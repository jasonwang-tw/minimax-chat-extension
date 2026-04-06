// sidepanel.js - 側邊欄邏輯

let currentImageData = null;  // 目前附加的圖片

document.addEventListener('DOMContentLoaded', async () => {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatMessages = document.getElementById('chatMessages');
  const emptyState = document.getElementById('emptyState');
  const typingIndicator = document.getElementById('typingIndicator');
  const statusText = document.getElementById('statusText');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const toggleHistoryBtn = document.getElementById('toggleHistory');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const openSettingsBtn = document.getElementById('openSettings');
  const screenshotBtn = document.getElementById('screenshotBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const imageInput = document.getElementById('imageInput');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const removeImageBtn = document.getElementById('removeImage');

  let sessions = [];
  let currentSession = null;
  let isLoading = false;

  // 檢查 API Key
  await checkApiKey();

  // 監聽 storage 變化（Gemini key 在選項頁儲存後通知側邊欄）
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiApiKey) {
      checkApiKey();
    }
  });

  // 載入歷史記錄
  await loadHistory();

  // 自動調整輸入框高度
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    updateSendButton();
  });

  // 發送訊息
  sendBtn.addEventListener('click', handleSend);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // 截圖功能
  screenshotBtn.addEventListener('click', async () => {
    try {
      statusText.textContent = '截圖中...';
      statusText.classList.remove('error');

      // 使用 null 讓 Chrome 自動選擇目前可截圖的分頁
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      currentImageData = dataUrl;
      showImagePreview(dataUrl);
      statusText.textContent = '';
    } catch (error) {
      console.error('截圖失敗:', error);
      statusText.textContent = '截圖失敗：' + error.message;
      statusText.classList.add('error');
    }
  });

  // 上傳圖片
  uploadBtn.addEventListener('click', () => {
    imageInput.click();
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        currentImageData = event.target.result;
        showImagePreview(currentImageData);
      };
      reader.readAsDataURL(file);
    }
  });

  // 移除圖片
  removeImageBtn.addEventListener('click', async () => {
    currentImageData = null;
    imagePreview.classList.add('hidden');
    imageInput.value = '';
    updateSendButton();
    await checkApiKey(); // 重新檢查按鈕狀態
  });

  // 切換歷史面板
  toggleHistoryBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('hidden');
  });

  // 清除歷史
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有歷史紀錄？')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      sessions = [];
      currentSession = null;
      renderHistory();
      chatMessages.innerHTML = '';
      emptyState.classList.remove('hidden');
    }
  });

  // 關閉歷史面板（點擊外部）
  historyPanel.addEventListener('click', (e) => {
    if (e.target === historyPanel) {
      historyPanel.classList.add('hidden');
    }
  });

  // 開啟設定頁面
  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 監聽 chatMessages 滾動
  chatMessages.addEventListener('scroll', () => {
    // 使用者可以滾動查看歷史，但新訊息時自動置底
  });

  function showImagePreview(dataUrl) {
    previewImg.src = dataUrl;
    imagePreview.classList.remove('hidden');
    updateSendButton();
  }

  function updateSendButton() {
    const hasContent = messageInput.value.trim() || currentImageData;
    sendBtn.disabled = !hasContent || isLoading;
  }

  async function checkApiKey() {
    const { apiKey, geminiApiKey } = await chrome.storage.sync.get(['apiKey', 'geminiApiKey']);

    // MiniMax key：控制文字輸入
    if (!apiKey) {
      statusText.textContent = '請先設定 MiniMax API Key';
      statusText.classList.add('error');
      messageInput.disabled = true;
      sendBtn.disabled = true;
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
    } else {
      messageInput.disabled = false;
      statusText.textContent = '';
      statusText.classList.remove('error');
      // 有 MiniMax key 才能發送，但截圖/上傳需要 Gemini key
    }

    // Gemini key：控制截圖/上傳按鈕
    if (!geminiApiKey) {
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
      // 如果有圖片但沒有 Gemini key，提示使用者
      if (currentImageData) {
        statusText.textContent = '請先設定 Gemini API Key 才能分析圖片';
        statusText.classList.add('error');
      }
    } else {
      screenshotBtn.disabled = false;
      uploadBtn.disabled = false;
    }
  }

  async function loadHistory() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
    if (response.success) {
      sessions = response.data || [];
      renderHistory();
    }
  }

  function renderHistory() {
    historyList.innerHTML = '';
    sessions.slice().reverse().forEach((session, index) => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      const preview = firstUserMsg ? firstUserMsg.content.substring(0, 50) : '新對話';
      const hasImage = session.messages.some(m => m.image);
      div.innerHTML = `
        <p class="history-preview">${escapeHtml(preview)}${firstUserMsg && firstUserMsg.content.length > 50 ? '...' : ''}${hasImage ? ' [圖片]' : ''}</p>
        <span class="history-time">${formatTime(session.timestamp)}</span>
      `;
      div.addEventListener('click', () => loadSession(index));
      historyList.appendChild(div);
    });

    if (sessions.length === 0) {
      historyList.innerHTML = '<p class="history-empty">尚無歷史紀錄</p>';
    }
  }

  function loadSession(index) {
    const reversedIndex = sessions.length - 1 - index;
    currentSession = sessions[reversedIndex];
    chatMessages.innerHTML = '';

    currentSession.messages.forEach(msg => {
      if (msg.image) {
        addMessageWithImage(msg.content, msg.role, msg.image);
      } else {
        addMessage(msg.content, msg.role);
      }
    });

    emptyState.classList.add('hidden');
    historyPanel.classList.add('hidden');
    scrollToBottom();
  }

  function startNewSession() {
    currentSession = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      messages: []
    };
    chatMessages.innerHTML = '';
    emptyState.classList.remove('hidden');
  }

  async function handleSend() {
    const message = messageInput.value.trim();
    if (!message && !currentImageData) return;

    if (!currentSession) {
      startNewSession();
    }

    isLoading = true;
    sendBtn.disabled = true;
    messageInput.disabled = true;
    typingIndicator.classList.remove('hidden');
    emptyState.classList.add('hidden');
    statusText.textContent = '等待回應...';
    statusText.classList.remove('error');

    // 添加 user 訊息（可能含圖片）
    const userMessage = { role: 'user', content: message };
    if (currentImageData) {
      userMessage.image = currentImageData;
    }

    currentSession.messages.push(userMessage);
    addMessageWithImage(message, 'user', currentImageData);

    const textMessage = message;
    const imageData = currentImageData;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    currentImageData = null;
    imagePreview.classList.add('hidden');
    imageInput.value = '';

    try {
      const historyForApi = currentSession.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content,
        image: m.image || null
      }));

      const response = await chrome.runtime.sendMessage({
        type: 'SEND_MESSAGE',
        data: { message: textMessage, history: historyForApi, image: imageData }
      });

      if (response.success) {
        const reply = response.data.reply;
        currentSession.messages.push({ role: 'assistant', content: reply });
        addMessage(reply, 'assistant');
        statusText.textContent = '';
        await saveCurrentSession();
        await loadHistory();
      } else {
        addMessage(`錯誤: ${response.error}`, 'error');
        statusText.textContent = response.error;
        statusText.classList.add('error');
      }
    } catch (error) {
      console.error('傳送失敗:', error);
      addMessage(`錯誤: ${error.message}`, 'error');
      statusText.textContent = error.message;
      statusText.classList.add('error');
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      messageInput.disabled = false;
      typingIndicator.classList.add('hidden');
      messageInput.focus();
      updateSendButton();
    }
  }

  async function saveCurrentSession() {
    if (!currentSession || currentSession.messages.length === 0) return;

    const existingIndex = sessions.findIndex(s => s.id === currentSession.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = currentSession;
    } else {
      sessions.push(currentSession);
    }

    await chrome.runtime.sendMessage({
      type: 'SAVE_SESSION',
      data: { session: currentSession }
    });
  }

  function addMessage(content, role) {
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
    div.innerHTML = `<div class="message-content">${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addMessageWithImage(content, role, imageData) {
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
    let html = `<div class="message-content">`;
    if (imageData) {
      html += `<img src="${imageData}" class="message-image" alt="圖片">`;
    }
    html += `${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
    div.innerHTML = html;
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    // 使用 requestAnimationFrame 確保 DOM 更新後再滾動
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
});
