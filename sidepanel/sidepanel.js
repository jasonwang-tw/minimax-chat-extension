// sidepanel.js - 側邊欄邏輯

let currentImageData = null;  // 目前附加的圖片
let currentImageMode = null;  // 'screenshot' | 'region' | 'upload' | 'ocr'
let pendingRegionMode = null; // 區域截圖完成後要套用的 mode（null = 'region'）

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
  const batchSelectBtn = document.getElementById('batchSelectBtn');
  const batchActionBar = document.getElementById('batchActionBar');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  const batchDeleteBtn = document.getElementById('batchDeleteBtn');
  const openSettingsBtn = document.getElementById('openSettings');
  const screenshotBtn = document.getElementById('screenshotBtn');
  const regionScreenshotBtn = document.getElementById('regionScreenshotBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const ocrBtn = document.getElementById('ocrBtn');
  const ocrPicker = document.getElementById('ocrPicker');
  const translateBtn = document.getElementById('translateBtn');
  const translatePanel = document.getElementById('translatePanel');
  const sourceLangSelect = document.getElementById('sourceLang');
  const targetLangSelect = document.getElementById('targetLang');
  const imageInput = document.getElementById('imageInput');
  const imagePreview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('previewImg');
  const removeImageBtn = document.getElementById('removeImage');
  const imageModeLabel = document.getElementById('imageModeLabel');
  const regionModal = document.getElementById('regionModal');
  const regionCanvas = document.getElementById('regionCanvas');
  const cancelRegionBtn = document.getElementById('cancelRegion');
  const confirmRegionBtn = document.getElementById('confirmRegion');
  const redoRegionBtn = document.getElementById('redoRegion');
  const selectionRect = document.getElementById('selectionRect');
  const regionConfirmBar = document.getElementById('regionConfirmBar');

  let sessions = [];
  let currentSession = null;
  let isLoading = false;
  let translateEnabled = false;
  let batchSelectMode = false;
  let selectedIds = new Set();
  let currentAudio = null;    // 目前播放中的 Audio 物件
  let currentTTSBtn = null;   // 目前播放中的按鈕

  // Region screenshot state
  let regionStartX = 0, regionStartY = 0;
  let regionEndX = 0, regionEndY = 0;
  let isDragging = false;
  let fullScreenshotData = null;
  let regionConfirmed = false;

  // 檢查 API Key
  await checkApiKey();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiApiKey || changes.apiKey) {
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

  // ── 全頁截圖 ──────────────────────────────────────────
  screenshotBtn.addEventListener('click', async () => {
    try {
      statusText.textContent = '截圖中...';
      statusText.classList.remove('error');
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      setImageData(dataUrl, 'screenshot');
      statusText.textContent = '';
    } catch (error) {
      console.error('截圖失敗:', error);
      statusText.textContent = '截圖失敗：' + error.message;
      statusText.classList.add('error');
    }
  });

  // ── 區域截圖 ──────────────────────────────────────────
  regionScreenshotBtn.addEventListener('click', async () => {
    try {
      statusText.textContent = '擷取畫面中...';
      statusText.classList.remove('error');
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      fullScreenshotData = dataUrl;
      openRegionModal(dataUrl);
      statusText.textContent = '';
    } catch (error) {
      console.error('截圖失敗:', error);
      statusText.textContent = '截圖失敗：' + error.message;
      statusText.classList.add('error');
    }
  });

  // ── 上傳圖片 ──────────────────────────────────────────
  uploadBtn.addEventListener('click', () => {
    imageInput.click();
  });

  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageData(event.target.result, 'upload');
      };
      reader.readAsDataURL(file);
    }
  });

  // ── OCR 文字辨識 ────────────────────────────────────────
  ocrBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentImageData) {
      // 無圖時顯示來源選擇器
      ocrPicker.classList.toggle('hidden');
    } else {
      // 已有圖片：直接切換為 OCR 模式
      setImageData(currentImageData, 'ocr');
      ocrPicker.classList.add('hidden');
    }
  });

  // OCR picker：上傳圖片
  document.getElementById('ocrUploadOpt').addEventListener('click', () => {
    ocrPicker.classList.add('hidden');
    imageInput.click();
    imageInput.addEventListener('change', () => {
      currentImageMode = 'ocr';
      if (imageModeLabel) imageModeLabel.textContent = 'OCR';
    }, { once: true });
  });

  // OCR picker：全頁截圖
  document.getElementById('ocrScreenshotOpt').addEventListener('click', async () => {
    ocrPicker.classList.add('hidden');
    try {
      statusText.textContent = '截圖中...';
      statusText.classList.remove('error');
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      setImageData(dataUrl, 'ocr');
      statusText.textContent = '';
    } catch (error) {
      statusText.textContent = '截圖失敗：' + error.message;
      statusText.classList.add('error');
    }
  });

  // OCR picker：區域截圖
  document.getElementById('ocrRegionOpt').addEventListener('click', async () => {
    ocrPicker.classList.add('hidden');
    try {
      statusText.textContent = '擷取畫面中...';
      statusText.classList.remove('error');
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      fullScreenshotData = dataUrl;
      pendingRegionMode = 'ocr';
      openRegionModal(dataUrl);
      statusText.textContent = '';
    } catch (error) {
      statusText.textContent = '截圖失敗：' + error.message;
      statusText.classList.add('error');
    }
  });

  // 點擊其他地方關閉 OCR picker
  document.addEventListener('click', () => {
    ocrPicker.classList.add('hidden');
  });

  // ── 翻譯切換 ───────────────────────────────────────────
  translateBtn.addEventListener('click', () => {
    translateEnabled = !translateEnabled;
    translateBtn.classList.toggle('active', translateEnabled);
    translatePanel.classList.toggle('hidden', !translateEnabled);
  });

  // ── 移除圖片 ───────────────────────────────────────────
  removeImageBtn.addEventListener('click', async () => {
    clearImageData();
    await checkApiKey();
  });

  // ── 歷史面板 ───────────────────────────────────────────
  toggleHistoryBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('hidden');
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有歷史紀錄？')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      sessions = [];
      currentSession = null;
      exitBatchMode();
      renderHistory();
      chatMessages.innerHTML = '';
      emptyState.classList.remove('hidden');
    }
  });

  // ── 批次選取 ───────────────────────────────────────────
  batchSelectBtn.addEventListener('click', () => {
    batchSelectMode = !batchSelectMode;
    selectedIds.clear();
    batchSelectBtn.textContent = batchSelectMode ? '取消' : '選取';
    batchActionBar.classList.toggle('hidden', !batchSelectMode);
    renderHistory();
  });

  selectAllCheckbox.addEventListener('change', () => {
    if (selectAllCheckbox.checked) {
      sessions.forEach(s => selectedIds.add(s.id));
    } else {
      selectedIds.clear();
    }
    updateBatchDeleteBtn();
    renderHistory();
  });

  batchDeleteBtn.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`確定要刪除 ${selectedIds.size} 筆紀錄？`)) {
      for (const id of selectedIds) {
        await chrome.runtime.sendMessage({ type: 'DELETE_SESSION', data: { sessionId: id } });
      }
      if (currentSession && selectedIds.has(currentSession.id)) {
        currentSession = null;
        chatMessages.innerHTML = '';
        emptyState.classList.remove('hidden');
      }
      sessions = sessions.filter(s => !selectedIds.has(s.id));
      exitBatchMode();
      renderHistory();
    }
  });

  function exitBatchMode() {
    batchSelectMode = false;
    selectedIds.clear();
    batchSelectBtn.textContent = '選取';
    batchActionBar.classList.add('hidden');
  }

  function updateBatchDeleteBtn() {
    batchDeleteBtn.textContent = `刪除所選 (${selectedIds.size})`;
    batchDeleteBtn.disabled = selectedIds.size === 0;
    selectAllCheckbox.indeterminate = selectedIds.size > 0 && selectedIds.size < sessions.length;
    selectAllCheckbox.checked = sessions.length > 0 && selectedIds.size === sessions.length;
  }

  historyPanel.addEventListener('click', (e) => {
    if (e.target === historyPanel) {
      historyPanel.classList.add('hidden');
    }
  });

  openSettingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Region Modal ────────────────────────────────────────
  function openRegionModal(dataUrl) {
    regionModal.classList.remove('hidden');
    regionConfirmBar.classList.add('hidden');
    selectionRect.classList.add('hidden');
    regionConfirmed = false;

    const img = new Image();
    img.onload = () => {
      const wrapper = regionCanvas.parentElement;
      const maxW = wrapper.clientWidth || 400;
      const maxH = wrapper.clientHeight || 400;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      regionCanvas.width = img.width * scale;
      regionCanvas.height = img.height * scale;
      const ctx = regionCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, regionCanvas.width, regionCanvas.height);
    };
    img.src = dataUrl;
  }

  cancelRegionBtn.addEventListener('click', () => {
    regionModal.classList.add('hidden');
    fullScreenshotData = null;
  });

  redoRegionBtn.addEventListener('click', () => {
    regionConfirmBar.classList.add('hidden');
    selectionRect.classList.add('hidden');
    regionConfirmed = false;
  });

  confirmRegionBtn.addEventListener('click', () => {
    cropRegion();
    regionModal.classList.add('hidden');
  });

  // Mouse events for region selection
  regionCanvas.addEventListener('mousedown', (e) => {
    const rect = regionCanvas.getBoundingClientRect();
    regionStartX = e.clientX - rect.left;
    regionStartY = e.clientY - rect.top;
    regionEndX = regionStartX;
    regionEndY = regionStartY;
    isDragging = true;
    regionConfirmed = false;
    regionConfirmBar.classList.add('hidden');
    selectionRect.classList.remove('hidden');
    updateSelectionRect();
  });

  regionCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = regionCanvas.getBoundingClientRect();
    regionEndX = Math.max(0, Math.min(e.clientX - rect.left, regionCanvas.width));
    regionEndY = Math.max(0, Math.min(e.clientY - rect.top, regionCanvas.height));
    updateSelectionRect();
  });

  regionCanvas.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    const w = Math.abs(regionEndX - regionStartX);
    const h = Math.abs(regionEndY - regionStartY);
    if (w > 5 && h > 5) {
      regionConfirmBar.classList.remove('hidden');
    }
  });

  function updateSelectionRect() {
    const x = Math.min(regionStartX, regionEndX);
    const y = Math.min(regionStartY, regionEndY);
    const w = Math.abs(regionEndX - regionStartX);
    const h = Math.abs(regionEndY - regionStartY);
    const canvasRect = regionCanvas.getBoundingClientRect();
    const wrapperRect = regionCanvas.parentElement.getBoundingClientRect();
    selectionRect.style.left = (canvasRect.left - wrapperRect.left + x) + 'px';
    selectionRect.style.top = (canvasRect.top - wrapperRect.top + y) + 'px';
    selectionRect.style.width = w + 'px';
    selectionRect.style.height = h + 'px';
  }

  function cropRegion() {
    const scaleX = regionCanvas.width / regionCanvas.clientWidth || 1;
    const scaleY = regionCanvas.height / regionCanvas.clientHeight || 1;
    const x = Math.min(regionStartX, regionEndX) * scaleX;
    const y = Math.min(regionStartY, regionEndY) * scaleY;
    const w = Math.abs(regionEndX - regionStartX) * scaleX;
    const h = Math.abs(regionEndY - regionStartY) * scaleY;

    const img = new Image();
    img.onload = () => {
      const fullCanvas = document.createElement('canvas');
      const displayRatio = img.width / regionCanvas.width;
      fullCanvas.width = w * displayRatio;
      fullCanvas.height = h * displayRatio;
      const ctx = fullCanvas.getContext('2d');
      ctx.drawImage(img, x * displayRatio, y * displayRatio, fullCanvas.width, fullCanvas.height, 0, 0, fullCanvas.width, fullCanvas.height);
      const croppedData = fullCanvas.toDataURL('image/png');
      const mode = pendingRegionMode || 'region';
      pendingRegionMode = null;
      setImageData(croppedData, mode);
    };
    img.src = fullScreenshotData;
  }

  // ── Helpers ─────────────────────────────────────────────
  function setImageData(dataUrl, mode) {
    currentImageData = dataUrl;
    currentImageMode = mode;
    previewImg.src = dataUrl;
    imagePreview.classList.remove('hidden');
    const labels = { screenshot: '全頁截圖', region: '區域截圖', upload: '上傳圖片', ocr: 'OCR' };
    if (imageModeLabel) imageModeLabel.textContent = labels[mode] || '';
    updateSendButton();
  }

  function clearImageData() {
    currentImageData = null;
    currentImageMode = null;
    imagePreview.classList.add('hidden');
    imageInput.value = '';
    updateSendButton();
  }

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

    if (!apiKey) {
      statusText.textContent = '請先設定 MiniMax API Key';
      statusText.classList.add('error');
      messageInput.disabled = true;
      sendBtn.disabled = true;
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
      regionScreenshotBtn.disabled = true;
      ocrBtn.disabled = true;
    } else {
      messageInput.disabled = false;
      statusText.textContent = '';
      statusText.classList.remove('error');
    }

    if (!geminiApiKey) {
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
      regionScreenshotBtn.disabled = true;
      ocrBtn.disabled = true;
      if (currentImageData) {
        statusText.textContent = '請先設定 Gemini API Key 才能分析圖片';
        statusText.classList.add('error');
      }
    } else {
      if (apiKey) {
        screenshotBtn.disabled = false;
        uploadBtn.disabled = false;
        regionScreenshotBtn.disabled = false;
        ocrBtn.disabled = false;
      }
    }
  }

  // ── Session 管理 ────────────────────────────────────────
  async function loadHistory() {
    const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
    if (response.success) {
      sessions = response.data || [];
      renderHistory();
    }
  }

  function renderHistory() {
    historyList.innerHTML = '';
    if (sessions.length === 0) {
      historyList.innerHTML = '<p class="history-empty">尚無歷史紀錄</p>';
      if (batchSelectMode) exitBatchMode();
      return;
    }

    sessions.slice().reverse().forEach((session, reversedIdx) => {
      const originalIdx = sessions.length - 1 - reversedIdx;
      const div = document.createElement('div');
      div.className = 'history-item' + (batchSelectMode && selectedIds.has(session.id) ? ' selected' : '');

      const firstUserMsg = session.messages.find(m => m.role === 'user');
      const hasImage = session.messages.some(m => m.image);
      const defaultPreview = firstUserMsg
        ? firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
        : '新對話';
      const displayName = session.name || (defaultPreview + (hasImage ? ' [圖]' : ''));

      if (batchSelectMode) {
        // 批次選取模式：顯示 checkbox
        div.innerHTML = `
          <label class="history-checkbox-label">
            <input type="checkbox" class="history-checkbox" ${selectedIds.has(session.id) ? 'checked' : ''}>
          </label>
          <div class="history-item-body">
            <p class="history-preview" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</p>
            <span class="history-time">${formatTime(session.timestamp)}</span>
          </div>
        `;
        div.querySelector('.history-checkbox').addEventListener('change', (e) => {
          if (e.target.checked) {
            selectedIds.add(session.id);
          } else {
            selectedIds.delete(session.id);
          }
          div.classList.toggle('selected', e.target.checked);
          updateBatchDeleteBtn();
        });
        div.querySelector('.history-item-body').addEventListener('click', () => {
          const cb = div.querySelector('.history-checkbox');
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        });
      } else {
        // 一般模式
        div.innerHTML = `
          <div class="history-item-body">
            <p class="history-preview" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</p>
            <span class="history-time">${formatTime(session.timestamp)}</span>
          </div>
          <div class="history-item-actions">
            <button class="btn-history-rename" title="重新命名" data-id="${session.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-history-delete" title="刪除此紀錄" data-id="${session.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        `;
        div.querySelector('.history-item-body').addEventListener('click', () => loadSession(originalIdx));
        div.querySelector('.btn-history-rename').addEventListener('click', (e) => {
          e.stopPropagation();
          startRenameSession(session, div);
        });
        div.querySelector('.btn-history-delete').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('確定要刪除此筆紀錄？')) {
            await chrome.runtime.sendMessage({ type: 'DELETE_SESSION', data: { sessionId: session.id } });
            sessions = sessions.filter(s => s.id !== session.id);
            if (currentSession && currentSession.id === session.id) {
              currentSession = null;
              chatMessages.innerHTML = '';
              emptyState.classList.remove('hidden');
            }
            renderHistory();
          }
        });
      }

      historyList.appendChild(div);
    });

    if (batchSelectMode) updateBatchDeleteBtn();
  }

  function startRenameSession(session, itemEl) {
    const previewEl = itemEl.querySelector('.history-preview');
    const currentName = session.name || previewEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'history-rename-input';
    input.value = currentName;
    previewEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = async () => {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        session.name = newName;
        await chrome.runtime.sendMessage({
          type: 'RENAME_SESSION',
          data: { sessionId: session.id, name: newName }
        });
      }
      renderHistory();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderHistory(); }
    });
  }

  function loadSession(index) {
    currentSession = sessions[index];
    chatMessages.innerHTML = '';

    currentSession.messages.forEach(msg => {
      // 歷史訊息不知道當時語言設定，用內容自動偵測
      const ttsLang = detectLang(msg.content);
      if (msg.image) {
        addMessageWithImage(msg.content, msg.role, msg.image, ttsLang);
      } else {
        addMessage(msg.content, msg.role, ttsLang);
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

  // ── 發送訊息 ────────────────────────────────────────────
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

    const userMessage = { role: 'user', content: message };
    if (currentImageData) {
      userMessage.image = currentImageData;
    }

    currentSession.messages.push(userMessage);
    addMessageWithImage(message, 'user', currentImageData);

    const textMessage = message;
    const imageData = currentImageData;
    const imageMode = currentImageMode;

    messageInput.value = '';
    messageInput.style.height = 'auto';
    clearImageData();

    // 翻譯設定
    const translateConfig = translateEnabled ? {
      enabled: true,
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value
    } : null;

    try {
      const historyForApi = currentSession.messages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content,
        image: m.image || null
      }));

      const response = await chrome.runtime.sendMessage({
        type: 'SEND_MESSAGE',
        data: {
          message: textMessage,
          history: historyForApi,
          image: imageData,
          mode: imageMode,
          translateConfig
        }
      });

      if (response.success) {
        const reply = response.data.reply;
        currentSession.messages.push({ role: 'assistant', content: reply });
        // 翻譯開：AI 回覆是 targetLang；翻譯關：AI 回覆與使用者同語言
        const replyLang = translateEnabled ? targetLangSelect.value : sourceLangSelect.value;
        addMessage(reply, 'assistant', replyLang);
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

  // ── 訊息渲染 ────────────────────────────────────────────
  // ttsLang：明確指定語言；未傳入時用 sourceLang（user）或 targetLang（assistant）
  function resolveTTSLang(role, ttsLang) {
    if (ttsLang) return ttsLang;
    return role === 'user'
      ? (sourceLangSelect?.value || 'zh-TW')
      : (targetLangSelect?.value || 'zh-TW');
  }

  function addMessage(content, role, ttsLang) {
    const lang = resolveTTSLang(role, ttsLang);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : role === 'error' ? 'error' : 'assistant'}`;
    div.innerHTML = `
      <div class="message-content">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
      ${role !== 'error' ? `<button class="btn-tts" title="語音播放" data-text="${escapeAttr(content)}" data-lang="${lang}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      </button>` : ''}
    `;
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addMessageWithImage(content, role, imageData, ttsLang) {
    const lang = resolveTTSLang(role, ttsLang);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
    let html = `<div class="message-content">`;
    if (imageData) {
      html += `<img src="${imageData}" class="message-image" alt="圖片">`;
    }
    html += `${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
    html += `<button class="btn-tts" title="語音播放" data-text="${escapeAttr(content)}" data-lang="${lang}">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    </button>`;
    div.innerHTML = html;
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  // ── TTS ─────────────────────────────────────────────────
  function stopCurrentAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    if (currentTTSBtn) {
      currentTTSBtn.classList.remove('speaking');
      currentTTSBtn = null;
    }
  }

  async function handleTTS(e) {
    const btn = e.currentTarget;
    const text = btn.dataset.text;
    const lang = btn.dataset.lang || 'zh-TW';
    if (!text) return;

    // 再次點擊同一個按鈕 → 停止播放
    if (currentTTSBtn === btn) {
      stopCurrentAudio();
      return;
    }

    // 停止前一個播放
    stopCurrentAudio();

    btn.classList.add('speaking');
    currentTTSBtn = btn;

    try {
      // 透過 background 呼叫 Google TTS
      const response = await chrome.runtime.sendMessage({
        type: 'TTS_FETCH',
        data: { text, lang }
      });

      if (!response.success) throw new Error(response.error);

      // 用 Audio API 播放 MP3
      const audio = new Audio(`data:audio/mpeg;base64,${response.base64}`);
      currentAudio = audio;

      audio.onended = () => {
        if (currentTTSBtn === btn) stopCurrentAudio();
      };
      audio.onerror = () => {
        if (currentTTSBtn === btn) stopCurrentAudio();
      };

      await audio.play();
    } catch (err) {
      console.warn('Google TTS 失敗，改用系統語音:', err.message);
      // Fallback：Web Speech API
      if (currentTTSBtn !== btn) return; // 已被中斷
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;
      utterance.onend = () => { if (currentTTSBtn === btn) stopCurrentAudio(); };
      utterance.onerror = () => { if (currentTTSBtn === btn) stopCurrentAudio(); };
      window.speechSynthesis.speak(utterance);
    }
  }

  // ── 工具函式 ────────────────────────────────────────────

  // 依 Unicode 範圍自動偵測語言（用於歷史訊息 TTS）
  function detectLang(text) {
    if (!text) return 'zh-TW';
    const hiragana  = /[\u3040-\u309F]/;   // 平假名
    const katakana  = /[\u30A0-\u30FF]/;   // 片假名
    const hangul    = /[\uAC00-\uD7A3]/;   // 韓文
    const cjk       = /[\u4E00-\u9FFF]/;   // 中日文漢字
    const latin     = /[a-zA-Z]/;
    const arabic    = /[\u0600-\u06FF]/;
    const thai      = /[\u0E00-\u0E7F]/;
    const vietnamese = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

    if (hiragana.test(text) || katakana.test(text)) return 'ja';
    if (hangul.test(text)) return 'ko';
    if (thai.test(text)) return 'th';
    if (arabic.test(text)) return 'ar';
    if (vietnamese.test(text)) return 'vi';
    if (cjk.test(text)) return 'zh-TW';
    if (latin.test(text)) return 'en';
    return 'zh-TW';
  }

  function scrollToBottom() {
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

  function escapeAttr(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
