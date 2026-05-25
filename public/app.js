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
  symbols: [],
  pricePlan: null,
  settingsDirty: false,
};

document.getElementById('scanNow').addEventListener('click', () => runAction('/api/scan-now', 'scanNow'));
document.getElementById('settingsButton').addEventListener('click', toggleSettings);
document.getElementById('closeSettings').addEventListener('click', closeSettings);
document.getElementById('shutdown').addEventListener('click', shutdownServer);
document.getElementById('settingsForm').addEventListener('submit', saveSettings);
document.getElementById('languageSelect').addEventListener('change', changeLanguage);
document.getElementById('addSymbol').addEventListener('click', addSymbolsFromInput);
document.getElementById('symbolInput').addEventListener('keydown', handleSymbolKeydown);
document.getElementById('symbolInput').addEventListener('paste', () => setTimeout(addSymbolsFromInput, 0));
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
    setLanguageFromStatus(status);
    renderShell(status);
    populateSettings(status);
    if (!status.needsSetup && status.configOk) {
      const results = await getJson('/api/results');
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
  if (!state.symbols.length) {
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
  return {
    account: {
      email: document.getElementById('configEmail').value.trim(),
      password: document.getElementById('configPassword').value,
    },
    monitor: {
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
  state.pricePlan = config.pricePlan || null;
  document.getElementById('configEmail').value = config.account?.email || '';
  document.getElementById('configPassword').value = '';
  document.getElementById('configInterval').value = monitor.intervalMinutes || 5;
  document.getElementById('configLookback').value = monitor.lookbackMinutes || 30;
  document.getElementById('configEntryScore').value = rules.minBuyScoreForEntry || 45;
  document.getElementById('configStrongScore').value = rules.minBuyScoreForStrongEntry || 70;
  state.symbols = [...(monitor.symbols || ['AAPL'])];
  renderSymbolTags();
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

  if (state.settingsDirty || state.setupMode) return;

  await fetch('/api/language', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language }),
  }).catch(() => {});
  await refresh();
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
  document.getElementById('configPath').textContent = config.configPath || '-';
  document.getElementById('accountEmail').textContent = config.account?.email || '-';
  document.getElementById('watchSymbols').textContent = (config.monitor?.symbols || []).join(', ') || '-';
  document.getElementById('interval').textContent = t('minutes', { value: config.monitor?.intervalMinutes || '-' });
  document.getElementById('lookback').textContent = t('minutes', { value: config.monitor?.lookbackMinutes || '-' });

  renderLogs(status.logs || []);
}

function renderResults(scan) {
  const summary = scan?.summary || {};
  document.getElementById('scanMeta').textContent = scan
    ? `${formatDateTime(scan.generatedAt)} / ${scan.durationMs || 0}ms`
    : t('noScan');
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
