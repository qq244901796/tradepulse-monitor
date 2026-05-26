;(function (global) {
  function parseCsv(text) {
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
        continue;
      }

      if (char === '"') {
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
    const headers = rows[0].map((header) => normalizeHeader(header));

    return rows
      .slice(1)
      .filter((items) => items.some((item) => item.trim()))
      .map((items) => Object.fromEntries(headers.map((header, index) => [
        header,
        items[index]?.trim() || '',
      ])));
  }

  function normalizeHeader(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function toNumber(value) {
    const parsed = Number(String(value || '').replaceAll(',', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value, digits = 2) {
    return Number.isFinite(value) ? value.toFixed(digits) : '0.00';
  }


  const DEFAULT_CONFIG = {
    account: {
      email: '',
      password: '',
    },
    monitor: {
      mode: 'stock-list',
      symbols: ['AAPL'],
      intervalMinutes: 5,
      lookbackMinutes: 30,
      runAllDay: true,
    },
    rules: {
      minBuyScoreForEntry: 45,
      minBuyScoreForStrongEntry: 70,
    },
    pricePlan: {
      enabled: true,
      pullbackTolerancePct: 0.8,
      stopBufferPct: 1.5,
      minConfidence: 60,
    },
    topFlows: {
      type: 0,
    },
    server: {
      host: '127.0.0.1',
      port: 14587,
    },
    ui: {
      language: 'zh-CN',
    },
  };

  const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'];
  const SUPPORTED_MONITOR_MODES = ['stock-list', 'topflows'];

  function normalizeConfig(input) {
    const config = clone(DEFAULT_CONFIG);
    mergeObject(config, input || {});
    config.account.email = String(config.account.email || '').trim();
    config.account.password = String(config.account.password || '');
    config.monitor.mode = normalizeMonitorMode(config.monitor.mode);
    config.monitor.symbols = normalizeSymbols(config.monitor.symbols);
    config.monitor.intervalMinutes = Number(config.monitor.intervalMinutes);
    config.monitor.lookbackMinutes = Number(config.monitor.lookbackMinutes);
    config.monitor.runAllDay = config.monitor.runAllDay !== false;
    config.rules.minBuyScoreForEntry = Number(config.rules.minBuyScoreForEntry);
    config.rules.minBuyScoreForStrongEntry = Number(config.rules.minBuyScoreForStrongEntry);
    config.pricePlan.enabled = config.pricePlan.enabled !== false;
    config.pricePlan.pullbackTolerancePct = Number(config.pricePlan.pullbackTolerancePct);
    config.pricePlan.stopBufferPct = Number(config.pricePlan.stopBufferPct);
    config.pricePlan.minConfidence = Number(config.pricePlan.minConfidence);
    if (!config.topFlows || typeof config.topFlows !== 'object' || Array.isArray(config.topFlows)) {
      config.topFlows = clone(DEFAULT_CONFIG.topFlows);
    }
    config.topFlows.type = Number(config.topFlows.type);
    config.server.host = String(config.server.host || DEFAULT_CONFIG.server.host);
    config.server.port = Number(config.server.port || DEFAULT_CONFIG.server.port);
    config.ui.language = normalizeLanguage(config.ui.language);
    return config;
  }

  function validateConfig(config) {
    const errors = [];

    if (!config.account.email) errors.push('account.email is required.');
    if (!config.account.password) errors.push('account.password is required.');
    if (!SUPPORTED_MONITOR_MODES.includes(config.monitor.mode)) {
      errors.push('monitor.mode must be stock-list or topflows.');
    }
    if (config.monitor.mode === 'stock-list' && !config.monitor.symbols.length) {
      errors.push('monitor.symbols must contain at least one symbol.');
    }
    if (!Number.isFinite(config.monitor.intervalMinutes) || config.monitor.intervalMinutes < 1) {
      errors.push('monitor.intervalMinutes must be at least 1.');
    }
    if (!Number.isFinite(config.monitor.lookbackMinutes) || config.monitor.lookbackMinutes < 1) {
      errors.push('monitor.lookbackMinutes must be at least 1.');
    }
    if (!Number.isFinite(config.rules.minBuyScoreForEntry)) {
      errors.push('rules.minBuyScoreForEntry must be a number.');
    }
    if (!Number.isFinite(config.rules.minBuyScoreForStrongEntry)) {
      errors.push('rules.minBuyScoreForStrongEntry must be a number.');
    }
    if (!Number.isFinite(config.pricePlan.pullbackTolerancePct) || config.pricePlan.pullbackTolerancePct <= 0) {
      errors.push('pricePlan.pullbackTolerancePct must be greater than 0.');
    }
    if (!Number.isFinite(config.pricePlan.stopBufferPct) || config.pricePlan.stopBufferPct <= 0) {
      errors.push('pricePlan.stopBufferPct must be greater than 0.');
    }
    if (!Number.isFinite(config.pricePlan.minConfidence) || config.pricePlan.minConfidence < 0 || config.pricePlan.minConfidence > 100) {
      errors.push('pricePlan.minConfidence must be between 0 and 100.');
    }
    if (!Number.isFinite(config.topFlows.type) || ![0, 1, 2, 3].includes(config.topFlows.type)) {
      errors.push('topFlows.type must be 0, 1, 2, or 3.');
    }
    if (!Number.isInteger(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
      errors.push('server.port must be a valid TCP port.');
    }
    if (!SUPPORTED_LANGUAGES.includes(config.ui.language)) {
      errors.push('ui.language must be zh-CN or en-US.');
    }

    return errors;
  }

  function publicConfig(config, configPath) {
    return {
      configPath,
      account: {
        email: config.account.email || '',
        passwordConfigured: Boolean(config.account.password),
      },
      monitor: config.monitor,
      rules: config.rules,
      pricePlan: config.pricePlan,
      topFlows: config.topFlows,
      server: config.server,
      ui: config.ui,
    };
  }

  function normalizeSymbols(symbols) {
    if (typeof symbols === 'string') {
      symbols = symbols.split(/[\s,;，；]+/);
    }
    if (!Array.isArray(symbols)) return [];
    return [...new Set(symbols
      .map((symbol) => String(symbol || '').trim().toUpperCase())
      .filter(Boolean))];
  }

  function normalizeLanguage(language) {
    return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.ui.language;
  }

  function normalizeMonitorMode(mode) {
    return SUPPORTED_MONITOR_MODES.includes(mode) ? mode : DEFAULT_CONFIG.monitor.mode;
  }

  function mergeObject(target, source) {
    for (const [key, value] of Object.entries(source)) {
      if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && target[key]
        && typeof target[key] === 'object'
        && !Array.isArray(target[key])
      ) {
        mergeObject(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }



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

  function buildPricePlan({
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

  function normalizePriceRows(rows = []) {
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

  function isTriggeredSignal(signal) {
    return !SIGNAL_NONE.has(signal);
  }

  function classifySymbol(symbol, rows, powerInflows, config, date, chartRows = []) {
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
        pricePlan: buildPricePlan({
          symbol,
          rows: sorted,
          chartRows,
          signal: 'NO_DATA',
          buyScore: 0,
          sellScore: 0,
          config,
        }),
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

    const pricePlan = buildPricePlan({
      symbol,
      rows: sorted,
      chartRows,
      signal,
      buyScore,
      sellScore,
      config,
    });

    return {
      symbol,
      date,
      signal,
      buyScore,
      sellScore,
      firstSeen: false,
      reasons,
      pricePlan,
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

  function analyzeRows({ date, stockRows, powerRows, config, seenSignals, chartRowsBySymbol = new Map() }) {
    const rowsBySymbol = new Map(config.monitor.symbols.map((symbol) => [symbol, []]));

    for (const row of stockRows) {
      const symbol = String(row.SYMBOL || '').toUpperCase();
      if (rowsBySymbol.has(symbol)) rowsBySymbol.get(symbol).push(row);
    }

    return config.monitor.symbols.map((symbol) => {
      const chartRows = chartRowsBySymbol instanceof Map
        ? chartRowsBySymbol.get(symbol) || []
        : chartRowsBySymbol?.[symbol] || [];
      const result = classifySymbol(symbol, rowsBySymbol.get(symbol) || [], powerRows, config, date, chartRows);
      if (!isTriggeredSignal(result.signal)) return result;

      const key = `${date}|${result.symbol}|${result.signal}`;
      result.firstSeen = !seenSignals.has(key);
      result.occurrence = result.firstSeen ? 'first' : 'repeat';
      seenSignals.add(key);
      return result;
    });
  }

  function analyzeTradePulse({ date, stockRows, powerRows, config, seenSignals = new Set(), chartRowsBySymbol = new Map() }) {
    const results = analyzeRows({ date, stockRows, powerRows, config, seenSignals, chartRowsBySymbol });
    return {
      date,
      results,
      summary: summarizeSignals(results),
    };
  }

  function summarizeSignals(results) {
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


  const SIGNAL_KEYS = {
    STRONG_ENTRY: true,
    MIXED_ENTRY: true,
    POSSIBLE_ENTRY: true,
    SELL_PRESSURE: true,
    NEUTRAL: true,
    NO_DATA: true,
  };

  const I18N = {
    'zh-CN': {
      pricePlan: '\u4ef7\u683c\u8ba1\u5212',
      pricePlanWatch: '\u89c2\u5bdf\u4ef7',
      pricePlanBuyZone: '\u4e70\u5165\u533a\u95f4',
      pricePlanBreakout: '\u7a81\u7834\u786e\u8ba4',
      pricePlanStop: '\u98ce\u9669\u6b62\u635f',
      pricePlanConfidence: '\u53ef\u4fe1\u5ea6',
      pricePlanSource: '\u6570\u636e\u6e90',
      pricePlanActionable: '\u8fbe\u5230\u8ba1\u5212\u6761\u4ef6',
      pricePlanNotActionable: '\u7ee7\u7eed\u89c2\u5bdf',
      pricePlanSourceChart: 'Chart',
      pricePlanSourceExport: 'Export',
      monitorMode: '\u76d1\u63a7\u6a21\u5f0f',
      stockListMode: '\u80a1\u7968\u5217\u8868',
      topFlowsMode: 'Top Flows',
      topFlowsWatchlist: 'Top Flows \u699c\u5355',
      topFlowsSummary: 'Top Flows \u53d8\u52a8',
      topFlowsRows: '{value} \u6761',
      topFlowsNoChange: '\u6682\u65e0\u699c\u5355\u53d8\u52a8',
      topFlowsBaseline: '\u9996\u6b21\u626b\u63cf\uff0c\u5df2\u5efa\u7acb\u5bf9\u6bd4\u57fa\u7ebf',
      topFlowsEntered: '\u65b0\u8fdb\u699c',
      topFlowsExited: '\u79bb\u5f00\u699c\u5355',
      topFlowsMoved: '\u540d\u6b21\u53d8\u52a8',
      rank: '\u6392\u540d',
      topFlowsName: '\u540d\u79f0',
      changePct: '\u6da8\u8dcc',
      score: 'Score',
      momentum: 'Momentum',
      daily: 'Daily',
      topFlowsLargeDeal: 'Large Deal',
      pricePlanStatusREADY: '\u53ef\u6267\u884c',
      pricePlanStatusWATCH: '\u89c2\u5bdf\u4e2d',
      pricePlanStatusLOW_CONFIDENCE: '\u4fe1\u5fc3\u4e0d\u8db3',
      pricePlanStatusNO_DATA: '\u65e0\u4ef7\u683c\u6570\u636e',
      pricePlanStatusDISABLED: '\u5df2\u5173\u95ed',
      'reason.price_plan_disabled': '\u4ef7\u683c\u8ba1\u5212\u5df2\u5173\u95ed\u3002',
      'reason.price_plan_no_data': '\u6ca1\u6709\u53ef\u7528\u4ef7\u683c\u6570\u636e\u3002',
      'reason.price_plan_entry_signal': '\u5df2\u51fa\u73b0\u5165\u573a\u7c7b\u4fe1\u53f7\u3002',
      'reason.price_plan_institutional_anchor': '\u673a\u6784\u4e70\u5165\u5747\u4ef7\u9644\u8fd1\u5f62\u6210\u53c2\u8003\u4ef7\uff08{price}\uff09\u3002',
      'reason.price_plan_recent_buying': '\u6700\u8fd1\u4ecd\u6709\u673a\u6784\u4e70\u5165\u5206\u949f\uff08{count}\uff09\u3002',
      'reason.price_plan_large_deal_positive': '\u5168\u65e5\u5927\u5355\u51c0\u6d41\u5411\u504f\u6b63\uff08{ratio}%\uff09\u3002',
      'reason.price_plan_recent_large_positive': '\u6700\u8fd1\u5927\u5355\u51c0\u6d41\u5411\u504f\u6b63\uff08{ratio}%\uff09\u3002',
      'reason.price_plan_price_confirming': '\u4ef7\u683c\u5df2\u540c\u6b65\u8d70\u5f3a\uff08{pct}%\uff09\u3002',
      'reason.price_plan_sell_pressure': '\u5356\u538b\u9ad8\u4e8e\u4e70\u5165\u4fe1\u53f7\uff0c\u964d\u4f4e\u4ef7\u683c\u8ba1\u5212\u53ef\u4fe1\u5ea6\u3002',
      'reason.price_plan_extended': '\u73b0\u4ef7\u5df2\u660e\u663e\u9ad8\u4e8e\u7a81\u7834\u4ef7\uff0c\u8ffd\u4ef7\u98ce\u9669\u589e\u52a0\u3002',
      'reason.price_plan_wait_confirmation': '\u8fd8\u9700\u8981\u7b49\u5f85\u66f4\u660e\u786e\u7684\u673a\u6784\u4e70\u5165\u6216\u4ef7\u683c\u786e\u8ba4\u3002',
      'log.chart_data_failed': '\u66f2\u7ebf\u6570\u636e\u8bfb\u53d6\u5931\u8d25\uff08{symbol}\uff09\uff1a{message}\u3002',
      subtitle: '本地机构入场监控',
      language: '语言',
      settings: '设置',
      settingsTitle: '设置',
      settingsCopy: '在软件里直接编辑配置，保存后会立即重新扫描。',
      closeSettings: '收起设置',
      shutdown: '停止后台',
      scanNow: '立即扫描',
      email: 'TradePulse 邮箱',
      password: 'TradePulse 密码',
      passwordHelp: '已有配置时不填表示保留当前密码。首次配置必须填写密码。',
      symbols: '股票列表',
      symbolPlaceholder: '输入 AAPL 后回车，可一次粘贴 AAPL,TSLA NVDA',
      addSymbol: '添加',
      remove: '删除',
      intervalMinutes: '扫描周期（分钟）',
      lookbackMinutes: '回看分钟',
      entryScore: '入场阈值',
      strongScore: '强入场阈值',
      saveSettings: '保存设置并扫描',
      saving: '保存中...',
      saveFailed: '保存失败',
      settingsSaved: '设置已保存，正在重新扫描。',
      emptySymbols: '请至少添加一个股票代码。',
      runtimeStatus: '运行状态',
      loading: '读取中',
      login: '登录',
      lastScan: '最近扫描',
      nextScan: '下次扫描',
      tradeDate: '数据日期',
      signalSummary: '信号概览',
      noScan: '暂无扫描',
      watchlist: '股票监控',
      symbol: '股票',
      signal: '信号',
      buyScore: '买入分',
      sellScore: '卖压分',
      price: '价格',
      largeDeal: '大单净额',
      recentLargeDeal: '最近大单',
      reason: '原因',
      waitingResults: '等待扫描结果',
      config: '配置',
      account: '账号',
      interval: '周期',
      lookback: '回看',
      logs: '最近日志',
      autoRefresh: '自动刷新',
      running: '运行中',
      scanning: '扫描中',
      stopped: '已停止',
      loginOk: '已登录 {time}',
      loginError: '登录失败',
      loggingIn: '登录中',
      loginIdle: '等待登录',
      minutes: '{value} 分钟',
      symbolCount: '{value} 个股票',
      firstSeen: '首次',
      noLogs: '暂无日志',
      serverReadFailed: '无法读取本地服务：{message}',
      shuttingDown: '后台正在停止，页面稍后会断开。',
      STRONG_ENTRY: '强入场',
      MIXED_ENTRY: '冲突入场',
      POSSIBLE_ENTRY: '可能入场',
      SELL_PRESSURE: '卖压',
      NEUTRAL: '中性',
      NO_DATA: '无数据',
      'reason.no_data': '该股票/日期没有返回数据。',
      'reason.power_inflows_hit': '进入官方强资金流入列表，触发时间 {time}。',
      'reason.pwr_inflow_count': '强资金流入分钟数：{count}。',
      'reason.large_deal_strong_positive': '大单净流向强烈为正（{ratio}%）。',
      'reason.large_deal_positive': '大单净流向为正（{ratio}%）。',
      'reason.large_deal_strong_negative': '大单净流向强烈为负（{ratio}%）。',
      'reason.large_deal_negative': '大单净流向为负（{ratio}%）。',
      'reason.recent_large_deal_strong': '最近 {minutes} 分钟大单流向很强（{ratio}%）。',
      'reason.recent_large_deal_positive': '最近 {minutes} 分钟大单流向为正（{ratio}%）。',
      'reason.recent_large_deal_weak': '最近 {minutes} 分钟大单流向偏弱（{ratio}%）。',
      'reason.recent_large_deal_negative': '最近 {minutes} 分钟大单流向为负（{ratio}%）。',
      'reason.daily_acc_positive_rising': '日内累计为正，并继续走强（{value}）。',
      'reason.daily_acc_improving': '日内累计正在改善。',
      'reason.daily_acc_negative_falling': '日内累计为负，并继续走弱（{value}）。',
      'reason.momentum_acc_positive_rising': '动量累计为正，并继续走强（{value}）。',
      'reason.momentum_acc_improving': '动量累计正在改善。',
      'reason.momentum_acc_negative_falling': '动量累计为负，并继续走弱（{value}）。',
      'reason.large_positive_block_burst': '出现大额正向大单脉冲（{value}）。',
      'reason.large_negative_block_burst': '出现大额负向大单脉冲（{value}）。',
      'reason.price_up': '价格同步上涨（{pct}%）。',
      'reason.price_down': '价格同步下跌（{pct}%）。',
      'log.service_started': '后台服务已启动。',
      'log.config_error': '配置错误：{message}',
      'log.config_reloaded': '配置已重载。',
      'log.config_reload_failed': '配置重载失败：{message}',
      'log.scan_started': '扫描开始（{trigger}）。',
      'log.scan_finished': '扫描完成：{symbols} 条，用时 {durationMs}ms。',
      'log.scan_failed': '扫描失败：{message}',
      'log.export_session_expired': '导出会话已过期，正在重新登录。',
      'log.login_success': 'TradePulse 登录成功：{email}',
      'log.auth_check_failed_relogin': '登录状态检查失败，正在重新登录：{message}',
      'log.message': '{message}',
    },
    'en-US': {
      pricePlan: 'Price Plan',
      pricePlanWatch: 'Watch Price',
      pricePlanBuyZone: 'Buy Zone',
      pricePlanBreakout: 'Breakout Confirm',
      pricePlanStop: 'Risk Stop',
      pricePlanConfidence: 'Confidence',
      pricePlanSource: 'Source',
      pricePlanActionable: 'Plan conditions met',
      pricePlanNotActionable: 'Keep watching',
      pricePlanSourceChart: 'Chart',
      pricePlanSourceExport: 'Export',
      monitorMode: 'Monitor Mode',
      stockListMode: 'Stock List',
      topFlowsMode: 'Top Flows',
      topFlowsWatchlist: 'Top Flows List',
      topFlowsSummary: 'Top Flows Changes',
      topFlowsRows: '{value} rows',
      topFlowsNoChange: 'No list changes',
      topFlowsBaseline: 'First scan; comparison baseline created',
      topFlowsEntered: 'Entered',
      topFlowsExited: 'Exited',
      topFlowsMoved: 'Rank Changed',
      rank: 'Rank',
      topFlowsName: 'Name',
      changePct: 'Chg.',
      score: 'Score',
      momentum: 'Momentum',
      daily: 'Daily',
      topFlowsLargeDeal: 'Large Deal',
      pricePlanStatusREADY: 'Ready',
      pricePlanStatusWATCH: 'Watching',
      pricePlanStatusLOW_CONFIDENCE: 'Low Confidence',
      pricePlanStatusNO_DATA: 'No Price Data',
      pricePlanStatusDISABLED: 'Disabled',
      'reason.price_plan_disabled': 'Price plan is disabled.',
      'reason.price_plan_no_data': 'No usable price data is available.',
      'reason.price_plan_entry_signal': 'An entry-type signal is already present.',
      'reason.price_plan_institutional_anchor': 'Institutional buying forms a reference price near {price}.',
      'reason.price_plan_recent_buying': 'Recent institutional buying minutes are still present ({count}).',
      'reason.price_plan_large_deal_positive': 'Full-session large-deal net flow is positive ({ratio}%).',
      'reason.price_plan_recent_large_positive': 'Recent large-deal net flow is positive ({ratio}%).',
      'reason.price_plan_price_confirming': 'Price is confirming upward movement ({pct}%).',
      'reason.price_plan_sell_pressure': 'Sell pressure is stronger than the buying signal, reducing confidence.',
      'reason.price_plan_extended': 'Current price is already extended above breakout confirmation, so chase risk is higher.',
      'reason.price_plan_wait_confirmation': 'Wait for clearer institutional buying or price confirmation.',
      'log.chart_data_failed': 'Chart data failed ({symbol}): {message}.',
      subtitle: 'Local institutional-flow monitor',
      language: 'Language',
      settings: 'Settings',
      settingsTitle: 'Settings',
      settingsCopy: 'Edit configuration in the app. Saving triggers a scan immediately.',
      closeSettings: 'Hide Settings',
      shutdown: 'Stop Backend',
      scanNow: 'Scan Now',
      email: 'TradePulse Email',
      password: 'TradePulse Password',
      passwordHelp: 'Leave blank to keep the current password. Required on first setup.',
      symbols: 'Symbols',
      symbolPlaceholder: 'Type AAPL and press Enter, or paste AAPL,TSLA NVDA',
      addSymbol: 'Add',
      remove: 'Remove',
      intervalMinutes: 'Scan Interval (minutes)',
      lookbackMinutes: 'Lookback Minutes',
      entryScore: 'Entry Threshold',
      strongScore: 'Strong Entry Threshold',
      saveSettings: 'Save Settings and Scan',
      saving: 'Saving...',
      saveFailed: 'Save failed',
      settingsSaved: 'Settings saved. Scanning again.',
      emptySymbols: 'Add at least one symbol.',
      runtimeStatus: 'Runtime Status',
      loading: 'Loading',
      login: 'Login',
      lastScan: 'Last Scan',
      nextScan: 'Next Scan',
      tradeDate: 'Data Date',
      signalSummary: 'Signal Summary',
      noScan: 'No scan yet',
      watchlist: 'Watchlist',
      symbol: 'Symbol',
      signal: 'Signal',
      buyScore: 'Buy Score',
      sellScore: 'Sell Score',
      price: 'Price',
      largeDeal: 'Large Deal',
      recentLargeDeal: 'Recent Large Deal',
      reason: 'Reason',
      waitingResults: 'Waiting for scan results',
      config: 'Config',
      account: 'Account',
      interval: 'Interval',
      lookback: 'Lookback',
      logs: 'Recent Logs',
      autoRefresh: 'Auto refresh',
      running: 'Running',
      scanning: 'Scanning',
      stopped: 'Stopped',
      loginOk: 'Logged in {time}',
      loginError: 'Login failed',
      loggingIn: 'Logging in',
      loginIdle: 'Waiting for login',
      minutes: '{value} min',
      symbolCount: '{value} symbols',
      firstSeen: 'First',
      noLogs: 'No logs',
      serverReadFailed: 'Cannot read local service: {message}',
      shuttingDown: 'Backend is shutting down; this page will disconnect shortly.',
      STRONG_ENTRY: 'Strong Entry',
      MIXED_ENTRY: 'Mixed Entry',
      POSSIBLE_ENTRY: 'Possible Entry',
      SELL_PRESSURE: 'Sell Pressure',
      NEUTRAL: 'Neutral',
      NO_DATA: 'No Data',
      'reason.no_data': 'No export rows returned for this symbol/date.',
      'reason.power_inflows_hit': 'Power Inflows list hit at {time}.',
      'reason.pwr_inflow_count': 'PWR INFLOW minute count {count}.',
      'reason.large_deal_strong_positive': 'Net LARGE DEAL is strongly positive ({ratio}%).',
      'reason.large_deal_positive': 'Net LARGE DEAL is positive ({ratio}%).',
      'reason.large_deal_strong_negative': 'Net LARGE DEAL is strongly negative ({ratio}%).',
      'reason.large_deal_negative': 'Net LARGE DEAL is negative ({ratio}%).',
      'reason.recent_large_deal_strong': 'Recent {minutes}m LARGE DEAL is strong ({ratio}%).',
      'reason.recent_large_deal_positive': 'Recent {minutes}m LARGE DEAL is positive ({ratio}%).',
      'reason.recent_large_deal_weak': 'Recent {minutes}m LARGE DEAL is weak ({ratio}%).',
      'reason.recent_large_deal_negative': 'Recent {minutes}m LARGE DEAL is negative ({ratio}%).',
      'reason.daily_acc_positive_rising': 'DAILY ACC. is positive and rising ({value}).',
      'reason.daily_acc_improving': 'DAILY ACC. is improving intraday.',
      'reason.daily_acc_negative_falling': 'DAILY ACC. is negative and falling ({value}).',
      'reason.momentum_acc_positive_rising': 'MOMENTUM ACC. is positive and rising ({value}).',
      'reason.momentum_acc_improving': 'MOMENTUM ACC. is improving intraday.',
      'reason.momentum_acc_negative_falling': 'MOMENTUM ACC. is negative and falling ({value}).',
      'reason.large_positive_block_burst': 'Large positive block burst detected ({value}).',
      'reason.large_negative_block_burst': 'Large negative block burst detected ({value}).',
      'reason.price_up': 'Price confirms upward move ({pct}%).',
      'reason.price_down': 'Price confirms downward move ({pct}%).',
      'log.service_started': 'Monitor service started.',
      'log.config_error': 'Config error: {message}',
      'log.config_reloaded': 'Config reloaded.',
      'log.config_reload_failed': 'Config reload failed: {message}',
      'log.scan_started': 'Scan started ({trigger}).',
      'log.scan_finished': 'Scan finished: {symbols} items in {durationMs}ms.',
      'log.scan_failed': 'Scan failed: {message}',
      'log.export_session_expired': 'Export session expired; logging in again.',
      'log.login_success': 'Logged in to TradePulse as {email}.',
      'log.auth_check_failed_relogin': 'Auth check failed, logging in again: {message}',
      'log.message': '{message}',
    },
  };

  function t(language, key, params = {}) {
    const lang = I18N[language] ? language : 'zh-CN';
    const bundle = I18N[lang];
    const fallback = I18N['en-US'];
    const template = bundle[key] || fallback[key] || key;
    return template.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
  }

  function translateReason(reason, language) {
    if (typeof reason === 'string') return translateLegacyReason(reason, language);
    if (reason?.code) return t(language, `reason.${reason.code}`, reason.params || {});
    return '';
  }

  function translateLog(log, language) {
    if (log?.code) return t(language, `log.${log.code}`, log.params || { message: log.message || '' });
    return log?.message || '';
  }

  function translateError(message, language) {
    if (/Config file not found/i.test(message)) {
      return language === 'zh-CN'
        ? '还没有配置，请先在页面填写账号和股票列表。'
        : 'Config is missing. Fill in the account and watchlist on this page.';
    }
    if (/Open the local web page/i.test(message)) {
      return language === 'zh-CN'
        ? '打开本地页面并填写 TradePulse 账号。'
        : 'Open the local page and fill in your TradePulse account.';
    }
    if (/account\.email is required/i.test(message)) {
      return language === 'zh-CN' ? '请填写 TradePulse 邮箱。' : 'TradePulse email is required.';
    }
    if (/account\.password is required/i.test(message)) {
      return language === 'zh-CN' ? '请填写 TradePulse 密码。' : 'TradePulse password is required.';
    }
    if (/monitor\.symbols/i.test(message)) {
      return language === 'zh-CN' ? '请至少添加一个股票代码。' : 'At least one symbol is required.';
    }
    if (/monitor\.mode/i.test(message)) {
      return language === 'zh-CN' ? '监控模式只能选择股票列表或 Top Flows。' : 'Monitor mode must be Stock List or Top Flows.';
    }
    if (/topFlows\.type/i.test(message)) {
      return language === 'zh-CN' ? 'Top Flows 类型只能是 ALL、NYSE、NASDAQ 或 ETF。' : 'Top Flows type must be ALL, NYSE, NASDAQ, or ETF.';
    }
    return message;
  }

  function translateLegacyReason(value, language) {
    const patterns = [
      [/Net LARGE DEAL is strongly negative \(([-\d.]+)%\)\./, 'reason.large_deal_strong_negative', 'ratio'],
      [/Net LARGE DEAL is strongly positive \(([-\d.]+)%\)\./, 'reason.large_deal_strong_positive', 'ratio'],
      [/Net LARGE DEAL is negative \(([-\d.]+)%\)\./, 'reason.large_deal_negative', 'ratio'],
      [/Net LARGE DEAL is positive \(([-\d.]+)%\)\./, 'reason.large_deal_positive', 'ratio'],
      [/Recent (\d+)m LARGE DEAL is weak \(([-\d.]+)%\)\./, 'reason.recent_large_deal_weak', ['minutes', 'ratio']],
      [/Recent (\d+)m LARGE DEAL is strong \(([-\d.]+)%\)\./, 'reason.recent_large_deal_strong', ['minutes', 'ratio']],
      [/DAILY ACC\. is negative and falling \(([-\d.]+)\)\./, 'reason.daily_acc_negative_falling', 'value'],
      [/MOMENTUM ACC\. is negative and falling \(([-\d.]+)\)\./, 'reason.momentum_acc_negative_falling', 'value'],
    ];

    for (const [regex, key, names] of patterns) {
      const match = value.match(regex);
      if (!match) continue;
      const params = {};
      if (Array.isArray(names)) {
        names.forEach((name, index) => {
          params[name] = match[index + 1];
        });
      } else {
        params[names] = match[1];
      }
      return t(language, key, params);
    }
    return value;
  }


  function analyzeTradePulseFromCsv(input) {
    const stockRows = parseCsv(String(input.stockCsv || ''));
    const powerRows = parseCsv(String(input.powerCsv || ''));
    return analyzeTradePulse({
      date: input.date,
      stockRows,
      powerRows,
      config: normalizeConfig(input.config || {}),
      seenSignals: new Set(input.seenSignals || []),
      chartRowsBySymbol: input.chartRowsBySymbol || {},
    });
  }

  global.TradePulseCore = {
    parseCsv,
    normalizeHeader,
    toNumber,
    formatNumber,
    DEFAULT_CONFIG,
    SUPPORTED_LANGUAGES,
    SUPPORTED_MONITOR_MODES,
    normalizeConfig,
    validateConfig,
    publicConfig,
    normalizeSymbols,
    normalizeLanguage,
    normalizeMonitorMode,
    buildPricePlan,
    normalizePriceRows,
    isTriggeredSignal,
    classifySymbol,
    analyzeRows,
    analyzeTradePulse,
    summarizeSignals,
    SIGNAL_KEYS,
    I18N,
    t,
    translateReason,
    translateLog,
    translateError,
    translateLegacyReason,
    analyzeTradePulseFromCsv,
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
