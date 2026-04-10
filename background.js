// background.js - Service Worker for MiniMax API + Gemini Vision

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

// 監聽插件安裝
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiKey: '',
      settings: { model: MODEL_NAME, maxHistory: MAX_HISTORY },
      defaultPrompts: DEFAULT_PROMPTS,
      replyModes: DEFAULT_REPLY_MODES,
      customCommands: [],
      autoMemoryEnabled: false
    });
  }
});

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
});

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
