import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const coreSrcDir = path.join(rootDir, 'packages/core/src');
const outDir = path.join(rootDir, 'packages/core/dist');
const outFile = path.join(outDir, 'tradepulse-core.bundle.js');

const modules = [
  ['csv.js', ['parseCsv', 'normalizeHeader', 'toNumber', 'formatNumber']],
  ['config.js', [
    'DEFAULT_CONFIG',
    'SUPPORTED_LANGUAGES',
    'SUPPORTED_MONITOR_MODES',
    'normalizeConfig',
    'validateConfig',
    'publicConfig',
    'normalizeSymbols',
    'normalizeLanguage',
    'normalizeMonitorMode',
  ]],
  ['price-plan.js', [
    'buildPricePlan',
    'normalizePriceRows',
  ]],
  ['analyzer.js', [
    'isTriggeredSignal',
    'classifySymbol',
    'analyzeRows',
    'analyzeTradePulse',
    'summarizeSignals',
  ]],
  ['i18n.js', [
    'SIGNAL_KEYS',
    'I18N',
    't',
    'translateReason',
    'translateLog',
    'translateError',
    'translateLegacyReason',
  ]],
];

const body = modules.map(([file]) => transformModule(path.join(coreSrcDir, file))).join('\n\n');

const bundle = `;(function (global) {
${indent(body, 2)}

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
${modules
  .flatMap(([, names]) => names)
  .concat(['analyzeTradePulseFromCsv'])
  .map((name) => `    ${name},`)
  .join('\n')}
  };
}(typeof globalThis !== 'undefined' ? globalThis : window));
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, bundle, 'utf8');
console.log(`Core bundle created: ${path.relative(rootDir, outFile)}`);

function transformModule(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .replace(/^import .*?;\r?\n/gm, '')
    .replace(/^export /gm, '');
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text.split(/\r?\n/).map((line) => (line ? `${prefix}${line}` : '')).join('\n');
}
