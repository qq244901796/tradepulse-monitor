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
      symbols: ['AAPL'],
      intervalMinutes: 5,
      lookbackMinutes: 30,
      runAllDay: true,
    },
    rules: {
      minBuyScoreForEntry: 45,
      minBuyScoreForStrongEntry: 70,
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

  function normalizeConfig(input) {
    const config = clone(DEFAULT_CONFIG);
    mergeObject(config, input || {});
    config.account.email = String(config.account.email || '').trim();
    config.account.password = String(config.account.password || '');
    config.monitor.symbols = normalizeSymbols(config.monitor.symbols);
    config.monitor.intervalMinutes = Number(config.monitor.intervalMinutes);
    config.monitor.lookbackMinutes = Number(config.monitor.lookbackMinutes);
    config.monitor.runAllDay = config.monitor.runAllDay !== false;
    config.rules.minBuyScoreForEntry = Number(config.rules.minBuyScoreForEntry);
    config.rules.minBuyScoreForStrongEntry = Number(config.rules.minBuyScoreForStrongEntry);
    config.server.host = String(config.server.host || DEFAULT_CONFIG.server.host);
    config.server.port = Number(config.server.port || DEFAULT_CONFIG.server.port);
    config.ui.language = normalizeLanguage(config.ui.language);
    return config;
  }

  function validateConfig(config) {
    const errors = [];

    if (!config.account.email) errors.push('account.email is required.');
    if (!config.account.password) errors.push('account.password is required.');
    if (!config.monitor.symbols.length) errors.push('monitor.symbols must contain at least one symbol.');
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

  function classifySymbol(symbol, rows, powerInflows, config, date) {
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

  function analyzeRows({ date, stockRows, powerRows, config, seenSignals }) {
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

  function analyzeTradePulse({ date, stockRows, powerRows, config, seenSignals = new Set() }) {
    const results = analyzeRows({ date, stockRows, powerRows, config, seenSignals });
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
      'log.scan_finished': '扫描完成：{symbols} 个股票，用时 {durationMs}ms。',
      'log.scan_failed': '扫描失败：{message}',
      'log.export_session_expired': '导出会话已过期，正在重新登录。',
      'log.login_success': 'TradePulse 登录成功：{email}',
      'log.auth_check_failed_relogin': '登录状态检查失败，正在重新登录：{message}',
      'log.message': '{message}',
    },
    'en-US': {
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
      'log.scan_finished': 'Scan finished: {symbols} symbols in {durationMs}ms.',
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
    });
  }

  global.TradePulseCore = {
    parseCsv,
    normalizeHeader,
    toNumber,
    formatNumber,
    DEFAULT_CONFIG,
    SUPPORTED_LANGUAGES,
    normalizeConfig,
    validateConfig,
    publicConfig,
    normalizeSymbols,
    normalizeLanguage,
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
