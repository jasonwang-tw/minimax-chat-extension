const SYNC_BACKUP_KEYS = [
  'apiKey',
  'geminiApiKey',
  'braveApiKey',
  'exaApiKey',
  'settings',
  'globalPrompt',
  'defaultPrompts',
  'replyModes',
  'autoMemoryEnabled',
  'syncSettings',
  'memories',
  'categories'
];

const LOCAL_BACKUP_KEYS = [
  'customCommands',
  'knowledgeBase',
  'vocabulary'
  // chatSessions / sessionSummaries 為對話紀錄，資料量大，不納入備份
];

export const SETTINGS_BACKUP_SCHEMA_VERSION = 1;

export async function collectSettingsBackupPayload() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(SYNC_BACKUP_KEYS),
    chrome.storage.local.get(LOCAL_BACKUP_KEYS)
  ]);

  return {
    schemaVersion: SETTINGS_BACKUP_SCHEMA_VERSION,
    kind: 'minimax-settings-backup',
    exportedAt: new Date().toISOString(),
    settings: {
      apiKey: syncData.apiKey || '',
      geminiApiKey: syncData.geminiApiKey || '',
      braveApiKey: syncData.braveApiKey || '',
      exaApiKey: syncData.exaApiKey || '',
      settings: isPlainObject(syncData.settings) ? syncData.settings : {},
      globalPrompt: syncData.globalPrompt || '',
      defaultPrompts: isPlainObject(syncData.defaultPrompts) ? syncData.defaultPrompts : {},
      replyModes: Array.isArray(syncData.replyModes) ? syncData.replyModes : [],
      customCommands: Array.isArray(localData.customCommands) ? localData.customCommands : [],
      autoMemoryEnabled: !!syncData.autoMemoryEnabled,
      syncSettings: sanitizeSyncSettingsForBackup(syncData.syncSettings || {}),
      memories: Array.isArray(syncData.memories) ? syncData.memories : [],
      categories: isPlainObject(syncData.categories) ? syncData.categories : { memory: [], knowledge: [], vocabulary: [] },
      knowledgeBase: Array.isArray(localData.knowledgeBase) ? localData.knowledgeBase : [],
      vocabulary: Array.isArray(localData.vocabulary) ? localData.vocabulary : []
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

  const nextSyncSettings = {
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    geminiApiKey: typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey : '',
    braveApiKey: typeof settings.braveApiKey === 'string' ? settings.braveApiKey : '',
    exaApiKey: typeof settings.exaApiKey === 'string' ? settings.exaApiKey : '',
    settings: isPlainObject(settings.settings) ? settings.settings : {},
    globalPrompt: typeof settings.globalPrompt === 'string' ? settings.globalPrompt : '',
    defaultPrompts: isPlainObject(settings.defaultPrompts) ? settings.defaultPrompts : {},
    replyModes: Array.isArray(settings.replyModes) ? settings.replyModes : [],
    autoMemoryEnabled: !!settings.autoMemoryEnabled,
    syncSettings: sanitizeSyncSettingsForBackup(settings.syncSettings || {}),
    memories: Array.isArray(settings.memories) ? settings.memories : [],
    categories: isPlainObject(settings.categories) ? settings.categories : { memory: [], knowledge: [], vocabulary: [] }
  };

  const nextLocalSettings = {
    customCommands: Array.isArray(settings.customCommands) ? settings.customCommands : [],
    knowledgeBase: Array.isArray(settings.knowledgeBase) ? settings.knowledgeBase : [],
    vocabulary: Array.isArray(settings.vocabulary) ? settings.vocabulary : []
  };

  await Promise.all([
    chrome.storage.sync.set(nextSyncSettings),
    chrome.storage.local.set(nextLocalSettings)
  ]);

  return { sync: nextSyncSettings, local: nextLocalSettings };
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
