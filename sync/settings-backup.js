const SETTINGS_BACKUP_KEYS = [
  'apiKey',
  'geminiApiKey',
  'braveApiKey',
  'exaApiKey',
  'settings',
  'globalPrompt',
  'defaultPrompts',
  'replyModes',
  'customCommands',
  'autoMemoryEnabled',
  'syncSettings'
];

export const SETTINGS_BACKUP_SCHEMA_VERSION = 1;

export async function collectSettingsBackupPayload() {
  const data = await chrome.storage.sync.get(SETTINGS_BACKUP_KEYS);

  return {
    schemaVersion: SETTINGS_BACKUP_SCHEMA_VERSION,
    kind: 'minimax-settings-backup',
    exportedAt: new Date().toISOString(),
    settings: {
      apiKey: data.apiKey || '',
      geminiApiKey: data.geminiApiKey || '',
      braveApiKey: data.braveApiKey || '',
      exaApiKey: data.exaApiKey || '',
      settings: data.settings || {},
      globalPrompt: data.globalPrompt || '',
      defaultPrompts: data.defaultPrompts || {},
      replyModes: Array.isArray(data.replyModes) ? data.replyModes : [],
      customCommands: Array.isArray(data.customCommands) ? data.customCommands : [],
      autoMemoryEnabled: !!data.autoMemoryEnabled,
      syncSettings: sanitizeSyncSettingsForBackup(data.syncSettings || {})
    }
  };
}

export async function restoreSettingsBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid backup payload');
  }

  const settings = payload.settings;
  if (!settings || typeof settings !== 'object') {
    throw new Error('Backup payload does not contain settings');
  }

  const nextSettings = {
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    geminiApiKey: typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey : '',
    braveApiKey: typeof settings.braveApiKey === 'string' ? settings.braveApiKey : '',
    exaApiKey: typeof settings.exaApiKey === 'string' ? settings.exaApiKey : '',
    settings: isPlainObject(settings.settings) ? settings.settings : {},
    globalPrompt: typeof settings.globalPrompt === 'string' ? settings.globalPrompt : '',
    defaultPrompts: isPlainObject(settings.defaultPrompts) ? settings.defaultPrompts : {},
    replyModes: Array.isArray(settings.replyModes) ? settings.replyModes : [],
    customCommands: Array.isArray(settings.customCommands) ? settings.customCommands : [],
    autoMemoryEnabled: !!settings.autoMemoryEnabled,
    syncSettings: sanitizeSyncSettingsForBackup(settings.syncSettings || {})
  };

  await chrome.storage.sync.set(nextSettings);
  return nextSettings;
}

export function sanitizeSyncSettingsForBackup(syncSettings = {}) {
  return {
    provider: normalizeProvider(syncSettings.provider),
    autoSync: !!syncSettings.autoSync,
    googleDriveClientId: typeof syncSettings.googleDriveClientId === 'string' ? syncSettings.googleDriveClientId : '',
    wpBaseUrl: typeof syncSettings.wpBaseUrl === 'string' ? syncSettings.wpBaseUrl : 'https://jasonsbase.com'
  };
}

function normalizeProvider(provider) {
  if (provider === 'googleDrive' || provider === 'wordpress') {
    return provider;
  }

  return 'none';
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
