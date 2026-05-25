const DEBUG_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const TARGET_URL = process.env.TARGET_URL || 'https://app-trps.tradepulse.net/export';
const DOWNLOAD_PATH = process.env.DOWNLOAD_PATH || 'D:\\tradepulse\\downloads';
const TICKER = process.env.TICKER || 'AAPL';
const FROM_DATE = process.env.FROM_DATE || '2026-05-21';
const TO_DATE = process.env.TO_DATE || '2026-05-21';
const DATA_TYPE = process.env.DATA_TYPE || 'type-0';

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function findPage() {
  const pages = await getJson(`${DEBUG_URL}/json/list`);
  const page = pages.find((item) => item.type === 'page' && item.url.includes('app-trps.tradepulse.net'))
    || pages.find((item) => item.type === 'page' && !item.url.startsWith('chrome://'));
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`未找到可调试页面，请先用调试端口启动 Chrome：${DEBUG_URL}`);
  }
  return page;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
      return;
    }
    if (message.method && listeners.has(message.method)) {
      for (const listener of listeners.get(message.method)) listener(message.params || {});
    }
  });

  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      resolve({
        call(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCall, rejectCall) => {
            pending.set(id, { resolve: resolveCall, reject: rejectCall });
            setTimeout(() => {
              if (pending.has(id)) {
                pending.delete(id);
                rejectCall(new Error(`${method} timed out`));
              }
            }, 25000);
          });
        },
        on(method, listener) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push(listener);
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener('error', reject);
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusLine(ok, text) {
  return `${ok ? 'PASS' : 'FAIL'} ${text}`;
}

async function main() {
  const page = await findPage();
  const client = await connect(page.webSocketDebuggerUrl);
  const requests = new Map();
  const downloads = [];
  const checks = [];

  client.on('Network.requestWillBeSent', (event) => {
    const url = event.request?.url || '';
    if (!url.startsWith('http')) return;
    requests.set(event.requestId, {
      method: event.request.method,
      type: event.type,
      url,
      status: null,
      mimeType: null,
    });
  });

  client.on('Network.responseReceived', (event) => {
    if (!requests.has(event.requestId)) return;
    const request = requests.get(event.requestId);
    request.status = event.response.status;
    request.mimeType = event.response.mimeType;
    request.type = event.type;
  });

  client.on('Page.downloadWillBegin', (event) => {
    downloads.push({
      url: event.url,
      suggestedFilename: event.suggestedFilename,
      guid: event.guid,
      state: 'willBegin',
      receivedBytes: 0,
      totalBytes: 0,
    });
  });

  client.on('Page.downloadProgress', (event) => {
    const download = downloads.find((item) => item.guid === event.guid);
    if (!download) return;
    download.state = event.state;
    download.receivedBytes = event.receivedBytes;
    download.totalBytes = event.totalBytes;
  });

  await client.call('Page.enable');
  await client.call('Runtime.enable');
  await client.call('Network.enable');
  await client.call('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_PATH,
    eventsEnabled: true,
  }).catch(() => client.call('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_PATH,
  }));

  await client.call('Page.navigate', { url: TARGET_URL });
  await sleep(7000);

  const snapshot = await client.call('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => ({
      url: location.href,
      title: document.title,
      redirectedToLogin: location.hostname === 'auth0.tradepulse.net' || /sign in/i.test(document.title),
      hasTicker: Boolean(document.querySelector('#ticker')),
      dateCount: document.querySelectorAll('input[type="date"]').length,
      hasType0: Boolean(document.querySelector('#type-0')),
      hasType1: Boolean(document.querySelector('#type-1')),
      hasType2: Boolean(document.querySelector('#type-2')),
      hasExportButton: Array.from(document.querySelectorAll('button')).some((el) => /export/i.test(el.innerText || '')),
      bodyText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 500)
    }))()`,
  });

  const pageState = snapshot.result.value;
  checks.push({
    ok: pageState.url === TARGET_URL && !pageState.redirectedToLogin,
    text: `已登录访问 ${TARGET_URL}`,
  });
  checks.push({
    ok: pageState.title === 'Data Export - TradePulse',
    text: `页面标题为 Data Export - TradePulse`,
  });
  checks.push({
    ok: pageState.hasTicker && pageState.dateCount >= 2 && pageState.hasType0 && pageState.hasType1 && pageState.hasType2 && pageState.hasExportButton,
    text: '导出表单元素完整',
  });

  const clickResult = await client.call('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(() => {
      const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const ticker = document.querySelector('#ticker');
      const dates = Array.from(document.querySelectorAll('input[type="date"]'));
      const type = document.querySelector('#${DATA_TYPE}');
      const button = Array.from(document.querySelectorAll('button')).find((el) => /export/i.test(el.innerText || ''));
      if (!ticker || dates.length < 2 || !type || !button) return { ok: false };
      setValue(ticker, '${TICKER}');
      setValue(dates[0], '${FROM_DATE}');
      setValue(dates[1], '${TO_DATE}');
      type.click();
      button.click();
      return { ok: true, ticker: ticker.value, dates: dates.map((el) => el.value), selectedType: type.id };
    })()`,
  });

  checks.push({
    ok: clickResult.result.value?.ok === true,
    text: `触发导出：${TICKER} ${FROM_DATE} 至 ${TO_DATE}`,
  });

  await sleep(10000);

  const expectedExportPath = `/api/export?symbol=${encodeURIComponent(TICKER)}&sdate=${FROM_DATE.replaceAll('-', '')}&edate=${TO_DATE.replaceAll('-', '')}&type=${DATA_TYPE.replace('type-', '')}`;
  const apiRequests = Array.from(requests.values());
  const auth = apiRequests.find((request) => request.url === 'https://app-trps.tradepulse.net/api/auth/me');
  const exportRequest = apiRequests.find((request) => request.url.includes(expectedExportPath));
  const completedDownload = downloads.find((download) => download.state === 'completed' && download.receivedBytes > 0);

  checks.push({
    ok: auth?.status === 200,
    text: '鉴权接口 /api/auth/me 返回 200',
  });
  checks.push({
    ok: exportRequest?.status === 200 && exportRequest?.mimeType === 'text/csv',
    text: `导出接口返回 CSV：${expectedExportPath}`,
  });
  checks.push({
    ok: Boolean(completedDownload),
    text: completedDownload
      ? `CSV 下载完成：${completedDownload.suggestedFilename} (${completedDownload.receivedBytes} bytes)`
      : 'CSV 下载完成',
  });

  const ok = checks.every((check) => check.ok);
  for (const check of checks) console.log(statusLine(check.ok, check.text));
  console.log('');
  console.log(`Result: ${ok ? 'OK' : 'FAILED'}`);

  if (!ok) {
    console.log('');
    console.log('诊断信息：');
    console.log(JSON.stringify({
      page: pageState,
      exportRequest,
      downloads,
      relevantNetwork: apiRequests.filter((request) => (
        request.url.includes('/api/')
        || request.url.includes('.do')
        || request.url.includes('/export')
      )),
    }, null, 2));
    process.exitCode = 1;
  }

  client.close();
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
