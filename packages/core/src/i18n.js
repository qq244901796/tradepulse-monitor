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
    monitorMode: '\u76d1\u63a7\u6a21\u5f0f',
    stockListMode: '\u80a1\u7968\u5217\u8868',
    topFlowsMode: 'Top Flows',
    powerInflowsMode: 'Power Inflows',
    powerInflowsWatchlist: 'Power Inflows 榜单',
    powerInflowsRows: '{value} 条',
    powerInflowsRowsLabel: '榜单数量',
    powerInflowsEntered: '新进榜',
    powerInflowsExited: '离开榜单',
    powerInflowsExisting: '已在榜',
    powerInflowsBaseline: '首次扫描基线',
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
    triggerTime: '触发时间',
    status: '状态',
    emailNotification: '邮件提醒',
    emailNotificationHelp: '填写 Resend API Key 和接收 Power Inflows 新进榜提醒的邮箱。',
    mailApiKey: 'Resend API Key',
    mailApiKeyPlaceholder: '已有配置时可留空',
    mailApiKeyHelp: '首次使用请填写 Resend API Key。',
    mailApiKeyConfiguredHelp: '已保存 API Key。不填写表示继续使用当前 API Key。',
    mailRecipient: '收件邮箱',
    mailRecipientPlaceholder: '多个收件人用逗号分隔',
    testEmail: '发送测试邮件',
    testEmailHelp: '用当前填写的 API Key 和收件邮箱发送一封测试邮件。',
    testingEmail: '发送中...',
    testEmailSent: '测试邮件已发送，请检查收件箱。',
    emailApiKeyRequired: '请填写 Resend API Key。',
    emailRecipientRequired: '请填写收件邮箱。',
    emailStatus: '邮件状态',
    emailRecipientConfigured: '收件邮箱已配置',
    emailRecipientMissing: '未配置收件邮箱',
    emailApiKeyMissing: '未配置 Resend API Key',
    emailSenderMissing: '未配置 Resend API Key',
    emailSent: '已发送',
    emailFailed: '发送失败',
    emailSkippedBaseline: '首次基线不发送',
    emailSkippedNoEntered: '无新进榜',
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
    'log.email_sent': '邮件提醒已发送：{count} 个新进榜。',
    'log.email_failed': '邮件提醒发送失败：{message}',
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
    powerInflowsMode: 'Power Inflows',
    powerInflowsWatchlist: 'Power Inflows List',
    powerInflowsRows: '{value} rows',
    powerInflowsRowsLabel: 'Rows',
    powerInflowsEntered: 'Entered',
    powerInflowsExited: 'Exited',
    powerInflowsExisting: 'Already Listed',
    powerInflowsBaseline: 'First Scan Baseline',
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
    triggerTime: 'Trigger Time',
    status: 'Status',
    emailNotification: 'Email Notification',
    emailNotificationHelp: 'Enter the Resend API key and the email address that should receive new Power Inflows alerts.',
    mailApiKey: 'Resend API Key',
    mailApiKeyPlaceholder: 'Leave blank to keep the saved key',
    mailApiKeyHelp: 'Enter your Resend API key the first time.',
    mailApiKeyConfiguredHelp: 'API key is saved. Leave blank to keep using it.',
    mailRecipient: 'Recipient Email',
    mailRecipientPlaceholder: 'Separate multiple recipients with commas',
    testEmail: 'Send Test Email',
    testEmailHelp: 'Send one test email using the current API key and recipient.',
    testingEmail: 'Sending...',
    testEmailSent: 'Test email sent. Check the inbox.',
    emailApiKeyRequired: 'Enter the Resend API key.',
    emailRecipientRequired: 'Enter the recipient email.',
    emailStatus: 'Email Status',
    emailRecipientConfigured: 'Recipient Configured',
    emailRecipientMissing: 'No Recipient',
    emailApiKeyMissing: 'No Resend API Key',
    emailSenderMissing: 'No Resend API Key',
    emailSent: 'Sent',
    emailFailed: 'Failed',
    emailSkippedBaseline: 'Baseline; not sent',
    emailSkippedNoEntered: 'No new entries',
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
    'log.email_sent': 'Email notification sent for {count} new entries.',
    'log.email_failed': 'Email notification failed: {message}',
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
  if (/monitor\.mode/i.test(message)) {
    return language === 'zh-CN' ? '监控模式只能选择股票列表、Top Flows 或 Power Inflows。' : 'Monitor mode must be Stock List, Top Flows, or Power Inflows.';
  }
  if (/topFlows\.type/i.test(message)) {
    return language === 'zh-CN' ? 'Top Flows 类型只能是 ALL、NYSE、NASDAQ 或 ETF。' : 'Top Flows type must be ALL, NYSE, NASDAQ, or ETF.';
  }
  if (/Resend default sender can only send/i.test(message)) {
    return language === 'zh-CN'
      ? '当前 Resend 默认发件地址只能发送到该 Resend 账号自己的邮箱。请确认收件邮箱就是注册 Resend 的邮箱。'
      : 'The default Resend sender can only send to the email address registered on this Resend account.';
  }
  if (/Resend API key is missing/i.test(message)) {
    return language === 'zh-CN' ? '请填写 Resend API Key。' : 'Enter the Resend API key.';
  }
  if (/Email recipient is missing/i.test(message)) {
    return language === 'zh-CN' ? '请填写收件邮箱。' : 'Enter the recipient email.';
  }
  if (/notifications\.email\.resendApiKey/i.test(message)) {
    return language === 'zh-CN' ? '请填写 Resend API Key。' : 'Enter the Resend API key.';
  }
  if (/notifications\.email\.from/i.test(message)) {
    return language === 'zh-CN' ? '发送服务发件人尚未配置。' : 'Resend sender is not configured.';
  }
  if (/notifications\.email\.recipient/i.test(message)) {
    return language === 'zh-CN' ? '请填写收件邮箱。' : 'Email recipient is required.';
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
