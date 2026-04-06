// background.js - Service Worker for MiniMax API + Gemini Vision

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent';
const MODEL_NAME = 'MiniMax-M2.7';
const MAX_HISTORY = 50;

// 監聽插件安裝
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.sync.set({
      apiKey: '',
      settings: { model: MODEL_NAME, maxHistory: MAX_HISTORY }
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

  if (message.type === 'GET_API_KEY') {
    chrome.storage.sync.get(['apiKey'], result => {
      sendResponse({ success: true, data: result.apiKey || '' });
    });
    return true;
  }
});

// 處理聊天訊息
async function handleChatMessage({ message, history, image, mode, translateConfig }) {
  if (image) {
    // 圖片流程：Gemini 分析 → MiniMax 整理輸出
    return handleImagePipeline(message, history, image, mode);
  }
  // 一般文字對話（含翻譯模式）
  return handleMiniMaxChat(message, history, translateConfig);
}

// 圖片處理管線：Gemini 分析 → MiniMax 整理
async function handleImagePipeline(message, history, imageData, mode) {
  const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);
  if (!geminiApiKey) {
    throw new Error('請先在設定頁面輸入 Gemini API Key');
  }

  // Step 1: Gemini 分析圖片
  let geminiPrompt;
  if (mode === 'ocr') {
    geminiPrompt = '請仔細辨識並提取這張圖片中的所有文字內容，保持原始排版結構，不要遺漏任何文字。';
  } else {
    geminiPrompt = message
      ? `請詳細分析這張圖片，並針對以下問題回答：${message}`
      : '請詳細描述並分析這張圖片的所有內容。';
  }

  const geminiResult = await callGemini(geminiApiKey, imageData, geminiPrompt);

  // Step 2: MiniMax 整理輸出
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  if (!apiKey) {
    throw new Error('請先在設定頁面輸入 MiniMax API Key');
  }

  let minimaxPrompt;
  if (mode === 'ocr') {
    minimaxPrompt = `以下是從圖片中辨識出的文字內容：\n\n${geminiResult}\n\n請整理並格式化這些文字，修正明顯的OCR錯誤，保持原始語意。`;
  } else {
    const userQuestion = message ? `\n\n使用者的問題：${message}` : '';
    minimaxPrompt = `以下是圖片分析結果：\n\n${geminiResult}${userQuestion}\n\n請根據以上分析，提供清晰、有條理的回應。`;
  }

  return handleMiniMaxChat(minimaxPrompt, history, null);
}

// 呼叫 Gemini API
async function callGemini(geminiApiKey, imageData, prompt) {
  const base64Data = imageData.split(',')[1];
  const mimeMatch = imageData.match(/data:(image\/\w+);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  console.log('發送請求到 Gemini API（圖片分析）');

  const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { text: prompt }
        ]
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

// MiniMax 文字對話
async function handleMiniMaxChat(message, history, translateConfig) {
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);

  if (!apiKey) {
    throw new Error('請先在設定頁面輸入 API Key');
  }

  const messages = buildMessages(message, history, translateConfig);

  console.log('發送請求到 MiniMax API:', { model: MODEL_NAME, messages });

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_NAME,
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
    throw new Error('API 回應格式異常，請檢查 API Key 和模型設定');
  }

  return { reply: assistantMessage.trim() };
}

// 建立訊息陣列（支援翻譯模式）
function buildMessages(newMessage, history, translateConfig) {
  const messages = [];

  // 翻譯模式：加入系統提示
  if (translateConfig && translateConfig.enabled) {
    const { sourceLang, targetLang } = translateConfig;
    const srcName = LANG_NAMES[sourceLang] || sourceLang;
    const tgtName = LANG_NAMES[targetLang] || targetLang;
    const systemPrompt = `你是一位專業翻譯員。使用者會輸入${srcName}或${tgtName}的文字。
- 如果輸入是${srcName}，請翻譯成${tgtName}
- 如果輸入是${tgtName}，請翻譯成${srcName}
只輸出翻譯結果，不需要解釋或額外說明。`;
    messages.push({ role: 'system', content: systemPrompt });
  }

  // 歷史訊息
  if (history && history.length > 0) {
    history.forEach(item => {
      if (item.image) {
        messages.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: item.image } },
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
