import fs from 'node:fs';
import path from 'node:path';

const DEBUG_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const TARGET_URL = process.env.TARGET_URL || 'https://app-trps.tradepulse.net/export';
const CONFIG_PATH = process.env.CONFIG_PATH || 'config/tradepulse-watchlist.json';
const DATE = process.env.DATE || '';

function readConfig() {
  const fallback = {
    symbols: ['AAPL'],
    lookbackMinutes: 30,
    minBuyScoreForEntry: 45,
    minBuyScoreForStrongEntry: 70,
  };

  let config = fallback;
  const fullPath = path.resolve(CONFIG_PATH);
  if (fs.existsSync(fullPath)) {
    config = { ...fallback, ...JSON.parse(fs.readFileSync(fullPath, 'utf8')) };
  }

  if (process.env.SYMBOLS) {
    config.symbols = process.env.SYMBOLS.split(',').map((item) => item.trim()).filter(Boolean);
  }

  config.symbols = [...new Set(config.symbols.map((item) => item.trim().toUpperCase()).filter(Boolean))];
  return config;
}

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
    throw new Error(`No debuggable page found at ${DEBUG_URL}. Start/login Chrome first.`);
  }
  return page;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result || {});
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
            }, 30000);
          });
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

function csvParse(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim().replace(/\s+/g, ' '));
  return rows.slice(1)
    .filter((items) => items.some((item) => item.trim()))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index]?.trim() || ''])));
}

function num(value) {
  const parsed = Number(String(value || '').replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => `${a.DATE} ${a.TIME}`.localeCompare(`${b.DATE} ${b.TIME}`));
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + num(row[field]), 0);
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
}

function classifySymbol(symbol, rows, powerInflows, config, date) {
  const sorted = sortRows(rows);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const recent = sorted.slice(-config.lookbackMinutes);
  const powerHit = powerInflows.find((row) => String(row.SYMBOL || '').toUpperCase() === symbol);
  const pwrMinutes = sorted.filter((row) => num(row['PWR INFLOW']) > 0);

  if (!first || !last) {
    return {
      symbol,
      date,
      signal: 'NO_DATA',
      buyScore: 0,
      sellScore: 0,
      reasons: ['No export rows returned for this symbol/date.'],
      metrics: {},
    };
  }

  const totalLarge = sum(sorted, 'LARGE DEAL');
  const absLarge = sorted.reduce((total, row) => total + Math.abs(num(row['LARGE DEAL'])), 0);
  const recentLarge = sum(recent, 'LARGE DEAL');
  const recentAbsLarge = recent.reduce((total, row) => total + Math.abs(num(row['LARGE DEAL'])), 0);
  const largeRatio = absLarge > 0 ? totalLarge / absLarge : 0;
  const recentLargeRatio = recentAbsLarge > 0 ? recentLarge / recentAbsLarge : 0;
  const firstPrice = num(first.PRICE);
  const lastPrice = num(last.PRICE);
  const priceChangePct = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const firstDailyAcc = num(first['DAILY ACC.']);
  const lastDailyAcc = num(last['DAILY ACC.']);
  const dailyAccDelta = lastDailyAcc - firstDailyAcc;
  const firstMomentumAcc = num(first['MOMENTUM ACC.']);
  const lastMomentumAcc = num(last['MOMENTUM ACC.']);
  const momentumAccDelta = lastMomentumAcc - firstMomentumAcc;
  const maxLarge = Math.max(...sorted.map((row) => num(row['LARGE DEAL'])));
  const minLarge = Math.min(...sorted.map((row) => num(row['LARGE DEAL'])));
  const avgAbsLarge = sorted.length ? absLarge / sorted.length : 0;

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (powerHit) {
    buyScore += 35;
    reasons.push(`Power Inflows list hit at ${powerHit.TIME}.`);
  }

  if (pwrMinutes.length > 0) {
    buyScore += Math.min(20, 8 + pwrMinutes.length * 2);
    reasons.push(`PWR INFLOW minute count ${pwrMinutes.length}.`);
  }

  if (largeRatio >= 0.2) {
    buyScore += 30;
    reasons.push(`Net LARGE DEAL is strongly positive (${fmt(largeRatio * 100, 1)}%).`);
  } else if (largeRatio >= 0.08) {
    buyScore += 18;
    reasons.push(`Net LARGE DEAL is positive (${fmt(largeRatio * 100, 1)}%).`);
  } else if (largeRatio <= -0.2) {
    sellScore += 30;
    reasons.push(`Net LARGE DEAL is strongly negative (${fmt(largeRatio * 100, 1)}%).`);
  } else if (largeRatio <= -0.08) {
    sellScore += 18;
    reasons.push(`Net LARGE DEAL is negative (${fmt(largeRatio * 100, 1)}%).`);
  }

  if (recentLargeRatio >= 0.25) {
    buyScore += 15;
    reasons.push(`Recent ${config.lookbackMinutes}m LARGE DEAL is strong (${fmt(recentLargeRatio * 100, 1)}%).`);
  } else if (recentLargeRatio >= 0.1) {
    buyScore += 8;
    reasons.push(`Recent ${config.lookbackMinutes}m LARGE DEAL is positive (${fmt(recentLargeRatio * 100, 1)}%).`);
  } else if (recentLargeRatio <= -0.25) {
    sellScore += 15;
    reasons.push(`Recent ${config.lookbackMinutes}m LARGE DEAL is weak (${fmt(recentLargeRatio * 100, 1)}%).`);
  } else if (recentLargeRatio <= -0.1) {
    sellScore += 8;
    reasons.push(`Recent ${config.lookbackMinutes}m LARGE DEAL is negative (${fmt(recentLargeRatio * 100, 1)}%).`);
  }

  if (lastDailyAcc > 0 && dailyAccDelta > 0) {
    buyScore += 12;
    reasons.push(`DAILY ACC. is positive and rising (${fmt(lastDailyAcc)}).`);
  } else if (dailyAccDelta > 0) {
    buyScore += 6;
    reasons.push('DAILY ACC. is improving intraday.');
  } else if (lastDailyAcc < 0 && dailyAccDelta < 0) {
    sellScore += 12;
    reasons.push(`DAILY ACC. is negative and falling (${fmt(lastDailyAcc)}).`);
  }

  if (lastMomentumAcc > 0 && momentumAccDelta > 0) {
    buyScore += 12;
    reasons.push(`MOMENTUM ACC. is positive and rising (${fmt(lastMomentumAcc)}).`);
  } else if (momentumAccDelta > 0) {
    buyScore += 6;
    reasons.push('MOMENTUM ACC. is improving intraday.');
  } else if (lastMomentumAcc < 0 && momentumAccDelta < 0) {
    sellScore += 12;
    reasons.push(`MOMENTUM ACC. is negative and falling (${fmt(lastMomentumAcc)}).`);
  }

  if (avgAbsLarge > 0 && maxLarge > avgAbsLarge * 3) {
    buyScore += 6;
    reasons.push(`Large positive block burst detected (${fmt(maxLarge)}).`);
  }
  if (avgAbsLarge > 0 && Math.abs(minLarge) > avgAbsLarge * 3) {
    sellScore += 6;
    reasons.push(`Large negative block burst detected (${fmt(minLarge)}).`);
  }

  if (priceChangePct >= 0.5) {
    buyScore += 5;
    reasons.push(`Price confirms upward move (${fmt(priceChangePct, 2)}%).`);
  } else if (priceChangePct <= -0.5) {
    sellScore += 5;
    reasons.push(`Price confirms downward move (${fmt(priceChangePct, 2)}%).`);
  }

  buyScore = Math.max(0, Math.min(100, buyScore));
  sellScore = Math.max(0, Math.min(100, sellScore));

  let signal = 'NEUTRAL';
  if (buyScore >= config.minBuyScoreForStrongEntry && buyScore >= sellScore + 10 && sellScore < 20) {
    signal = 'STRONG_ENTRY';
  } else if (buyScore >= config.minBuyScoreForStrongEntry && buyScore >= sellScore + 10) {
    signal = 'MIXED_ENTRY';
  } else if (buyScore >= config.minBuyScoreForEntry && buyScore >= sellScore) {
    signal = 'POSSIBLE_ENTRY';
  } else if (sellScore >= 45 && sellScore > buyScore) {
    signal = 'SELL_PRESSURE';
  }

  return {
    symbol,
    date,
    signal,
    buyScore,
    sellScore,
    reasons,
    metrics: {
      rows: sorted.length,
      firstTime: first.TIME,
      lastTime: last.TIME,
      firstPrice,
      lastPrice,
      priceChangePct,
      totalLargeDeal: totalLarge,
      largeDealRatio: largeRatio,
      recentLargeDeal: recentLarge,
      recentLargeDealRatio: recentLargeRatio,
      lastDailyAcc,
      dailyAccDelta,
      lastMomentumAcc,
      momentumAccDelta,
      maxLargeDeal: maxLarge,
      minLargeDeal: minLarge,
      powerInflowTime: powerHit?.TIME || '',
    },
  };
}

async function evaluateJson(client, expression) {
  const result = await client.call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression,
  });
  return result.result.value;
}

async function fetchTextFromPage(client, url) {
  return evaluateJson(client, `fetch(${JSON.stringify(url)}, { credentials: 'include' })
    .then(async (res) => ({ ok: res.ok, status: res.status, contentType: res.headers.get('content-type') || '', text: await res.text() }))`);
}

async function main() {
  const config = readConfig();
  if (config.symbols.length === 0) throw new Error('No symbols configured.');

  const page = await findPage();
  const client = await connect(page.webSocketDebuggerUrl);

  await client.call('Page.enable');
  await client.call('Runtime.enable');
  await client.call('Page.navigate', { url: TARGET_URL });
  await sleep(5000);

  const pageState = await evaluateJson(client, `({
    url: location.href,
    title: document.title,
    login: location.hostname === 'auth0.tradepulse.net' || /sign in/i.test(document.title)
  })`);

  if (pageState.login) {
    throw new Error('Chrome is not logged in to TradePulse. Login in the opened Chrome profile first.');
  }

  const enabledDates = await evaluateJson(client, `fetch('https://data1.tradepulse.net/daily.enable.do').then((res) => res.json())`);
  const date = DATE.replaceAll('-', '') || enabledDates[0];
  if (!date) throw new Error('Unable to determine latest enabled TradePulse date.');

  const startDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const symbolsParam = config.symbols.join(',');
  const exportUrl = `/api/export?symbol=${encodeURIComponent(symbolsParam)}&sdate=${date}&edate=${date}&type=0`;
  const powerUrl = `/api/export?symbol=*&sdate=${date}&edate=${date}&type=1`;

  const [dataResponse, powerResponse] = await Promise.all([
    fetchTextFromPage(client, exportUrl),
    fetchTextFromPage(client, powerUrl),
  ]);

  if (!dataResponse.ok) {
    throw new Error(`Stock export failed: HTTP ${dataResponse.status} ${dataResponse.text.slice(0, 200)}`);
  }
  if (!powerResponse.ok) {
    throw new Error(`Power inflow export failed: HTTP ${powerResponse.status} ${powerResponse.text.slice(0, 200)}`);
  }

  const stockRows = csvParse(dataResponse.text);
  const powerRows = csvParse(powerResponse.text);
  const rowsBySymbol = new Map(config.symbols.map((symbol) => [symbol, []]));

  for (const row of stockRows) {
    const symbol = String(row.SYMBOL || '').toUpperCase();
    if (rowsBySymbol.has(symbol)) rowsBySymbol.get(symbol).push(row);
  }

  const results = config.symbols.map((symbol) => classifySymbol(
    symbol,
    rowsBySymbol.get(symbol) || [],
    powerRows,
    config,
    startDate,
  ));

  console.log(`TradePulse institutional-flow scan`);
  console.log(`Date: ${startDate}`);
  console.log(`Symbols: ${config.symbols.join(', ')}`);
  console.log('');

  for (const result of results) {
    const metrics = result.metrics;
    console.log(`${result.symbol}  ${result.signal}  buy=${result.buyScore} sell=${result.sellScore}`);
    if (metrics.rows) {
      console.log(`  rows=${metrics.rows} time=${metrics.firstTime}-${metrics.lastTime} price=${fmt(metrics.firstPrice)}->${fmt(metrics.lastPrice)} (${fmt(metrics.priceChangePct, 2)}%)`);
      console.log(`  largeDeal=${fmt(metrics.totalLargeDeal)} ratio=${fmt(metrics.largeDealRatio * 100, 1)}% recent${config.lookbackMinutes}m=${fmt(metrics.recentLargeDeal)} (${fmt(metrics.recentLargeDealRatio * 100, 1)}%)`);
      console.log(`  dailyAcc=${fmt(metrics.lastDailyAcc)} delta=${fmt(metrics.dailyAccDelta)} momentumAcc=${fmt(metrics.lastMomentumAcc)} delta=${fmt(metrics.momentumAccDelta)}`);
    }
    for (const reason of result.reasons.slice(0, 5)) {
      console.log(`  - ${reason}`);
    }
    console.log('');
  }

  const outDir = path.resolve('reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `tradepulse-institutional-${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    date: startDate,
    generatedAt: new Date().toISOString(),
    config,
    page: pageState,
    source: {
      exportUrl,
      powerUrl,
      stockRows: stockRows.length,
      powerRows: powerRows.length,
    },
    results,
  }, null, 2));
  console.log(`Report: ${outPath}`);

  client.close();
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
