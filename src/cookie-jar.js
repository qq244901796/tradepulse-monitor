export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  clear() {
    this.cookies.clear();
  }

  setFromHeaders(headers, url) {
    for (const value of getSetCookieHeaders(headers)) {
      this.setCookie(value, url);
    }
  }

  setCookie(setCookieValue, requestUrl) {
    const parts = splitCookieParts(setCookieValue);
    const [nameValue, ...attributes] = parts;
    const separatorIndex = nameValue.indexOf('=');
    if (separatorIndex <= 0) return;

    const name = nameValue.slice(0, separatorIndex).trim();
    const value = nameValue.slice(separatorIndex + 1);
    const origin = new URL(requestUrl);
    const cookie = {
      name,
      value,
      domain: origin.hostname.toLowerCase(),
      hostOnly: true,
      path: defaultPath(origin.pathname),
      secure: false,
      httpOnly: false,
      expiresAt: null,
    };

    for (const attribute of attributes) {
      const [rawKey, ...rawValue] = attribute.split('=');
      const key = rawKey.trim().toLowerCase();
      const attrValue = rawValue.join('=').trim();

      if (key === 'domain' && attrValue) {
        cookie.domain = attrValue.replace(/^\./, '').toLowerCase();
        cookie.hostOnly = false;
      } else if (key === 'path' && attrValue) {
        cookie.path = attrValue;
      } else if (key === 'secure') {
        cookie.secure = true;
      } else if (key === 'httponly') {
        cookie.httpOnly = true;
      } else if (key === 'max-age') {
        const seconds = Number(attrValue);
        if (Number.isFinite(seconds)) cookie.expiresAt = Date.now() + seconds * 1000;
      } else if (key === 'expires') {
        const timestamp = Date.parse(attrValue);
        if (Number.isFinite(timestamp)) cookie.expiresAt = timestamp;
      }
    }

    const storageKey = `${cookie.domain}|${cookie.path}|${cookie.name}`;
    if (cookie.expiresAt !== null && cookie.expiresAt <= Date.now()) {
      this.cookies.delete(storageKey);
      return;
    }
    this.cookies.set(storageKey, cookie);
  }

  getCookieHeader(url) {
    const target = new URL(url);
    const now = Date.now();
    const matched = [];

    for (const [key, cookie] of this.cookies.entries()) {
      if (cookie.expiresAt !== null && cookie.expiresAt <= now) {
        this.cookies.delete(key);
        continue;
      }
      if (cookie.secure && target.protocol !== 'https:') continue;
      if (!domainMatches(target.hostname.toLowerCase(), cookie)) continue;
      if (!pathMatches(target.pathname, cookie.path)) continue;
      matched.push(`${cookie.name}=${cookie.value}`);
    }

    return matched.join('; ');
  }

  count() {
    return this.cookies.size;
  }

  toPublicList() {
    return [...this.cookies.values()].map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expiresAt: cookie.expiresAt ? new Date(cookie.expiresAt).toISOString() : null,
    }));
  }
}

function getSetCookieHeaders(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const value = headers.get('set-cookie');
  return value ? splitCombinedSetCookie(value) : [];
}

function splitCookieParts(value) {
  const parts = [];
  let current = '';
  let inExpires = false;

  for (const part of value.split(';')) {
    const trimmed = part.trim();
    if (/^expires=/i.test(trimmed)) {
      inExpires = true;
      current = current ? `${current}; ${trimmed}` : trimmed;
      continue;
    }
    if (inExpires && /^[A-Za-z]{3},/i.test(trimmed)) {
      current += `; ${trimmed}`;
      inExpires = false;
      continue;
    }
    if (current) {
      parts.push(current);
      current = '';
    }
    parts.push(trimmed);
    inExpires = false;
  }

  if (current) parts.push(current);
  return parts;
}

function splitCombinedSetCookie(value) {
  return value.split(/,(?=\s*[^;,\s]+=)/g).map((item) => item.trim()).filter(Boolean);
}

function domainMatches(hostname, cookie) {
  if (cookie.hostOnly) return hostname === cookie.domain;
  return hostname === cookie.domain || hostname.endsWith(`.${cookie.domain}`);
}

function pathMatches(pathname, cookiePath) {
  return pathname === cookiePath || pathname.startsWith(cookiePath.endsWith('/') ? cookiePath : `${cookiePath}/`);
}

function defaultPath(pathname) {
  if (!pathname || !pathname.startsWith('/')) return '/';
  if (pathname === '/') return '/';
  return pathname.slice(0, pathname.lastIndexOf('/') + 1) || '/';
}
