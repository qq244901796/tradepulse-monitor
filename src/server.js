import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig } from './config.js';
import { MonitorService } from './monitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const coreDir = path.join(rootDir, 'packages/core/src');

const initialConfig = loadConfig(rootDir).config;
const host = process.env.HOST || initialConfig.server.host || '127.0.0.1';
const port = Number(process.env.PORT || initialConfig.server.port || 14587);
const monitor = new MonitorService({ rootDir });

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
    });
  }
});

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

  if (req.method === 'OPTIONS') {
    sendNoContent(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    sendJson(res, 200, monitor.getStatus());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/results') {
    sendJson(res, 200, monitor.getResults() || null);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/history') {
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
    sendJson(res, 200, monitor.getHistory(limit));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/config-public') {
    sendJson(res, 200, monitor.getStatus().publicConfig);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/config') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        errors: [error.message],
      });
      return;
    }
    const currentConfig = loadConfig(rootDir).config;
    if (
      body?.account
      && String(body.account.password || '') === ''
      && currentConfig.account.password
    ) {
      body = {
        ...body,
        account: {
          ...body.account,
          password: currentConfig.account.password,
        },
      };
    }
    const saved = saveConfig(rootDir, body);
    if (!saved.ok) {
      sendJson(res, 400, {
        ok: false,
        errors: saved.errors,
      });
      return;
    }
    const status = monitor.reloadConfig();
    sendJson(res, 200, {
      ok: true,
      configPath: saved.configPath,
      status,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/language') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        errors: [error.message],
      });
      return;
    }

    const current = loadConfig(rootDir).config;
    current.ui = {
      ...(current.ui || {}),
      language: body.language,
    };
    const saved = saveConfig(rootDir, current);
    if (!saved.ok) {
      sendJson(res, 400, {
        ok: false,
        errors: saved.errors,
      });
      return;
    }

    const status = monitor.reloadConfig({ scan: false });
    sendJson(res, 200, {
      ok: true,
      status,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/scan-now') {
    const result = await monitor.scanNow('manual');
    sendJson(res, result.ok ? 200 : result.busy ? 409 : 400, result);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/reload-config') {
    sendJson(res, 200, monitor.reloadConfig());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/shutdown') {
    sendJson(res, 200, {
      ok: true,
      message: 'Server is shutting down.',
    });
    setTimeout(() => {
      monitor.stop();
      server.close(() => process.exit(0));
    }, 100);
    return;
  }

  if (req.method === 'GET') {
    if (url.pathname.startsWith('/core/')) {
      await serveStaticFrom(url.pathname.replace(/^\/core/, ''), coreDir, res);
      return;
    }
    await serveStatic(url.pathname, res);
    return;
  }

  sendJson(res, 405, {
    ok: false,
    error: 'Method not allowed.',
  });
}

async function readJsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024 * 1024) {
      throw new Error('Request body is too large.');
    }
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON body: ${error.message}`);
  }
}

async function serveStatic(pathname, res) {
  return serveStaticFrom(pathname, publicDir, res);
}

async function serveStaticFrom(pathname, baseDir, res) {
  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const requestedPath = path.normalize(decodeURIComponent(normalizedPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(baseDir, requestedPath);
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);

  if (!resolved.startsWith(resolvedBase)) {
    sendJson(res, 403, { ok: false, error: 'Forbidden.' });
    return;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    sendJson(res, 404, { ok: false, error: 'Not found.' });
    return;
  }

  res.writeHead(200, {
    'content-type': contentType(resolved),
    'cache-control': 'no-store',
  });
  fs.createReadStream(resolved).pipe(res);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': 'http://127.0.0.1',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendNoContent(res) {
  res.writeHead(204, {
    'access-control-allow-origin': 'http://127.0.0.1',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end();
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

server.listen(port, host, () => {
  monitor.start();
  console.log(`TradePulse Monitor: http://${host}:${port}`);
});

process.on('SIGINT', () => {
  monitor.stop();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  monitor.stop();
  server.close(() => process.exit(0));
});
