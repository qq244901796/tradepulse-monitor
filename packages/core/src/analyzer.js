import { formatNumber, toNumber } from './csv.js';

const SIGNAL_NONE = new Set(['NEUTRAL', 'NO_DATA']);

function sortRows(rows) {
  return [...rows].sort((a, b) => `${a.DATE} ${a.TIME}`.localeCompare(`${b.DATE} ${b.TIME}`));
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + toNumber(row[field]), 0);
}

function clampScore(score) {
  return Math.max(0, Math.min(100, score));
}

function reason(code, params = {}) {
  return { code, params };
}

export function isTriggeredSignal(signal) {
  return !SIGNAL_NONE.has(signal);
}

export function classifySymbol(symbol, rows, powerInflows, config, date) {
  const sorted = sortRows(rows);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const lookbackMinutes = config.monitor.lookbackMinutes;
  const recent = sorted.slice(-lookbackMinutes);
  const powerHit = powerInflows.find((row) => String(row.SYMBOL || '').toUpperCase() === symbol);
  const pwrMinutes = sorted.filter((row) => toNumber(row['PWR INFLOW']) > 0);

  if (!first || !last) {
    return {
      symbol,
      date,
      signal: 'NO_DATA',
      buyScore: 0,
      sellScore: 0,
      firstSeen: false,
      reasons: [reason('no_data')],
      metrics: {},
    };
  }

  const totalLarge = sum(sorted, 'LARGE DEAL');
  const absLarge = sorted.reduce((total, row) => total + Math.abs(toNumber(row['LARGE DEAL'])), 0);
  const recentLarge = sum(recent, 'LARGE DEAL');
  const recentAbsLarge = recent.reduce((total, row) => total + Math.abs(toNumber(row['LARGE DEAL'])), 0);
  const largeRatio = absLarge > 0 ? totalLarge / absLarge : 0;
  const recentLargeRatio = recentAbsLarge > 0 ? recentLarge / recentAbsLarge : 0;
  const firstPrice = toNumber(first.PRICE);
  const lastPrice = toNumber(last.PRICE);
  const priceChangePct = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const firstDailyAcc = toNumber(first['DAILY ACC.']);
  const lastDailyAcc = toNumber(last['DAILY ACC.']);
  const dailyAccDelta = lastDailyAcc - firstDailyAcc;
  const firstMomentumAcc = toNumber(first['MOMENTUM ACC.']);
  const lastMomentumAcc = toNumber(last['MOMENTUM ACC.']);
  const momentumAccDelta = lastMomentumAcc - firstMomentumAcc;
  const largeDeals = sorted.map((row) => toNumber(row['LARGE DEAL']));
  const maxLarge = Math.max(...largeDeals);
  const minLarge = Math.min(...largeDeals);
  const avgAbsLarge = sorted.length ? absLarge / sorted.length : 0;

  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];

  if (powerHit) {
    buyScore += 35;
    reasons.push(reason('power_inflows_hit', { time: powerHit.TIME }));
  }

  if (pwrMinutes.length > 0) {
    buyScore += Math.min(20, 8 + pwrMinutes.length * 2);
    reasons.push(reason('pwr_inflow_count', { count: pwrMinutes.length }));
  }

  if (largeRatio >= 0.2) {
    buyScore += 30;
    reasons.push(reason('large_deal_strong_positive', { ratio: formatNumber(largeRatio * 100, 1) }));
  } else if (largeRatio >= 0.08) {
    buyScore += 18;
    reasons.push(reason('large_deal_positive', { ratio: formatNumber(largeRatio * 100, 1) }));
  } else if (largeRatio <= -0.2) {
    sellScore += 30;
    reasons.push(reason('large_deal_strong_negative', { ratio: formatNumber(largeRatio * 100, 1) }));
  } else if (largeRatio <= -0.08) {
    sellScore += 18;
    reasons.push(reason('large_deal_negative', { ratio: formatNumber(largeRatio * 100, 1) }));
  }

  if (recentLargeRatio >= 0.25) {
    buyScore += 15;
    reasons.push(reason('recent_large_deal_strong', {
      minutes: lookbackMinutes,
      ratio: formatNumber(recentLargeRatio * 100, 1),
    }));
  } else if (recentLargeRatio >= 0.1) {
    buyScore += 8;
    reasons.push(reason('recent_large_deal_positive', {
      minutes: lookbackMinutes,
      ratio: formatNumber(recentLargeRatio * 100, 1),
    }));
  } else if (recentLargeRatio <= -0.25) {
    sellScore += 15;
    reasons.push(reason('recent_large_deal_weak', {
      minutes: lookbackMinutes,
      ratio: formatNumber(recentLargeRatio * 100, 1),
    }));
  } else if (recentLargeRatio <= -0.1) {
    sellScore += 8;
    reasons.push(reason('recent_large_deal_negative', {
      minutes: lookbackMinutes,
      ratio: formatNumber(recentLargeRatio * 100, 1),
    }));
  }

  if (lastDailyAcc > 0 && dailyAccDelta > 0) {
    buyScore += 12;
    reasons.push(reason('daily_acc_positive_rising', { value: formatNumber(lastDailyAcc) }));
  } else if (dailyAccDelta > 0) {
    buyScore += 6;
    reasons.push(reason('daily_acc_improving'));
  } else if (lastDailyAcc < 0 && dailyAccDelta < 0) {
    sellScore += 12;
    reasons.push(reason('daily_acc_negative_falling', { value: formatNumber(lastDailyAcc) }));
  }

  if (lastMomentumAcc > 0 && momentumAccDelta > 0) {
    buyScore += 12;
    reasons.push(reason('momentum_acc_positive_rising', { value: formatNumber(lastMomentumAcc) }));
  } else if (momentumAccDelta > 0) {
    buyScore += 6;
    reasons.push(reason('momentum_acc_improving'));
  } else if (lastMomentumAcc < 0 && momentumAccDelta < 0) {
    sellScore += 12;
    reasons.push(reason('momentum_acc_negative_falling', { value: formatNumber(lastMomentumAcc) }));
  }

  if (avgAbsLarge > 0 && maxLarge > avgAbsLarge * 3) {
    buyScore += 6;
    reasons.push(reason('large_positive_block_burst', { value: formatNumber(maxLarge) }));
  }
  if (avgAbsLarge > 0 && Math.abs(minLarge) > avgAbsLarge * 3) {
    sellScore += 6;
    reasons.push(reason('large_negative_block_burst', { value: formatNumber(minLarge) }));
  }

  if (priceChangePct >= 0.5) {
    buyScore += 5;
    reasons.push(reason('price_up', { pct: formatNumber(priceChangePct, 2) }));
  } else if (priceChangePct <= -0.5) {
    sellScore += 5;
    reasons.push(reason('price_down', { pct: formatNumber(priceChangePct, 2) }));
  }

  buyScore = clampScore(buyScore);
  sellScore = clampScore(sellScore);

  let signal = 'NEUTRAL';
  if (
    buyScore >= config.rules.minBuyScoreForStrongEntry
    && buyScore >= sellScore + 10
    && sellScore < 20
  ) {
    signal = 'STRONG_ENTRY';
  } else if (
    buyScore >= config.rules.minBuyScoreForStrongEntry
    && buyScore >= sellScore + 10
  ) {
    signal = 'MIXED_ENTRY';
  } else if (buyScore >= config.rules.minBuyScoreForEntry && buyScore >= sellScore) {
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
    firstSeen: false,
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

export function analyzeRows({ date, stockRows, powerRows, config, seenSignals }) {
  const rowsBySymbol = new Map(config.monitor.symbols.map((symbol) => [symbol, []]));

  for (const row of stockRows) {
    const symbol = String(row.SYMBOL || '').toUpperCase();
    if (rowsBySymbol.has(symbol)) rowsBySymbol.get(symbol).push(row);
  }

  return config.monitor.symbols.map((symbol) => {
    const result = classifySymbol(symbol, rowsBySymbol.get(symbol) || [], powerRows, config, date);
    if (!isTriggeredSignal(result.signal)) return result;

    const key = `${date}|${result.symbol}|${result.signal}`;
    result.firstSeen = !seenSignals.has(key);
    result.occurrence = result.firstSeen ? 'first' : 'repeat';
    seenSignals.add(key);
    return result;
  });
}

export function analyzeTradePulse({ date, stockRows, powerRows, config, seenSignals = new Set() }) {
  const results = analyzeRows({ date, stockRows, powerRows, config, seenSignals });
  return {
    date,
    results,
    summary: summarizeSignals(results),
  };
}

export function summarizeSignals(results) {
  const summary = {
    STRONG_ENTRY: 0,
    MIXED_ENTRY: 0,
    POSSIBLE_ENTRY: 0,
    SELL_PRESSURE: 0,
    NEUTRAL: 0,
    NO_DATA: 0,
  };
  for (const result of results) {
    summary[result.signal] = (summary[result.signal] || 0) + 1;
  }
  return summary;
}
