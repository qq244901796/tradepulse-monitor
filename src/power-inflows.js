import { toNumber } from '../packages/core/src/csv.js';

const SYMBOL_FIELDS = ['SYMBOL', 'Symbol', 'symbol', 'TICKER', 'Ticker', 'ticker'];
const NAME_FIELDS = ['NAME', 'Name', 'name', 'COMPANY', 'Company', 'company'];
const TIME_FIELDS = ['TIME', 'Time', 'time'];
const DATE_FIELDS = ['DATE', 'Date', 'date'];
const PRICE_FIELDS = ['PRICE', 'Price', 'price', 'LAST', 'Last', 'last', 'CLOSE', 'Close', 'close'];

export function normalizePowerInflowRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const normalized = [];

  for (const [index, row] of rows.entries()) {
    const symbol = firstValue(row, SYMBOL_FIELDS).toUpperCase();
    if (!symbol || symbol === '****' || seen.has(symbol)) continue;
    seen.add(symbol);
    normalized.push({
      rank: normalized.length + 1,
      sourceIndex: index,
      symbol,
      name: firstValue(row, NAME_FIELDS),
      date: firstValue(row, DATE_FIELDS),
      time: firstValue(row, TIME_FIELDS),
      price: toNumber(firstValue(row, PRICE_FIELDS)),
      raw: compactRaw(row),
    });
  }

  return normalized;
}

export function comparePowerInflowSnapshots(previousRows, currentRows) {
  if (!Array.isArray(previousRows) || !previousRows.length) {
    return {
      baseline: true,
      total: 0,
      entered: [],
      exited: [],
    };
  }

  const previous = new Map(previousRows.map((row) => [row.symbol, row]));
  const current = new Map(currentRows.map((row) => [row.symbol, row]));
  const entered = currentRows
    .filter((row) => !previous.has(row.symbol))
    .map((row) => ({ ...row, changeType: 'entered' }));
  const exited = previousRows
    .filter((row) => !current.has(row.symbol))
    .map((row) => ({ ...row, changeType: 'exited' }));

  return {
    baseline: false,
    total: entered.length,
    entered,
    exited,
  };
}

export function summarizePowerInflowChanges(changes, rows = []) {
  return {
    POWER_INFLOW_ROWS: rows.length || 0,
    POWER_INFLOW_ENTERED: changes?.entered?.length || 0,
    POWER_INFLOW_EXITED: changes?.exited?.length || 0,
    POWER_INFLOW_EMAIL_TRIGGERED: changes?.entered?.length || 0,
  };
}

export function buildPowerInflowEmail({ generatedAt, tradeDate, entered }) {
  const symbols = entered.map((row) => row.symbol).join(', ');
  const lines = [
    `TradePulse Power Inflows 新进榜`,
    ``,
    `扫描时间: ${generatedAt}`,
    `数据日期: ${tradeDate}`,
    `新进榜股票: ${symbols || '-'}`,
    ``,
    ...entered.map((row) => [
      `${row.symbol}${row.name ? ` - ${row.name}` : ''}`,
      `  时间: ${row.time || '-'}`,
      `  价格: ${Number.isFinite(row.price) && row.price !== 0 ? row.price : '-'}`,
    ].join('\n')),
    ``,
    `本地页面: http://127.0.0.1:14587`,
  ];

  return {
    subject: `TradePulse Power Inflows 新进榜：${symbols || '-'}`,
    text: lines.join('\n'),
  };
}

function firstValue(row, fields) {
  for (const field of fields) {
    const value = row?.[field];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function compactRaw(row) {
  return Object.fromEntries(Object.entries(row || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .slice(0, 40));
}
