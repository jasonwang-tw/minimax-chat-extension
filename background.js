// background.js - Service Worker for MiniMax API + Gemini Vision

import { SyncService, DEFAULT_SYNC_SETTINGS } from './sync/sync-service.js';

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent';
const MODEL_NAME = 'MiniMax-M2.7';
const MAX_HISTORY = 50;

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

// 監聽插件安裝
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiKey: '',
      settings: { model: MODEL_NAME, maxHistory: MAX_HISTORY },
      defaultPrompts: DEFAULT_PROMPTS,
      replyModes: DEFAULT_REPLY_MODES,
      customCommands: [],
      autoMemoryEnabled: false,
      syncSettings: DEFAULT_SYNC_SETTINGS
    });
    chrome.storage.local.set({
      vocabulary: [],
      categories: { memory: [], knowledge: [], vocabulary: [] },
      syncAuth: {}
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

// 右鍵選單點擊處理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'add-to-memory') {
    const text = info.selectionText?.trim();
    if (!text) return;
    const { memories = [] } = await chrome.storage.sync.get(['memories']);
    if (memories.some(m => m.text === text)) return; // 防重複
    memories.push({
      id: `mem_${Date.now()}`,
      text,
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
            content: `請分析以下內容並回覆 JSON：\n\n${snippet}`
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
      kb2[idx].tags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [];
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
            const raw = document.body?.innerText || '';
            const text = raw.length > 8000 ? raw.slice(0, 8000) + '\n...（已截斷）' : raw;
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

  if (message.type === 'GET_SYNC_SETTINGS') {
    syncService.getSettings()
      .then(settings => sendResponse({ success: true, data: settings }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'SAVE_SYNC_SETTINGS') {
    syncService.saveSettings(message.data || {})
      .then(settings => sendResponse({ success: true, data: settings }))
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
});

// ── Streaming（Port 長連線）─────────────────────────────
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'chat-stream') return;
  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'STREAM_MESSAGE') return;
    try {
      await streamHandleMessage(msg.data, port);
    } catch (err) {
      try { port.postMessage({ type: 'error', message: err.message }); } catch {}
    }
  });
});

async function streamHandleMessage({ message, history, images, image, mode, translateConfig, model, systemPrompt, memoryContext }, port) {
  const fileList = images && images.length > 0
    ? images
    : (image ? [{ dataUrl: image, mode: mode || 'upload', fileType: 'image' }] : null);

  if (!fileList || fileList.length === 0) {
    await streamMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, port);
    return;
  }

  const textFiles = fileList.filter(f => f.fileType === 'text');
  const visualFiles = fileList.filter(f => !f.fileType || f.fileType === 'image' || f.fileType === 'pdf');

  if (visualFiles.length > 0) {
    port.postMessage({ type: 'status', text: visualFiles.length > 1 ? `分析 ${visualFiles.length} 個視覺檔案中...` : '分析圖片中...' });

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

    const geminiResult = await callGemini(geminiApiKey, visualFiles, geminiPrompt);
    port.postMessage({ type: 'status', text: '整理回應中...' });

    let minimaxPrompt;
    if (isOcr) {
      minimaxPrompt = `以下是從圖片中辨識出的文字：\n\n${geminiResult}\n\n請整理並格式化，修正OCR錯誤，保持原始語意。`;
    } else {
      const userQ = combinedMessage ? `\n\n使用者問題：${combinedMessage}` : '';
      minimaxPrompt = `以下是圖片分析結果：\n\n${geminiResult}${userQ}\n\n請根據以上分析，提供清晰、有條理的回應。`;
    }
    await streamMiniMaxChat(minimaxPrompt, history, null, model, null, memoryContext, port);
    return;
  }

  // 純文字檔 → 分批分析 + stream 合併
  await streamTextFilesPipeline(textFiles, message, history, translateConfig, model, systemPrompt, memoryContext, port);
}

async function streamTextFilesPipeline(textFiles, userMessage, history, translateConfig, model, systemPrompt, memoryContext, port) {
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
    await streamMiniMaxChat(prompt, history, translateConfig, model, systemPrompt, memoryContext, port);
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
  await streamMiniMaxChat(mergePrompt, history, translateConfig, model, systemPrompt, memoryContext, port);
}

async function streamMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext, port) {
  const { apiKey, defaultPrompts, globalPrompt: storedGlobal } = await chrome.storage.sync.get(['apiKey', 'defaultPrompts', 'globalPrompt']);
  if (!apiKey) throw new Error('請先在設定頁面輸入 API Key');

  const useModel = model || MODEL_NAME;
  const globalPrompt = storedGlobal?.trim() || '';
  const chatDefaultPrompt = defaultPrompts?.chat?.trim() || '';
  let modePrompt = '';
  if (chatDefaultPrompt && systemPrompt) modePrompt = `${chatDefaultPrompt}\n\n${systemPrompt}`;
  else if (chatDefaultPrompt) modePrompt = chatDefaultPrompt;
  else if (systemPrompt) modePrompt = systemPrompt;

  const finalSystemPrompt = [memoryContext, globalPrompt, modePrompt].filter(Boolean).join('\n\n');
  const messages = buildMessages(message, history, translateConfig, finalSystemPrompt, globalPrompt);

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: useModel, messages, stream: true })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.base_resp?.status_msg || `API 錯誤: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let fullContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
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
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            port.postMessage({ type: 'chunk', text: delta, full: fullContent });
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  const cleaned = fullContent
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<result>[\s\S]*?<\/result>/gi, '')
    .trim();

  port.postMessage({ type: 'done', reply: cleaned || fullContent });
}

// 處理聊天訊息
async function handleChatMessage({ message, history, images, image, mode, translateConfig, model, systemPrompt, memoryContext }) {
  // 支援新格式 images（陣列）與舊格式 image（單張）
  const fileList = images && images.length > 0
    ? images
    : (image ? [{ dataUrl: image, mode: mode || 'upload', fileType: 'image' }] : null);

  if (!fileList || fileList.length === 0) {
    return handleMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext);
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
  const MAX_TOTAL_CHARS = 30000; // 最多 5 段，避免 merge 也超出 context

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
async function handleMiniMaxChat(message, history, translateConfig, model, systemPrompt, memoryContext) {
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

  const messages = buildMessages(message, history, translateConfig, finalSystemPrompt, globalPrompt);

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
    if (errorData.error?.message) {
      throw new Error(errorData.error.message);
    } else if (errorData.error) {
      throw new Error(JSON.stringify(errorData.error));
    }
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

// 建立訊息陣列（支援翻譯模式、預設提示詞、回覆模式）
function buildMessages(newMessage, history, translateConfig, systemPrompt, globalPrompt = '') {
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

  // 歷史訊息
  if (history && history.length > 0) {
    history.forEach(item => {
      const histImgs = item.images || (item.image ? [item.image] : null);
      if (histImgs && histImgs.length > 0) {
        messages.push({
          role: 'user',
          content: [
            ...histImgs.map(url => ({ type: 'image_url', image_url: { url } })),
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
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  const maxHistory = MAX_HISTORY;

  const existingIndex = chatSessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    chatSessions[existingIndex] = session;
  } else {
    chatSessions.push(session);
  }

  while (chatSessions.length > maxHistory) {
    chatSessions.shift();
  }

  await chrome.storage.local.set({ chatSessions });
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
async function extractMemories(userMessage, aiReply) {
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  if (!apiKey) return [];

  const prompt = `以下是一段對話：\n\n使用者：${userMessage}\n\nAI：${aiReply}\n\n請判斷這段對話是否包含值得長期記憶的使用者偏好、身份、重要事實。若有，以 JSON 陣列格式回傳（每項字串最多 30 字，僅客觀事實，不含 AI 回應內容）；若無，回傳 []。只回傳 JSON，不要其他說明。`;

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
    return Array.isArray(items) ? items.filter(i => typeof i === 'string' && i.trim()) : [];
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
