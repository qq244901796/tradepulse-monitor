export const SIGNAL_KEYS = {
  STRONG_ENTRY: true,
  MIXED_ENTRY: true,
  POSSIBLE_ENTRY: true,
  SELL_PRESSURE: true,
  NEUTRAL: true,
  NO_DATA: true,
};

export const I18N = {
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
    'log.scan_finished': '扫描完成：{symbols} 个股票，用时 {durationMs}ms。',
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
    'log.scan_finished': 'Scan finished: {symbols} symbols in {durationMs}ms.',
    'log.scan_failed': 'Scan failed: {message}',
    'log.export_session_expired': 'Export session expired; logging in again.',
    'log.login_success': 'Logged in to TradePulse as {email}.',
    'log.auth_check_failed_relogin': 'Auth check failed, logging in again: {message}',
    'log.message': '{message}',
  },
};

export function t(language, key, params = {}) {
  const lang = I18N[language] ? language : 'zh-CN';
  const bundle = I18N[lang];
  const fallback = I18N['en-US'];
  const template = bundle[key] || fallback[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '');
}

export function translateReason(reason, language) {
  if (typeof reason === 'string') return translateLegacyReason(reason, language);
  if (reason?.code) return t(language, `reason.${reason.code}`, reason.params || {});
  return '';
}

export function translateLog(log, language) {
  if (log?.code) return t(language, `log.${log.code}`, log.params || { message: log.message || '' });
  return log?.message || '';
}

export function translateError(message, language) {
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

export function translateLegacyReason(value, language) {
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
