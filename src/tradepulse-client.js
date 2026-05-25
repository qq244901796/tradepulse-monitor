import { CookieJar } from './cookie-jar.js';

const APP_ORIGIN = 'https://app-trps.tradepulse.net';
const AUTH_ORIGIN = 'https://auth0.tradepulse.net';
const DATA_ORIGIN = 'https://data1.tradepulse.net';

export class AuthRequiredError extends Error {
  constructor(message = 'TradePulse session is not authenticated.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class TradePulseClient {
  constructor({ email, password, logger = () => {} }) {
    this.email = email;
    this.password = password;
    this.logger = logger;
    this.jar = new CookieJar();
    this.loggedInAt = null;
    this.lastAuthUser = null;
  }

  async login() {
    if (!this.email || !this.password) {
      throw new Error('TradePulse account email/password is missing.');
    }

    this.jar.clear();
    const ret = encodeURIComponent(`${APP_ORIGIN}/export`);
    await this.request(`${AUTH_ORIGIN}/trps/login?ret=${ret}`, {
      method: 'GET',
      redirect: 'manual',
    });

    const response = await this.request(`${AUTH_ORIGIN}/trps/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
        origin: AUTH_ORIGIN,
        referer: `${AUTH_ORIGIN}/trps/login?ret=${ret}`,
      },
      body: JSON.stringify({
        teml: this.email,
        tpass: this.password,
      }),
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(`Login failed: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    if (payload && payload.status === false) {
      throw new Error('Login failed: TradePulse rejected the account information.');
    }

    const user = await this.authMe();
    this.loggedInAt = new Date().toISOString();
    this.lastAuthUser = user;
    this.logger('info', 'login_success', { email: this.email });
    return user;
  }

  async ensureLoggedIn() {
    if (!this.loggedInAt) return this.login();
    try {
      return await this.authMe();
    } catch (error) {
      this.logger('warn', 'auth_check_failed_relogin', { message: error.message });
      return this.login();
    }
  }

  async authMe() {
    const response = await this.request(`${APP_ORIGIN}/api/auth/me`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'application/json',
        referer: `${APP_ORIGIN}/export`,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      throw new AuthRequiredError('Auth check redirected to login.');
    }

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      throw new Error(`/api/auth/me failed: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    if (!contentType.includes('application/json')) {
      throw new AuthRequiredError('/api/auth/me did not return JSON.');
    }

    const user = JSON.parse(text);
    this.lastAuthUser = user;
    return user;
  }

  async getLatestDates() {
    const response = await this.request(`${DATA_ORIGIN}/daily.enable.do`, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        accept: 'application/json',
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`daily.enable.do failed: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    return JSON.parse(text);
  }

  async exportCsv({ symbols, date, type }) {
    const symbolText = Array.isArray(symbols) ? symbols.join(',') : String(symbols || '');
    const query = new URLSearchParams({
      symbol: symbolText,
      sdate: date,
      edate: date,
      type: String(type),
    });
    const url = `${APP_ORIGIN}/api/export?${query.toString()}`;
    const response = await this.request(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'text/csv,*/*',
        referer: `${APP_ORIGIN}/export`,
      },
    });

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const location = response.headers.get('location') || '';

    if (response.status >= 300 && response.status < 400) {
      throw new AuthRequiredError(`Export redirected to ${location || 'login'}.`);
    }
    if (!response.ok) {
      throw new Error(`Export failed: HTTP ${response.status} ${text.slice(0, 200)}`);
    }
    if (contentType.includes('text/html') && /sign in|login/i.test(text)) {
      throw new AuthRequiredError('Export returned login HTML.');
    }

    return {
      url,
      contentType,
      text,
    };
  }

  async request(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const cookie = this.jar.getCookieHeader(url);
    if (cookie) headers.set('cookie', cookie);
    headers.set('user-agent', headers.get('user-agent') || browserUserAgent());

    const response = await fetch(url, {
      ...options,
      headers,
    });
    this.jar.setFromHeaders(response.headers, url);
    return response;
  }

  publicSessionInfo() {
    return {
      loggedInAt: this.loggedInAt,
      email: this.email,
      cookieCount: this.jar.count(),
      cookies: this.jar.toPublicList(),
      user: this.lastAuthUser,
    };
  }
}

function browserUserAgent() {
  return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
}
