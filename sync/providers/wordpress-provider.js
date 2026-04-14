import { BaseProvider } from './base-provider.js';

const DEFAULT_WORDPRESS_BASE_URL = 'https://jasonsbase.com';
const WORDPRESS_NAMESPACE = '/wp-json/minimax-sync/v1';

export class WordPressProvider extends BaseProvider {
  constructor() {
    super('wordpress');
  }

  async authorize({ baseUrl }) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const redirectUri = chrome.identity.getRedirectURL('wordpress-sync');
    const state = crypto.randomUUID();
    const authUrl = `${normalizedBaseUrl}/?minimax_sync_action=authorize&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    if (!responseUrl) {
      throw new Error('WordPress 授權失敗：未收到回傳網址');
    }

    const callbackUrl = new URL(responseUrl);
    const returnedState = callbackUrl.searchParams.get('state');
    const code = callbackUrl.searchParams.get('code');

    if (returnedState !== state) {
      throw new Error('WordPress 授權失敗：state 驗證不一致');
    }

    if (!code) {
      throw new Error('WordPress 授權失敗：未收到授權碼');
    }

    const response = await fetchJson(`${normalizedBaseUrl}${WORDPRESS_NAMESPACE}/auth/exchange`, {
      method: 'POST',
      body: {
        code,
        redirectUri
      }
    });

    if (!response?.token) {
      throw new Error('WordPress 授權失敗：未取得 API token');
    }

    return {
      baseUrl: normalizedBaseUrl,
      apiToken: response.token,
      account: response.account || null,
      connectedAt: Date.now()
    };
  }

  async revoke(auth) {
    if (!auth?.apiToken || !auth?.baseUrl) return;

    try {
      await fetchJson(`${normalizeBaseUrl(auth.baseUrl)}${WORDPRESS_NAMESPACE}/auth/logout`, {
        method: 'POST',
        token: auth.apiToken
      });
    } catch (error) {
      console.warn('[Sync] WordPress logout failed:', error?.message || error);
    }
  }

  async getStatus(auth = {}) {
    if (!auth?.apiToken || !auth?.baseUrl) {
      return {
        connected: false,
        baseUrl: auth?.baseUrl || DEFAULT_WORDPRESS_BASE_URL
      };
    }

    try {
      const response = await fetchJson(`${normalizeBaseUrl(auth.baseUrl)}${WORDPRESS_NAMESPACE}/me/status`, {
        method: 'GET',
        token: auth.apiToken
      });

      return {
        connected: true,
        baseUrl: normalizeBaseUrl(auth.baseUrl),
        account: response.account || null,
        lastBackupAt: response.lastBackupAt || null
      };
    } catch (error) {
      return {
        connected: false,
        baseUrl: normalizeBaseUrl(auth.baseUrl),
        reason: error.message || 'AUTH_INVALID'
      };
    }
  }

  async backupSettings(auth, payload) {
    ensureAuthorized(auth);

    return fetchJson(`${normalizeBaseUrl(auth.baseUrl)}${WORDPRESS_NAMESPACE}/backup/settings`, {
      method: 'PUT',
      token: auth.apiToken,
      body: payload
    });
  }

  async restoreSettings(auth) {
    ensureAuthorized(auth);

    return fetchJson(`${normalizeBaseUrl(auth.baseUrl)}${WORDPRESS_NAMESPACE}/backup/settings`, {
      method: 'GET',
      token: auth.apiToken
    });
  }
}

export { DEFAULT_WORDPRESS_BASE_URL, normalizeBaseUrl };

function ensureAuthorized(auth) {
  if (!auth?.apiToken || !auth?.baseUrl) {
    throw new Error('請先登入 WordPress 備援同步');
  }
}

function normalizeBaseUrl(baseUrl) {
  const raw = typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : DEFAULT_WORDPRESS_BASE_URL;
  return raw.replace(/\/+$/, '');
}

async function fetchJson(url, { method = 'GET', token, body } = {}) {
  const headers = {
    Accept: 'application/json'
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data || {};
}
