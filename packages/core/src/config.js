export const DEFAULT_CONFIG = {
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
  powerInflows: {
    source: 'export-type-1',
  },
  notifications: {
    email: {
      recipient: '',
      resendApiKey: '',
      from: 'TradePulse Monitor <onboarding@resend.dev>',
    },
  },
  server: {
    host: '127.0.0.1',
    port: 14587,
  },
  ui: {
    language: 'zh-CN',
  },
};

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'];
export const SUPPORTED_MONITOR_MODES = ['stock-list', 'topflows', 'power-inflows'];

export function normalizeConfig(input) {
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
  if (!config.powerInflows || typeof config.powerInflows !== 'object' || Array.isArray(config.powerInflows)) {
    config.powerInflows = clone(DEFAULT_CONFIG.powerInflows);
  }
  config.powerInflows.source = String(config.powerInflows.source || DEFAULT_CONFIG.powerInflows.source);
  if (!config.notifications || typeof config.notifications !== 'object' || Array.isArray(config.notifications)) {
    config.notifications = clone(DEFAULT_CONFIG.notifications);
  }
  if (!config.notifications.email || typeof config.notifications.email !== 'object' || Array.isArray(config.notifications.email)) {
    config.notifications.email = clone(DEFAULT_CONFIG.notifications.email);
  }
  config.notifications.email.recipient = String(
    config.notifications.email.recipient
    || config.notifications.email.to
    || '',
  ).trim();
  config.notifications.email.resendApiKey = String(config.notifications.email.resendApiKey || '').trim();
  config.notifications.email.from = String(config.notifications.email.from || DEFAULT_CONFIG.notifications.email.from).trim();
  config.server.host = String(config.server.host || DEFAULT_CONFIG.server.host);
  config.server.port = Number(config.server.port || DEFAULT_CONFIG.server.port);
  config.ui.language = normalizeLanguage(config.ui.language);
  return config;
}

export function validateConfig(config) {
  const errors = [];

  if (!config.account.email) errors.push('account.email is required.');
  if (!config.account.password) errors.push('account.password is required.');
  if (!SUPPORTED_MONITOR_MODES.includes(config.monitor.mode)) {
    errors.push('monitor.mode must be stock-list, topflows, or power-inflows.');
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
  if (config.powerInflows.source !== 'export-type-1') {
    errors.push('powerInflows.source must be export-type-1.');
  }
  if (!Number.isInteger(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push('server.port must be a valid TCP port.');
  }
  if (!SUPPORTED_LANGUAGES.includes(config.ui.language)) {
    errors.push('ui.language must be zh-CN or en-US.');
  }

  return errors;
}

export function publicConfig(config, configPath) {
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
    powerInflows: config.powerInflows,
    notifications: {
      email: {
        recipient: config.notifications.email.recipient,
        resendApiKeyConfigured: Boolean(config.notifications.email.resendApiKey),
        senderConfigured: Boolean(config.notifications.email.resendApiKey),
      },
    },
    server: config.server,
    ui: config.ui,
  };
}

export function normalizeSymbols(symbols) {
  if (typeof symbols === 'string') {
    symbols = symbols.split(/[\s,;，；]+/);
  }
  if (!Array.isArray(symbols)) return [];
  return [...new Set(symbols
    .map((symbol) => String(symbol || '').trim().toUpperCase())
    .filter(Boolean))];
}

export function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.ui.language;
}

export function normalizeMonitorMode(mode) {
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
