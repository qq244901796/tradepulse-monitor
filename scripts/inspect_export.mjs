const DEBUG_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const TARGET_URL = process.env.TARGET_URL || 'https://app-trps.tradepulse.net/export';

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
  const requests = [];
  const responses = new Map();

  client.on('Network.requestWillBeSent', (event) => {
    const url = event.request?.url || '';
    if (!url.startsWith('http')) return;
    requests.push({
      id: event.requestId,
      method: event.request.method,
      type: event.type,
      url,
    });
  });

  client.on('Network.responseReceived', (event) => {
    const url = event.response?.url || '';
    if (!url.startsWith('http')) return;
    responses.set(event.requestId, {
      status: event.response.status,
      mimeType: event.response.mimeType,
      type: event.type,
      url,
    });
  });

  await client.call('Page.enable');
  await client.call('Runtime.enable');
  await client.call('Network.enable');
  await client.call('Page.navigate', { url: TARGET_URL });
  await sleep(7000);

  const { result } = await client.call('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: `(() => {
      const trim = (value, max = 220) => String(value || '').replace(/\\s+/g, ' ').trim().slice(0, max);
      const pick = (nodes, mapper, max = 80) => Array.from(nodes).slice(0, max).map(mapper).filter(Boolean);
      const visible = (el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        h1: pick(document.querySelectorAll('h1'), (el) => trim(el.innerText)),
        headings: pick(document.querySelectorAll('h1,h2,h3,[role="heading"]'), (el) => trim(el.innerText), 120),
        nav: pick(document.querySelectorAll('nav a, aside a, header a, [role="navigation"] a'), (el) => ({
          text: trim(el.innerText || el.getAttribute('aria-label')),
          href: el.href,
        }), 120),
        buttons: pick(document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]'), (el) => visible(el) ? ({
          text: trim(el.innerText || el.value || el.getAttribute('aria-label')),
          type: el.type || '',
          disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
        }) : null, 160),
        inputs: pick(document.querySelectorAll('input,select,textarea'), (el) => visible(el) ? ({
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          name: el.name || '',
          id: el.id || '',
          placeholder: el.placeholder || '',
          value: el.type === 'password' ? '' : trim(el.value, 80),
          checked: el.type === 'radio' || el.type === 'checkbox' ? el.checked : undefined,
          label: (() => {
            if (el.id) {
              const label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
              if (label) return trim(label.innerText);
            }
            return trim(el.closest('label')?.innerText || el.parentElement?.innerText || '');
          })(),
          options: el.tagName === 'SELECT' ? Array.from(el.options).slice(0, 20).map((option) => trim(option.text)) : undefined,
        }) : null, 120),
        tables: pick(document.querySelectorAll('table'), (table) => ({
          headers: pick(table.querySelectorAll('th'), (th) => trim(th.innerText), 80),
          firstRows: pick(table.querySelectorAll('tr'), (tr) => pick(tr.children, (td) => trim(td.innerText), 20), 8),
        }), 20),
        bodyText: trim(document.body.innerText, 6000),
        scripts: pick(document.scripts, (script) => script.src, 80),
        storageKeys: {
          localStorage: Object.keys(localStorage),
          sessionStorage: Object.keys(sessionStorage),
        },
      };
    })()`,
  });

  const pageData = result.value;
  const network = requests.map((request) => ({
    method: request.method,
    type: request.type,
    status: responses.get(request.id)?.status ?? null,
    mimeType: responses.get(request.id)?.mimeType ?? null,
    url: request.url,
  }));

  console.log(JSON.stringify({ page: pageData, network }, null, 2));
  client.close();
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
