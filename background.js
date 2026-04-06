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
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
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

  if (message.type === 'GET_API_KEY') {
    chrome.storage.sync.get(['apiKey'], result => {
      sendResponse({ success: true, data: result.apiKey || '' });
    });
    return true;
  }
});

// 處理聊天訊息
async function handleChatMessage({ message, history, image }) {
  // 有圖片 → 走 Gemini；無圖片 → 走 MiniMax
  if (image) {
    return handleGeminiImage(message, image);
  }
  return handleMiniMaxChat(message, history);
}

// MiniMax 文字對話
async function handleMiniMaxChat(message, history) {
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);

  if (!apiKey) {
    throw new Error('請先在設定頁面輸入 API Key');
  }

  const { anthropicMessages } = buildOpenAIMessages(message, history, null);

  console.log('發送請求到 MiniMax API:', { model: MODEL_NAME, messages: anthropicMessages });

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: anthropicMessages
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
    // MiniMax 有時回傳 [{type:"text",text:"..."}, {type:"thinking",thinking:"..."}]
    assistantMessage = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');
  } else if (typeof content === 'string') {
    // 字串可能包含<think>...</think>或<result>...<result>標籤，直接移除
    assistantMessage = content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<result>[\s\S]*?<\/result>/gi, '')
      .trim();
  }

  // 如果過濾後空白，嘗試整個 content（防禦）
  if (!assistantMessage) {
    assistantMessage = typeof content === 'string' ? content.trim() : '';
  }

  if (!assistantMessage || assistantMessage.trim() === '') {
    console.error('無法解析 API 回應格式:', data);
    throw new Error('API 回應格式異常，請檢查 API Key 和模型設定');
  }

  return { reply: assistantMessage.trim() };
}

// Gemini 圖片分析
async function handleGeminiImage(message, imageData) {
  const { geminiApiKey } = await chrome.storage.sync.get(['geminiApiKey']);

  if (!geminiApiKey) {
    throw new Error('請先在設定頁面輸入 Gemini API Key');
  }

  // 解析 base64（含前綴 data:image/...;base64,）
  const base64Data = imageData.split(',')[1];
  const mimeMatch = imageData.match(/data:(image\/\w+);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  const prompt = message || '請描述這張圖片';

  console.log('發送請求到 Gemini API（圖片分析）');

  const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

  let assistantMessage = '';
  if (data.candidates?.[0]?.content?.parts) {
    const textParts = data.candidates[0].content.parts.filter(p => p.text);
    assistantMessage = textParts.map(p => p.text).join('\n\n');
  }

  if (!assistantMessage || assistantMessage.trim() === '') {
    throw new Error('Gemini 回應格式異常');
  }

  return { reply: assistantMessage.trim() };
}

// 建立 OpenAI 格式的訊息（給 MiniMax 使用）
function buildOpenAIMessages(newMessage, history, image) {
  const messages = [];

  // history 是 currentSession.messages 的陣列
  if (history && history.length > 0) {
    history.forEach(item => {
      if (item.image) {
        // 歷史訊息含圖片
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

  // 當前訊息（含圖片）
  if (image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        { type: 'text', text: newMessage || '請描述這張圖片' }
      ]
    });
  } else {
    messages.push({ role: 'user', content: newMessage });
  }

  return { anthropicMessages: messages, systemPrompt: null };
}

// 保存 session 到歷史記錄
async function saveSession(session) {
  const { chatSessions = [] } = await chrome.storage.local.get(['chatSessions']);
  const maxHistory = MAX_HISTORY;

  // 檢查是否已存在
  const existingIndex = chatSessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    chatSessions[existingIndex] = session;
  } else {
    chatSessions.push(session);
  }

  // 保持最大歷史記錄數
  while (chatSessions.length > maxHistory) {
    chatSessions.shift();
  }

  await chrome.storage.local.set({ chatSessions });
}
