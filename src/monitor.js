import fs from 'node:fs';
import path from 'node:path';
import { analyzeRows, isTriggeredSignal } from '../packages/core/src/analyzer.js';
import { loadConfig, publicConfig } from './config.js';
import { parseCsv } from '../packages/core/src/csv.js';
import { AuthRequiredError, TradePulseClient } from './tradepulse-client.js';
import {
  compareTopFlowSnapshots,
  normalizeTopFlowRows,
  normalizeTopFlowsType,
  summarizeTopFlowChanges,
  topFlowsTypeLabel,
} from './topflows.js';

const VERSION = '1.2.0';

export class MonitorService {
  constructor({ rootDir }) {
    this.rootDir = rootDir;
    this.configLoad = loadConfig(rootDir);
    this.config = this.configLoad.config;
    this.client = this.createClient();
    this.timer = null;
    this.startedAt = new Date().toISOString();
    this.seenSignals = new Set();
    this.topFlowsSnapshot = null;
    this.history = [];
    this.logs = [];
    this.state = {
      version: VERSION,
      startedAt: this.startedAt,
      running: false,
      scanning: false,
      configOk: this.configLoad.ok,
      configErrors: this.configLoad.errors,
      needsSetup: Boolean(this.configLoad.needsSetup || !this.configLoad.ok),
      setupReason: this.configLoad.errors.join(' '),
      lastConfigLoadAt: new Date().toISOString(),
      login: {
        status: 'idle',
        loggedInAt: null,
        error: '',
      },
      schedule: {
        intervalMinutes: this.config.monitor.intervalMinutes,
        nextRunAt: null,
        lastRunStartedAt: null,
        lastRunFinishedAt: null,
      },
      latest: null,
      lastError: '',
    };
  }

  start() {
    this.loadSeenSignalsFromHistory();
    this.state.running = true;
    this.log('info', 'service_started');
    if (this.configLoad.ok) {
      this.scanNow('startup').catch((error) => this.log('error', error.message));
    } else {
      this.log('error', 'config_error', { message: this.configLoad.errors.join(' ') });
      this.scheduleNext();
    }
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.state.running = false;
  }

  reloadConfig({ scan = true } = {}) {
    this.configLoad = loadConfig(this.rootDir);
    this.config = this.configLoad.config;
    this.client = this.createClient();
    this.state.configOk = this.configLoad.ok;
    this.state.configErrors = this.configLoad.errors;
    this.state.needsSetup = Boolean(this.configLoad.needsSetup || !this.configLoad.ok);
    this.state.setupReason = this.configLoad.errors.join(' ');
    this.state.lastConfigLoadAt = new Date().toISOString();
    this.state.schedule.intervalMinutes = this.config.monitor.intervalMinutes;
    this.state.login = {
      status: 'idle',
      loggedInAt: null,
      error: '',
    };
    this.log(this.configLoad.ok ? 'info' : 'error', this.configLoad.ok
      ? 'config_reloaded'
      : 'config_reload_failed', { message: this.configLoad.errors.join(' ') });
    if (this.configLoad.ok && scan) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.state.schedule.nextRunAt = null;
      this.scanNow('config').catch((error) => this.log('error', error.message));
    } else if (this.configLoad.ok) {
      this.scheduleNext();
    } else {
      this.scheduleNext();
    }
    return this.getStatus();
  }

  async scanNow(trigger = 'manual') {
    if (this.state.scanning) {
      return {
        ok: false,
        busy: true,
        message: 'Scan already running.',
      };
    }

    if (!this.configLoad.ok) {
      this.state.lastError = this.configLoad.errors.join(' ');
      return {
        ok: false,
        busy: false,
        message: this.state.lastError,
      };
    }

    this.state.scanning = true;
    this.state.schedule.lastRunStartedAt = new Date().toISOString();
    this.state.lastError = '';
    const started = Date.now();
    this.log('info', 'scan_started', { trigger });

    try {
      const result = await this.runScan(trigger);
      this.state.latest = result;
      this.history.unshift(summarizeScan(result));
      this.history = this.history.slice(0, 200);
      this.appendHistory(result);
      this.state.schedule.lastRunFinishedAt = new Date().toISOString();
      this.log('info', 'scan_finished', {
        symbols: result.results.length || result.topFlows?.rows?.length || 0,
        durationMs: result.durationMs,
      });
      return {
        ok: true,
        busy: false,
        result,
      };
    } catch (error) {
      this.state.lastError = error.message;
      this.state.schedule.lastRunFinishedAt = new Date().toISOString();
      this.log('error', 'scan_failed', { message: error.message });
      return {
        ok: false,
        busy: false,
        message: error.message,
      };
    } finally {
      this.state.scanning = false;
      this.state.schedule.lastRunFinishedAt ||= new Date().toISOString();
      this.state.latest ||= null;
      if (this.state.latest) this.state.latest.durationMs = Date.now() - started;
      this.scheduleNext();
    }
  }

  async runScan(trigger) {
    if (this.config.monitor.mode === 'topflows') {
      return this.runTopFlowsScan(trigger);
    }
    return this.runStockListScan(trigger);
  }

  async runStockListScan(trigger) {
    const started = Date.now();
    await this.ensureLoggedIn();

    const dates = await this.client.getLatestDates();
    const tradeDate = dates[0];
    if (!tradeDate) throw new Error('TradePulse did not return an enabled data date.');

    const [stockExport, powerExport] = await this.fetchExportsWithRelogin(tradeDate);
    const chartRowsBySymbol = await this.fetchChartRowsBySymbol();
    const stockRows = parseCsv(stockExport.text);
    const powerRows = parseCsv(powerExport.text);
    const displayDate = `${tradeDate.slice(0, 4)}-${tradeDate.slice(4, 6)}-${tradeDate.slice(6, 8)}`;
    const results = analyzeRows({
      date: displayDate,
      stockRows,
      powerRows,
      config: this.config,
      seenSignals: this.seenSignals,
      chartRowsBySymbol,
    });

    return {
      id: `${Date.now()}`,
      trigger,
      generatedAt: new Date().toISOString(),
      tradeDate: displayDate,
      durationMs: Date.now() - started,
      source: {
        stockExportUrl: stockExport.url,
        powerExportUrl: powerExport.url,
        stockRows: stockRows.length,
        powerRows: powerRows.length,
        chartRows: Object.fromEntries(
          Object.entries(chartRowsBySymbol).map(([symbol, rows]) => [symbol, rows.length]),
        ),
      },
      results,
      summary: summarizeSignals(results),
    };
  }

  async runTopFlowsScan(trigger) {
    const started = Date.now();
    await this.ensureLoggedIn();

    const type = normalizeTopFlowsType(this.config.topFlows?.type);
    const topFlows = await this.client.getTopFlows({ type });
    const rows = normalizeTopFlowRows(topFlows.rows);
    const previousRows = this.topFlowsSnapshot?.type === type ? this.topFlowsSnapshot.rows : [];
    const changes = compareTopFlowSnapshots(previousRows, rows);
    const generatedAt = new Date().toISOString();
    this.topFlowsSnapshot = {
      generatedAt,
      type,
      rows,
    };

    return {
      id: `${Date.now()}`,
      mode: 'topflows',
      trigger,
      generatedAt,
      tradeDate: generatedAt.slice(0, 10),
      durationMs: Date.now() - started,
      source: {
        topFlowsUrl: topFlows.url,
        topFlowsType: type,
        topFlowsLabel: topFlowsTypeLabel(type),
        topFlowRows: rows.length,
      },
      topFlows: {
        type,
        label: topFlowsTypeLabel(type),
        rows,
        changes,
      },
      results: [],
      summary: summarizeTopFlowChanges(changes),
    };
  }

  async fetchExportsWithRelogin(tradeDate) {
    try {
      return await this.fetchExports(tradeDate);
    } catch (error) {
      if (!(error instanceof AuthRequiredError)) throw error;
      this.log('warn', 'export_session_expired');
      await this.login();
      return this.fetchExports(tradeDate);
    }
  }

  async fetchExports(tradeDate) {
    const [stockExport, powerExport] = await Promise.all([
      this.client.exportCsv({
        symbols: this.config.monitor.symbols,
        date: tradeDate,
        type: 0,
      }),
      this.client.exportCsv({
        symbols: '*',
        date: tradeDate,
        type: 1,
      }),
    ]);
    return [stockExport, powerExport];
  }

  async fetchChartRowsBySymbol() {
    const entries = await Promise.all(this.config.monitor.symbols.map(async (symbol) => {
      try {
        const chart = await this.client.getChartRows(symbol);
        return [symbol, chart.rows];
      } catch (error) {
        this.log('warn', 'chart_data_failed', { symbol, message: error.message });
        return [symbol, []];
      }
    }));
    return Object.fromEntries(entries);
  }

  async ensureLoggedIn() {
    try {
      const user = await this.client.ensureLoggedIn();
      this.state.login.status = 'ok';
      this.state.login.loggedInAt = this.client.loggedInAt;
      this.state.login.error = '';
      this.state.login.user = user;
      return user;
    } catch (error) {
      this.state.login.status = 'error';
      this.state.login.error = error.message;
      throw error;
    }
  }

  async login() {
    const user = await this.client.login();
    this.state.login.status = 'ok';
    this.state.login.loggedInAt = this.client.loggedInAt;
    this.state.login.error = '';
    this.state.login.user = user;
    return user;
  }

  scheduleNext() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.state.running) return;

    const intervalMs = Math.max(1, this.config.monitor.intervalMinutes) * 60 * 1000;
    const nextRunAt = new Date(Date.now() + intervalMs);
    this.state.schedule.nextRunAt = nextRunAt.toISOString();
    this.state.schedule.intervalMinutes = this.config.monitor.intervalMinutes;
    this.timer = setTimeout(() => {
      this.scanNow('schedule').catch((error) => this.log('error', error.message));
    }, intervalMs);
  }

  getStatus() {
    return {
      ...this.state,
      publicConfig: publicConfig(this.config, this.configLoad.configPath),
      session: this.client?.publicSessionInfo?.() || null,
      logs: this.logs.slice(0, 80),
    };
  }

  getResults() {
    return this.state.latest;
  }

  getHistory(limit = 50) {
    return this.history.slice(0, limit);
  }

  createClient() {
    return new TradePulseClient({
      email: this.config.account.email,
      password: this.config.account.password,
      logger: (level, message) => this.log(level, message),
    });
  }

  appendHistory(result) {
    const dir = path.join(this.rootDir, 'data/history');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${result.tradeDate.replaceAll('-', '')}.jsonl`);
    fs.appendFileSync(file, `${JSON.stringify(result)}\n`, 'utf8');
  }

  loadSeenSignalsFromHistory() {
    const dir = path.join(this.rootDir, 'data/history');
    if (!fs.existsSync(dir)) return;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.jsonl')) continue;
      const fullPath = path.join(dir, file);
      const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          this.history.unshift(summarizeScan(record));
          if (record.mode === 'topflows' && record.topFlows?.rows?.length) {
            if (!this.topFlowsSnapshot || String(record.generatedAt).localeCompare(this.topFlowsSnapshot.generatedAt) > 0) {
              this.topFlowsSnapshot = {
                generatedAt: record.generatedAt,
                type: record.topFlows.type,
                rows: record.topFlows.rows,
              };
            }
          }
          for (const result of record.results || []) {
            if (isTriggeredSignal(result.signal)) {
              this.seenSignals.add(`${result.date}|${result.symbol}|${result.signal}`);
            }
          }
        } catch {
          // Ignore malformed history lines so one bad record does not block startup.
        }
      }
    }
    this.history.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
    this.history = this.history.slice(0, 200);
  }

  log(level, code, params = {}) {
    const structured = typeof code === 'string' && /^[a-z0-9_]+$/i.test(code);
    const entry = {
      at: new Date().toISOString(),
      level,
      code: structured ? code : 'message',
      params: structured ? params : { message: String(code || '') },
      message: structured ? '' : String(code || ''),
    };
    this.logs.unshift(entry);
    this.logs = this.logs.slice(0, 200);
    const prefix = level.toUpperCase().padEnd(5, ' ');
    console.log(`[${entry.at}] ${prefix} ${entry.code} ${JSON.stringify(entry.params)}`);
  }
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

function summarizeScan(result) {
  if (result.mode === 'topflows') {
    return {
      id: result.id,
      mode: result.mode,
      generatedAt: result.generatedAt,
      tradeDate: result.tradeDate,
      durationMs: result.durationMs,
      trigger: result.trigger,
      summary: result.summary,
      topFlows: {
        label: result.topFlows?.label || 'ALL',
        rowCount: result.topFlows?.rows?.length || 0,
        changes: result.topFlows?.changes || summarizeTopFlowChanges(),
      },
    };
  }

  return {
    id: result.id,
    mode: result.mode || 'stock-list',
    generatedAt: result.generatedAt,
    tradeDate: result.tradeDate,
    durationMs: result.durationMs,
    trigger: result.trigger,
    summary: result.summary,
    symbols: (result.results || []).map((item) => ({
      symbol: item.symbol,
      signal: item.signal,
      buyScore: item.buyScore,
      sellScore: item.sellScore,
      firstSeen: item.firstSeen,
      pricePlan: item.pricePlan,
    })),
  };
}
