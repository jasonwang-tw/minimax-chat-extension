// background.js - Service Worker for Open Chat Hub providers

import { SyncService, DEFAULT_SYNC_SETTINGS } from './sync/sync-service.js';

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent';
const MODEL_NAME = 'MiniMax-M2.7';
const MAX_HISTORY = 50;
const MAX_CONTEXT_CHARS = 40000; // 保守估計 ~20k tokens（中英混合約 2 字元/token）
const OPENROUTER_MODELS_API_URL = 'https://openrouter.ai/api/v1/models';
const MODEL_PRICING_CACHE_KEY = 'openrouterModelPricingCache';
const MODEL_USAGE_LEDGER_KEY = 'modelUsageLedger';
const MODEL_USAGE_LEDGER_LIMIT = 1000;
const AGENT_REQUEST_TIMEOUT_MS = 45000;
const AGENT_SYNTHESIS_TIMEOUT_MS = 90000;
const STREAM_IDLE_TIMEOUT_MS = 60000;
const PORT_KEEPALIVE_INTERVAL_MS = 20000;
const AGENT_TOOL_RESULT_LIMIT = 1600;
const AGENT_TOOL_RESULT_COUNT = 3;
const AGENT_FINAL_CONTEXT_LIMIT = 8000;
const AGENT_ITER_MIN = 3;
const AGENT_ITER_DEFAULT = 6;
const AGENT_ITER_MAX = 12;

const DEFAULT_PROMPTS = {
  chat: '',
  imageAnalysis: '請詳細分析這張圖片的所有內容，包含視覺元素、文字、佈局與重要細節。',
  ocr: '請仔細辨識並提取這張圖片中的所有文字內容，保持原始排版結構，不要遺漏任何文字。'
};

const DEFAULT_REPLY_MODES = [
  { id: 'standard', name: '標準', icon: '💬', prompt: '' },
  { id: 'discuss', name: '討論模式', icon: '🔍', prompt: '請針對問題進行多角度分析，引用可靠資訊，交互比對後給出結論，並附上推理過程。' }
];

const syncService = new SyncService();

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeContextCharBudget(value) {
  const budget = Number(value);
  if (!Number.isFinite(budget) || budget <= 0) return MAX_CONTEXT_CHARS;
  return Math.max(1000, Math.round(budget));
}

function normalizeAgentIterations(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return AGENT_ITER_DEFAULT;
  return Math.min(AGENT_ITER_MAX, Math.max(AGENT_ITER_MIN, Math.round(n)));
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? (promptTokens + completionTokens));
  if (!promptTokens && !completionTokens && !totalTokens) return null;
  return { promptTokens, completionTokens, totalTokens };
}

function calculateOpenRouterCost(usage, pricing) {
  if (!usage || !pricing) return null;
  const promptPrice = toNumber(pricing.prompt);
  const completionPrice = toNumber(pricing.completion);
  const requestPrice = toNumber(pricing.request);
  if (promptPrice === null || completionPrice === null) return null;
  const inputCostUsd = usage.promptTokens * promptPrice;
  const outputCostUsd = usage.completionTokens * completionPrice;
  const requestCostUsd = requestPrice ?? 0;
  const totalCostUsd = inputCostUsd + outputCostUsd + requestCostUsd;
  return { inputCostUsd, outputCostUsd, requestCostUsd, totalCostUsd };
}

function extractApiErrorMessage(errorData, fallbackStatus) {
  const error = errorData?.error;
  const nested = error?.metadata?.raw || error?.metadata?.message || error?.details || error?.cause;
  if (typeof nested === 'string' && nested.trim()) return nested.trim();
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof errorData?.base_resp?.status_msg === 'string' && errorData.base_resp.status_msg.trim()) {
    return errorData.base_resp.status_msg.trim();
  }
  if (typeof errorData?.message === 'string' && errorData.message.trim()) return errorData.message.trim();
  return fallbackStatus ? `API 錯誤: ${fallbackStatus}` : 'API 錯誤';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = AGENT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`請求逾時（${Math.round(timeoutMs / 1000)} 秒）。模型可能暫時無回應，已中止本次 Agent 分析。`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readStreamChunkWithTimeout(reader, timeoutMs = STREAM_IDLE_TIMEOUT_MS) {
  let timer = null;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`串流回覆逾時（${Math.round(timeoutMs / 1000)} 秒未收到內容）。請稍後重試或切換模型。`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getInputModalities(model) {
  const values = model?.inputModalities
    || model?.architecture?.input_modalities
    || model?.architecture?.modality
    || model?.input_modalities
    || [];
  const list = Array.isArray(values) ? values : String(values || '').split('+');
  return list.map(v => String(v).trim().toLowerCase()).filter(Boolean);
}

function getOutputModalities(model) {
  const values = model?.outputModalities
    || model?.architecture?.output_modalities
    || model?.output_modalities
    || [];
  const list = Array.isArray(values) ? values : String(values || '').split('+');
  return list.map(v => String(v).trim().toLowerCase()).filter(Boolean);
}

const SUPPORTED_IMAGE_ASPECT_RATIOS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']);

function normalizeImageAspectRatio(value) {
  const normalized = String(value || '')
    .replace(/[：xX]/g, ':')
    .replace(/\s+/g, '')
    .trim();
  return SUPPORTED_IMAGE_ASPECT_RATIOS.has(normalized) ? normalized : null;
}

function extractImageAspectRatio(text = '') {
  const matches = String(text).matchAll(/(?:^|[^\d])(\d{1,2}\s*[:：xX]\s*\d{1,2})(?!\d)/g);
  for (const match of matches) {
    const ratio = normalizeImageAspectRatio(match[1]);
    if (ratio) return ratio;
  }
  return null;
}

function looksLikeImageGenerationModel(modelId = '', modelInfo = {}) {
  const outputModalities = getOutputModalities(modelInfo);
  if (outputModalities.includes('image')) return true;
  return /(?:image|nano[-_\s]?banana|gemini.*flash.*image)/i.test(String(modelId || modelInfo?.name || ''));
}

function looksLikeImageGenerationRequest(text = '') {
  return /(?:生成|產生|建立|創建|畫|繪製|生圖|圖片|圖像|照片|海報|插圖|generate|create|draw|image|picture|photo|poster|illustration)/i.test(String(text || ''));
}

function isImageReplyNoise(text = '') {
  const normalized = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<result>|<\/result>/gi, '')
    .trim();
  return !normalized || /^[`'"\s.,，。!！?？:：;；\-_*~|()[\]{}<>]+$/.test(normalized);
}

async function getOpenRouterImageRequestConfig({ modelId, message, apiKey }) {
  if (!apiKey || !modelId || modelId === MODEL_NAME || !looksLikeImageGenerationRequest(message)) return null;
  const pricingMap = await getOpenRouterPricingMap(apiKey);
  const modelInfo = pricingMap[modelId] || {};
  if (!looksLikeImageGenerationModel(modelId, modelInfo)) return null;
  const aspectRatio = extractImageAspectRatio(message);
  return {
    modalities: ['image', 'text'],
    ...(aspectRatio ? { image_config: { aspect_ratio: aspectRatio } } : {}),
    aspectRatio
  };
}

async function getOpenRouterPricingMap(apiKey) {
  const now = Date.now();
  const { [MODEL_PRICING_CACHE_KEY]: cache } = await chrome.storage.local.get([MODEL_PRICING_CACHE_KEY]);
  if (cache?.models && now - (cache.updatedAt || 0) < 24 * 60 * 60 * 1000) {
    const hasOutputMetadata = Object.values(cache.models).some(model => Array.isArray(model.outputModalities));
    if (hasOutputMetadata) {
      return cache.models;
    }
    console.log('[Usage] OpenRouter 模型快取缺少 output modalities，重新整理模型資料');
  }

  try {
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const resp = await fetch(OPENROUTER_MODELS_API_URL, { headers });
    if (!resp.ok) throw new Error(`OpenRouter models API ${resp.status}`);
    const data = await resp.json();
    const models = {};
    for (const model of data.data || []) {
      if (!model?.id) continue;
      models[model.id] = {
        id: model.id,
        name: model.name || model.id,
        pricing: model.pricing || {},
        supportedParameters: model.supported_parameters || [],
        inputModalities: getInputModalities(model),
        outputModalities: getOutputModalities(model),
        contextLength: model.context_length || model.top_provider?.context_length || null,
        updatedAt: now
      };
    }
    await chrome.storage.local.set({ [MODEL_PRICING_CACHE_KEY]: { updatedAt: now, models } });
    return models;
  } catch (err) {
    console.warn('[Usage] 無法更新 OpenRouter 模型價格:', err?.message || err);
    return cache?.models || {};
  }
}

async function recordOpenRouterUsage({ modelId, usage, apiKey, sessionId, source }) {
  const normalized = normalizeUsage(usage);
  if (!normalized || !modelId) return;
  const pricingMap = await getOpenRouterPricingMap(apiKey);
  const modelInfo = pricingMap[modelId] || {};
  const cost = calculateOpenRouterCost(normalized, modelInfo.pricing);
  const entry = {
    id: `usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    provider: 'openrouter',
    modelId,
    modelName: modelInfo.name || modelId,
    source: source || 'chat',
    sessionId: sessionId || null,
    promptTokens: normalized.promptTokens,
    completionTokens: normalized.completionTokens,
    totalTokens: normalized.totalTokens,
    inputCostUsd: cost?.inputCostUsd ?? null,
    outputCostUsd: cost?.outputCostUsd ?? null,
    requestCostUsd: cost?.requestCostUsd ?? null,
    totalCostUsd: cost?.totalCostUsd ?? null,
    pricing: modelInfo.pricing || null
  };

  const { [MODEL_USAGE_LEDGER_KEY]: current = [] } = await chrome.storage.local.get([MODEL_USAGE_LEDGER_KEY]);
  const next = [entry, ...(Array.isArray(current) ? current : [])].slice(0, MODEL_USAGE_LEDGER_LIMIT);
  await chrome.storage.local.set({ [MODEL_USAGE_LEDGER_KEY]: next });
}

// 監聽插件安裝
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiKey: '',
      settings: { model: MODEL_NAME, maxHistory: MAX_HISTORY },
      defaultPrompts: DEFAULT_PROMPTS,
      replyModes: DEFAULT_REPLY_MODES,
      autoMemoryEnabled: false,
      syncSettings: DEFAULT_SYNC_SETTINGS
    });
    chrome.storage.local.set({
      vocabulary: [],
      categories: { memory: [], knowledge: [], vocabulary: [] },
      syncAuth: {},
      customCommands: []
    });
  }

  // 建立右鍵選單（每次安裝/更新都重建，避免重複）
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'add-to-memory',
      title: '加入長期記憶',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'add-to-vocabulary',
      title: '加入單字簿',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'add-to-knowledge',
      title: '加入知識庫',
      contexts: ['selection', 'page']
    });
    chrome.contextMenus.create({
      id: 'instant-translate',
      title: '立即翻譯',
      contexts: ['selection']
    });
  });

});

chrome.runtime.onStartup.addListener(async () => {
  // autoSync 啟用時，開啟 extension 自動從 WordPress 還原最新備份
  try {
    const settings = await syncService.getSettings();
    if (settings.provider !== 'wordpress' || !settings.autoSync) return;
    const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
    if (!syncAuth.wordpress?.apiToken) return;
    await syncService.restoreWordPressSettings();
    console.log('[Sync] 自動同步完成（onStartup）');
  } catch (error) {
    console.warn('[Sync] 開啟時自動同步失敗:', error?.message || error);
  }
});

// 資料變動即時自動備份（debounce 5 秒，避免連續觸發）
let _autoBackupTimer = null;
const AUTO_BACKUP_KEYS_SYNC = new Set(['memories', 'apiKey', 'geminiApiKey', 'braveApiKey', 'exaApiKey', 'openrouterApiKey', 'customModels', 'settings', 'defaultPrompts', 'globalPrompt']);
const AUTO_BACKUP_KEYS_LOCAL = new Set(['vocabulary', 'knowledgeBase', 'chatSessions']);

chrome.storage.onChanged.addListener((changes, area) => {
  const watchedKeys = area === 'sync' ? AUTO_BACKUP_KEYS_SYNC : AUTO_BACKUP_KEYS_LOCAL;
  const hasRelevantChange = Object.keys(changes).some(k => watchedKeys.has(k));
  if (!hasRelevantChange) return;

  if (_autoBackupTimer) clearTimeout(_autoBackupTimer);
  _autoBackupTimer = setTimeout(async () => {
    try {
      const settings = await syncService.getSettings();
      if (settings.provider !== 'wordpress') return;
      const { syncAuth = {} } = await chrome.storage.local.get(['syncAuth']);
      if (!syncAuth.wordpress?.apiToken) return;
      await syncService.backupWordPressSettings();
    } catch (error) {
      console.warn('[Sync] 即時備份失敗:', error?.message || error);
    }
  }, 5000);
});

// 右鍵選單點擊處理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-memory') {
    const text = info.selectionText?.trim();
    if (!text) return;
    const { memories = [] } = await chrome.storage.sync.get(['memories']);
    if (memories.some(m => (m.summary || m.text) === text)) return; // 防重複
    memories.push({
      id: `mem_${Date.now()}`,
      title: text.slice(0, 30),
      summary: text,
      tags: [],
      source: 'context-menu',
      category: '',
      createdAt: Date.now()
    });
    if (memories.length > 30) memories.shift(); // 上限 30 筆（sync 容量限制）
    await chrome.storage.sync.set({ memories });
  }

  if (info.menuItemId === 'add-to-vocabulary') {
    const word = info.selectionText?.trim();
    if (!word) return;
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    if (vocabulary.some(v => v.word === word)) return; // 防重複
    // 簡易語言偵測
    const lang = /[\u4e00-\u9fff]/.test(word) ? 'zh'
               : /[\u3040-\u30ff]/.test(word) ? 'ja'
               : /^[\x00-\x7F]+$/.test(word)  ? 'en'
               : 'other';
    vocabulary.push({
      id: `vocab_${Date.now()}`,
      word,
      definition: '',
      category: '',
      lang,
      createdAt: Date.now()
    });
    await chrome.storage.local.set({ vocabulary });
  }

  if (info.menuItemId === 'add-to-knowledge') {
    const id = `kb_${Date.now()}`;
    let title = tab?.title || '未命名';
    let url = tab?.url || '';
    let content = '';
    let source = 'url';

    if (info.selectionText?.trim()) {
      // 選取文字模式
      source = 'text';
      content = info.selectionText.trim();
      title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
      url = tab?.url || '';
    } else {
      // 整頁模式：抓取頁面內容
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const raw = document.body?.innerText || '';
            return {
              title: document.title || '',
              url: location.href || '',
              text: raw.length > 8000 ? raw.slice(0, 8000) + '\n...（已截斷）' : raw
            };
          }
        });
        const page = results[0].result;
        title = page.title;
        url = page.url;
        content = page.text;
      } catch (e) {
        console.error('[知識庫] 無法讀取頁面:', e);
        return;
      }
    }

    // 防重複（url 模式比對 url、text 模式比對 content）
    const { knowledgeBase = [] } = await chrome.storage.local.get(['knowledgeBase']);
    if (source === 'url' && knowledgeBase.some(kb => kb.url === url && kb.source === 'url')) return;
    if (source === 'text' && knowledgeBase.some(kb => kb.content === content)) return;

    const item = { id, title, url, content, summary: '', tags: [], category: '', source, status: 'processing', createdAt: Date.now() };
    knowledgeBase.push(item);
    await chrome.storage.local.set({ knowledgeBase });

    // 非同步 AI 分析（不阻塞右鍵回應）
    analyzeKnowledgeItem(id);
  }

  if (info.menuItemId === 'instant-translate') {
    const text = info.selectionText?.trim();
    if (!text || !tab?.id) return;

    // 偵測語言：有中文 → 譯成英文；否則 → 譯成繁中
    const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
    const [from, to] = isChinese ? ['zh-TW', 'en'] : ['auto', 'zh-TW'];

    try {
      const translated = await translateTextGoogle(text, from, to);
      const msgData = { type: 'SHOW_TRANSLATE_POPUP', data: { original: text, translated, from, to } };

      // 永遠先動態注入（guard 防止重複執行），await 完成後 listener 已就緒
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/translate-popup.js']
        });
      } catch (injectErr) {
        // chrome:// 等特殊頁面無法注入，靜默跳過
        console.warn('[翻譯] 無法注入 content script:', injectErr.message);
        return;
      }

      await chrome.tabs.sendMessage(tab.id, msgData);
    } catch (e) {
      console.error('[翻譯] 失敗:', e);
    }
  }
});

// ── Google Translate（免費端點）───────────────────────────
async function translateTextGoogle(text, from, to) {
  const url = `https://translate.google.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data[0] || []).map(s => s?.[0] || '').join('');
}

// ── 知識庫 AI 分析 ──────────────────────────────────────
async function analyzeKnowledgeItem(itemId) {
  try {
    const { knowledgeBase = [] } = await chrome.storage.local.get(['knowledgeBase']);
    const item = knowledgeBase.find(kb => kb.id === itemId);
    if (!item) return;
    const existingTagPool = [...new Set(
      knowledgeBase.flatMap(kb => Array.isArray(kb.tags) ? kb.tags : [])
    )].slice(0, 60);

    const { apiKey } = await chrome.storage.sync.get(['apiKey']);
    if (!apiKey) {
      // 無 API Key 仍標記為 ready（無摘要）
      const { knowledgeBase: kb = [] } = await chrome.storage.local.get(['knowledgeBase']);
      const idx = kb.findIndex(k => k.id === itemId);
      if (idx !== -1) { kb[idx].status = 'ready'; await chrome.storage.local.set({ knowledgeBase: kb }); }
      return;
    }

    const snippet = item.content.slice(0, 3000);

    const resp = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content: '你是一個內容摘要助手。使用者會提供文章或網頁內容，你必須回覆且只能回覆一個 JSON 物件，格式為 {"summary":"摘要文字","tags":["標籤1","標籤2"]}，不得包含任何其他說明文字或 Markdown 標記。'
          },
          {
            role: 'user',
            content: `請為以下內容產生摘要與標籤，請回傳 JSON。
既有可用標籤（請優先沿用；不適合再新增）：${existingTagPool.length ? existingTagPool.join('、') : '（目前無既有標籤）'}

內容如下：
${snippet}`
          }
        ],
        max_tokens: 500
      })
    });
    const data = await resp.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();

    // 多層次 JSON 解析：direct → 精確 regex → 欄位萃取
    const parsed = extractKbJson(text);

    const { knowledgeBase: kb2 = [] } = await chrome.storage.local.get(['knowledgeBase']);
    const idx = kb2.findIndex(k => k.id === itemId);
    if (idx === -1) return;

    if (parsed) {
      kb2[idx].summary = typeof parsed.summary === 'string' ? parsed.summary : '';
      const currentTags = Array.isArray(kb2[idx].tags) ? kb2[idx].tags : [];
      const suggestedTags = Array.isArray(parsed.tags) ? parsed.tags : [];
      const existingTags = [...new Set(
        kb2.flatMap(kb => Array.isArray(kb.tags) ? kb.tags : [])
      )];
      kb2[idx].tags = resolveKnowledgeTags(suggestedTags, existingTags, currentTags, 5);
    }
    kb2[idx].status = 'ready';
    await chrome.storage.local.set({ knowledgeBase: kb2 });
  } catch (e) {
    console.error('[知識庫] analyzeKnowledgeItem error:', e);
    // 確保不永遠停在 processing
    try {
      const { knowledgeBase: kb = [] } = await chrome.storage.local.get(['knowledgeBase']);
      const idx = kb.findIndex(k => k.id === itemId);
      if (idx !== -1) { kb[idx].status = 'ready'; await chrome.storage.local.set({ knowledgeBase: kb }); }
    } catch {}
  }
}

// 從 AI 回應中穩健地萃取 JSON
async function reanalyzeKnowledgeItem(itemId) {
  const { knowledgeBase = [] } = await chrome.storage.local.get(['knowledgeBase']);
  const idx = knowledgeBase.findIndex(k => k.id === itemId);
  if (idx === -1) throw new Error('Knowledge item not found');

  knowledgeBase[idx].status = 'processing';
  await chrome.storage.local.set({ knowledgeBase });

  analyzeKnowledgeItem(itemId).catch((error) => {
    console.error('[知識庫] reanalyzeKnowledgeItem error:', error);
  });
}

function cleanKnowledgeTag(tag) {
  return String(tag || '').trim().replace(/\s+/g, ' ');
}

function normalizeKnowledgeTag(tag) {
  return cleanKnowledgeTag(tag).toLowerCase();
}

function normalizeKnowledgeTagCompact(tag) {
  return normalizeKnowledgeTag(tag).replace(/[\s_\-./]+/g, '');
}

function resolveKnowledgeTags(suggestedTags, existingTags, fallbackTags = [], limit = 5) {
  const existing = [];
  const existingByNorm = new Map();
  const existingByCompact = new Map();

  (Array.isArray(existingTags) ? existingTags : []).forEach(raw => {
    const clean = cleanKnowledgeTag(raw);
    if (!clean) return;
    const norm = normalizeKnowledgeTag(clean);
    const compact = normalizeKnowledgeTagCompact(clean);
    if (!existingByNorm.has(norm)) existingByNorm.set(norm, clean);
    if (!existingByCompact.has(compact)) existingByCompact.set(compact, clean);
    existing.push(clean);
  });

  const tryMatchExisting = (raw) => {
    const clean = cleanKnowledgeTag(raw);
    if (!clean) return '';
    const norm = normalizeKnowledgeTag(clean);
    const compact = normalizeKnowledgeTagCompact(clean);
    if (existingByNorm.has(norm)) return existingByNorm.get(norm);
    if (existingByCompact.has(compact)) return existingByCompact.get(compact);
    if (norm.length >= 2) {
      const includeHit = existing.find(t => {
        const tNorm = normalizeKnowledgeTag(t);
        return tNorm.includes(norm) || norm.includes(tNorm);
      });
      if (includeHit) return includeHit;
    }
    return clean;
  };

  const resolved = [];
  const seenNorm = new Set();
  const pushTag = (raw) => {
    if (resolved.length >= limit) return;
    const matched = tryMatchExisting(raw);
    if (!matched) return;
    const norm = normalizeKnowledgeTag(matched);
    if (!norm || seenNorm.has(norm)) return;
    seenNorm.add(norm);
    resolved.push(matched);
  };

  const source = (Array.isArray(suggestedTags) && suggestedTags.length > 0)
    ? suggestedTags
    : (Array.isArray(fallbackTags) ? fallbackTags : []);
  source.forEach(pushTag);
  return resolved.slice(0, limit);
}

function extractKbJson(text) {
  // 1. 去除 markdown code fences（```json ... ``` 或 ``` ... ```）
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // 2. 直接 parse 整段
  try { return JSON.parse(stripped); } catch {}

  // 3. 找第一個 { 到最後一個 }（但先縮小範圍至含 "summary" 的段落）
  const summaryIdx = stripped.indexOf('"summary"');
  if (summaryIdx !== -1) {
    const start = stripped.lastIndexOf('{', summaryIdx);
    const end = stripped.indexOf('}', summaryIdx);
    if (start !== -1 && end !== -1) {
      // 找配對的右括號（處理巢狀）
      let depth = 0, closeIdx = -1;
      for (let i = start; i < stripped.length; i++) {
        if (stripped[i] === '{') depth++;
        else if (stripped[i] === '}') { depth--; if (depth === 0) { closeIdx = i; break; } }
      }
      if (closeIdx !== -1) {
        try { return JSON.parse(stripped.slice(start, closeIdx + 1)); } catch {}
      }
    }
  }

  // 4. 正則萃取欄位（最後手段）
  const summaryMatch = stripped.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const tagsMatch = stripped.match(/"tags"\s*:\s*\[([^\]]*)\]/);
  if (summaryMatch) {
    const tags = [];
    if (tagsMatch) {
      const tagArr = tagsMatch[1].match(/"((?:[^"\\]|\\.)*)"/g) || [];
      tags.push(...tagArr.map(t => t.replace(/^"|"$/g, '')));
    }
    return { summary: summaryMatch[1], tags };
  }

  return null;
}

// 監聽工具列圖示點擊，開啟側邊欄
// 使用 windowId 而非 tabId，避免跨頁面切換時出現錯誤
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    // 設定側邊欄路徑（確保每次都指向正確的 HTML）
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel/sidepanel.html',
      enabled: true
    });
  } catch (error) {
    console.error('開啟側邊欄失敗:', error);
  }
});

// 監聽來自 sidepanel 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_MESSAGE') {
    handleChatMessage(message.data)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_HISTORY') {
    chrome.storage.local.get(['chatSessions'], result => {
      sendResponse({ success: true, data: result.chatSessions || [] });
    });
    return true;
  }

  if (message.type === 'SAVE_SESSION') {
    saveSession(message.data.session)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ chatSessions: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'DELETE_SESSION') {
    deleteSession(message.data.sessionId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'RENAME_SESSION') {
    renameSession(message.data.sessionId, message.data.name)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'PIN_SESSION') {
    pinSession(message.data.sessionId, message.data.pinned)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_API_KEY') {
    chrome.storage.sync.get(['apiKey'], result => {
      sendResponse({ success: true, data: result.apiKey || '' });
    });
    return true;
  }

  if (message.type === 'CAPTURE_TAB') {
    // 取得使用者最後聚焦的一般視窗（排除 side panel 本身）
    chrome.windows.getLastFocused({ windowTypes: ['normal'] }, async (win) => {
      if (chrome.runtime.lastError || !win) {
        sendResponse({ success: false, error: '找不到可截圖的視窗' });
        return;
      }
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(win.id, { format: 'png' });
        sendResponse({ success: true, dataUrl });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  if (message.type === 'TTS_FETCH') {
    fetchGoogleTTS(message.data.text, message.data.lang)
      .then(base64 => sendResponse({ success: true, base64 }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'TRANSLATE_WORD') {
    translateTextGoogle(message.data.text, message.data.from || 'auto', message.data.to || 'zh-TW')
      .then(result => sendResponse({ success: true, translated: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'WEB_SEARCH') {
    braveSearch(message.data.query)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'DEEP_SEARCH') {
    exaSearch(message.data.query)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'AUTO_SEARCH') {
    autoSearch(message.data.message)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ needed: false, error: error.message }));
    return true;
  }

  if (message.type === 'EXTRACT_MEMORY') {
    extractMemories(message.data.userMessage, message.data.aiReply)
      .then(items => sendResponse({ success: true, items }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'READ_PAGE') {
    chrome.windows.getLastFocused({ windowTypes: ['normal'] }, async (win) => {
      if (chrome.runtime.lastError || !win) {
        sendResponse({ success: false, error: '找不到可讀取的視窗' });
        return;
      }
      try {
        const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
        const tab = tabs[0];
        if (!tab) {
          sendResponse({ success: false, error: '找不到活動分頁' });
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const title = document.title || '';
            const url = location.href || '';
            const desc = document.querySelector('meta[name="description"]')?.content || '';
            // 優先抓取主要內容區域，避免 nav/footer 干擾
            const mainEl = document.querySelector('main, [role="main"], article, #main-content, #content, .main-content');
            const text = mainEl ? mainEl.innerText : (document.body?.innerText || '');
            return { title, url, description: desc, text };
          }
        });
        sendResponse({ success: true, data: results[0].result });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  if (message.type === 'READ_PAGE_CODE') {
    chrome.windows.getLastFocused({ windowTypes: ['normal'] }, async (win) => {
      if (chrome.runtime.lastError || !win) {
        sendResponse({ success: false, error: '找不到可讀取的視窗' });
        return;
      }
      try {
        const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
        const tab = tabs[0];
        if (!tab) {
          sendResponse({ success: false, error: '找不到活動分頁' });
          return;
        }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const title = document.title || '';
            const url = location.href || '';
            // 內嵌 CSS
            const styles = Array.from(document.querySelectorAll('style'))
              .map(s => s.textContent?.trim()).filter(Boolean).join('\n\n');
            // 外部 CSS 路徑
            const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
              .map(l => l.href).filter(Boolean).join('\n');
            // HTML 原始碼（整頁）
            const html = document.documentElement.outerHTML;
            return { title, url, styles, cssLinks, html };
          }
        });
        sendResponse({ success: true, data: results[0].result });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  if (message.type === 'REANALYZE_KNOWLEDGE') {
    reanalyzeKnowledgeItem(message.data.itemId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_SYNC_SETTINGS') {
    syncService.getSettings()
      .then(settings => sendResponse({ success: true, data: settings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SAVE_SYNC_SETTINGS') {
    syncService.saveSettings(message.data || {})
      .then(async (settings) => {
        await refreshWordPressAutoBackupAlarm();
        sendResponse({ success: true, data: settings });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GOOGLE_DRIVE_CONNECT') {
    syncService.connectGoogleDrive()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GOOGLE_DRIVE_DISCONNECT') {
    syncService.disconnectGoogleDrive()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'GET_SYNC_STATUS') {
    syncService.getStatus()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'WORDPRESS_CONNECT') {
    syncService.connectWordPress()
      .then(async (data) => {
        await refreshWordPressAutoBackupAlarm();
        sendResponse({ success: true, data });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'WORDPRESS_DISCONNECT') {
    syncService.disconnectWordPress()
      .then(async (data) => {
        await refreshWordPressAutoBackupAlarm();
        sendResponse({ success: true, data });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'WORDPRESS_BACKUP_SETTINGS') {
    syncService.backupWordPressSettings()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'WORDPRESS_RESTORE_SETTINGS') {
    syncService.restoreWordPressSettings()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});


// ── Streaming（Port 長連線）─────────────────────────────
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'chat-stream') return;
  let portDisconnected = false;
  const keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      if (chrome.runtime.lastError) {
        console.warn('[Background] keepalive 失敗:', chrome.runtime.lastError.message);
      }
    });
  }, PORT_KEEPALIVE_INTERVAL_MS);
  port.onDisconnect.addListener(() => {
    portDisconnected = true;
    clearInterval(keepAliveTimer);
  });
  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'STREAM_MESSAGE') return;
    try {
      await streamHandleMessage(msg.data, port);
    } catch (err) {
      console.error('[Background] streamHandleMessage 拋出錯誤:', err.message);
      if (!portDisconnected) {
        try { port.postMessage({ type: 'error', message: err.message }); } catch (e) {
          console.warn('[Background] 無法傳送 error 至 port（已斷線）:', e.message);
        }
      }
    }
  });
});

async function generateAgentPlan({ message, history, model, systemPrompt, memoryContext }) {
  const { apiKey, openrouterApiKey } = await chrome.storage.sync.get(['apiKey', 'openrouterApiKey']);
  const requestedModel = model || MODEL_NAME;
  const useOpenRouter = !!(openrouterApiKey && requestedModel !== MODEL_NAME);
  const key = useOpenRouter ? openrouterApiKey : apiKey;
  if (!key) throw new Error('請先在設定頁面輸入 API Key');
  const url = useOpenRouter ? OPENROUTER_API_URL : MINIMAX_API_URL;
  const extraHeaders = useOpenRouter
    ? { 'HTTP-Referer': 'chrome-extension://open-chat-hub', 'X-Title': 'Open Chat Hub' }
    : {};
  const compactHistory = trimHistoryForContext(history || [], 8000)
    .map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 1200) : ''}`)
    .join('\n');
  const planPrompt = `你是計畫模式。請先不要執行工具，也不要回答最終答案。
根據使用者任務、目前上下文與可用工具，產生一份可供使用者批准的繁體中文執行計畫。

可用工具：
- web_search：一般網路搜尋
- deep_search：深度搜尋

請只輸出 JSON，不要 Markdown。格式：
{
  "summary": "一句話描述目標",
  "tools": ["web_search"],
  "sites": ["example.com"],
  "steps": ["步驟一", "步驟二", "步驟三"],
  "risk": "低/中/高與原因"
}

使用者任務：
${message || '未提供文字任務'}

記憶與系統補充：
${[memoryContext, systemPrompt].filter(Boolean).join('\n\n') || '無'}

對話摘要：
${compactHistory || '無'}`;
  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({
      model: requestedModel,
      messages: [{ role: 'user', content: planPrompt }]
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(extractApiErrorMessage(err, resp.status));
  }
  const data = await resp.json();
  const raw = getResponseText(data).replace(/```json|```/g, '').trim();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  const fallbackSteps = raw.split(/\n+/).map(s => s.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean).slice(0, 5);
  return {
    summary: parsed?.summary || '執行使用者任務',
    tools: Array.isArray(parsed?.tools) ? parsed.tools : ['web_search', 'deep_search'],
    sites: Array.isArray(parsed?.sites) ? parsed.sites : [],
    steps: Array.isArray(parsed?.steps) && parsed.steps.length > 0 ? parsed.steps : fallbackSteps,
    risk: parsed?.risk || '',
    text: raw
  };
}

async function streamHandleMessage({ message, history, images, image, mode, translateConfig, model, contextCharBudget, maxAgentIterations, systemPrompt, memoryContext, sessionId, skipTools, planMode, planApproved, approvedPlan }, port) {
  if (planMode && !planApproved) {
    const plan = await generateAgentPlan({ message, history, model, systemPrompt, memoryContext });
    port.postMessage({ type: 'plan_required', plan });
    return;
  }
  const planPrompt = planApproved && approvedPlan
    ? `${systemPrompt || ''}\n\n[已批准的執行計畫]\n${approvedPlan}`.trim()
    : systemPrompt;
  const fileList = images && images.length > 0
    ? images
    : (image ? [{ dataUrl: image, mode: mode || 'upload', fileType: 'image' }] : null);

  if (!fileList || fileList.length === 0) {
    const { openrouterApiKey } = await chrome.storage.sync.get(['openrouterApiKey']);
    const imageRequestConfig = await getOpenRouterImageRequestConfig({ modelId: model || MODEL_NAME, message, apiKey: openrouterApiKey });
    if (skipTools || translateConfig?.enabled || imageRequestConfig) {
      await streamMiniMaxChat(message, history, translateConfig, model, planPrompt, memoryContext, port, sessionId, contextCharBudget);
    } else {
      await streamAgentChat(message, history, translateConfig, model, planPrompt, memoryContext, port, sessionId, contextCharBudget, maxAgentIterations);
    }
    return;
  }

  const textFiles = fileList.filter(f => f.fileType === 'text');
  const visualFiles = fileList.filter(f => !f.fileType || f.fileType === 'image' || f.fileType === 'pdf');

  if (visualFiles.length > 0) {
    const imageFiles = visualFiles.filter(f => !f.fileType || f.fileType === 'image');
    const pdfFiles = visualFiles.filter(f => f.fileType === 'pdf');
    const pdfRoute = classifyPdfRoute(pdfFiles);
    const routeDetails = describeVisualRoute(imageFiles, pdfFiles, pdfRoute, model);
    port.postMessage({
      type: 'agent_notice',
      text: routeDetails,
      level: 'info'
    });

    if (imageFiles.length === 0 && pdfFiles.length > 0 && pdfRoute === 'openrouter-pdf') {
      try {
        await streamOpenRouterPdfChat(message, history, textFiles, pdfFiles, translateConfig, model, planPrompt, memoryContext, port, sessionId, contextCharBudget);
        return;
      } catch (err) {
        const fileNames = formatFileNames(pdfFiles);
        port.postMessage({
          type: 'agent_notice',
          text: `OpenRouter PDF 解析不可用，已改用 Gemini 視覺分析。檔案：${fileNames}。錯誤：${err.message}`,
          level: 'warning'
        });
      }
    }

    const statusText = pdfFiles.length > 0 && imageFiles.length === 0
      ? (pdfRoute === 'gemini' ? '使用 Gemini 分析掃描型 PDF 中...' : '使用 Gemini 分析 PDF 中...')
      : (visualFiles.length > 1 ? `使用 Gemini 分析 ${visualFiles.length} 個視覺檔案中...` : '使用 Gemini 分析圖片中...');
    port.postMessage({ type: 'status', text: statusText });

    let textAppend = '';
    if (textFiles.length > 0) {
      const parts = textFiles.map(f => {
        const base64 = f.dataUrl.split(',')[1];
        let text = atob(base64);
        const name = f.fileName || '檔案';
        if (text.length > 6000) text = text.slice(0, 6000) + '\n...[已截斷]';
        return `=== ${name} ===\n${text}`;
      });
      textAppend = '\n\n[附加文字檔案內容]\n' + parts.join('\n\n');
    }
    const combinedMessage = `${message || ''}${textAppend}`.trim();

    const { geminiApiKey, defaultPrompts } = await chrome.storage.sync.get(['geminiApiKey', 'defaultPrompts']);
    if (!geminiApiKey) throw new Error('請先在設定頁面輸入 Gemini API Key');

    const prompts = { ...DEFAULT_PROMPTS, ...(defaultPrompts || {}) };
    const isOcr = visualFiles.every(img => img.mode === 'ocr');
    let geminiPrompt;
    if (isOcr) {
      geminiPrompt = prompts.ocr || DEFAULT_PROMPTS.ocr;
      if (visualFiles.length > 1) geminiPrompt = `以下有 ${visualFiles.length} 張圖片，請逐一辨識：\n\n` + geminiPrompt;
    } else {
      const basePrompt = prompts.imageAnalysis || DEFAULT_PROMPTS.imageAnalysis;
      const multiHint = visualFiles.length > 1 ? `以下有 ${visualFiles.length} 張圖片，請逐一分析：\n\n` : '';
      geminiPrompt = multiHint + (combinedMessage ? `${basePrompt}\n\n使用者問題：${combinedMessage}` : basePrompt);
    }

    let geminiResult;
    try {
      geminiResult = await callGemini(geminiApiKey, visualFiles, geminiPrompt);
    } catch (err) {
      const files = formatFileNames(visualFiles);
      throw new Error(`Gemini 視覺分析失敗。檔案：${files}。錯誤：${err.message}`);
    }
    port.postMessage({ type: 'status', text: '整理回應中...' });

    let minimaxPrompt;
    if (isOcr) {
      minimaxPrompt = `以下是從圖片中辨識出的文字：\n\n${geminiResult}\n\n請整理並格式化，修正OCR錯誤，保持原始語意。`;
    } else {
      const userQ = combinedMessage ? `\n\n使用者問題：${combinedMessage}` : '';
      minimaxPrompt = `以下是圖片分析結果：\n\n${geminiResult}${userQ}\n\n請根據以上分析，提供清晰、有條理的回應。`;
    }
    await streamMiniMaxChat(minimaxPrompt, history, null, model, planPrompt, memoryContext, port, sessionId, contextCharBudget);
    return;
  }

  // 純文字檔 → 分批分析 + stream 合併
  await streamTextFilesPipeline(textFiles, message, history, translateConfig, model, planPrompt, memoryContext, port, contextCharBudget);
}

async function streamTextFilesPipeline(textFiles, userMessage, history, translateConfig, model, systemPrompt, memoryContext, port, contextCharBudget) {
  const CHUNK_SIZE = 6000;
  const MAX_TOTAL_CHARS = 30000;

  const fileParts = [];
  let totalChars = 0;
  let truncated = false;
  for (const f of textFiles) {
    if (totalChars >= MAX_TOTAL_CHARS) { truncated = true; break; }
    const base64 = f.dataUrl.split(',')[1];
    let text = atob(base64);
    const name = f.fileName || '檔案';
    const remaining = MAX_TOTAL_CHARS - totalChars;
    if (text.length > remaining) { text = text.slice(0, remaining); truncated = true; }
    fileParts.push({ name, text });
    totalChars += text.length;
  }
  const truncateNotice = truncated ? `\n\n⚠️ 檔案過大，僅分析前 ${MAX_TOTAL_CHARS.toLocaleString()} 字元。` : '';

  const chunks = [];
  for (const { name, text } of fileParts) {
    if (text.length <= CHUNK_SIZE) {
      chunks.push({ label: name, content: text });
    } else {
      const total = Math.ceil(text.length / CHUNK_SIZE);
      for (let i = 0, idx = 1; i < text.length; i += CHUNK_SIZE, idx++) {
        chunks.push({ label: `${name}（第 ${idx}/${total} 段）`, content: text.slice(i, i + CHUNK_SIZE) });
      }
    }
  }

  if (chunks.length === 1) {
    const prompt = `以下是附加的檔案內容：\n\n=== ${chunks[0].label} ===\n${chunks[0].content}${userMessage ? `\n\n使用者問題：${userMessage}` : '\n\n請分析並整理以上內容。'}${truncateNotice}`;
    await streamMiniMaxChat(prompt, history, translateConfig, model, systemPrompt, memoryContext, port, undefined, contextCharBudget);
    return;
  }

  const segmentResults = [];
  for (let i = 0; i < chunks.length; i++) {
    port.postMessage({ type: 'status', text: `分析第 ${i + 1}/${chunks.length} 段...` });
    const segPrompt = `以下是「${chunks[i].label}」的內容，請閱讀並摘要重點：\n\n${chunks[i].content}`;
    const res = await handleMiniMaxChat(segPrompt, [], null, model, null, memoryContext);
    segmentResults.push(`【${chunks[i].label}】\n${res.reply}`);
  }
  port.postMessage({ type: 'status', text: '整合結果中...' });
  const mergePrompt = `以下是對文件各段落的分析摘要，請整合成完整報告：\n\n${segmentResults.join('\n\n')}${userMessage ? `\n\n使用者問題：${userMessage}` : ''}${truncateNotice}`;
  await streamMiniMaxChat(mergePrompt, history, translateConfig, model, systemPrompt, memoryContext, port, undefined, contextCharBudget);
}

function getDataUrlBase64(dataUrl) {
  const idx = String(dataUrl || '').indexOf(',');
  return idx >= 0 ? String(dataUrl).slice(idx + 1) : '';
}

function samplePdfBinary(dataUrl, maxBase64Chars = 1200000) {
  const base64 = getDataUrlBase64(dataUrl).slice(0, maxBase64Chars);
  try {
    return atob(base64);
  } catch {
    return '';
  }
}

function countPdfMarker(sample, marker) {
  return (sample.match(new RegExp(marker, 'g')) || []).length;
}

function isLikelyScannedPdf(file) {
  const sample = samplePdfBinary(file.dataUrl);
  if (!sample) return false;

  const imageCount = countPdfMarker(sample, '/Subtype\\s*/Image');
  const textBlocks = countPdfMarker(sample, '\\bBT\\b') + countPdfMarker(sample, '\\bET\\b');
  const textOps = countPdfMarker(sample, '\\bTj\\b') + countPdfMarker(sample, '\\bTJ\\b') + countPdfMarker(sample, '\\bTf\\b');
  const fontCount = countPdfMarker(sample, '/Font\\b');

  return imageCount > 0 && textBlocks === 0 && textOps === 0 && fontCount === 0;
}

function classifyPdfRoute(pdfFiles) {
  if (!pdfFiles || pdfFiles.length === 0) return null;
  return pdfFiles.some(isLikelyScannedPdf) ? 'gemini' : 'openrouter-pdf';
}

function formatFileNames(files) {
  const names = (files || []).map((file, i) => file.fileName || `檔案 ${i + 1}`);
  return names.length > 0 ? names.join('、') : '未命名檔案';
}

function describeVisualRoute(imageFiles, pdfFiles, pdfRoute, model) {
  const imageCount = imageFiles?.length || 0;
  const pdfCount = pdfFiles?.length || 0;
  const requestedModel = model || MODEL_NAME;

  if (imageCount > 0 && pdfCount > 0) {
    return `分析方式：圖片與 PDF 混合上傳，統一使用 Gemini 視覺分析。圖片 ${imageCount} 個、PDF ${pdfCount} 個。`;
  }
  if (imageCount > 0) {
    return `分析方式：使用 Gemini image analysis。圖片 ${imageCount} 個。`;
  }
  if (pdfRoute === 'openrouter-pdf') {
    return `分析方式：偵測為文字型 PDF，優先使用 OpenRouter PDF Inputs（Cloudflare AI parser）搭配模型 ${requestedModel}。PDF ${pdfCount} 個。`;
  }
  if (pdfRoute === 'gemini') {
    return `分析方式：偵測為圖片型/掃描型 PDF，使用 Gemini 視覺分析。PDF ${pdfCount} 個。`;
  }
  return '分析方式：使用 Gemini 視覺分析。';
}

async function streamOpenRouterPdfChat(message, history, textFiles, pdfFiles, translateConfig, model, systemPrompt, memoryContext, port, sessionId, contextCharBudget) {
  const { defaultPrompts, globalPrompt: storedGlobal, openrouterApiKey } =
    await chrome.storage.sync.get(['defaultPrompts', 'globalPrompt', 'openrouterApiKey']);

  const requestedModel = model || MODEL_NAME;
  if (!openrouterApiKey || requestedModel === MODEL_NAME) {
    throw new Error('請先選擇 OpenRouter 模型並設定 OpenRouter API Key');
  }

  port.postMessage({ type: 'status', text: `使用 OpenRouter Cloudflare AI 解析 PDF 中...（${formatFileNames(pdfFiles)}）` });

  const globalPrompt = storedGlobal?.trim() || '';
  const chatDefaultPrompt = defaultPrompts?.chat?.trim() || '';
  let modePrompt = '';
  if (chatDefaultPrompt && systemPrompt) modePrompt = `${chatDefaultPrompt}\n\n${systemPrompt}`;
  else if (chatDefaultPrompt) modePrompt = chatDefaultPrompt;
  else if (systemPrompt) modePrompt = systemPrompt;
  const finalSystemPrompt = [memoryContext, globalPrompt, modePrompt].filter(Boolean).join('\n\n');

  const textAppend = buildTextFilesAppend(textFiles);
  const userText = `${message || '請分析這份 PDF。'}${textAppend}`.trim();
  const messages = buildPdfMessages(userText, history || [], translateConfig, finalSystemPrompt, globalPrompt, pdfFiles, contextCharBudget);

  const response = await fetchWithTimeout(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'chrome-extension://open-chat-hub',
      'X-Title': 'Open Chat Hub'
    },
    body: JSON.stringify({
      model: requestedModel,
      messages,
      plugins: [
        {
          id: 'file-parser',
          pdf: { engine: 'cloudflare-ai' }
        }
      ]
    })
  }, 90000);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const rawMsg = extractApiErrorMessage(errorData, response.status);
    throw new Error(`OpenRouter PDF Inputs 失敗。模型：${requestedModel}；Parser：cloudflare-ai；檔案：${formatFileNames(pdfFiles)}；HTTP ${response.status}；${rawMsg}`);
  }

  const data = await response.json();
  const reply = getResponseText(data).trim();
  if (!reply) {
    throw new Error(`OpenRouter PDF Inputs 未返回文字內容。模型：${requestedModel}；Parser：cloudflare-ai；檔案：${formatFileNames(pdfFiles)}`);
  }

  port.postMessage({ type: 'chunk', text: reply, full: reply });
  port.postMessage({ type: 'done', reply });

  if (data.usage) {
    recordOpenRouterUsage({ modelId: requestedModel, usage: data.usage, apiKey: openrouterApiKey, sessionId, source: 'pdf' })
      .catch(err => console.warn('[Usage] 紀錄失敗:', err?.message || err));
  }
}

function buildTextFilesAppend(textFiles) {
  if (!textFiles || textFiles.length === 0) return '';
  const parts = textFiles.map(f => {
    const base64 = getDataUrlBase64(f.dataUrl);
    let text = atob(base64);
    const name = f.fileName || '檔案';
    if (text.length > 6000) text = text.slice(0, 6000) + '\n...[已截斷]';
    return `=== ${name} ===\n${text}`;
  });
  return '\n\n[附加文字檔案內容]\n' + parts.join('\n\n');
}

function buildPdfMessages(userText, history, translateConfig, systemPrompt, globalPrompt, pdfFiles, contextCharBudget = MAX_CONTEXT_CHARS) {
  const messages = [];
  if (translateConfig && translateConfig.enabled) {
    const { sourceLang, targetLang } = translateConfig;
    const srcName = LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = LANG_NAMES[targetLang] || targetLang;
    const translatePrompt = `你是一位專業翻譯員。使用者會輸入${srcName}或${tgtName}的文字。
- 如果輸入是${srcName}，請翻譯成${tgtName}
- 如果輸入是${tgtName}，請翻譯成${srcName}
只輸出翻譯結果，不需要解釋或額外說明。`;
    messages.push({ role: 'system', content: globalPrompt ? `${globalPrompt}\n\n${translatePrompt}` : translatePrompt });
  } else if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  const textOnlyHistory = (history || []).filter(item => !(item.images || item.image));
  trimHistoryForContext(textOnlyHistory, Math.max(0, normalizeContextCharBudget(contextCharBudget) - userText.length)).forEach(item => {
    messages.push({ role: item.role, content: item.content });
  });

  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: userText },
      ...pdfFiles.map((file, i) => ({
        type: 'file',
        file: {
          filename: file.fileName || `document-${i + 1}.pdf`,
          file_data: file.dataUrl
        }
      }))
    ]
  });
  return messages;
}

function getResponseText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content.map(part => part.text || '').filter(Boolean).join('\n\n');
  }
  return typeof content === 'string' ? content : '';
}

function normalizeImageAttachment(raw, index = 0) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return {
      type: 'image',
      name: `image-${index + 1}`,
      mimeType: raw.startsWith('data:') ? (raw.match(/^data:([^;]+);/)?.[1] || 'image/png') : '',
      url: raw,
      source: 'openrouter'
    };
  }
  const url = raw.url || raw.image_url?.url || raw.imageUrl?.url || raw.data_url || raw.dataUrl || raw.b64_json || raw.base64 || raw.file_data;
  if (!url) return null;
  const mimeType = raw.mime_type || raw.mimeType || (String(url).match(/^data:([^;]+);/)?.[1] || 'image/png');
  const normalizedUrl = String(url).startsWith('data:') || String(url).startsWith('http')
    ? String(url)
    : `data:${mimeType};base64,${url}`;
  return {
    type: 'image',
    name: raw.filename || raw.name || `image-${index + 1}`,
    mimeType,
    url: normalizedUrl,
    source: 'openrouter'
  };
}

function extractImageOutputAttachments(messageOrData, text = '') {
  const msg = messageOrData?.choices?.[0]?.message || messageOrData?.choices?.[0]?.delta || messageOrData || {};
  const attachments = [];
  const push = raw => {
    const attachment = normalizeImageAttachment(raw, attachments.length);
    if (attachment && !attachments.some(a => a.url === attachment.url)) attachments.push(attachment);
  };

  if (Array.isArray(msg.images)) msg.images.forEach(push);
  if (Array.isArray(msg.attachments)) {
    msg.attachments
      .filter(a => String(a.type || '').toLowerCase() === 'image' || a.url || a.data_url || a.b64_json)
      .forEach(push);
  }

  const content = msg.content;
  if (Array.isArray(content)) {
    content.forEach(part => {
      const type = String(part?.type || '').toLowerCase();
      if (type === 'image_url' || type === 'output_image' || type === 'image') {
        push(part.image_url || part.image || part);
      }
    });
  }

  const markdownImageRe = /!\[[^\]]*]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
  for (const sourceText of [text, typeof content === 'string' ? content : '']) {
    let match;
    while ((match = markdownImageRe.exec(sourceText || '')) !== null) push(match[1]);
  }

  return attachments;
}

async function streamMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, port, sessionId, contextCharBudget) {
  const { apiKey, defaultPrompts, globalPrompt: storedGlobal, openrouterApiKey } =
    await chrome.storage.sync.get(['apiKey', 'defaultPrompts', 'globalPrompt', 'openrouterApiKey']);

  const requestedModel = model || MODEL_NAME;
  const useOpenRouter = !!(openrouterApiKey && requestedModel !== MODEL_NAME);
  if (!useOpenRouter && !apiKey) throw new Error('請先在設定頁面輸入 API Key');

  const useModel = requestedModel;
  const globalPrompt = storedGlobal?.trim() || '';
  const chatDefaultPrompt = defaultPrompts?.chat?.trim() || '';
  let modePrompt = '';
  if (chatDefaultPrompt && systemPrompt) modePrompt = `${chatDefaultPrompt}\n\n${systemPrompt}`;
  else if (chatDefaultPrompt) modePrompt = chatDefaultPrompt;
  else if (systemPrompt) modePrompt = systemPrompt;

  const finalSystemPrompt = [memoryContext, globalPrompt, modePrompt].filter(Boolean).join('\n\n');

  const effectiveContextChars = normalizeContextCharBudget(contextCharBudget);
  const fixedChars = (finalSystemPrompt?.length || 0) + message.length;
  const historyBudget = Math.max(0, effectiveContextChars - fixedChars);
  const compressKey = useOpenRouter ? openrouterApiKey : apiKey;
  const { history: compressedHistory, summary } = await compressHistoryIfNeeded(sessionId, history || [], compressKey, useModel, historyBudget);

  if (summary) port.postMessage({ type: 'compressed' });

  const effectiveSystemPrompt = summary
    ? `${finalSystemPrompt ? finalSystemPrompt + '\n\n' : ''}[對話前段摘要]\n${summary}`
    : finalSystemPrompt;

  const messages = buildMessages(message, compressedHistory, translateConfig, effectiveSystemPrompt, globalPrompt, effectiveContextChars);

  const chatUrl = useOpenRouter ? OPENROUTER_API_URL : MINIMAX_API_URL;
  const chatKey = useOpenRouter ? openrouterApiKey : apiKey;
  const extraHeaders = useOpenRouter
    ? { 'HTTP-Referer': 'chrome-extension://open-chat-hub', 'X-Title': 'Open Chat Hub' }
    : {};
  const imageRequestConfig = useOpenRouter
    ? await getOpenRouterImageRequestConfig({ modelId: useModel, message, apiKey: openrouterApiKey })
    : null;

  const requestBody = {
    model: useModel,
    messages,
    stream: true,
    ...(imageRequestConfig ? {
      modalities: imageRequestConfig.modalities,
      ...(imageRequestConfig.image_config ? { image_config: imageRequestConfig.image_config } : {})
    } : {}),
    ...(useOpenRouter ? { stream_options: { include_usage: true } } : {})
  };
  console.log(`[Stream] 送出請求 model=${useModel} msgs=${messages.length} histChars=${messages.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : 0), 0)}`);

  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${chatKey}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const rawMsg = extractApiErrorMessage(errorData, response.status);
    console.error(`[Stream] HTTP 錯誤 ${response.status}:`, rawMsg);
    if (rawMsg.toLowerCase().includes('context window')) {
      throw new Error('對話內容或歷史過長，已超出模型限制。請試著縮短輸入，或點擊「+」開啟新對話。');
    }
    throw new Error(rawMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let fullContent = '';
  let finalUsage = null;
  let outputAttachments = [];
  let lastFinishReason = null;
  let streamError = null;

  try {
    while (true) {
      const { done, value } = await readStreamChunkWithTimeout(reader);
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.usage) finalUsage = json.usage;
          // 擷取 API 層級錯誤（mid-stream error）
          if (json.error) {
            const errCode = json.error.code || json.error.status_code || '';
            const errMsg = json.error.message || JSON.stringify(json.error);
            console.error(`[Stream] API mid-stream error code=${errCode}:`, errMsg);
            streamError = errMsg;
          }
          if (useOpenRouter) {
            const deltaAttachments = extractImageOutputAttachments(json, fullContent);
            if (deltaAttachments.length > 0) {
              outputAttachments = [...outputAttachments, ...deltaAttachments.filter(a => !outputAttachments.some(existing => existing.url === a.url))];
            }
          }
          const choice = json.choices?.[0];
          if (choice?.finish_reason) lastFinishReason = choice.finish_reason;
          const delta = choice?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            port.postMessage({ type: 'chunk', text: delta, full: fullContent });
          }
        } catch (e) {
          console.warn('[Stream] SSE 解析失敗:', e.message, '| raw:', line.slice(0, 120));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (lastFinishReason && lastFinishReason !== 'stop') {
    console.warn(`[Stream] finish_reason=${lastFinishReason} model=${useModel}`);
  }

  const cleaned = fullContent
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<result>[\s\S]*?<\/result>/gi, '')
    .trim();

  if (useOpenRouter) {
    const textAttachments = extractImageOutputAttachments(null, cleaned || fullContent);
    if (textAttachments.length > 0) {
      outputAttachments = [...outputAttachments, ...textAttachments.filter(a => !outputAttachments.some(existing => existing.url === a.url))];
    }
  }

  if (!cleaned && !fullContent && outputAttachments.length === 0) {
    const reason = streamError
      ? `API 錯誤：${streamError}`
      : lastFinishReason === 'length'
        ? '對話歷史過長，模型在回覆前即達 token 上限。請點擊「+」開啟新對話。'
        : '模型回傳空內容，可能為暫時性錯誤，請稍後重試。';
    const debugLine = `[Debug] model=${useModel} msgs=${messages.length} finish=${lastFinishReason ?? 'none'} err=${streamError ?? 'none'}`;
    console.error(`[Stream] 空回應 ${debugLine}`);
    throw new Error(`${reason}\n${debugLine}`);
  }

  let finalReply = cleaned || fullContent;
  if (outputAttachments.length > 0) {
    const refusalLikeReply = /(?:無法理解|無法為.*生成|無法.*圖片|不能.*生成|sorry|can't|cannot|unable)/i.test(finalReply);
    if (isImageReplyNoise(finalReply) || refusalLikeReply) {
      finalReply = imageRequestConfig?.aspectRatio
        ? `已生成圖片（${imageRequestConfig.aspectRatio}）。`
        : '已生成圖片。';
    }
  }

  console.log(`[Stream] 完成 chars=${fullContent.length} finish_reason=${lastFinishReason}`);
  port.postMessage({ type: 'done', reply: finalReply, attachments: outputAttachments, usage: normalizeUsage(finalUsage) });
  if (useOpenRouter && finalUsage) {
    recordOpenRouterUsage({ modelId: useModel, usage: finalUsage, apiKey: openrouterApiKey, sessionId, source: 'chat' })
      .catch(err => console.warn('[Usage] 紀錄失敗:', err?.message || err));
  }
}

// ── Agent Tools 定義 ─────────────────────────────────────────
const AGENT_TOOLS_SEARCH = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '搜尋網路上的最新資訊、新聞、當前事件、最新版本、即時狀態。除非使用者明確指定時間範圍，否則搜尋關鍵字應加入當前年份以優先取得最新結果。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜尋關鍵字，20字以內，應包含年份以確保結果時效性' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deep_search',
      description: '深度搜尋技術文件、學術研究、詳細資料。適合需要深入技術資訊的問題。除非使用者指定，否則優先取得最新版本資料。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜尋關鍵字，應包含年份以確保結果時效性' }
        },
        required: ['query']
      }
    }
  }
];

const AGENT_TOOLS_BROWSER = [
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: '點擊頁面上的指定元素（按鈕、連結、核取方塊等）。優先使用 id、data-testid、aria-label 定位，再考慮 CSS class。',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector，例如 #submit、[aria-label="搜尋"]、.btn-primary' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_fill',
      description: '填入文字到輸入框（input、textarea）。填入後自動觸發 input 與 change 事件，相容 React / Vue 應用。',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector，例如 #email、[name="username"]' },
          value: { type: 'string', description: '要填入的文字' }
        },
        required: ['selector', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_select',
      description: '選擇 <select> 下拉選單的選項，支援依 value 屬性或顯示文字匹配。',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector 指向 <select> 元素' },
          value: { type: 'string', description: '選項的 value 屬性值或顯示文字' }
        },
        required: ['selector', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_text',
      description: '取得頁面元素或整頁的文字內容。省略 selector 時自動擷取主要內容區域（main / article），最多回傳 8000 字元。',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector（可省略，省略時取整頁主要內容）' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_html',
      description: '取得頁面元素的 HTML 原始碼，用於分析頁面結構或找到正確的 selector。最多回傳 5000 字元。',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector（可省略，省略時取 body HTML）' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_scroll',
      description: '捲動頁面。direction 可為 up/down（相對捲動）或 top/bottom（捲到頁首/頁尾）。',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'], description: '捲動方向' },
          amount: { type: 'number', description: '捲動像素（direction 為 top/bottom 時忽略，預設 300）' }
        },
        required: ['direction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_wait_for',
      description: '等待頁面出現指定元素，適用於頁面載入或動態內容渲染後的操作。預設最多等待 5 秒。',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: '要等待的元素 CSS selector' },
          timeout: { type: 'number', description: '最長等待毫秒數（預設 5000，上限 15000）' }
        },
        required: ['selector']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browser_navigate',
      description: '在新分頁中開啟指定 URL，不影響使用者當前頁面。同一 session 內的後續 browser_* 操作都會在此新分頁執行。導航後可搭配 browser_wait_for 等待頁面載入完成。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '完整 URL，例如 https://example.com' }
        },
        required: ['url']
      }
    }
  }
];

// ── Session 層級瀏覽器分頁 / 群組追蹤 ──────────────────────────
// key: sessionId → { tabId, groupId }
// tabId：目前最後一個 agent 分頁；groupId：該 session 的分頁群組
const agentBrowserSessions = new Map();

async function getAgentTabId(sessionId) {
  const ctx = agentBrowserSessions.get(sessionId);
  if (!ctx?.tabId) return null;
  try {
    await chrome.tabs.get(ctx.tabId);
    return ctx.tabId;
  } catch {
    agentBrowserSessions.set(sessionId, { ...ctx, tabId: null });
    return null;
  }
}

async function getAgentGroupId(sessionId) {
  const ctx = agentBrowserSessions.get(sessionId);
  if (!ctx?.groupId) return null;
  try {
    await chrome.tabGroups.get(ctx.groupId);
    return ctx.groupId;
  } catch {
    agentBrowserSessions.set(sessionId, { ...ctx, groupId: null });
    return null;
  }
}

// ── 取得使用者當前活動分頁 ────────────────────────────────────
async function getActivePageTab() {
  return new Promise((resolve) => {
    chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
      if (chrome.runtime.lastError || !win) { resolve(null); return; }
      chrome.tabs.query({ active: true, windowId: win.id }, (tabs) => {
        resolve(tabs?.[0] || null);
      });
    });
  });
}

// ── tool_start 顯示文字 ───────────────────────────────────────
function toolDisplayQuery(name, args) {
  if (args.query) return args.query;
  if (args.selector) return args.selector;
  if (args.url) return args.url;
  if (args.direction) return args.amount ? `${args.direction} ${args.amount}px` : args.direction;
  if (args.value) return String(args.value).slice(0, 40);
  return '';
}

// ── 瀏覽器工具執行 ────────────────────────────────────────────
async function executeBrowserTool(toolName, args, sessionId) {
  // browser_navigate：永遠開新分頁，加入（或建立）session 群組
  if (toolName === 'browser_navigate') {
    try {
      const tab = await chrome.tabs.create({ url: args.url, active: false });
      if (sessionId) {
        const existingGroupId = await getAgentGroupId(sessionId);
        let groupId;
        if (existingGroupId) {
          // 加入既有群組
          await chrome.tabs.group({ tabIds: [tab.id], groupId: existingGroupId });
          groupId = existingGroupId;
        } else {
          // 建立新群組並設定樣式
          groupId = await chrome.tabs.group({ tabIds: [tab.id] });
          await chrome.tabGroups.update(groupId, { title: 'Open Chat Hub', color: 'blue' });
        }
        agentBrowserSessions.set(sessionId, { tabId: tab.id, groupId });
      }
      return { success: true, url: args.url, tabId: tab.id };
    } catch (e) {
      return { error: e.message };
    }
  }

  // 其他工具：優先使用 session agent 分頁，否則使用使用者當前分頁
  let tabId;
  if (sessionId) {
    tabId = await getAgentTabId(sessionId);
  }
  if (!tabId) {
    const tab = await getActivePageTab();
    if (!tab) return { error: '找不到活動分頁' };
    tabId = tab.id;
  }

  async function exec(func, funcArgs = []) {
    try {
      const results = await chrome.scripting.executeScript({ target: { tabId }, func, args: funcArgs });
      return results[0].result;
    } catch (e) {
      return { error: e.message };
    }
  }

  if (toolName === 'browser_click') {
    return await exec((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { error: `找不到元素: ${sel}` };
      el.click();
      return { success: true, tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 60) };
    }, [args.selector]);
  }

  if (toolName === 'browser_fill') {
    return await exec((sel, val) => {
      const el = document.querySelector(sel);
      if (!el) return { error: `找不到元素: ${sel}` };
      const inputProto = window.HTMLInputElement.prototype;
      const textareaProto = window.HTMLTextAreaElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(inputProto, 'value')?.set
        || Object.getOwnPropertyDescriptor(textareaProto, 'value')?.set;
      if (nativeSetter) nativeSetter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, value: val };
    }, [args.selector, args.value]);
  }

  if (toolName === 'browser_select') {
    return await exec((sel, val) => {
      const el = document.querySelector(sel);
      if (!el || el.tagName !== 'SELECT') return { error: `找不到 <select> 元素: ${sel}` };
      const opt = Array.from(el.options).find(o => o.value === val || o.text === val);
      if (!opt) return { error: `找不到選項: ${val}` };
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, selected: opt.text };
    }, [args.selector, args.value]);
  }

  if (toolName === 'browser_get_text') {
    return await exec((sel) => {
      let el;
      let warning = '';
      if (sel) {
        el = document.querySelector(sel);
        if (!el) {
          warning = `找不到元素: ${sel}，已改讀取頁面主內容。`;
          el = document.querySelector('main, [role="main"], article, #main-content, #content, .main-content') || document.body;
        }
      } else {
        el = document.querySelector('main, [role="main"], article, #main-content, #content, .main-content') || document.body;
      }
      const text = el.innerText || '';
      return {
        text: text.length > 8000 ? text.slice(0, 8000) + '\n...（已截斷）' : text,
        length: text.length,
        ...(warning ? { warning, selectorFallback: true } : {})
      };
    }, [args.selector || '']);
  }

  if (toolName === 'browser_get_html') {
    return await exec((sel) => {
      const el = sel ? document.querySelector(sel) : document.body;
      if (!el) return { error: `找不到元素: ${sel}` };
      const html = el.innerHTML || '';
      return { html: html.length > 5000 ? html.slice(0, 5000) + '\n...（已截斷）' : html, length: html.length };
    }, [args.selector || '']);
  }

  if (toolName === 'browser_scroll') {
    return await exec((direction, amount) => {
      const px = amount || 300;
      if (direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else if (direction === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      else if (direction === 'up') window.scrollBy({ top: -px, behavior: 'smooth' });
      else window.scrollBy({ top: px, behavior: 'smooth' });
      return { success: true, scrollY: window.scrollY };
    }, [args.direction, args.amount || 300]);
  }

  if (toolName === 'browser_wait_for') {
    const selector = args.selector;
    const timeout = Math.min(args.timeout || 5000, 15000);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await exec((sel) => !!document.querySelector(sel), [selector]);
      if (found === true) return { success: true, selector };
      if (found?.error) return found;
      await new Promise(r => setTimeout(r, 300));
    }
    return { error: `等待逾時 (${timeout}ms)：找不到 ${selector}` };
  }

  return { error: `未知瀏覽器工具: ${toolName}` };
}

// ── XML 工具呼叫解析（MiniMax M2.7 使用 XML 格式而非 OpenAI tool_calls）──
function parseXmlToolCalls(content) {
  if (!content || typeof content !== 'string') return null;
  const blockMatch = content.match(/<minimax:tool_call>([\s\S]*?)<\/minimax:tool_call>/);
  if (!blockMatch) return null;
  const calls = [];
  const invokeRe = /<invoke name="([^"]+)">([\s\S]*?)<\/invoke>/g;
  let m;
  while ((m = invokeRe.exec(blockMatch[1])) !== null) {
    const name = m[1];
    const args = {};
    const paramRe = /<parameter name="([^"]+)">([\s\S]*?)<\/parameter>/g;
    let p;
    while ((p = paramRe.exec(m[2])) !== null) args[p[1]] = p[2].trim();
    calls.push({ name, args });
  }
  return calls.length > 0 ? calls : null;
}

function truncateAgentText(value, limit = AGENT_TOOL_RESULT_LIMIT) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit)}\n...（已截斷，原長度 ${text.length} 字）` : text;
}

function compactToolResultForAgent(result) {
  if (!result || typeof result !== 'object') return truncateAgentText(result);
  if (result.error) return { error: truncateAgentText(result.error, 600) };
  if (Array.isArray(result.results)) {
    return {
      ...result,
      results: result.results.slice(0, AGENT_TOOL_RESULT_COUNT).map(r => ({
        title: truncateAgentText(r.title, 160),
        url: r.url,
        snippet: truncateAgentText(r.snippet, 500)
      })),
      omitted: Math.max(0, result.results.length - AGENT_TOOL_RESULT_COUNT)
    };
  }
  if (typeof result.text === 'string') {
    return { ...result, text: truncateAgentText(result.text) };
  }
  if (typeof result.html === 'string') {
    return { ...result, html: truncateAgentText(result.html) };
  }
  return result;
}

function formatXmlToolResultForAgent(name, args, result) {
  const compact = compactToolResultForAgent(result);
  if (compact.results) {
    const snippets = compact.results.map((r, i) => (
      `[${i + 1}] ${r.title}\n${r.snippet}\n來源：${r.url}`
    )).join('\n\n');
    const omitted = compact.omitted ? `\n\n另有 ${compact.omitted} 筆結果已省略，請先根據以上高相關結果判斷是否需要再搜尋。` : '';
    return `[工具 ${name} 搜尋「${args.query || ''}」的結果]\n${snippets}${omitted}`;
  }
  return `[工具 ${name} 的結果]\n${truncateAgentText(JSON.stringify(compact), AGENT_TOOL_RESULT_LIMIT)}`;
}

// ── Tool 執行路由 ─────────────────────────────────────────────
async function handleToolCall(name, args, sessionId) {
  if (name === 'web_search') {
    const r = await braveSearch(args.query);
    if (r.success) return { results: r.results, provider: r.provider };
    const fallback = await exaSearch(args.query);
    return fallback.success ? { results: fallback.results, provider: fallback.provider } : { error: r.error };
  }
  if (name === 'deep_search') {
    const r = await exaSearch(args.query);
    if (r.success) return { results: r.results, provider: r.provider };
    const fallback = await braveSearch(args.query);
    return fallback.success ? { results: fallback.results, provider: fallback.provider } : { error: r.error };
  }
  if (name.startsWith('browser_')) {
    return await executeBrowserTool(name, args, sessionId);
  }
  const { apiToolRegistry } = await chrome.storage.local.get('apiToolRegistry');
  const regTool = (apiToolRegistry || []).find(t => t.enabled && t.name === name);
  if (regTool) return await executeApiTool(regTool, args);
  return { error: `未知工具: ${name}` };
}

// ── API Tool Registry ────────────────────────────────────────
function buildRegistryTool(tool) {
  const props = {};
  const required = [];
  for (const p of (tool.parameters || [])) {
    props[p.name] = { type: p.type || 'string', description: p.description || '' };
    if (p.required) required.push(p.name);
  }
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: { type: 'object', properties: props, ...(required.length ? { required } : {}) }
    }
  };
}

async function executeApiTool(tool, args) {
  try {
    let url = tool.url || '';
    const headers = {};
    const queryParams = new URLSearchParams();

    for (const p of (tool.parameters || []).filter(p => p.location === 'path')) {
      if (args[p.name] !== undefined)
        url = url.replace(`{${p.name}}`, encodeURIComponent(String(args[p.name])));
    }

    if (tool.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${tool.authSecret || ''}`;
    } else if (tool.authType === 'api_key_header' && tool.authKeyName) {
      headers[tool.authKeyName] = tool.authSecret || '';
    } else if (tool.authType === 'api_key_query' && tool.authKeyName) {
      queryParams.set(tool.authKeyName, tool.authSecret || '');
    } else if (tool.authType === 'basic_auth') {
      headers['Authorization'] = `Basic ${btoa(`${tool.authUsername || ''}:${tool.authPassword || ''}`)}`;
    }

    for (const p of (tool.parameters || []).filter(p => p.location === 'query')) {
      if (args[p.name] !== undefined) queryParams.set(p.name, String(args[p.name]));
    }

    const bodyObj = {};
    for (const p of (tool.parameters || []).filter(p => p.location === 'body')) {
      if (args[p.name] !== undefined) bodyObj[p.name] = args[p.name];
    }

    for (const p of (tool.parameters || []).filter(p => p.location === 'header')) {
      if (args[p.name] !== undefined) headers[p.name] = String(args[p.name]);
    }

    const fullUrl = queryParams.toString() ? `${url}?${queryParams}` : url;
    const fetchOpts = { method: tool.method || 'GET', headers };
    if (['POST', 'PUT', 'PATCH'].includes(tool.method) && Object.keys(bodyObj).length > 0) {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(bodyObj);
    }

    const resp = await fetch(fullUrl, fetchOpts);
    const text = await resp.text();
    const limit = tool.responseLimit || 2000;

    if (!resp.ok) return { error: `HTTP ${resp.status}: ${text.slice(0, 500)}` };

    try {
      return { result: JSON.stringify(JSON.parse(text), null, 2).slice(0, limit) };
    } catch {
      return { result: text.slice(0, limit) };
    }
  } catch (err) {
    return { error: err.message };
  }
}

// ── Agent 對話（帶 Tool Use）──────────────────────────────────
async function streamAgentChat(message, history, translateConfig, model, systemPrompt, memoryContext, port, sessionId, contextCharBudget, maxAgentIterations) {
  const { apiKey, defaultPrompts, globalPrompt: storedGlobal, openrouterApiKey } =
    await chrome.storage.sync.get(['apiKey', 'defaultPrompts', 'globalPrompt', 'openrouterApiKey']);

  const requestedModel = model || MODEL_NAME;
  const useOpenRouter = !!(openrouterApiKey && requestedModel !== MODEL_NAME);
  if (!useOpenRouter && !apiKey) throw new Error('請先在設定頁面輸入 API Key');

  // 決定可用工具（瀏覽器工具永遠可用，搜尋工具視 API Key 決定，Registry 工具依設定載入）
  const { braveApiKey, exaApiKey } = await chrome.storage.sync.get(['braveApiKey', 'exaApiKey']);
  const { apiToolRegistry } = await chrome.storage.local.get('apiToolRegistry');
  const registryTools = (apiToolRegistry || []).filter(t => t.enabled).map(buildRegistryTool);
  const tools = [...AGENT_TOOLS_BROWSER, ...registryTools];
  if (braveApiKey || exaApiKey) tools.push(AGENT_TOOLS_SEARCH[0]); // web_search
  if (exaApiKey) tools.push(AGENT_TOOLS_SEARCH[1]);                 // deep_search

  const useModel = requestedModel;
  if (useOpenRouter) {
    const pricingMap = await getOpenRouterPricingMap(openrouterApiKey);
    const supportedParameters = pricingMap[useModel]?.supportedParameters || [];
    if (!supportedParameters.includes('tools')) {
      port.postMessage({
        type: 'agent_notice',
        text: `目前模型不支援 tool use，已改用一般對話回覆。可切換支援 tools 的 OpenRouter 模型或 MiniMax。`,
        level: 'warning'
      });
      return streamMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, port, sessionId, contextCharBudget);
    }
  }

  const agentKey = useOpenRouter ? openrouterApiKey : apiKey;
  const agentUrl = useOpenRouter ? OPENROUTER_API_URL : MINIMAX_API_URL;
  const agentExtraHeaders = useOpenRouter
    ? { 'HTTP-Referer': 'chrome-extension://open-chat-hub', 'X-Title': 'Open Chat Hub' }
    : {};

  const globalPrompt = storedGlobal?.trim() || '';
  const chatDefaultPrompt = defaultPrompts?.chat?.trim() || '';
  let modePrompt = '';
  if (chatDefaultPrompt && systemPrompt) modePrompt = `${chatDefaultPrompt}\n\n${systemPrompt}`;
  else if (chatDefaultPrompt) modePrompt = chatDefaultPrompt;
  else if (systemPrompt) modePrompt = systemPrompt;

  // 注入當前日期，確保搜尋優先抓近期資料
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const dateContext = `當前日期：${dateStr}。搜尋資訊時，除非使用者明確指定時間範圍，否則一律以接近當前日期的資訊為準。回答中引用網路搜尋結果時，來源必須以 Markdown 超連結格式標注，例如：[標題](https://example.com)，不可只寫來源名稱而不附 URL。`;

  const finalSystemPrompt = [dateContext, memoryContext, globalPrompt, modePrompt].filter(Boolean).join('\n\n');
  const effectiveContextChars = normalizeContextCharBudget(contextCharBudget);
  const fixedChars = (finalSystemPrompt?.length || 0) + message.length;
  const historyBudget = Math.max(0, effectiveContextChars - fixedChars);
  const { history: compressedHistory, summary } = await compressHistoryIfNeeded(sessionId, history || [], agentKey, useModel, historyBudget);
  if (summary) port.postMessage({ type: 'compressed' });

  const effectiveSystemPrompt = summary
    ? `${finalSystemPrompt ? finalSystemPrompt + '\n\n' : ''}[對話前段摘要]\n${summary}`
    : finalSystemPrompt;

  const messages = buildMessages(message, compressedHistory, translateConfig, effectiveSystemPrompt, globalPrompt, effectiveContextChars);

  let toolsExecuted = false;
  const toolObservations = [];
  const maxIter = normalizeAgentIterations(maxAgentIterations);

  function getMessageText(msg) {
    if (Array.isArray(msg?.content)) {
      return msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    }
    return typeof msg?.content === 'string' ? msg.content : '';
  }

  function cleanAgentReply(content) {
    return String(content || '')
      .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<result>[\s\S]*?<\/result>/gi, '')
      .trim();
  }

  async function requestFinalSynthesis(reason = '') {
    const finalMessages = [
      ...messages,
      {
        role: 'user',
        content: `請根據以上對話與工具搜尋結果，直接用繁體中文回答使用者原始問題。不要再呼叫工具，不要輸出空內容。${reason ? `\n\n補充：${reason}` : ''}`
      }
    ];
    const resp = await fetchWithTimeout(agentUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${agentKey}`, 'Content-Type': 'application/json', ...agentExtraHeaders },
      body: JSON.stringify({ model: useModel, messages: finalMessages })
    }, AGENT_SYNTHESIS_TIMEOUT_MS);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(extractApiErrorMessage(err, resp.status));
    }
    const data = await resp.json();
    if (useOpenRouter && data.usage) {
      recordOpenRouterUsage({ modelId: useModel, usage: data.usage, apiKey: openrouterApiKey, sessionId, source: 'agent_synthesis' })
        .catch(err => console.warn('[Usage] 紀錄失敗:', err?.message || err));
    }
    const reply = cleanAgentReply(getMessageText(data.choices?.[0]?.message));
    if (!reply) throw new Error('模型完成工具搜尋後未返回文字內容，請稍後重試或切換模型。');
    return reply;
  }

  function buildFinalFallbackPrompt(reason = '', errorMessage = '') {
    const toolContext = truncateAgentText(toolObservations.join('\n\n---\n\n'), AGENT_FINAL_CONTEXT_LIMIT);
    return `以下是 Agent 已經取得的工具結果。請不要再呼叫工具，直接根據這些資料用繁體中文回答使用者原始問題。

使用者原始問題：
${message || '未提供'}

工具結果：
${toolContext || '沒有可用工具結果'}

${reason ? `補充狀態：${reason}\n` : ''}${errorMessage ? `前一次整理失敗原因：${errorMessage}\n` : ''}
請輸出完整、條理清楚的最終回答。`;
  }

  function buildContinuationPrompt(reason = '') {
    const toolContext = truncateAgentText(toolObservations.join('\n\n---\n\n'), AGENT_FINAL_CONTEXT_LIMIT);
    if (!toolContext) return null;
    return `請繼續上一段 Agent 任務，針對尚未查清楚的部分做後續搜尋與整理。

原始問題：
${message || '未提供'}

上一段停止原因：
${reason || '已達本段工具迭代上限'}

上一段已取得的工具結果摘要：
${toolContext}

續跑要求：
- 不要重複搜尋已經明確回答的問題。
- 先判斷還缺哪些關鍵資訊，再進行有針對性的搜尋。
- 搜尋完成後，輸出一份可直接執行的繁體中文完整答案。
- 若仍有不確定事項，請明確標示需要使用者確認的部分。`;
  }

  function buildContinuationPayload(reason = '') {
    const prompt = buildContinuationPrompt(reason);
    return prompt ? { prompt, label: '繼續深入搜尋' } : null;
  }

  async function streamFinalFallback(reason = '', errorMessage = '') {
    port.postMessage({
      type: 'agent_notice',
      text: `最終整理逾時，已改用已取得的工具結果直接整理回覆。${errorMessage ? `原因：${errorMessage}` : ''}`,
      level: 'warning'
    });
    await streamMiniMaxChat(
      buildFinalFallbackPrompt(reason, errorMessage),
      [],
      null,
      model,
      systemPrompt,
      memoryContext,
      port,
      sessionId,
      contextCharBudget
    );
  }

  for (let iter = 0; iter < maxIter; iter++) {
    port.postMessage({ type: 'agent_thinking', iter: iter + 1, maxIter });
    let resp;
    try {
      resp = await fetchWithTimeout(agentUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${agentKey}`, 'Content-Type': 'application/json', ...agentExtraHeaders },
        body: JSON.stringify({ model: useModel, messages, tools })
      });
    } catch (err) {
      port.postMessage({
        type: 'agent_notice',
        text: `Agent 分析請求失敗：${err.message} 已改用一般串流回覆。`,
        level: 'warning'
      });
      return streamMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, port, sessionId, contextCharBudget);
    }

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const rawMsg = extractApiErrorMessage(err, resp.status);
      if (rawMsg.toLowerCase().includes('context window')) throw new Error('對話內容過長，請點擊「+」開啟新對話');
      throw new Error(rawMsg);
    }

    const data = await resp.json();
    if (useOpenRouter && data.usage) {
      recordOpenRouterUsage({ modelId: useModel, usage: data.usage, apiKey: openrouterApiKey, sessionId, source: toolsExecuted ? 'agent_final' : 'agent' })
        .catch(err => console.warn('[Usage] 紀錄失敗:', err?.message || err));
    }
    const msg = data.choices?.[0]?.message;

    // 取得 content 字串（支援 array 或 string 格式）
    const contentStr = getMessageText(msg);

    // 優先檢查 OpenAI format tool_calls，再 fallback 到 XML format
    const openAIToolCalls = msg?.tool_calls?.length > 0 ? msg.tool_calls : null;
    const xmlToolCalls = openAIToolCalls ? null : parseXmlToolCalls(contentStr);
    const hasToolCalls = !!(openAIToolCalls || xmlToolCalls);

    if (hasToolCalls) {
      toolsExecuted = true;

      if (openAIToolCalls) {
        // OpenAI format：直接 append 原始 message
        messages.push(msg);
        for (const tc of openAIToolCalls) {
          const name = tc.function?.name || tc.name || '';
          let args = {};
          try { args = JSON.parse(tc.function?.arguments || tc.arguments || '{}'); } catch {}
          port.postMessage({ type: 'tool_start', tool: name, query: toolDisplayQuery(name, args) });
          let result;
          try { result = await handleToolCall(name, args, sessionId); } catch (e) { result = { error: e.message }; }
          if (result.error) {
            port.postMessage({
              type: 'agent_notice',
              text: `${name} 執行失敗：${result.error}。系統會把錯誤交給模型，嘗試用既有上下文回覆。`,
              level: 'warning'
            });
          }
          port.postMessage({ type: 'tool_done', tool: name, count: result.results?.length ?? null, error: result.error || null });
          const compactResult = compactToolResultForAgent(result);
          toolObservations.push(formatXmlToolResultForAgent(name, args, compactResult));
          messages.push({ role: 'tool', tool_call_id: tc.id || '', content: JSON.stringify(compactResult) });
        }
      } else {
        // XML format：清除 XML block 後 append assistant message，結果以 user 訊息注入
        const cleanContent = contentStr
          .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .trim();
        if (cleanContent) messages.push({ role: 'assistant', content: cleanContent });

        const resultParts = [];
        for (const tc of xmlToolCalls) {
          port.postMessage({ type: 'tool_start', tool: tc.name, query: toolDisplayQuery(tc.name, tc.args) });
          let result;
          try { result = await handleToolCall(tc.name, tc.args, sessionId); } catch (e) { result = { error: e.message }; }
          if (result.error) {
            port.postMessage({
              type: 'agent_notice',
              text: `${tc.name} 執行失敗：${result.error}。系統會把錯誤交給模型，嘗試用既有上下文回覆。`,
              level: 'warning'
            });
          }
          port.postMessage({ type: 'tool_done', tool: tc.name, count: result.results?.length ?? null, error: result.error || null });
          const formattedResult = formatXmlToolResultForAgent(tc.name, tc.args, result);
          resultParts.push(formattedResult);
          toolObservations.push(formattedResult);
        }
        messages.push({ role: 'user', content: resultParts.join('\n\n---\n\n') });
      }
      continue;
    }

    // 無 tool_calls：這是最終回答
    if (!toolsExecuted) {
      const directReply = cleanAgentReply(contentStr);
      if (directReply) {
        port.postMessage({
          type: 'agent_notice',
          text: 'AI 判斷這次不需要使用搜尋工具，已直接回覆。',
          level: 'info'
        });
        port.postMessage({ type: 'done', reply: directReply });
        return;
      }
      port.postMessage({
        type: 'agent_notice',
        text: 'AI 未呼叫工具且未產生有效內容，已改用一般串流回覆。',
        level: 'warning'
      });
      return streamMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, port, sessionId, contextCharBudget);
    }

    // 工具執行完畢後的最終回答：清除 XML/think 後直接送出
    let finalReply = cleanAgentReply(contentStr);
    if (!finalReply) {
      port.postMessage({
        type: 'agent_notice',
        text: '工具執行後模型未產生最終回答，正在改用補救整理流程。',
        level: 'warning'
      });
      try {
        finalReply = await requestFinalSynthesis('上一輪模型未產生 final answer。');
      } catch (err) {
        await streamFinalFallback('上一輪模型未產生 final answer。', err.message);
        return;
      }
    }
    port.postMessage({ type: 'done', reply: finalReply });
    return;
  }

  if (toolsExecuted) {
    const limitReason = `已達工具迭代上限 ${maxIter} 輪。`;
    port.postMessage({
      type: 'agent_notice',
      text: `工具呼叫已達 ${maxIter} 輪上限，正在根據目前結果穩定整理回覆。若需要更完整搜尋，可將 Agent 深度切換為深入或研究後重試。`,
      level: 'warning'
    });
    let finalReply;
    try {
      finalReply = await requestFinalSynthesis(`${limitReason}請根據現有資料產生完整回答，並明確指出仍可能需要使用者確認或後續查證的部分。`);
    } catch (err) {
      await streamFinalFallback(limitReason, err.message);
      return;
    }
    port.postMessage({ type: 'done', reply: finalReply, continuation: buildContinuationPayload(limitReason) });
    return;
  }
}

// 處理聊天訊息
async function handleChatMessage({ message, history, images, image, mode, translateConfig, model, systemPrompt, memoryContext, sessionId }) {
  // 支援新格式 images（陣列）與舊格式 image（單張）
  const fileList = images && images.length > 0
    ? images
    : (image ? [{ dataUrl: image, mode: mode || 'upload', fileType: 'image' }] : null);

  if (!fileList || fileList.length === 0) {
    return handleMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, sessionId);
  }

  // 分離文字檔與視覺檔（圖片 / PDF）
  const textFiles = fileList.filter(f => f.fileType === 'text');
  const visualFiles = fileList.filter(f => !f.fileType || f.fileType === 'image' || f.fileType === 'pdf');

  if (visualFiles.length > 0) {
    // 有圖片或 PDF → Gemini pipeline
    // 文字檔若存在，內容截至 6000 字附加進 message（Gemini prompt 不做分批）
    let textAppend = '';
    if (textFiles.length > 0) {
      const parts = textFiles.map(f => {
        const base64 = f.dataUrl.split(',')[1];
        let text = atob(base64);
        const name = f.fileName || '檔案';
        if (text.length > 6000) text = text.slice(0, 6000) + '\n...[已截斷]';
        return `=== ${name} ===\n${text}`;
      });
      textAppend = '\n\n[附加文字檔案內容]\n' + parts.join('\n\n');
    }
    const combinedMessage = `${message || ''}${textAppend}`.trim();
    return handleImagePipeline(combinedMessage, history, visualFiles, model, memoryContext);
  } else {
    // 純文字檔 → 分批送 MiniMax，最後合併
    return handleTextFilesPipeline(textFiles, message, history, translateConfig, model, systemPrompt, memoryContext);
  }
}

// 圖片處理管線：Gemini 分析 → MiniMax 整理（支援多張圖）
async function handleImagePipeline(message, history, images, model, memoryContext) {
  const { geminiApiKey, defaultPrompts } = await chrome.storage.sync.get(['geminiApiKey', 'defaultPrompts']);
  if (!geminiApiKey) {
    throw new Error('請先在設定頁面輸入 Gemini API Key');
  }

  const prompts = { ...DEFAULT_PROMPTS, ...(defaultPrompts || {}) };

  // 判斷模式：全部 ocr → ocr；其餘 → image
  const isOcr = images.every(img => (img.mode || img) === 'ocr' || img.mode === 'ocr');

  // Step 1: Gemini 分析（一次送出所有圖片）
  let geminiPrompt;
  if (isOcr) {
    geminiPrompt = prompts.ocr || DEFAULT_PROMPTS.ocr;
    if (images.length > 1) geminiPrompt = `以下有 ${images.length} 張圖片，請逐一辨識每張圖片中的文字：\n\n` + geminiPrompt;
  } else {
    const basePrompt = prompts.imageAnalysis || DEFAULT_PROMPTS.imageAnalysis;
    const multiHint = images.length > 1 ? `以下有 ${images.length} 張圖片，請逐一分析：\n\n` : '';
    geminiPrompt = multiHint + (message ? `${basePrompt}\n\n使用者問題：${message}` : basePrompt);
  }

  const geminiResult = await callGemini(geminiApiKey, images, geminiPrompt);

  // Step 2: MiniMax 整理輸出
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  if (!apiKey) {
    throw new Error('請先在設定頁面輸入 MiniMax API Key');
  }

  let minimaxPrompt;
  if (isOcr) {
    minimaxPrompt = `以下是從圖片中辨識出的文字內容：\n\n${geminiResult}\n\n請整理並格式化這些文字，修正明顯的OCR錯誤，保持原始語意。`;
  } else {
    const userQuestion = message ? `\n\n使用者的問題：${message}` : '';
    minimaxPrompt = `以下是圖片分析結果：\n\n${geminiResult}${userQuestion}\n\n請根據以上分析，提供清晰、有條理的回應。`;
  }

  return handleMiniMaxChat(minimaxPrompt, history, null, model, null, memoryContext);
}

// 呼叫 Gemini API（支援多張圖片）
async function callGemini(geminiApiKey, images, prompt) {
  // images = [{ dataUrl, mode }] 或 [dataUrlString]
  const imageParts = images.map(img => {
    const dataUrl = typeof img === 'string' ? img : img.dataUrl;
    const base64Data = dataUrl.split(',')[1];
    const mimeMatch = dataUrl.match(/data:([^;]+);base64/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    return { inline_data: { mime_type: mimeType, data: base64Data } };
  });

  console.log(`發送請求到 Gemini API（${images.length} 張圖片）`);

  const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [...imageParts, { text: prompt }]
      }]
    })
  });

  console.log('Gemini 回應狀態:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Gemini 錯誤回應:', errorData);
    if (errorData.error?.message) {
      throw new Error(errorData.error.message);
    }
    throw new Error(`Gemini API 錯誤: ${response.status}`);
  }

  const data = await response.json();
  console.log('Gemini 回應資料:', JSON.stringify(data, null, 2));

  let result = '';
  if (data.candidates?.[0]?.content?.parts) {
    const textParts = data.candidates[0].content.parts.filter(p => p.text);
    result = textParts.map(p => p.text).join('\n\n');
  }

  if (!result || result.trim() === '') {
    throw new Error('Gemini 回應格式異常');
  }

  return result.trim();
}

// 文字檔分批處理：每段 6000 字 → 逐段分析 → 合併結果
async function handleTextFilesPipeline(textFiles, userMessage, history, translateConfig, model, systemPrompt, memoryContext) {
  const CHUNK_SIZE = 6000;
  const MAX_TOTAL_CHARS = 60000; // 最多 10 段，支援長頁面/代碼分析

  // 讀取並裁切所有文字檔，總量限制 MAX_TOTAL_CHARS
  const fileParts = [];
  let totalChars = 0;
  let truncated = false;

  for (const f of textFiles) {
    if (totalChars >= MAX_TOTAL_CHARS) { truncated = true; break; }
    const base64 = f.dataUrl.split(',')[1];
    let text = atob(base64);
    const name = f.fileName || '檔案';
    const remaining = MAX_TOTAL_CHARS - totalChars;
    if (text.length > remaining) {
      text = text.slice(0, remaining);
      truncated = true;
    }
    fileParts.push({ name, text });
    totalChars += text.length;
  }

  const truncateNotice = truncated ? `\n\n⚠️ 檔案過大，本次僅分析前 ${MAX_TOTAL_CHARS.toLocaleString()} 字元。` : '';

  // 建立分段
  const chunks = [];
  for (const { name, text } of fileParts) {
    if (text.length <= CHUNK_SIZE) {
      chunks.push({ label: name, content: text });
    } else {
      const total = Math.ceil(text.length / CHUNK_SIZE);
      for (let i = 0, idx = 1; i < text.length; i += CHUNK_SIZE, idx++) {
        chunks.push({ label: `${name}（第 ${idx}/${total} 段）`, content: text.slice(i, i + CHUNK_SIZE) });
      }
    }
  }

  // 只有一段 → 直接送出
  if (chunks.length === 1) {
    const prompt = `以下是附加的檔案內容：\n\n=== ${chunks[0].label} ===\n${chunks[0].content}${userMessage ? `\n\n使用者問題：${userMessage}` : '\n\n請分析並整理以上內容。'}${truncateNotice}`;
    return handleMiniMaxChat(prompt, history, translateConfig, model, systemPrompt, memoryContext);
  }

  // 多段 → 逐段分析（空 history，避免累積過長）
  const segmentResults = [];
  for (const chunk of chunks) {
    const segPrompt = `以下是「${chunk.label}」的內容，請閱讀並摘要這段的重點：\n\n${chunk.content}`;
    const res = await handleMiniMaxChat(segPrompt, [], null, model, null, memoryContext);
    segmentResults.push(`【${chunk.label}】\n${res.reply}`);
  }

  // 合併所有段落分析
  const mergePrompt = `以下是對同一份（或多份）文件各段落的分析摘要，請整合成一份完整、有條理的分析報告：\n\n${segmentResults.join('\n\n')}${userMessage ? `\n\n使用者問題：${userMessage}` : ''}${truncateNotice}`;
  return handleMiniMaxChat(mergePrompt, history, translateConfig, model, systemPrompt, memoryContext);
}

// MiniMax 文字對話
async function handleMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, sessionId) {
  const { apiKey, defaultPrompts, globalPrompt: storedGlobal } = await chrome.storage.sync.get(['apiKey', 'defaultPrompts', 'globalPrompt']);

  if (!apiKey) {
    throw new Error('請先在設定頁面輸入 API Key');
  }

  const useModel = model || MODEL_NAME;
  const globalPrompt = storedGlobal?.trim() || '';

  // 組合 systemPrompt：一般問答提示詞 + 回覆模式提示詞
  const chatDefaultPrompt = defaultPrompts?.chat?.trim() || '';
  let modePrompt = '';
  if (chatDefaultPrompt && systemPrompt) {
    modePrompt = `${chatDefaultPrompt}\n\n${systemPrompt}`;
  } else if (chatDefaultPrompt) {
    modePrompt = chatDefaultPrompt;
  } else if (systemPrompt) {
    modePrompt = systemPrompt;
  }

  // 優先序：memory > globalPrompt > modePrompt
  const finalSystemPrompt = [memoryContext, globalPrompt, modePrompt].filter(Boolean).join('\n\n');

  const fixedChars = (finalSystemPrompt?.length || 0) + message.length;
  const historyBudget = Math.max(0, MAX_CONTEXT_CHARS - fixedChars);
  const { history: compressedHistory, summary } = await compressHistoryIfNeeded(sessionId, history || [], apiKey, useModel, historyBudget);

  const effectiveSystemPrompt = summary
    ? `${finalSystemPrompt ? finalSystemPrompt + '\n\n' : ''}[對話前段摘要]\n${summary}`
    : finalSystemPrompt;

  const messages = buildMessages(message, compressedHistory, translateConfig, effectiveSystemPrompt, globalPrompt);

  console.log('發送請求到 MiniMax API:', { model: useModel, messages });

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: useModel,
      messages
    })
  });

  console.log('API 回應狀態:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('API 錯誤回應:', errorData);
    const rawMsg = errorData.error?.message || '';
    if (rawMsg.toLowerCase().includes('context window')) {
      throw new Error('對話內容或歷史過長，已超出模型限制。請試著縮短輸入，或點擊「+」開啟新對話。');
    }
    if (rawMsg) throw new Error(rawMsg);
    if (errorData.error) throw new Error(JSON.stringify(errorData.error));
    throw new Error(`API 錯誤: ${response.status}`);
  }

  const data = await response.json();
  console.log('API 回應資料:', JSON.stringify(data, null, 2));

  let assistantMessage = '';
  const content = data.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    assistantMessage = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');
  } else if (typeof content === 'string') {
    assistantMessage = content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<result>[\s\S]*?<\/result>/gi, '')
      .trim();
  }

  if (!assistantMessage) {
    assistantMessage = typeof content === 'string' ? content.trim() : '';
  }

  if (!assistantMessage || assistantMessage.trim() === '') {
    console.error('無法解析 API 回應格式:', data);
    const finishReason = data.choices?.[0]?.finish_reason;
    if (finishReason === 'length') throw new Error('輸入或輸出超過模型 context window 限制，請縮短內容後重試');
    const errCode = data.error?.code || data.base_resp?.status_code;
    const errMsg = data.error?.message || data.base_resp?.status_msg;
    if (errMsg) throw new Error(`API 錯誤 (${errCode || '?'}): ${errMsg}`);
    throw new Error('API 回應為空，可能是 API Key 無效或模型暫時不可用');
  }

  return { reply: assistantMessage.trim() };
}

// 自動壓縮歷史：超出 budget 時呼叫 MiniMax 生成摘要，複用 sessionSummaries
const COMPRESS_CHUNK_CHARS = 8000;  // 每段壓縮上限（留足空間給 prompt overhead）

// 單次摘要 API call（內部工具，不 stream）
async function callCompressApi(apiKey, model, text) {
  const res = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: `請將以下對話摘要成繁體中文（300字以內），保留重要資訊與結論：\n\n${text}` }]
    })
  });
  if (!res.ok) throw new Error('compress_api_failed');
  const data = await res.json();
  const result = (data.choices?.[0]?.message?.content || '').trim();
  if (!result) throw new Error('compress_empty');
  return result;
}

// 合併多段摘要為最終摘要
async function callMergeCompressApi(apiKey, model, summaries) {
  const merged = summaries.join('\n\n---\n\n');
  const res = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: `以下是對話各段的摘要，請整合成一份繁體中文總摘要（200字以內），保留重要資訊、決定與結論：\n\n${merged}` }]
    })
  });
  if (!res.ok) throw new Error('merge_api_failed');
  const data = await res.json();
  const result = (data.choices?.[0]?.message?.content || '').trim();
  if (!result) throw new Error('merge_empty');
  return result;
}

async function compressHistoryIfNeeded(sessionId, history, apiKey, model, budgetChars) {
  if (!history || history.length === 0) return { history, summary: '' };

  const totalChars = history.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
  if (totalChars <= budgetChars) return { history, summary: '' };

  const KEEP_RECENT = 10;

  // 讀取已有的自動摘要（避免重複壓縮相同段落）
  let existingSummary = '';
  let coveredUpTo = 0;
  if (sessionId) {
    const { sessionSummaries = {} } = await chrome.storage.local.get(['sessionSummaries']);
    const autoList = (sessionSummaries[sessionId] || []).filter(s => s.auto);
    if (autoList.length > 0) {
      const latest = autoList.sort((a, b) => b.createdAt - a.createdAt)[0];
      existingSummary = latest.text;
      coveredUpTo = latest.coveredUpTo || 0;
    }
  }

  const unsummarizedEnd = Math.max(0, history.length - KEEP_RECENT);
  const newToSummarize = history.slice(coveredUpTo, unsummarizedEnd);
  const toKeep = history.slice(-KEEP_RECENT);

  // 已全數壓縮過，直接複用
  if (newToSummarize.length === 0 && existingSummary) {
    return { history: toKeep, summary: existingSummary };
  }

  // 組合新增對話的純文字
  const newConvText = newToSummarize
    .filter(m => typeof m.content === 'string')
    .map(m => `${m.role === 'user' ? '使用者' : 'AI'}: ${m.content}`)
    .join('\n');

  if (!newConvText.trim() && !existingSummary) {
    return { history: trimHistoryForContext(history, budgetChars), summary: '' };
  }
  if (!newConvText.trim()) {
    return { history: toKeep, summary: existingSummary };
  }

  try {
    let finalSummary;

    if (newConvText.length <= COMPRESS_CHUNK_CHARS) {
      // 短：單次摘要
      const newSummary = await callCompressApi(apiKey, model, newConvText);
      finalSummary = existingSummary
        ? await callMergeCompressApi(apiKey, model, [existingSummary, newSummary])
        : newSummary;
    } else {
      // 長：分段摘要 → 合併
      const chunks = [];
      for (let i = 0; i < newConvText.length; i += COMPRESS_CHUNK_CHARS) {
        chunks.push(newConvText.slice(i, i + COMPRESS_CHUNK_CHARS));
      }
      const chunkSummaries = [];
      if (existingSummary) chunkSummaries.push(`[前段摘要]\n${existingSummary}`);
      for (const chunk of chunks) {
        chunkSummaries.push(await callCompressApi(apiKey, model, chunk));
      }
      finalSummary = chunkSummaries.length === 1
        ? chunkSummaries[0]
        : await callMergeCompressApi(apiKey, model, chunkSummaries);
    }

    // 存入 sessionSummaries（取代舊的自動摘要）
    if (sessionId) {
      const { sessionSummaries: stored = {} } = await chrome.storage.local.get(['sessionSummaries']);
      if (!stored[sessionId]) stored[sessionId] = [];
      stored[sessionId] = stored[sessionId].filter(s => !s.auto);
      stored[sessionId].push({
        id: `sum_auto_${Date.now()}`,
        text: finalSummary,
        createdAt: Date.now(),
        addedToMemory: false,
        auto: true,
        coveredUpTo: unsummarizedEnd
      });
      await chrome.storage.local.set({ sessionSummaries: stored });
    }

    return { history: toKeep, summary: finalSummary };
  } catch {
    return { history: trimHistoryForContext(history, budgetChars), summary: '' };
  }
}

// 從最舊端裁切歷史，確保不超出 token budget
function trimHistoryForContext(history, budgetChars) {
  if (!history || history.length === 0) return [];
  const trimmed = [...history];
  let total = trimmed.reduce((sum, item) => sum + (typeof item.content === 'string' ? item.content.length : 0), 0);
  while (total > budgetChars && trimmed.length > 2) {
    const removed = trimmed.shift();
    total -= typeof removed.content === 'string' ? removed.content.length : 0;
  }
  return trimmed;
}

// 建立訊息陣列（支援翻譯模式、預設提示詞、回覆模式）
function buildMessages(newMessage, history, translateConfig, systemPrompt, globalPrompt = '', contextCharBudget = MAX_CONTEXT_CHARS) {
  const messages = [];

  // 翻譯模式：翻譯指令 + 全局提示詞
  if (translateConfig && translateConfig.enabled) {
    const { sourceLang, targetLang } = translateConfig;
    const srcName = LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = LANG_NAMES[targetLang] || targetLang;
    const translatePrompt = `你是一位專業翻譯員。使用者會輸入${srcName}或${tgtName}的文字。
- 如果輸入是${srcName}，請翻譯成${tgtName}
- 如果輸入是${tgtName}，請翻譯成${srcName}
只輸出翻譯結果，不需要解釋或額外說明。`;
    const finalTranslatePrompt = globalPrompt ? `${globalPrompt}\n\n${translatePrompt}` : translatePrompt;
    messages.push({ role: 'system', content: finalTranslatePrompt });
  } else if (systemPrompt) {
    // 全局提示詞已在呼叫前合入 systemPrompt
    messages.push({ role: 'system', content: systemPrompt });
  }

  // 歷史訊息（自動裁切避免超出 context window）
  const fixedChars = (systemPrompt?.length || 0) + newMessage.length;
  const historyBudget = Math.max(0, normalizeContextCharBudget(contextCharBudget) - fixedChars);
  const trimmedHistory = trimHistoryForContext(history, historyBudget);

  if (trimmedHistory.length > 0) {
    trimmedHistory.forEach(item => {
      const histImgs = item.images || (item.image ? [item.image] : null);
      const imageOnlyUrls = histImgs ? histImgs.filter(url =>
        typeof url === 'string' && (url.startsWith('data:image/') || /^https?:\/\//.test(url))
      ) : null;
      if (imageOnlyUrls && imageOnlyUrls.length > 0) {
        messages.push({
          role: 'user',
          content: [
            ...imageOnlyUrls.map(url => ({ type: 'image_url', image_url: { url } })),
            { type: 'text', text: item.content || '請描述這張圖片' }
          ]
        });
      } else {
        messages.push({ role: item.role, content: item.content });
      }
    });
  }

  // 當前訊息
  messages.push({ role: 'user', content: newMessage });

  return messages;
}

const LANG_NAMES = {
  'zh-TW': '繁體中文',
  'zh-CN': '簡體中文',
  'en': '英文',
  'ja': '日文',
  'ko': '韓文',
  'fr': '法文',
  'de': '德文',
  'es': '西班牙文',
  'th': '泰文',
  'vi': '越南文'
};

// 保存 session 到歷史記錄
async function saveSession(session) {
  const [{ chatSessions = [] }, { settings = {} }] = await Promise.all([
    chrome.storage.local.get(['chatSessions']),
    chrome.storage.sync.get(['settings'])
  ]);
  const configuredMaxHistory = Number(settings?.maxHistory);
  const maxHistory = [20, 50, 100].includes(configuredMaxHistory) ? configuredMaxHistory : MAX_HISTORY;

  const existingIndex = chatSessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    chatSessions[existingIndex] = session;
  } else {
    chatSessions.push(session);
  }

  while (chatSessions.length > maxHistory) {
    chatSessions.shift();
  }

  await new Promise((resolve, reject) => {
    chrome.storage.local.set({ chatSessions }, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

// 刪除單一 session
async function deleteSession(sessionId) {
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  const updated = chatSessions.filter(s => s.id !== sessionId);
  await chrome.storage.local.set({ chatSessions: updated });
}

// 重新命名 session
async function renameSession(sessionId, name) {
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  const index = chatSessions.findIndex(s => s.id === sessionId);
  if (index >= 0) {
    chatSessions[index].name = name;
    await chrome.storage.local.set({ chatSessions });
  }
}

// 釘選/取消釘選 session
async function pinSession(sessionId, pinned) {
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  const index = chatSessions.findIndex(s => s.id === sessionId);
  if (index >= 0) {
    chatSessions[index].pinned = pinned;
    await chrome.storage.local.set({ chatSessions });
  }
}

// ── Google TTS ──────────────────────────────────────────────
// 使用 Google Translate TTS endpoint，音質與網頁版一致
async function fetchGoogleTTS(text, lang) {
  const chunks = splitTextChunks(text.trim(), 180);
  const buffers = [];

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(lang)}&client=gtx&ttsspeed=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/'
      }
    });
    if (!response.ok) throw new Error(`Google TTS 請求失敗: ${response.status}`);
    buffers.push(await response.arrayBuffer());
  }

  // 合併所有 chunk 的 MP3 資料
  const total = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    merged.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  // 轉 base64（分批處理避免 call stack 溢出）
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < merged.length; i += chunkSize) {
    binary += String.fromCharCode(...merged.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// AI 自動萃取記憶（獨立呼叫，不帶歷史節省 token）
// 回傳結構化物件陣列：{ title, summary, tags }
async function extractMemories(userMessage, aiReply) {
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  if (!apiKey) return [];

  const prompt = `以下是一段對話：

使用者：${userMessage}

AI：${aiReply}

請判斷這段對話是否包含值得長期記憶的使用者偏好、身份、重要事實或事件。
若有，以 JSON 陣列回傳，每項格式如下：
{ "title": "簡短標題（10字內）", "summary": "完整事件摘要（50字內，保留關鍵細節）", "tags": ["標籤1", "標籤2"] }
若無，回傳 []。只回傳 JSON，不要其他說明。`;

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) return [];

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.filter(b => b.type === 'text').map(b => b.text).join('')
    : (typeof content === 'string' ? content : '');

  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const items = JSON.parse(match[0]);
    if (!Array.isArray(items)) return [];
    // 相容舊格式（字串）與新格式（物件）
    return items
      .map(i => {
        if (typeof i === 'string' && i.trim()) {
          return { title: i.trim().slice(0, 30), summary: i.trim(), tags: [] };
        }
        if (i && typeof i === 'object' && i.title) {
          return {
            title: String(i.title || '').trim().slice(0, 30),
            summary: String(i.summary || i.title || '').trim(),
            tags: Array.isArray(i.tags) ? i.tags.map(t => String(t).trim()).filter(Boolean) : []
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// 依長度切割文字（在句末或空格處斷開）
function splitTextChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end >= text.length) { chunks.push(text.slice(start)); break; }
    // 優先從標點或空格切
    const candidates = [' ', '。', '，', '！', '？', '.', ',', '!', '?', '\n'];
    let splitAt = -1;
    for (const sep of candidates) {
      const pos = text.lastIndexOf(sep, end);
      if (pos > start) { splitAt = pos + 1; break; }
    }
    if (splitAt === -1) splitAt = end;
    chunks.push(text.slice(start, splitAt));
    start = splitAt;
  }
  return chunks;
}

// ── 關鍵字精修（修錯字 + 補全 + 最佳化）────────────────────────
async function refineQuery(rawQuery, apiKey, originalMessage = '') {
  const contextHint = originalMessage && originalMessage !== rawQuery
    ? `\n使用者原始訊息（供參考）：${originalMessage.slice(0, 200)}`
    : '';
  const refinePrompt = `你是搜尋引擎關鍵字優化助手。將以下搜尋關鍵字修正拼字錯誤（包含品牌、平台、產品名稱的錯誤拼法）、補全縮寫，並優化為適合 Google 搜尋的格式。只回覆修正後的關鍵字（20字以內，英文專有名詞與品牌名保留英文，不要任何說明或標點）。${contextHint}
原始關鍵字：${rawQuery}`;
  try {
    const res = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: 'user', content: refinePrompt }],
        max_tokens: 30
      })
    });
    if (!res.ok) return rawQuery;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const refined = (Array.isArray(content)
      ? content.filter(b => b.type === 'text').map(b => b.text).join('')
      : (typeof content === 'string' ? content : '')).trim();
    return refined || rawQuery;
  } catch {
    return rawQuery;
  }
}

// ── 自動搜尋判斷 ──────────────────────────────────────────────
async function autoSearch(userMessage) {
  const { braveApiKey, exaApiKey, apiKey, globalPrompt } = await chrome.storage.sync.get(['braveApiKey', 'exaApiKey', 'apiKey', 'globalPrompt']);
  if (!braveApiKey && !exaApiKey) return { needed: false };
  if (!apiKey) return { needed: false };

  // 明確搜尋意圖：偵測到搜尋前綴 → 修正關鍵字後搜尋
  const SEARCH_TRIGGERS = /^(搜尋|搜索|查詢|查找|幫我搜|幫我查|search|find|look up)\s*/i;
  if (SEARCH_TRIGGERS.test(userMessage.trim())) {
    const rawQuery = userMessage.trim().replace(SEARCH_TRIGGERS, '').trim() || userMessage.trim();
    const query = await refineQuery(rawQuery, apiKey, userMessage);
    const searchResult = await braveSearch(query);
    if (!searchResult.success) return { needed: false };
    return { needed: true, rawQuery, query, results: searchResult.results, provider: searchResult.provider };
  }

  // 一次 API 呼叫：判斷是否需要搜尋，若需要同時回傳搜尋關鍵字
  const classifyPrompt = `判斷以下問題是否需要即時網路搜尋才能準確回答（涉及最新事件、當前版本、即時狀態、近期發布等）。
若需要搜尋，只回覆最佳搜尋關鍵字（20字以內，不含標點）；若不需要，只回覆 NO。不要其他說明。
問題：${userMessage.slice(0, 300)}`;

  const messages = [];
  if (globalPrompt) messages.push({ role: 'system', content: globalPrompt });
  messages.push({ role: 'user', content: classifyPrompt });

  try {
    const res = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL_NAME, messages, max_tokens: 30 })
    });
    if (!res.ok) return { needed: false };
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const rawText = (Array.isArray(content)
      ? content.filter(b => b.type === 'text').map(b => b.text).join('')
      : (typeof content === 'string' ? content : '')).trim();

    // 判斷回覆是否為 NO（中英文）
    if (!rawText || /^(NO|不需要|不用|否)/i.test(rawText)) {
      return { needed: false };
    }

    // rawText 是 AI 萃取的關鍵字，再進一步精修後搜尋
    const query = await refineQuery(rawText, apiKey, userMessage);
    const searchResult = await braveSearch(query);
    if (!searchResult.success) return { needed: false };
    return { needed: true, rawQuery: rawText, query, results: searchResult.results, provider: searchResult.provider };
  } catch {
    return { needed: false };
  }
}

// ── Brave Search（一般搜尋）──────────────────────────────────
async function braveSearch(query) {
  const { braveApiKey } = await chrome.storage.sync.get(['braveApiKey']);
  if (!braveApiKey) return { success: false, error: 'NO_KEY' };

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveApiKey }
    });
    if (res.ok) {
      const data = await res.json();
      const results = (data.web?.results || []).slice(0, 5).map(r => ({
        title: r.title, url: r.url, snippet: r.description || ''
      }));
      if (results.length > 0) return { success: true, results, provider: 'Brave' };
      return { success: false, error: '搜尋無結果，請更換關鍵字' };
    }
    const status = res.status;
    if (status === 401 || status === 403) return { success: false, error: `Brave API Key 無效（HTTP ${status}）` };
    if (status === 429) return { success: false, error: 'Brave API 已達用量上限（429）' };
    return { success: false, error: `Brave 搜尋失敗（HTTP ${status}）` };
  } catch (e) {
    return { success: false, error: `Brave 搜尋例外：${e.message}` };
  }
}

// ── Exa Search（深度搜尋）────────────────────────────────────
async function exaSearch(query) {
  const { exaApiKey } = await chrome.storage.sync.get(['exaApiKey']);
  if (!exaApiKey) return { success: false, error: 'NO_KEY' };

  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': exaApiKey },
      body: JSON.stringify({
        query, numResults: 5, useAutoprompt: true,
        contents: { text: { maxCharacters: 300 } }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const results = (data.results || []).slice(0, 5).map(r => ({
        title: r.title || r.url, url: r.url, snippet: r.text || ''
      }));
      if (results.length > 0) return { success: true, results, provider: 'Exa' };
      return { success: false, error: '搜尋無結果，請更換關鍵字' };
    }
    const status = res.status;
    if (status === 401 || status === 403) return { success: false, error: `Exa API Key 無效（HTTP ${status}）` };
    return { success: false, error: `Exa 搜尋失敗（HTTP ${status}）` };
  } catch (e) {
    return { success: false, error: `Exa 搜尋例外：${e.message}` };
  }
}
