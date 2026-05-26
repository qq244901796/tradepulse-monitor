import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  publicConfig,
  validateConfig,
} from '../packages/core/src/config.js';

export { DEFAULT_CONFIG, normalizeConfig, publicConfig, validateConfig };

export function getConfigPath(rootDir) {
  return process.env.CONFIG_PATH
    ? path.resolve(rootDir, process.env.CONFIG_PATH)
    : path.resolve(rootDir, 'config/app.json');
}

export function getExampleConfigPath(rootDir) {
  return path.resolve(rootDir, 'config/app.example.json');
}

export function loadConfig(rootDir) {
  const configPath = getConfigPath(rootDir);
  if (!fs.existsSync(configPath)) {
    return {
      ok: false,
      config: structuredClone(DEFAULT_CONFIG),
      configPath,
      needsSetup: true,
      errors: [
        `Config file not found: ${configPath}`,
        'Open the local web page and fill in your TradePulse account.',
      ],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    return {
      ok: false,
      config: structuredClone(DEFAULT_CONFIG),
      configPath,
      needsSetup: false,
      errors: [`Invalid JSON in ${configPath}: ${error.message}`],
    };
  }

  const config = normalizeConfig(parsed);
  const errors = validateConfig(config);
  return {
    ok: errors.length === 0,
    config,
    configPath,
    needsSetup: errors.some((error) => (
      error.includes('account.email')
      || error.includes('account.password')
      || error.includes('monitor.symbols')
      || error.includes('notifications.email')
    )),
    errors,
  };
}

export function saveConfig(rootDir, input) {
  const configPath = getConfigPath(rootDir);
  const config = normalizeConfig(input || {});
  const errors = validateConfig(config);

  if (errors.length) {
    return {
      ok: false,
      config,
      configPath,
      errors,
    };
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(`${configPath}.tmp`, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  fs.renameSync(`${configPath}.tmp`, configPath);

  return {
    ok: true,
    config,
    configPath,
    errors: [],
  };
}
