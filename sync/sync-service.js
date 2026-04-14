// sync/sync-service.js

import { GoogleDriveProvider } from './providers/google-drive-provider.js';

const DEFAULT_SYNC_SETTINGS = {
  provider: 'none',
  autoSync: false,
  googleDriveClientId: ''
};

export class SyncService {
  constructor() {
    this.providers = {
      googleDrive: new GoogleDriveProvider()
    };
  }

  async getSettings() {
    const { syncSettings = {} } = await chrome.storage.sync.get(['syncSettings']);
    return { ...DEFAULT_SYNC_SETTINGS, ...syncSettings };
  }

  async saveSettings(partial) {
    const current = await this.getSettings();
    const merged = { ...current, ...(partial || {}) };
    await chrome.storage.sync.set({ syncSettings: merged });
    return merged;
  }

  async connectGoogleDrive() {
    const settings = await this.getSettings();
    const provider = this.providers.googleDrive;

    const authData = await provider.authorize({
      clientId: settings.googleDriveClientId
    });

    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
    syncAuth.googleDrive = authData;
    await chrome.storage.local.set({ syncAuth });

    await this.saveSettings({ provider: 'googleDrive' });

    return {
      provider: 'googleDrive',
      connected: true,
      account: authData.account || null,
      expiresAt: authData.expiresAt
    };
  }

  async disconnectGoogleDrive() {
    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
    const auth = syncAuth.googleDrive;
    if (auth?.accessToken) {
      await this.providers.googleDrive.revoke({ accessToken: auth.accessToken });
    }

    delete syncAuth.googleDrive;
    await chrome.storage.local.set({ syncAuth });
    await this.saveSettings({ provider: 'none' });

    return { provider: 'googleDrive', connected: false };
  }

  async getStatus() {
    const settings = await this.getSettings();
    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);

    const status = {
      provider: settings.provider,
      autoSync: !!settings.autoSync,
      googleDriveClientIdConfigured: !!settings.googleDriveClientId,
      googleDrive: { connected: false }
    };

    status.googleDrive = await this.providers.googleDrive.getStatus(syncAuth.googleDrive);

    return status;
  }
}

export { DEFAULT_SYNC_SETTINGS };
