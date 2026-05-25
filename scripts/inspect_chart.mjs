import fs from 'node:fs';
import path from 'node:path';

const DEBUG_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const TARGET_URL = process.env.TARGET_URL || 'https://app-trps.tradepulse.net/chart';
const SYMBOL = process.env.SYMBOL || process.env.TICKER || 'AAPL';
const REPORT_PATH = process.env.REPORT_PATH || path.resolve('reports/chart-api-discovery.json');

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

async function findPage() {
  const pages = await getJson(`${DEBUG_URL}/json/list`);
  const appPage = pages.find((page) => page.type === 'page' && page.url.includes('app-trps.tradepulse.net'));
  const normalPage = pages.find((page) => page.type === 'page' && !page.url.startsWith('chrome://'));
  const page = appPage || normalPage;
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No debuggable Chrome page found. Start Chrome with scripts/start_tradepulse_chrome.ps1 first.`);
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

function isInterestingNetworkItem(item) {
  return (
    item.url.includes('/api/')
    || item.url.includes('/chart')
    || item.url.includes('.do')
    || item.url.includes('data1.tradepulse.net')
    || item.mimeType?.includes('json')
    || item.mimeType?.includes('csv')
  );
}

function truncateBody(body, max = 20000) {
  if (!body) return '';
  return body.length > max ? `${body.slice(0, max)}\n/* truncated ${body.length - max} chars */` : body;
}

async function captureSnapshot(client, label) {
  const { result } = await client.call('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(() => {
      const trim = (value, max = 240) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const pick = (nodes, mapper, max = 120) => Array.from(nodes).slice(0, max).map(mapper).filter(Boolean);
      const globals = ['Highcharts', 'echarts', 'Chart', 'ApexCharts', 'Plotly']
        .filter((name) => Boolean(window[name]));
      return {
        label: ${JSON.stringify(label)},
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        bodyText: trim(document.body.innerText, 5000),
        headings: pick(document.querySelectorAll('h1,h2,h3,[role="heading"]'), (el) => trim(el.innerText)),
        inputs: pick(document.querySelectorAll('input,select,textarea'), (el) => visible(el) ? ({
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          id: el.id || '',
          name: el.name || '',
          placeholder: el.placeholder || '',
          value: el.type === 'password' ? '' : trim(el.value, 120),
          options: el.tagName === 'SELECT' ? Array.from(el.options).slice(0, 30).map((option) => trim(option.text)) : undefined,
          label: (() => {
            if (el.id) {
              const found = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
              if (found) return trim(found.innerText);
            }
            return trim(el.closest('label')?.innerText || el.parentElement?.innerText || '');
          })()
        }) : null),
        buttons: pick(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]'), (el) => visible(el) ? ({
          text: trim(el.innerText || el.value || el.getAttribute('aria-label')),
          id: el.id || '',
          name: el.name || '',
          disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true')
        }) : null),
        links: pick(document.querySelectorAll('a[href]'), (el) => visible(el) ? ({
          text: trim(el.innerText || el.getAttribute('aria-label')),
          href: el.href
        }) : null),
        canvases: pick(document.querySelectorAll('canvas'), (canvas) => {
          const rect = canvas.getBoundingClientRect();
          return {
            width: canvas.width,
            height: canvas.height,
            clientWidth: Math.round(rect.width),
            clientHeight: Math.round(rect.height),
            className: canvas.className || ''
          };
        }),
        svgs: pick(document.querySelectorAll('svg'), (svg) => {
          const rect = svg.getBoundingClientRect();
          return {
            clientWidth: Math.round(rect.width),
            clientHeight: Math.round(rect.height),
            text: trim(svg.innerText || svg.textContent, 500)
          };
        }, 20),
        scripts: pick(document.scripts, (script) => script.src, 100),
        storageKeys: {
          localStorage: Object.keys(localStorage),
          sessionStorage: Object.keys(sessionStorage)
        },
        chartGlobals: globals
      };
    })()`,
  });
  return result.value;
}

async function trySetSymbol(client) {
  const { result } = await client.call('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(() => {
      const symbol = ${JSON.stringify(SYMBOL)};
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const scoreInput = (el) => {
        const text = [el.id, el.name, el.placeholder, el.getAttribute('aria-label'), el.closest('label')?.innerText, el.parentElement?.innerText]
          .join(' ')
          .toLowerCase();
        if (/symbol|ticker|stock|code|search/.test(text)) return 10;
        if (el.type === 'text' || el.type === 'search') return 3;
        return 0;
      };
      const input = Array.from(document.querySelectorAll('input'))
        .filter((el) => visible(el) && !['password', 'hidden', 'checkbox', 'radio', 'date'].includes(el.type))
        .sort((a, b) => scoreInput(b) - scoreInput(a))[0];
      if (!input) return { ok: false, reason: 'no visible symbol input' };

      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(input, symbol);
      else input.value = symbol;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

      const button = Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]'))
        .filter((el) => visible(el) && !el.disabled)
        .find((el) => /search|chart|apply|submit|load|go|查询|搜索|图表|应用/.test(String(el.innerText || el.value || '').toLowerCase()));
      if (button) button.click();

      return {
        ok: true,
        input: {
          id: input.id || '',
          name: input.name || '',
          placeholder: input.placeholder || '',
          value: input.value
        },
        clickedButton: button ? String(button.innerText || button.value || '') : ''
      };
    })()`,
  });
  return result.value;
}

async function main() {
  const page = await findPage();
  const client = await connect(page.webSocketDebuggerUrl);
  const requests = new Map();
  const consoleMessages = [];

  client.on('Network.requestWillBeSent', (event) => {
    const url = event.request?.url || '';
    if (!url.startsWith('http')) return;
    requests.set(event.requestId, {
      id: event.requestId,
      method: event.request.method,
      type: event.type,
      url,
      requestHeaders: event.request.headers || {},
      status: null,
      mimeType: null,
      responseHeaders: {},
      body: null,
      bodyBase64Encoded: false,
    });
  });

  client.on('Network.responseReceived', (event) => {
    const item = requests.get(event.requestId);
    if (!item) return;
    item.status = event.response.status;
    item.mimeType = event.response.mimeType;
    item.type = event.type;
    item.responseHeaders = event.response.headers || {};
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
  await client.call('Page.navigate', { url: TARGET_URL });
  await sleep(8000);

  const before = await captureSnapshot(client, 'initial');
  const interaction = await trySetSymbol(client);
  await sleep(8000);
  const after = await captureSnapshot(client, 'after-symbol');

  const network = Array.from(requests.values()).filter(isInterestingNetworkItem);
  for (const item of network) {
    if (!item.status || item.status >= 400) continue;
    if (!isInterestingNetworkItem(item)) continue;
    try {
      const body = await client.call('Network.getResponseBody', { requestId: item.id });
      item.body = truncateBody(body.body || '');
      item.bodyBase64Encoded = Boolean(body.base64Encoded);
    } catch (error) {
      item.bodyError = error.message;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    symbol: SYMBOL,
    page: {
      before,
      interaction,
      after,
    },
    network,
    likelyDataEndpoints: network
      .filter((item) => item.status && item.status < 400)
      .filter((item) => item.mimeType?.includes('json') || item.url.includes('/api/') || item.url.includes('.do')),
    consoleMessages: consoleMessages.slice(-80),
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Chart discovery report written: ${REPORT_PATH}`);
  console.log(`Likely data endpoints: ${report.likelyDataEndpoints.length}`);
  client.close();
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
