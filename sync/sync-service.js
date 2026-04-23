import { collectSettingsBackupPayload, restoreSettingsBackupPayload, sanitizeSyncSettingsForBackup } from './settings-backup.js';
import { GoogleDriveProvider } from './providers/google-drive-provider.js';
import { WordPressProvider, DEFAULT_WORDPRESS_BASE_URL } from './providers/wordpress-provider.js';

const DEFAULT_SYNC_SETTINGS = {
  provider: 'none',
  autoSync: false,
  googleDriveClientId: '',
  wpBaseUrl: DEFAULT_WORDPRESS_BASE_URL
};

export class SyncService {
  constructor() {
    this.providers = {
      googleDrive: new GoogleDriveProvider(),
      wordpress: new WordPressProvider()
    };
  }

  async getSettings() {
    const { syncSettings = {} } = await chrome.storage.sync.get(['syncSettings']);
    return {
      ...DEFAULT_SYNC_SETTINGS,
      ...sanitizeSyncSettingsForBackup(syncSettings)
    };
  }

  async saveSettings(partial) {
    const current = await this.getSettings();
    const merged = sanitizeSyncSettingsForBackup({
      ...current,
      ...(partial || {})
    });

    await chrome.storage.sync.set({ syncSettings: merged });
    return merged;
  }

  async connectGoogleDrive() {
    const settings = await this.getSettings();
    const authData = await this.providers.googleDrive.authorize({
      clientId: settings.googleDriveClientId
    });

    await this.#storeAuth('googleDrive', authData);
    await this.saveSettings({ provider: 'googleDrive' });

    return {
      provider: 'googleDrive',
      connected: true,
      account: authData.account || null,
      expiresAt: authData.expiresAt || null
    };
  }

  async disconnectGoogleDrive() {
    const auth = await this.#getAuth('googleDrive');
    await this.providers.googleDrive.revoke(auth);
    await this.#clearAuth('googleDrive');

    const settings = await this.getSettings();
    if (settings.provider === 'googleDrive') {
      await this.saveSettings({ provider: 'none' });
    }

    return { provider: 'googleDrive', connected: false };
  }

  async connectWordPress() {
    const settings = await this.getSettings();
    const authData = await this.providers.wordpress.authorize({
      baseUrl: settings.wpBaseUrl
    });

    await this.#storeAuth('wordpress', authData);
    await this.saveSettings({ provider: 'wordpress', wpBaseUrl: authData.baseUrl });

    return {
      provider: 'wordpress',
      connected: true,
      baseUrl: authData.baseUrl,
      account: authData.account || null
    };
  }

  async disconnectWordPress() {
    const auth = await this.#getAuth('wordpress');
    await this.providers.wordpress.revoke(auth);
    await this.#clearAuth('wordpress');

    const settings = await this.getSettings();
    if (settings.provider === 'wordpress') {
      await this.saveSettings({ provider: 'none' });
    }

    return { provider: 'wordpress', connected: false };
  }

  async backupWordPressSettings() {
    const auth = await this.#getAuth('wordpress');
    const payload = await collectSettingsBackupPayload();
    const response = await this.providers.wordpress.backupSettings(auth, payload);

    return {
      success: true,
      provider: 'wordpress',
      updatedAt: response.updatedAt || null
    };
  }

  async restoreWordPressSettings() {
    const auth = await this.#getAuth('wordpress');
    const response = await this.providers.wordpress.restoreSettings(auth);
    const payload = response?.payload || response;
    const restored = await restoreSettingsBackupPayload(payload);

    return {
      success: true,
      provider: 'wordpress',
      restoredKeys: Object.keys(restored)
    };
  }

  async getStatus() {
    const settings = await this.getSettings();
    const googleDriveAuth = await this.#getAuth('googleDrive');
    const wordpressAuth = await this.#getAuth('wordpress');

    return {
      provider: settings.provider,
      autoSync: !!settings.autoSync,
      googleDriveClientIdConfigured: !!settings.googleDriveClientId,
      wpBaseUrl: settings.wpBaseUrl,
      googleDrive: await this.providers.googleDrive.getStatus(googleDriveAuth),
      wordpress: await this.providers.wordpress.getStatus({
        ...wordpressAuth,
        baseUrl: wordpressAuth?.baseUrl || settings.wpBaseUrl
      })
    };
  }

  async #getAuth(providerName) {
    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
    return syncAuth[providerName] || null;
  }

  async #storeAuth(providerName, value) {
    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
    syncAuth[providerName] = value;
    await chrome.storage.local.set({ syncAuth });
  }

  async #clearAuth(providerName) {
    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
    delete syncAuth[providerName];
    await chrome.storage.local.set({ syncAuth });
  }
}

export { DEFAULT_SYNC_SETTINGS };
