import { toNumber } from '../packages/core/src/csv.js';

export const TOPFLOWS_TYPES = {
  ALL: 0,
  NYSE: 1,
  NASDAQ: 2,
  ETF: 3,
};

const TOPFLOWS_LABELS = new Map(Object.entries(TOPFLOWS_TYPES).map(([label, type]) => [type, label]));

export function normalizeTopFlowsType(value) {
  const type = Number(value);
  return TOPFLOWS_LABELS.has(type) ? type : TOPFLOWS_TYPES.ALL;
}

export function topFlowsTypeLabel(type) {
  return TOPFLOWS_LABELS.get(normalizeTopFlowsType(type)) || 'ALL';
}

export function normalizeTopFlowRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      rank: index + 1,
      symbol: String(row.s || '').trim().toUpperCase(),
      name: String(row.n || '').trim(),
      price: toNumber(row.p),
      changePct: toNumber(row.c),
      score: toNumber(row.sc),
      momentum: toNumber(row.m),
      daily: toNumber(row.d),
      largeDeal: toNumber(row.l),
      minutes: toNumber(row.t),
    }))
    .filter((row) => row.symbol && row.symbol !== '****');
}

export function compareTopFlowSnapshots(previousRows, currentRows) {
  if (!Array.isArray(previousRows) || !previousRows.length) {
    return {
      baseline: true,
      total: 0,
      entered: [],
      exited: [],
      rankChanged: [],
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
  const rankChanged = currentRows
    .filter((row) => {
      const old = previous.get(row.symbol);
      return old && old.rank !== row.rank;
    })
    .map((row) => ({
      ...row,
      changeType: 'rankChanged',
      previousRank: previous.get(row.symbol).rank,
    }));

  return {
    baseline: false,
    total: entered.length + exited.length + rankChanged.length,
    entered,
    exited,
    rankChanged,
  };
}

export function summarizeTopFlowChanges(changes) {
  return {
    TOPFLOWS_ENTERED: changes?.entered?.length || 0,
    TOPFLOWS_EXITED: changes?.exited?.length || 0,
    TOPFLOWS_RANK_CHANGED: changes?.rankChanged?.length || 0,
    TOPFLOWS_TOTAL_CHANGES: changes?.total || 0,
  };
}
