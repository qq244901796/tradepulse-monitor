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
  if (!page?.webSocketDebuggerUrl) throw new Error('No debuggable page found');
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
            }, 20000);
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

async function main() {
  const page = await findPage();
  const client = await connect(page.webSocketDebuggerUrl);
  const requests = new Map();
  const downloads = [];
  const consoleMessages = [];

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
    });
  });

  client.on('Page.downloadProgress', (event) => {
    const download = downloads.find((item) => item.guid === event.guid);
    if (download) {
      download.state = event.state;
      download.receivedBytes = event.receivedBytes;
      download.totalBytes = event.totalBytes;
    }
  });

  client.on('Runtime.consoleAPICalled', (event) => {
    consoleMessages.push({
      type: event.type,
      text: event.args?.map((arg) => arg.value || arg.description || '').join(' '),
    });
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

  const before = await client.call('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      url: location.href,
      title: document.title,
      ticker: document.querySelector('#ticker')?.value || '',
      dates: Array.from(document.querySelectorAll('input[type="date"]')).map((el) => el.value),
      selectedType: Array.from(document.querySelectorAll('input[name="data-type"]')).find((el) => el.checked)?.id || ''
    })`,
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
      if (!ticker || dates.length < 2 || !type || !button) {
        return { ok: false, reason: 'missing form element' };
      }
      setValue(ticker, '${TICKER}');
      setValue(dates[0], '${FROM_DATE}');
      setValue(dates[1], '${TO_DATE}');
      type.click();
      button.click();
      return {
        ok: true,
        ticker: ticker.value,
        dates: dates.map((el) => el.value),
        selectedType: Array.from(document.querySelectorAll('input[name="data-type"]')).find((el) => el.checked)?.id || '',
        buttonText: button.innerText
      };
    })()`,
  });

  await sleep(10000);

  const after = await client.call('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      url: location.href,
      title: document.title,
      bodyText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 1200)
    })`,
  });

  const network = Array.from(requests.values()).filter((request) => (
    request.url.includes('/api/')
    || request.url.includes('.do')
    || request.url.includes('export')
    || request.mimeType === 'text/csv'
    || request.mimeType === 'application/octet-stream'
  ));

  console.log(JSON.stringify({
    before: before.result.value,
    click: clickResult.result.value,
    after: after.result.value,
    downloads,
    network,
    consoleMessages: consoleMessages.slice(-20),
  }, null, 2));

  client.close();
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
