import {
  SIGNAL_KEYS,
  t as coreT,
  translateError,
  translateLog,
  translateReason,
} from '/core/i18n.js';

const state = {
  loading: false,
  settingsOpen: false,
  setupMode: false,
  language: localStorage.getItem('language') || 'zh-CN',
  monitorMode: 'stock-list',
  symbols: [],
  topFlows: { type: 0 },
  powerInflows: { source: 'export-type-1' },
  notifications: { email: { recipient: '', resendApiKeyConfigured: false } },
  pricePlan: null,
  settingsDirty: false,
  lastStatus: null,
  lastResults: null,
};

document.getElementById('scanNow').addEventListener('click', () => runAction('/api/scan-now', 'scanNow'));
document.getElementById('settingsButton').addEventListener('click', toggleSettings);
document.getElementById('closeSettings').addEventListener('click', closeSettings);
document.getElementById('shutdown').addEventListener('click', shutdownServer);
document.getElementById('settingsForm').addEventListener('submit', saveSettings);
document.getElementById('languageSelect').addEventListener('change', changeLanguage);
document.getElementById('configMode').addEventListener('change', handleModeChange);
document.getElementById('addSymbol').addEventListener('click', addSymbolsFromInput);
document.getElementById('symbolInput').addEventListener('keydown', handleSymbolKeydown);
document.getElementById('symbolInput').addEventListener('paste', () => setTimeout(addSymbolsFromInput, 0));
document.getElementById('testEmail').addEventListener('click', testEmail);
document.getElementById('settingsForm').addEventListener('input', () => {
  state.settingsDirty = true;
});

applyLanguage(state.language);
refresh();
setInterval(refresh, 5000);

async function refresh() {
  if (state.loading) return;
  state.loading = true;
  try {
    const status = await getJson('/api/status');
    state.lastStatus = status;
    setLanguageFromStatus(status);
    renderShell(status);
    populateSettings(status);
    if (!status.needsSetup && status.configOk) {
      const results = await getJson('/api/results');
      state.lastResults = results;
      renderStatus(status);
      renderResults(results);
    }
  } catch (error) {
    renderFetchError(error);
  } finally {
    state.loading = false;
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const button = document.getElementById('saveSettings');
  const errorBox = document.getElementById('settingsError');
  const mode = document.getElementById('configMode').value;
  if (mode === 'stock-list' && !state.symbols.length) {
    showSettingsMessage(t('emptySymbols'), true);
    return;
  }

  button.disabled = true;
  button.textContent = t('saving');
  errorBox.classList.add('hidden');
  errorBox.classList.remove('success');
  errorBox.textContent = '';

  try {
    const response = await fetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(readSettingsForm()),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(translateErrors(result.errors || [result.error || t('saveFailed')]).join('\n'));
    }
    state.settingsDirty = false;
    state.setupMode = false;
    state.settingsOpen = false;
    showSettingsMessage(t('settingsSaved'), false);
    await refresh();
  } catch (error) {
    showSettingsMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = t('saveSettings');
  }
}

function readSettingsForm() {
  const mode = document.getElementById('configMode').value;
  return {
    account: {
      email: document.getElementById('configEmail').value.trim(),
      password: document.getElementById('configPassword').value,
    },
    monitor: {
      mode,
      symbols: state.symbols,
      intervalMinutes: Number(document.getElementById('configInterval').value),
      lookbackMinutes: Number(document.getElementById('configLookback').value),
      runAllDay: true,
    },
    rules: {
      minBuyScoreForEntry: Number(document.getElementById('configEntryScore').value),
      minBuyScoreForStrongEntry: Number(document.getElementById('configStrongScore').value),
    },
    pricePlan: state.pricePlan || undefined,
    topFlows: state.topFlows || { type: 0 },
    powerInflows: state.powerInflows || { source: 'export-type-1' },
    notifications: {
      email: {
        resendApiKey: document.getElementById('mailApiKey').value.trim(),
        recipient: document.getElementById('mailRecipient').value.trim(),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 14587,
    },
    ui: {
      language: state.language,
    },
  };
}

function populateSettings(status, force = false) {
  if (state.settingsDirty && !force) return;
  const config = status.publicConfig || {};
  const monitor = config.monitor || {};
  const rules = config.rules || {};
  const email = config.notifications?.email || {};
  state.pricePlan = config.pricePlan || null;
  state.topFlows = config.topFlows || { type: 0 };
  state.powerInflows = config.powerInflows || { source: 'export-type-1' };
  state.notifications = config.notifications || { email: { recipient: '', resendApiKeyConfigured: false } };
  state.monitorMode = normalizeMonitorMode(monitor.mode);
  document.getElementById('configMode').value = state.monitorMode;
  document.getElementById('configEmail').value = config.account?.email || '';
  document.getElementById('configPassword').value = '';
  document.getElementById('configInterval').value = monitor.intervalMinutes || 5;
  document.getElementById('configLookback').value = monitor.lookbackMinutes || 30;
  document.getElementById('configEntryScore').value = rules.minBuyScoreForEntry || 45;
  document.getElementById('configStrongScore').value = rules.minBuyScoreForStrongEntry || 70;
  document.getElementById('mailApiKey').value = '';
  document.getElementById('mailRecipient').value = email.recipient || '';
  document.getElementById('mailApiKeyHelp').textContent = email.resendApiKeyConfigured
    ? t('mailApiKeyConfiguredHelp')
    : t('mailApiKeyHelp');
  state.symbols = [...(monitor.symbols || ['AAPL'])];
  renderModeFields();
  renderSymbolTags();
}

function handleModeChange(event) {
  state.monitorMode = normalizeMonitorMode(event.target.value);
  state.settingsDirty = true;
  renderModeFields();
}

function renderModeFields() {
  const stockMode = state.monitorMode === 'stock-list';
  const powerInflowsMode = state.monitorMode === 'power-inflows';
  document.querySelectorAll('.stock-only').forEach((element) => {
    element.classList.toggle('hidden', !stockMode);
  });
  document.querySelectorAll('.power-inflows-only').forEach((element) => {
    element.classList.toggle('hidden', !powerInflowsMode);
  });
  ['configLookback', 'configEntryScore', 'configStrongScore'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.required = stockMode;
  });
  ['mailApiKey', 'mailRecipient'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.required = false;
  });
}

function normalizeMonitorMode(mode) {
  return ['stock-list', 'topflows', 'power-inflows'].includes(mode) ? mode : 'stock-list';
}

function addSymbolsFromInput() {
  const input = document.getElementById('symbolInput');
  const items = parseSymbols(input.value);
  if (!items.length) return;
  const existing = new Set(state.symbols);
  for (const item of items) existing.add(item);
  state.symbols = [...existing].sort();
  input.value = '';
  state.settingsDirty = true;
  renderSymbolTags();
}

function handleSymbolKeydown(event) {
  if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
    event.preventDefault();
    addSymbolsFromInput();
  }
}

function parseSymbols(value) {
  return String(value || '')
    .split(/[\s,;，；]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z0-9.\-]+$/.test(item));
}

function removeSymbol(symbol) {
  state.symbols = state.symbols.filter((item) => item !== symbol);
  state.settingsDirty = true;
  renderSymbolTags();
}

function renderSymbolTags() {
  const container = document.getElementById('symbolTags');
  if (!state.symbols.length) {
    container.innerHTML = `<span class="muted">${t('emptySymbols')}</span>`;
    return;
  }
  container.innerHTML = state.symbols.map((symbol) => `
    <span class="symbol-tag">
      <span>${escapeHtml(symbol)}</span>
      <button type="button" data-symbol="${escapeHtml(symbol)}" aria-label="${t('remove')} ${escapeHtml(symbol)}">x</button>
    </span>
  `).join('');
  container.querySelectorAll('button[data-symbol]').forEach((button) => {
    button.addEventListener('click', () => removeSymbol(button.dataset.symbol));
  });
}

async function runAction(url, buttonId) {
  const button = document.getElementById(buttonId);
  button.disabled = true;
  try {
    await fetch(url, { method: 'POST' });
    await refresh();
  } finally {
    button.disabled = false;
  }
}

async function testEmail() {
  const button = document.getElementById('testEmail');
  const resendApiKey = document.getElementById('mailApiKey').value.trim();
  const recipient = document.getElementById('mailRecipient').value.trim();
  const hasSavedApiKey = Boolean(state.notifications?.email?.resendApiKeyConfigured);

  if (!resendApiKey && !hasSavedApiKey) {
    showSettingsMessage(t('emailApiKeyRequired'), true);
    return;
  }
  if (!recipient) {
    showSettingsMessage(t('emailRecipientRequired'), true);
    return;
  }

  button.disabled = true;
  button.textContent = t('testingEmail');
  try {
    const response = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        notifications: {
          email: {
            resendApiKey,
            recipient,
          },
        },
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(translateErrors(result.errors || [result.error || t('emailFailed')]).join('\n'));
    }
    showSettingsMessage(t('testEmailSent'), false);
  } catch (error) {
    showSettingsMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = t('testEmail');
  }
}

async function shutdownServer() {
  const warning = document.getElementById('configWarning');
  warning.textContent = t('shuttingDown');
  warning.classList.remove('hidden');
  await fetch('/api/shutdown', { method: 'POST' }).catch(() => {});
}

async function changeLanguage(event) {
  const language = event.target.value;
  state.language = language;
  localStorage.setItem('language', language);
  applyLanguage(language);
  renderSymbolTags();
  renderModeFields();
  rerenderCachedView();

  if (state.settingsDirty || state.setupMode) return;

  fetch('/api/language', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language }),
  }).catch(() => {});
}

async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

function setLanguageFromStatus(status) {
  const configured = status.needsSetup
    ? localStorage.getItem('language') || status.publicConfig?.ui?.language
    : status.publicConfig?.ui?.language;
  const language = ['zh-CN', 'en-US'].includes(configured) ? configured : 'zh-CN';
  if (language !== state.language && !state.settingsDirty) {
    state.language = language;
    localStorage.setItem('language', language);
  }
  applyLanguage(state.language);
}

function rerenderCachedView() {
  if (!state.lastStatus) return;
  renderShell(state.lastStatus);
  if (!state.lastStatus.needsSetup && state.lastStatus.configOk) {
    renderStatus(state.lastStatus);
    renderResults(state.lastResults);
  }
}

function applyLanguage(language) {
  state.language = ['zh-CN', 'en-US'].includes(language) ? language : 'zh-CN';
  document.documentElement.lang = state.language;
  document.getElementById('languageSelect').value = state.language;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  updateMailApiKeyHelp();
}

function updateMailApiKeyHelp() {
  const help = document.getElementById('mailApiKeyHelp');
  if (!help) return;
  help.textContent = state.notifications?.email?.resendApiKeyConfigured
    ? t('mailApiKeyConfiguredHelp')
    : t('mailApiKeyHelp');
}

function renderShell(status) {
  const setup = Boolean(status.needsSetup || !status.configOk);
  state.setupMode = setup;
  if (setup) state.settingsOpen = true;
  document.getElementById('settingsPanel').classList.toggle('hidden', !state.settingsOpen);
  document.getElementById('closeSettings').classList.toggle('hidden', setup);
  document.getElementById('settingsButton').classList.toggle('hidden', setup);
  document.getElementById('scanNow').classList.toggle('hidden', setup);
  document.getElementById('shutdown').classList.toggle('hidden', setup);
  document.querySelectorAll('.monitor-panel').forEach((panel) => {
    panel.classList.toggle('hidden', setup);
  });
  document.getElementById('settingsTitle').textContent = setup ? t('settingsTitle') : t('settings');
  document.getElementById('settingsCopy').textContent = t('settingsCopy');
}

function renderStatus(status) {
  const serviceBadge = document.getElementById('serviceStatus');
  serviceBadge.textContent = status.scanning ? t('scanning') : status.running ? t('running') : t('stopped');
  serviceBadge.className = `badge ${status.configOk && status.login.status !== 'error' ? 'ok' : 'warn'}`;

  document.getElementById('loginStatus').textContent = loginText(status);
  document.getElementById('lastScan').textContent = formatDateTime(status.schedule.lastRunFinishedAt);
  document.getElementById('nextScan').textContent = formatDateTime(status.schedule.nextRunAt);
  document.getElementById('tradeDate').textContent = status.latest?.tradeDate || '-';

  const warning = document.getElementById('configWarning');
  const errors = translateErrors([
    ...(status.configErrors || []),
    status.lastError || '',
    status.login.error || '',
  ].filter(Boolean));
  warning.textContent = errors.join('\n');
  warning.classList.toggle('hidden', errors.length === 0);

  const config = status.publicConfig || {};
  const mode = normalizeMonitorMode(config.monitor?.mode);
  document.getElementById('configPath').textContent = config.configPath || '-';
  document.getElementById('accountEmail').textContent = config.account?.email || '-';
  document.getElementById('watchSymbolsLabel').textContent = mode === 'stock-list' ? t('symbols') : t('monitorMode');
  document.getElementById('watchSymbols').textContent = modeSummaryText(config);
  document.getElementById('interval').textContent = t('minutes', { value: config.monitor?.intervalMinutes || '-' });
  document.getElementById('lookback').textContent = mode === 'stock-list'
    ? t('minutes', { value: config.monitor?.lookbackMinutes || '-' })
    : '-';

  renderLogs(status.logs || []);
}

function renderResults(scan) {
  document.getElementById('scanMeta').textContent = scan
    ? `${formatDateTime(scan.generatedAt)} / ${scan.durationMs || 0}ms`
    : t('noScan');

  if (scan?.mode === 'topflows') {
    renderTopFlowsResults(scan);
    return;
  }
  if (scan?.mode === 'power-inflows') {
    renderPowerInflowsResults(scan);
    return;
  }

  renderStockResults(scan);
}

function renderStockResults(scan) {
  const summary = scan?.summary || {};
  document.getElementById('resultsTitle').textContent = t('watchlist');
  document.getElementById('resultsHead').innerHTML = `
    <th>${t('symbol')}</th>
    <th>${t('signal')}</th>
    <th>${t('buyScore')}</th>
    <th>${t('sellScore')}</th>
    <th>${t('price')}</th>
    <th>${t('largeDeal')}</th>
    <th>${t('recentLargeDeal')}</th>
    <th>${t('pricePlan')}</th>
    <th>${t('reason')}</th>
  `;
  document.getElementById('symbolCount').textContent = scan?.results?.length
    ? t('symbolCount', { value: scan.results.length })
    : '-';

  const summaryEl = document.getElementById('summary');
  summaryEl.innerHTML = Object.keys(SIGNAL_KEYS).map((signal) => `
    <div class="summary-item">
      <span>${t(signal)}</span>
      <strong>${summary[signal] || 0}</strong>
    </div>
  `).join('');

  const body = document.getElementById('resultsBody');
  if (!scan?.results?.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty">${t('waitingResults')}</td></tr>`;
    return;
  }

  body.innerHTML = scan.results.map((item) => {
    const metrics = item.metrics || {};
    const price = metrics.rows
      ? `${fixed(metrics.firstPrice)} -> ${fixed(metrics.lastPrice)} (${fixed(metrics.priceChangePct)}%)`
      : '-';
    const largeDeal = metrics.rows
      ? `${fixed(metrics.totalLargeDeal)} / ${fixed((metrics.largeDealRatio || 0) * 100, 1)}%`
      : '-';
    const recent = metrics.rows
      ? `${fixed(metrics.recentLargeDeal)} / ${fixed((metrics.recentLargeDealRatio || 0) * 100, 1)}%`
      : '-';
    const firstSeen = item.firstSeen ? `<span class="badge ok">${t('firstSeen')}</span>` : '';
    return `
      <tr>
        <td><strong>${escapeHtml(item.symbol)}</strong> ${firstSeen}</td>
        <td><span class="signal ${item.signal}">${t(item.signal)}</span></td>
        <td class="metric">${item.buyScore}</td>
        <td class="metric">${item.sellScore}</td>
        <td class="metric">${price}</td>
        <td class="metric">${largeDeal}</td>
        <td class="metric">${recent}</td>
        <td class="price-plan">${renderPricePlan(item.pricePlan)}</td>
        <td class="reason">${(item.reasons || []).slice(0, 4).map((reason) => translateReason(reason, state.language)).map(escapeHtml).join('<br>')}</td>
      </tr>
    `;
  }).join('');
}

function renderTopFlowsResults(scan) {
  const summary = scan?.summary || {};
  const rows = scan?.topFlows?.rows || [];
  const changes = scan?.topFlows?.changes || {};
  const changeMap = buildTopFlowChangeMap(changes);

  document.getElementById('resultsTitle').textContent = t('topFlowsWatchlist');
  document.getElementById('resultsHead').innerHTML = `
    <th>${t('rank')}</th>
    <th>${t('symbol')}</th>
    <th>${t('topFlowsName')}</th>
    <th>${t('price')}</th>
    <th>${t('score')}</th>
    <th>${t('momentum')}</th>
    <th>${t('daily')}</th>
    <th>${t('topFlowsLargeDeal')}</th>
    <th>${t('reason')}</th>
  `;
  document.getElementById('symbolCount').textContent = rows.length
    ? t('topFlowsRows', { value: rows.length })
    : '-';

  const entered = changes.entered?.length ?? summary.TOPFLOWS_ENTERED ?? 0;
  const exited = changes.exited?.length ?? summary.TOPFLOWS_EXITED ?? 0;
  const moved = changes.rankChanged?.length ?? summary.TOPFLOWS_RANK_CHANGED ?? 0;
  const total = changes.total ?? summary.TOPFLOWS_TOTAL_CHANGES ?? 0;
  document.getElementById('summary').innerHTML = [
    [t('topFlowsSummary'), total],
    [t('topFlowsEntered'), entered],
    [t('topFlowsExited'), exited],
    [t('topFlowsMoved'), moved],
  ].map(([label, value]) => `
    <div class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `).join('');

  const body = document.getElementById('resultsBody');
  if (!rows.length && !changes.exited?.length) {
    body.innerHTML = `<tr><td colspan="9" class="empty">${t('waitingResults')}</td></tr>`;
    return;
  }

  const currentRows = rows.map((row) => renderTopFlowRow(row, changeMap.get(row.symbol), changes.baseline));
  const exitedRows = (changes.exited || []).map(renderExitedTopFlowRow);
  body.innerHTML = [...currentRows, ...exitedRows].join('');
}

function buildTopFlowChangeMap(changes) {
  const map = new Map();
  for (const row of changes.entered || []) map.set(row.symbol, row);
  for (const row of changes.rankChanged || []) map.set(row.symbol, row);
  return map;
}

function renderTopFlowRow(row, change, baseline) {
  return `
    <tr>
      <td class="metric">${escapeHtml(row.rank || '-')}</td>
      <td><strong>${escapeHtml(row.symbol)}</strong> ${renderTopFlowBadge(change)}</td>
      <td class="topflow-name">${escapeHtml(row.name || '-')}</td>
      <td class="metric">${fixed(row.price)} <span class="${numberClass(row.changePct)}">${formatSignedPct(row.changePct)}</span></td>
      <td class="metric">${fixed(row.score, 1)}</td>
      <td class="metric">${fixed(row.momentum, 2)}</td>
      <td class="metric">${fixed(row.daily, 2)}</td>
      <td class="metric">${formatCompact(row.largeDeal)}</td>
      <td class="reason">${renderTopFlowChangeNote(row, change, baseline)}</td>
    </tr>
  `;
}

function renderExitedTopFlowRow(row) {
  return `
    <tr class="topflow-exited">
      <td class="metric">${escapeHtml(row.rank || '-')}</td>
      <td><strong>${escapeHtml(row.symbol)}</strong> <span class="change-badge exited">${t('topFlowsExited')}</span></td>
      <td class="topflow-name">${escapeHtml(row.name || '-')}</td>
      <td class="metric">${fixed(row.price)} <span class="${numberClass(row.changePct)}">${formatSignedPct(row.changePct)}</span></td>
      <td class="metric">${fixed(row.score, 1)}</td>
      <td class="metric">${fixed(row.momentum, 2)}</td>
      <td class="metric">${fixed(row.daily, 2)}</td>
      <td class="metric">${formatCompact(row.largeDeal)}</td>
      <td class="reason">${t('topFlowsExited')}</td>
    </tr>
  `;
}

function renderTopFlowBadge(change) {
  if (!change) return '';
  if (change.changeType === 'entered') {
    return `<span class="change-badge entered">${t('topFlowsEntered')}</span>`;
  }
  if (change.changeType === 'rankChanged') {
    return `<span class="change-badge moved">${t('topFlowsMoved')}</span>`;
  }
  return '';
}

function renderTopFlowChangeNote(row, change, baseline) {
  if (baseline) return escapeHtml(t('topFlowsBaseline'));
  if (!change) return `<span class="muted">${t('topFlowsNoChange')}</span>`;
  if (change.changeType === 'entered') return escapeHtml(t('topFlowsEntered'));
  if (change.changeType === 'rankChanged') {
    return `${escapeHtml(t('topFlowsMoved'))}: #${escapeHtml(change.previousRank)} -> #${escapeHtml(row.rank)}`;
  }
  return '-';
}

function renderPowerInflowsResults(scan) {
  const summary = scan?.summary || {};
  const rows = scan?.powerInflows?.rows || [];
  const changes = scan?.powerInflows?.changes || {};
  const notification = scan?.powerInflows?.notification || {};
  const enteredSymbols = new Set((changes.entered || []).map((row) => row.symbol));

  document.getElementById('resultsTitle').textContent = t('powerInflowsWatchlist');
  document.getElementById('resultsHead').innerHTML = `
    <th>${t('rank')}</th>
    <th>${t('symbol')}</th>
    <th>${t('topFlowsName')}</th>
    <th>${t('tradeDate')}</th>
    <th>${t('triggerTime')}</th>
    <th>${t('price')}</th>
    <th>${t('status')}</th>
    <th>${t('reason')}</th>
  `;
  document.getElementById('symbolCount').textContent = rows.length
    ? t('powerInflowsRows', { value: rows.length })
    : '-';

  document.getElementById('summary').innerHTML = [
    [t('powerInflowsRowsLabel'), summary.POWER_INFLOW_ROWS || rows.length || 0],
    [t('powerInflowsEntered'), summary.POWER_INFLOW_ENTERED || 0],
    [t('powerInflowsExited'), summary.POWER_INFLOW_EXITED || 0],
    [t('emailStatus'), emailStatusText(notification)],
  ].map(([label, value]) => `
    <div class="summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join('');

  const body = document.getElementById('resultsBody');
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="empty">${t('waitingResults')}</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row) => renderPowerInflowRow(row, enteredSymbols.has(row.symbol), changes.baseline)).join('');
}

function renderPowerInflowRow(row, entered, baseline) {
  const status = baseline
    ? t('powerInflowsBaseline')
    : entered ? t('powerInflowsEntered') : t('powerInflowsExisting');
  const badge = entered ? `<span class="change-badge entered">${t('powerInflowsEntered')}</span>` : '';
  return `
    <tr>
      <td class="metric">${escapeHtml(row.rank || '-')}</td>
      <td><strong>${escapeHtml(row.symbol)}</strong> ${badge}</td>
      <td class="topflow-name">${escapeHtml(row.name || '-')}</td>
      <td class="metric">${escapeHtml(row.date || '-')}</td>
      <td class="metric">${escapeHtml(row.time || '-')}</td>
      <td class="metric">${row.price ? fixed(row.price) : '-'}</td>
      <td>${escapeHtml(status)}</td>
      <td class="reason">${escapeHtml(powerInflowRawSummary(row.raw))}</td>
    </tr>
  `;
}

function powerInflowRawSummary(raw = {}) {
  return Object.entries(raw)
    .filter(([key]) => !['SYMBOL', 'NAME', 'DATE', 'TIME'].includes(key.toUpperCase()))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ') || '-';
}

function emailStatusText(notification = {}) {
  if (!notification.enabled) return t('emailRecipientMissing');
  if (notification.sent) return t('emailSent');
  if (notification.error) return t('emailFailed');
  if (notification.skippedReason === 'api_key_missing' || notification.skippedReason === 'sender_missing') {
    return t('emailApiKeyMissing');
  }
  if (notification.skippedReason === 'baseline') return t('emailSkippedBaseline');
  if (notification.skippedReason === 'no_entered') return t('emailSkippedNoEntered');
  return t('emailRecipientConfigured');
}

function renderPricePlan(plan) {
  if (!plan || plan.enabled === false || plan.status === 'NO_DATA') {
    return `<span class="muted">${t(`pricePlanStatus${plan?.status || 'NO_DATA'}`)}</span>`;
  }

  const status = t(`pricePlanStatus${plan.status || 'LOW_CONFIDENCE'}`);
  const source = plan.source === 'chart' ? t('pricePlanSourceChart') : t('pricePlanSourceExport');
  const actionText = plan.actionable ? t('pricePlanActionable') : t('pricePlanNotActionable');
  const reasons = (plan.reasons || [])
    .slice(0, 2)
    .map((item) => translateReason(item, state.language))
    .map(escapeHtml)
    .join('<br>');

  return `
    <div class="price-plan-box">
      <div><strong>${escapeHtml(status)}</strong> / ${escapeHtml(actionText)}</div>
      <div>${t('pricePlanWatch')}: <strong>${fixed(plan.watchPrice)}</strong></div>
      <div>${t('pricePlanBuyZone')}: ${fixed(plan.buyZoneLow)} - ${fixed(plan.buyZoneHigh)}</div>
      <div>${t('pricePlanBreakout')}: ${fixed(plan.confirmBreakoutPrice)}</div>
      <div>${t('pricePlanStop')}: ${fixed(plan.riskStopPrice)}</div>
      <div>${t('pricePlanConfidence')}: ${plan.confidenceScore || 0}/${plan.minConfidence || 60}</div>
      <div>${t('pricePlanSource')}: ${escapeHtml(source)}</div>
      ${reasons ? `<div class="muted">${reasons}</div>` : ''}
    </div>
  `;
}

function renderLogs(logs) {
  const el = document.getElementById('logs');
  if (!logs.length) {
    el.innerHTML = `<div class="muted">${t('noLogs')}</div>`;
    return;
  }
  el.innerHTML = logs.slice(0, 40).map((log) => `
    <div class="log ${escapeHtml(log.level)}">
      <span>${formatDateTime(log.at)}</span>
      <span class="level">${escapeHtml(log.level)}</span>
      <span>${escapeHtml(translateLog(log, state.language))}</span>
    </div>
  `).join('');
}

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  document.getElementById('settingsPanel').classList.toggle('hidden', !state.settingsOpen);
}

function closeSettings() {
  state.settingsOpen = false;
  state.settingsDirty = false;
  document.getElementById('settingsPanel').classList.add('hidden');
  document.getElementById('settingsError').classList.add('hidden');
  refresh();
}

function showSettingsMessage(message, isError) {
  const box = document.getElementById('settingsError');
  box.textContent = message;
  box.classList.remove('hidden');
  box.classList.toggle('success', !isError);
}

function renderFetchError(error) {
  const warning = state.setupMode || state.settingsOpen
    ? document.getElementById('settingsError')
    : document.getElementById('configWarning');
  warning.textContent = t('serverReadFailed', { message: error.message });
  warning.classList.remove('hidden');
}

function loginText(status) {
  if (status.login.status === 'ok') return t('loginOk', { time: formatDateTime(status.login.loggedInAt) });
  if (status.login.status === 'error') return t('loginError');
  return status.scanning ? t('loggingIn') : t('loginIdle');
}

function t(key, params = {}) {
  return coreT(state.language, key, params);
}

function translateErrors(errors) {
  return errors.map((message) => translateError(message, state.language));
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(state.language === 'zh-CN' ? 'zh-CN' : 'en-US', { hour12: false });
}

function fixed(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '-';
}

function formatSignedPct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  const sign = number > 0 ? '+' : '';
  return `${sign}${number.toFixed(2)}%`;
}

function formatCompact(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return new Intl.NumberFormat(state.language === 'zh-CN' ? 'zh-CN' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(number);
}

function numberClass(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return 'muted';
  return number > 0 ? 'positive' : 'negative';
}

function topFlowsTypeText(type) {
  return {
    0: 'ALL',
    1: 'NYSE',
    2: 'NASDAQ',
    3: 'ETF',
  }[Number(type)] || 'ALL';
}

function modeSummaryText(config) {
  const mode = normalizeMonitorMode(config.monitor?.mode);
  if (mode === 'topflows') return `${t('topFlowsMode')} / ${topFlowsTypeText(config.topFlows?.type)}`;
  if (mode === 'power-inflows') {
    const recipient = config.notifications?.email?.recipient || t('emailRecipientMissing');
    return `${t('powerInflowsMode')} / ${recipient}`;
  }
  return (config.monitor?.symbols || []).join(', ') || '-';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
