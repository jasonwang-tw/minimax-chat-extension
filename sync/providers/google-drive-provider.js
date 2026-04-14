// sync/providers/google-drive-provider.js

import { BaseProvider } from './base-provider.js';

const GOOGLE_OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_REVOKE = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';
const DRIVE_ABOUT = 'https://www.googleapis.com/drive/v3/about?fields=user';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export class GoogleDriveProvider extends BaseProvider {
  constructor() {
    super('googleDrive');
  }

  async authorize({ clientId }) {
    if (!clientId) throw new Error('請先在設定頁輸入 Google OAuth Client ID');

    const redirectUri = chrome.identity.getRedirectURL('google-drive-sync');
    const state = crypto.randomUUID();
    const authUrl = `${GOOGLE_OAUTH_BASE}?client_id=${encodeURIComponent(clientId)}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(GOOGLE_DRIVE_SCOPE)}&prompt=consent&state=${encodeURIComponent(state)}`;

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    if (!responseUrl) throw new Error('OAuth 授權失敗：未收到回傳網址');

    const hash = responseUrl.split('#')[1] || '';
    const params = new URLSearchParams(hash);
    const returnedState = params.get('state');
    if (returnedState !== state) throw new Error('OAuth state 驗證失敗，請重試');

    const accessToken = params.get('access_token');
    if (!accessToken) throw new Error('OAuth 授權失敗：未取得 access token');

    const expiresIn = Number(params.get('expires_in') || 3600);
    const expiresAt = Date.now() + Math.max(300, expiresIn - 60) * 1000;

    const profile = await this.#fetchProfile(accessToken);
    await this.#verifyDriveAccess(accessToken);

    return {
      accessToken,
      expiresAt,
      scope: params.get('scope') || GOOGLE_DRIVE_SCOPE,
      account: profile,
      connectedAt: Date.now()
    };
  }

  async revoke({ accessToken }) {
    if (!accessToken) return;
    try {
      await fetch(`${GOOGLE_TOKEN_REVOKE}?token=${encodeURIComponent(accessToken)}`, {
        method: 'POST'
      });
    } catch (err) {
      console.warn('[Sync] revoke token failed:', err?.message || err);
    }
  }

  async getStatus(auth) {
    if (!auth?.accessToken) return { connected: false };

    const now = Date.now();
    if (auth.expiresAt && now >= auth.expiresAt) {
      return { connected: false, reason: 'TOKEN_EXPIRED' };
    }

    try {
      await this.#verifyDriveAccess(auth.accessToken);
      return {
        connected: true,
        account: auth.account || null,
        expiresAt: auth.expiresAt || null,
        connectedAt: auth.connectedAt || null
      };
    } catch (err) {
      return { connected: false, reason: err.message || 'AUTH_INVALID' };
    }
  }

  async #fetchProfile(accessToken) {
    try {
      const res = await fetch(GOOGLE_USERINFO, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id || '',
        email: data.email || '',
        name: data.name || ''
      };
    } catch {
      return null;
    }
  }

  async #verifyDriveAccess(accessToken) {
    const res = await fetch(DRIVE_ABOUT, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Google Drive 驗證失敗 (${res.status}) ${text.slice(0, 120)}`.trim());
    }
    return res.json();
  }
}

export { GOOGLE_DRIVE_SCOPE };
