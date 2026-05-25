import { formatNumber, toNumber } from './csv.js';

const ENTRY_SIGNALS = new Set(['STRONG_ENTRY', 'MIXED_ENTRY', 'POSSIBLE_ENTRY']);

function reason(code, params = {}) {
  return { code, params };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 100) return Number(value.toFixed(2));
  if (value >= 10) return Number(value.toFixed(3));
  return Number(value.toFixed(4));
}

function avg(values) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function weightedAverage(items) {
  let weighted = 0;
  let weightTotal = 0;
  for (const item of items) {
    if (!Number.isFinite(item.price) || item.price <= 0 || !Number.isFinite(item.weight) || item.weight <= 0) continue;
    weighted += item.price * item.weight;
    weightTotal += item.weight;
  }
  return weightTotal > 0 ? weighted / weightTotal : 0;
}

function normalizeSettings(config = {}) {
  const settings = config.pricePlan || {};
  return {
    enabled: settings.enabled !== false,
    pullbackTolerancePct: Number.isFinite(Number(settings.pullbackTolerancePct))
      ? clamp(Number(settings.pullbackTolerancePct), 0.1, 5)
      : 0.8,
    stopBufferPct: Number.isFinite(Number(settings.stopBufferPct))
      ? clamp(Number(settings.stopBufferPct), 0.1, 10)
      : 1.5,
    minConfidence: Number.isFinite(Number(settings.minConfidence))
      ? clamp(Number(settings.minConfidence), 0, 100)
      : 60,
  };
}

export function buildPricePlan({
  symbol,
  rows,
  chartRows = [],
  signal,
  buyScore,
  sellScore,
  config,
}) {
  const settings = normalizeSettings(config);
  if (!settings.enabled) {
    return {
      enabled: false,
      status: 'DISABLED',
      source: 'none',
      confidenceScore: 0,
      actionable: false,
      reasons: [reason('price_plan_disabled')],
    };
  }

  const normalizedChartRows = normalizePriceRows(chartRows);
  const sourceRows = normalizedChartRows.length ? normalizedChartRows : normalizePriceRows(rows);

  if (!sourceRows.length) {
    return {
      enabled: true,
      status: 'NO_DATA',
      source: 'none',
      confidenceScore: 0,
      actionable: false,
      reasons: [reason('price_plan_no_data')],
    };
  }

  const source = normalizedChartRows.length ? 'chart' : 'export';
  const first = sourceRows[0];
  const last = sourceRows[sourceRows.length - 1];
  const recent = sourceRows.slice(-Math.min(sourceRows.length, Math.max(5, config.monitor?.lookbackMinutes || 30)));
  const prices = sourceRows.map((row) => row.price).filter((value) => value > 0);
  const recentPrices = recent.map((row) => row.price).filter((value) => value > 0);
  const institutionalRows = sourceRows.filter((row) => row.largeDeal > 0 || row.powerInflow > 0);
  const institutionalRecent = recent.filter((row) => row.largeDeal > 0 || row.powerInflow > 0);
  const institutionalVwap = weightedAverage(
    institutionalRows.map((row) => ({
      price: row.price,
      weight: Math.max(row.largeDeal, 0) + Math.max(row.powerInflow, 0),
    })),
  );
  const allVwap = weightedAverage(
    sourceRows.map((row) => ({
      price: row.price,
      weight: Math.abs(row.largeDeal) || 1,
    })),
  );
  const anchorPrice = institutionalVwap || allVwap || avg(recentPrices) || last.price;
  const recentLow = Math.min(...recentPrices);
  const recentHigh = Math.max(...recentPrices);
  const dayLow = Math.min(...prices);
  const dayHigh = Math.max(...prices);
  const institutionalLow = institutionalRows.length
    ? Math.min(...institutionalRows.map((row) => row.price).filter((value) => value > 0))
    : 0;
  const support = Math.max(
    0,
    Math.min(
      ...[recentLow, institutionalLow || recentLow, anchorPrice].filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
  const tolerance = settings.pullbackTolerancePct / 100;
  const stopBuffer = settings.stopBufferPct / 100;
  const buyZoneLow = support ? support * (1 - tolerance) : anchorPrice * (1 - tolerance);
  const buyZoneHigh = anchorPrice * (1 + tolerance);
  const confirmBreakoutPrice = Math.max(recentHigh, last.price, anchorPrice) * (1 + tolerance / 2);
  const riskStopPrice = (support || anchorPrice) * (1 - stopBuffer);
  const largeTotal = sourceRows.reduce((total, row) => total + row.largeDeal, 0);
  const largeAbs = sourceRows.reduce((total, row) => total + Math.abs(row.largeDeal), 0);
  const recentLargeTotal = recent.reduce((total, row) => total + row.largeDeal, 0);
  const recentLargeAbs = recent.reduce((total, row) => total + Math.abs(row.largeDeal), 0);
  const largeRatio = largeAbs > 0 ? largeTotal / largeAbs : 0;
  const recentLargeRatio = recentLargeAbs > 0 ? recentLargeTotal / recentLargeAbs : 0;
  const priceChangePct = first.price ? ((last.price - first.price) / first.price) * 100 : 0;

  const planReasons = [];
  let confidence = Math.max(0, buyScore - Math.max(0, sellScore * 0.45));

  if (ENTRY_SIGNALS.has(signal)) {
    confidence += 10;
    planReasons.push(reason('price_plan_entry_signal', { signal }));
  }
  if (institutionalRows.length) {
    confidence += Math.min(15, 5 + institutionalRows.length);
    planReasons.push(reason('price_plan_institutional_anchor', {
      count: institutionalRows.length,
      price: formatNumber(anchorPrice, 2),
    }));
  }
  if (institutionalRecent.length) {
    confidence += 8;
    planReasons.push(reason('price_plan_recent_buying', { count: institutionalRecent.length }));
  }
  if (largeRatio > 0.12) {
    confidence += 8;
    planReasons.push(reason('price_plan_large_deal_positive', { ratio: formatNumber(largeRatio * 100, 1) }));
  }
  if (recentLargeRatio > 0.12) {
    confidence += 8;
    planReasons.push(reason('price_plan_recent_large_positive', { ratio: formatNumber(recentLargeRatio * 100, 1) }));
  }
  if (priceChangePct > 0.3) {
    confidence += 4;
    planReasons.push(reason('price_plan_price_confirming', { pct: formatNumber(priceChangePct, 2) }));
  }
  if (sellScore >= buyScore || signal === 'SELL_PRESSURE') {
    confidence -= 30;
    planReasons.push(reason('price_plan_sell_pressure'));
  }
  if (last.price > 0 && last.price > confirmBreakoutPrice * 1.03) {
    confidence -= 8;
    planReasons.push(reason('price_plan_extended'));
  }

  confidence = Math.round(clamp(confidence, 0, 100));
  const status = confidence >= settings.minConfidence && ENTRY_SIGNALS.has(signal)
    ? 'READY'
    : confidence >= settings.minConfidence
      ? 'WATCH'
      : 'LOW_CONFIDENCE';

  if (!planReasons.length) {
    planReasons.push(reason('price_plan_wait_confirmation'));
  }

  return {
    enabled: true,
    status,
    source,
    actionable: status === 'READY',
    watchPrice: roundPrice(anchorPrice),
    buyZoneLow: roundPrice(Math.min(buyZoneLow, buyZoneHigh)),
    buyZoneHigh: roundPrice(Math.max(buyZoneLow, buyZoneHigh)),
    confirmBreakoutPrice: roundPrice(confirmBreakoutPrice),
    riskStopPrice: roundPrice(riskStopPrice),
    confidenceScore: confidence,
    minConfidence: settings.minConfidence,
    reasons: planReasons,
    metrics: {
      lastPrice: roundPrice(last.price),
      dayLow: roundPrice(dayLow),
      dayHigh: roundPrice(dayHigh),
      recentLow: roundPrice(recentLow),
      recentHigh: roundPrice(recentHigh),
      institutionalVwap: roundPrice(institutionalVwap),
      exportVwap: roundPrice(allVwap),
      largeDealRatio: largeRatio,
      recentLargeDealRatio: recentLargeRatio,
      priceChangePct,
    },
  };
}

export function normalizePriceRows(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      time: String(row.TIME || row.time || row.datetime || row.dateTime || row.t || ''),
      price: toNumber(row.PRICE ?? row.price ?? row.close ?? row.value ?? row.p),
      largeDeal: toNumber(row['LARGE DEAL'] ?? row.largeDeal ?? row.large_deal ?? row.l ?? 0),
      powerInflow: toNumber(row['PWR INFLOW'] ?? row.powerInflow ?? row.pwrInflow ?? row.i ?? 0),
    }))
    .filter((row) => row.price > 0)
    .sort((a, b) => a.time.localeCompare(b.time));
}
