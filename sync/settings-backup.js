const SYNC_BACKUP_KEYS = [
  'apiKey',
  'geminiApiKey',
  'braveApiKey',
  'exaApiKey',
  'openrouterApiKey',
  'customModels',
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
      openrouterApiKey: syncData.openrouterApiKey || '',
      customModels: Array.isArray(syncData.customModels) ? syncData.customModels : [],
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

  // 支援多種 response 結構：
  // 1. { schemaVersion, kind, settings: {...} }  ← 標準格式
  // 2. { payload: { schemaVersion, settings: {...} } }  ← WP plugin 包一層
  // 3. { settings: {...} }  ← 只有 settings wrapper
  // 4. { apiKey, globalPrompt, defaultPrompts, ... }  ← 舊格式（settings 直接在頂層）
  let settings;
  if (payload.settings && typeof payload.settings === 'object') {
    settings = payload.settings;
  } else if (payload.payload && typeof payload.payload === 'object') {
    const inner = payload.payload;
    settings = (inner.settings && typeof inner.settings === 'object') ? inner.settings : inner;
  } else if (typeof payload.globalPrompt === 'string' || typeof payload.apiKey === 'string') {
    // 舊格式：payload 本身就是 settings
    settings = payload;
  } else {
    throw new Error('Backup payload does not contain settings');
  }

  const nextSyncSettings = {
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    geminiApiKey: typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey : '',
    braveApiKey: typeof settings.braveApiKey === 'string' ? settings.braveApiKey : '',
    exaApiKey: typeof settings.exaApiKey === 'string' ? settings.exaApiKey : '',
    openrouterApiKey: typeof settings.openrouterApiKey === 'string' ? settings.openrouterApiKey : '',
    customModels: Array.isArray(settings.customModels) ? settings.customModels : [],
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
