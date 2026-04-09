// sidepanel.js - 側邊欄邏輯

let currentImages = [];  // [{ dataUrl, mode }]  目前附加的圖片（支援多張）
let pendingRegionMode = null; // 區域截圖完成後要套用的 mode（null = 'region'）
let currentModel = 'MiniMax-M2.7';  // 目前選擇的模型
let currentReplyModeId = 'standard'; // 目前回覆模式 ID
let replyModes = [];          // 從 storage 載入的回覆模式
let historySearchQuery = '';  // 歷史紀錄搜尋關鍵字
let memories = [];            // 全域長期記憶條目
let customCommands = [];      // 使用者自訂指令
let pageContext = null;       // 當前分頁內容（/page 指令觸發後）
let cmdPaletteIndex = -1;     // 指令選單鍵盤選取游標

document.addEventListener('DOMContentLoaded', async () => {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatMessages = document.getElementById('chatMessages');
  const emptyState = document.getElementById('emptyState');
  const typingIndicator = document.getElementById('typingIndicator');
  const statusText = document.getElementById('statusText');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const newSessionBtn = document.getElementById('newSessionBtn');
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
  const imageThumbs = document.getElementById('imageThumbs');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxOverlay = document.getElementById('lightboxOverlay');
  const regionModal = document.getElementById('regionModal');
  const regionModalTitle = document.getElementById('regionModalTitle');
  const regionCanvas = document.getElementById('regionCanvas');
  const cancelRegionBtn = document.getElementById('cancelRegion');
  const confirmRegionBtn = document.getElementById('confirmRegion');
  const redoRegionBtn = document.getElementById('redoRegion');
  const selectionRect = document.getElementById('selectionRect');
  const regionConfirmBar = document.getElementById('regionConfirmBar');
  const selectionPhaseEl = document.getElementById('selectionPhase');
  const annotationPhaseEl = document.getElementById('annotationPhase');
  const annCanvasWrapper = document.getElementById('annCanvasWrapper');
  const annBgCanvas = document.getElementById('annBgCanvas');
  const annDrawCanvas = document.getElementById('annDrawCanvas');
  const annTextInput = document.getElementById('annTextInput');
  const backToSelectBtn = document.getElementById('backToSelect');
  const confirmAnnotationBtn = document.getElementById('confirmAnnotation');
  const annUndoBtn = document.getElementById('annUndo');
  const annClearBtn = document.getElementById('annClear');
  const modelSelect = document.getElementById('modelSelect');
  const replyModeSelect = document.getElementById('replyModeSelect');
  const historySearchInput = document.getElementById('historySearch');
  const historyClearSearchBtn = document.getElementById('historyClearSearch');
  const commandPalette = document.getElementById('commandPalette');
  const pageContextChip = document.getElementById('pageContextChip');
  const pageContextLabel = document.getElementById('pageContextLabel');
  const pageContextRemove = document.getElementById('pageContextRemove');
  const memoryModal = document.getElementById('memoryModal');
  const memoryModalOverlay = document.getElementById('memoryModalOverlay');
  const memoryModalClose = document.getElementById('memoryModalClose');
  const memoryList = document.getElementById('memoryList');
  const memoryClearAllBtn = document.getElementById('memoryClearAllBtn');

  // SVG 圖示常數（必須在所有函式之前宣告，避免 TDZ 錯誤）
  const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;
  const TTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const COPY_OK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;

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

  // Annotation state
  let annTool = 'pen';
  let annColor = '#ef4444';
  let annStrokeSize = 2;
  let annNumberCounter = 1;
  let annHistory = [];
  let annIsDrawing = false;
  let annStartX = 0, annStartY = 0;
  let annPreviewState = null;
  let annTextPos = { x: 0, y: 0 };

  // 載入回覆模式、記憶、自訂指令
  await loadReplyModes();
  await loadMemories();
  await loadCustomCommands();

  // 檢查 API Key
  await checkApiKey();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.geminiApiKey || changes.apiKey) {
      checkApiKey();
    }
    if (changes.replyModes) {
      loadReplyModes();
    }
    if (changes.customCommands) {
      loadCustomCommands();
    }
  });

  // 載入歷史記錄
  await loadHistory();

  // ── 模型選擇 ────────────────────────────────────────────
  modelSelect.addEventListener('change', () => {
    currentModel = modelSelect.value;
  });

  // ── 回覆模式選擇 ─────────────────────────────────────────
  replyModeSelect.addEventListener('change', () => {
    currentReplyModeId = replyModeSelect.value;
  });

  // ── 歷史搜尋 ────────────────────────────────────────────
  historySearchInput.addEventListener('input', () => {
    historySearchQuery = historySearchInput.value.trim();
    historyClearSearchBtn.classList.toggle('hidden', !historySearchQuery);
    renderHistory();
  });

  historyClearSearchBtn.addEventListener('click', () => {
    historySearchInput.value = '';
    historySearchQuery = '';
    historyClearSearchBtn.classList.add('hidden');
    renderHistory();
  });

  // 自動調整輸入框高度 + 指令選單
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    updateSendButton();
    handleCommandPaletteInput();
  });

  // 發送訊息
  sendBtn.addEventListener('click', handleSend);
  messageInput.addEventListener('keydown', (e) => {
    // 指令選單鍵盤導航
    if (!commandPalette.classList.contains('hidden')) {
      const items = commandPalette.querySelectorAll('.command-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        cmdPaletteIndex = Math.min(cmdPaletteIndex + 1, items.length - 1);
        renderCommandPaletteActive(items);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        cmdPaletteIndex = Math.max(cmdPaletteIndex - 1, 0);
        renderCommandPaletteActive(items);
        return;
      }
      if (e.key === 'Enter') {
        const active = commandPalette.querySelector('.command-item.active') || items[0];
        if (active) { e.preventDefault(); active.click(); return; }
      }
      if (e.key === 'Escape') {
        hideCommandPalette();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const active = commandPalette.querySelector('.command-item.active') || items[0];
        if (active) { active.click(); return; }
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // 點擊其他地方關閉指令選單
  document.addEventListener('click', (e) => {
    if (!commandPalette.contains(e.target) && e.target !== messageInput) {
      hideCommandPalette();
    }
  });

  // Page context chip 移除
  pageContextRemove.addEventListener('click', clearPageContext);

  // Memory Modal
  memoryModalClose.addEventListener('click', closeMemoryModal);
  memoryModalOverlay.addEventListener('click', closeMemoryModal);
  memoryClearAllBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有長期記憶？')) {
      memories = [];
      await saveMemories();
      renderMemoryList();
    }
  });

  // 截圖統一透過 background，支援跨視窗
  async function captureTab() {
    // 直接從 side panel（extension page）呼叫，避免 activeTab 在 service worker 中失效
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('找不到活動頁籤');
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  }

  // ── 全頁截圖 ──────────────────────────────────────────
  screenshotBtn.addEventListener('click', async () => {
    try {
      statusText.textContent = '截圖中...';
      statusText.classList.remove('error');
      const dataUrl = await captureTab();
      addImageData(dataUrl, 'screenshot');
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
      const dataUrl = await captureTab();
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
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => addImageData(event.target.result, 'upload');
      reader.readAsDataURL(file);
    });
    imageInput.value = '';
  });

  // ── Ctrl+V 貼上圖片 ──────────────────────────────────
  messageInput.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (evt) => addImageData(evt.target.result, 'upload');
        reader.readAsDataURL(file);
        break;
      }
    }
  });

  // ── OCR 文字辨識 ────────────────────────────────────────
  ocrBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentImages.length) {
      ocrPicker.classList.toggle('hidden');
    } else {
      // 把現有圖片全部標記為 OCR 模式
      currentImages = currentImages.map(img => ({ ...img, mode: 'ocr' }));
      renderImagePreviews();
      ocrPicker.classList.add('hidden');
    }
  });

  // OCR picker：上傳圖片
  document.getElementById('ocrUploadOpt').addEventListener('click', () => {
    ocrPicker.classList.add('hidden');
    imageInput.click();
    imageInput.addEventListener('change', () => {
      // 最後加入的圖片設為 ocr（change 已在主 handler 處理，此處補標記）
      if (currentImages.length) {
        currentImages[currentImages.length - 1].mode = 'ocr';
        renderImagePreviews();
      }
    }, { once: true });
  });

  // OCR picker：全頁截圖
  document.getElementById('ocrScreenshotOpt').addEventListener('click', async () => {
    ocrPicker.classList.add('hidden');
    try {
      statusText.textContent = '截圖中...';
      statusText.classList.remove('error');
      const dataUrl = await captureTab();
      addImageData(dataUrl, 'ocr');
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
      const dataUrl = await captureTab();
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

  // ── Lightbox ──────────────────────────────────────────
  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.remove('hidden');
  }
  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
  }
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
  // 使用事件委派：chatMessages 內所有 .message-image 均可點擊
  chatMessages.addEventListener('click', (e) => {
    if (e.target.classList.contains('message-image')) {
      openLightbox(e.target.src);
    }
  });

  // ── 歷史面板 ───────────────────────────────────────────
  newSessionBtn.addEventListener('click', () => {
    startNewSession();
    historyPanel.classList.add('hidden');
  });

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
    resetRegionModal();
    regionConfirmed = false;

    const img = new Image();
    img.onload = () => {
      const maxW = selectionPhaseEl.clientWidth || 400;
      const maxH = selectionPhaseEl.clientHeight || 400;
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
    pendingRegionMode = null;
    resetRegionModal();
    annHideTextInput();
  });

  redoRegionBtn.addEventListener('click', () => {
    regionConfirmBar.classList.add('hidden');
    selectionRect.classList.add('hidden');
    regionConfirmed = false;
  });

  // 確認選取 → 進入標記階段
  confirmRegionBtn.addEventListener('click', () => {
    enterAnnotationPhase();
  });

  // 標記階段：返回重新選取
  backToSelectBtn.addEventListener('click', () => {
    annotationPhaseEl.classList.add('hidden');
    selectionPhaseEl.classList.remove('hidden');
    regionModalTitle.textContent = '拖曳選取截圖範圍';
    annHideTextInput();
    annIsDrawing = false;
  });

  // 標記階段：確認截圖
  confirmAnnotationBtn.addEventListener('click', () => {
    annFinalizeText();
    const merged = document.createElement('canvas');
    merged.width = annBgCanvas.width;
    merged.height = annBgCanvas.height;
    const ctx = merged.getContext('2d');
    ctx.drawImage(annBgCanvas, 0, 0);
    ctx.drawImage(annDrawCanvas, 0, 0);
    const finalData = merged.toDataURL('image/png');
    const mode = pendingRegionMode || 'region';
    pendingRegionMode = null;
    regionModal.classList.add('hidden');
    resetRegionModal();
    addImageData(finalData, mode);
  });

  // 工具選擇
  document.querySelectorAll('.ann-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ann-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      annTool = btn.dataset.tool;
      annDrawCanvas.style.cursor = annTool === 'text' ? 'text' : 'crosshair';
      annHideTextInput();
    });
  });

  // 顏色選擇
  document.querySelectorAll('.ann-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ann-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      annColor = btn.dataset.color;
      annTextInput.style.color = annColor;
    });
  });

  // 筆粗選擇
  document.querySelectorAll('.ann-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ann-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      annStrokeSize = parseInt(btn.dataset.size);
    });
  });

  // 復原
  annUndoBtn.addEventListener('click', annUndo);

  // 清除
  annClearBtn.addEventListener('click', () => {
    annDrawCanvas.getContext('2d').clearRect(0, 0, annDrawCanvas.width, annDrawCanvas.height);
    annHistory = [];
    annNumberCounter = 1;
  });

  // Cmd/Ctrl+Z 復原
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !annotationPhaseEl.classList.contains('hidden')) {
      e.preventDefault();
      annUndo();
    }
  });

  // ── Annotation canvas events ────────────────────────────
  annDrawCanvas.addEventListener('mousedown', (e) => {
    const pos = annGetPos(e);
    if (annTool === 'text') {
      // 文字工具在 mousedown 只記錄位置，mouseup 才顯示輸入框
      // 避免 mousedown → focus → mouseup → blur 的焦點競爭
      annStartX = pos.x; annStartY = pos.y;
      return;
    }
    if (annTool === 'number') {
      annSaveState();
      annDrawNumber(annDrawCanvas.getContext('2d'), pos.x, pos.y, annNumberCounter++);
      return;
    }
    annIsDrawing = true;
    annStartX = pos.x;
    annStartY = pos.y;
    const ctx = annDrawCanvas.getContext('2d');
    if (annTool === 'pen') {
      annSaveState();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      annSetStyle(ctx);
    } else {
      annPreviewState = ctx.getImageData(0, 0, annDrawCanvas.width, annDrawCanvas.height);
    }
  });

  annDrawCanvas.addEventListener('mousemove', (e) => {
    if (!annIsDrawing) return;
    const pos = annGetPos(e);
    const ctx = annDrawCanvas.getContext('2d');
    if (annTool === 'pen') {
      annSetStyle(ctx);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      return;
    }
    if (annPreviewState) ctx.putImageData(annPreviewState, 0, 0);
    annSetStyle(ctx);
    if (annTool === 'circle') annDrawEllipse(ctx, annStartX, annStartY, pos.x, pos.y);
    else if (annTool === 'rect') annDrawRect(ctx, annStartX, annStartY, pos.x, pos.y);
    else if (annTool === 'arrow') annDrawArrow(ctx, annStartX, annStartY, pos.x, pos.y);
  });

  function annFinishDrag(e) {
    // 文字工具：mouseup 才顯示輸入框（避免焦點競爭）
    if (annTool === 'text') {
      const pos = annGetPos(e);
      // 確認是 click（位移 < 5px）
      if (Math.abs(pos.x - annStartX) < 5 && Math.abs(pos.y - annStartY) < 5) {
        annShowTextInput(pos.x, pos.y);
      }
      return;
    }
    if (!annIsDrawing) return;
    annIsDrawing = false;
    if (annTool !== 'pen' && annPreviewState) {
      const pos = annGetPos(e);
      if (Math.abs(pos.x - annStartX) > 3 || Math.abs(pos.y - annStartY) > 3) {
        annHistory.push(annPreviewState);
        if (annHistory.length > 30) annHistory.shift();
      } else {
        annDrawCanvas.getContext('2d').putImageData(annPreviewState, 0, 0);
      }
      annPreviewState = null;
    }
  }
  annDrawCanvas.addEventListener('mouseup', annFinishDrag);
  annDrawCanvas.addEventListener('mouseleave', (e) => {
    if (annTool === 'text') return; // text 工具不在 mouseleave 處理
    annFinishDrag(e);
  });

  // Text input — 只用 Enter/Escape 控制，不使用 blur 自動關閉
  annTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); annFinalizeText(); }
    if (e.key === 'Escape') { annHideTextInput(); }
    e.stopPropagation();
  });
  // 點到 canvas 之外才關閉（防止因焦點競爭意外消失）
  annTextInput.addEventListener('blur', (e) => {
    if (!annTextInput.classList.contains('hidden') && e.relatedTarget === null) {
      // focus 移到視窗外（如切換應用），不要自動關閉，等使用者按 Enter
    }
    // 若 focus 移到標記工具列按鈕，則關閉
    if (e.relatedTarget && annotationPhaseEl.contains(e.relatedTarget) && e.relatedTarget !== annTextInput) {
      annFinalizeText();
    }
  });

  // ── Annotation helpers ───────────────────────────────────
  function enterAnnotationPhase() {
    const scaleX = regionCanvas.width / (regionCanvas.clientWidth || regionCanvas.width);
    const scaleY = regionCanvas.height / (regionCanvas.clientHeight || regionCanvas.height);
    const x = Math.min(regionStartX, regionEndX) * scaleX;
    const y = Math.min(regionStartY, regionEndY) * scaleY;
    const w = Math.abs(regionEndX - regionStartX) * scaleX;
    const h = Math.abs(regionEndY - regionStartY) * scaleY;

    const img = new Image();
    img.onload = () => {
      const dRatio = img.width / regionCanvas.width;
      const cropX = x * dRatio, cropY = y * dRatio;
      const cropW = w * dRatio, cropH = h * dRatio;

      selectionPhaseEl.classList.add('hidden');
      annotationPhaseEl.classList.remove('hidden');
      regionModalTitle.textContent = '標記截圖內容';

      requestAnimationFrame(() => {
        const mw = annCanvasWrapper.clientWidth || 360;
        const mh = annCanvasWrapper.clientHeight || 400;
        const scale = Math.min(mw / cropW, mh / cropH, 1);
        const cw = Math.round(cropW * scale);
        const ch = Math.round(cropH * scale);

        annBgCanvas.width = cw; annBgCanvas.height = ch;
        annDrawCanvas.width = cw; annDrawCanvas.height = ch;
        annBgCanvas.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cw, ch);
        annDrawCanvas.getContext('2d').clearRect(0, 0, cw, ch);

        annHistory = [];
        annNumberCounter = 1;
        annHideTextInput();
        annTextInput.style.color = annColor;
      });
    };
    img.src = fullScreenshotData;
  }

  function resetRegionModal() {
    selectionPhaseEl.classList.remove('hidden');
    annotationPhaseEl.classList.add('hidden');
    regionModalTitle.textContent = '拖曳選取截圖範圍';
    regionConfirmBar.classList.add('hidden');
    selectionRect.classList.add('hidden');
  }

  function annGetPos(e) {
    const rect = annDrawCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (annDrawCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (annDrawCanvas.height / rect.height)
    };
  }

  function annSetStyle(ctx) {
    ctx.strokeStyle = annColor;
    ctx.lineWidth = annStrokeSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function annSaveState() {
    const s = annDrawCanvas.getContext('2d').getImageData(0, 0, annDrawCanvas.width, annDrawCanvas.height);
    annHistory.push(s);
    if (annHistory.length > 30) annHistory.shift();
  }

  function annUndo() {
    if (annHistory.length === 0) return;
    const prev = annHistory.pop();
    annDrawCanvas.getContext('2d').putImageData(prev, 0, 0);
  }

  function annDrawEllipse(ctx, x1, y1, x2, y2) {
    const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    if (rx < 1 || ry < 1) return;
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, rx, ry, 0, 0, 2 * Math.PI);
    ctx.stroke();
  }

  function annDrawRect(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  function annDrawArrow(ctx, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 5) return;
    const angle = Math.atan2(dy, dx);
    const head = Math.min(18, len * 0.35);
    const spread = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - spread), y2 - head * Math.sin(angle - spread));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle + spread), y2 - head * Math.sin(angle + spread));
    ctx.stroke();
  }

  function annDrawNumber(ctx, x, y, num) {
    const r = Math.max(11, annStrokeSize * 3 + 8);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = annColor;
    ctx.fill();
    const light = isLightHex(annColor);
    ctx.fillStyle = light ? '#000' : '#fff';
    ctx.font = `bold ${Math.round(r * 1.1)}px Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), x, y);
  }

  function isLightHex(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 128;
  }

  function annShowTextInput(cx, cy) {
    annTextPos = { x: cx, y: cy };
    const wRect = annCanvasWrapper.getBoundingClientRect();
    const cRect = annDrawCanvas.getBoundingClientRect();
    const scaleX = cRect.width / annDrawCanvas.width;
    const scaleY = cRect.height / annDrawCanvas.height;
    annTextInput.style.left = (cRect.left - wRect.left + cx * scaleX) + 'px';
    annTextInput.style.top = (cRect.top - wRect.top + cy * scaleY) + 'px';
    annTextInput.style.color = annColor;
    annTextInput.value = '';
    annTextInput.classList.remove('hidden');
    // requestAnimationFrame 確保 DOM 更新後再 focus，避免焦點競爭
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        annTextInput.focus();
      });
    });
  }

  function annFinalizeText() {
    if (annTextInput.classList.contains('hidden')) return;
    const text = annTextInput.value.trim();
    annHideTextInput();
    if (!text) return;
    const ctx = annDrawCanvas.getContext('2d');
    annSaveState();
    const fontSize = 12 + annStrokeSize * 2;
    ctx.font = `bold ${fontSize}px Arial,sans-serif`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = annColor;
    ctx.fillText(text, annTextPos.x + 2, annTextPos.y);
  }

  function annHideTextInput() {
    annTextInput.classList.add('hidden');
    annTextInput.value = '';
  }

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
      addImageData(croppedData, mode);
    };
    img.src = fullScreenshotData;
  }

  // ── Helpers ─────────────────────────────────────────────
  function addImageData(dataUrl, mode) {
    currentImages.push({ dataUrl, mode });
    renderImagePreviews();
    updateSendButton();
  }

  function clearImageData() {
    currentImages = [];
    renderImagePreviews();
    imageInput.value = '';
    updateSendButton();
  }

  function renderImagePreviews() {
    if (!currentImages.length) {
      imagePreview.classList.add('hidden');
      imageThumbs.innerHTML = '';
      return;
    }
    imagePreview.classList.remove('hidden');
    const labels = { screenshot: '全頁截圖', region: '區域截圖', upload: '上傳', ocr: 'OCR' };
    imageThumbs.innerHTML = '';
    currentImages.forEach((img, idx) => {
      const item = document.createElement('div');
      item.className = 'thumb-item';
      item.innerHTML = `
        <img src="${img.dataUrl}" class="thumb-img" alt="">
        <button class="btn-thumb-remove" title="移除">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <span class="thumb-label">${labels[img.mode] || img.mode}</span>
      `;
      item.querySelector('.btn-thumb-remove').addEventListener('click', () => {
        currentImages.splice(idx, 1);
        renderImagePreviews();
        updateSendButton();
      });
      imageThumbs.appendChild(item);
    });
  }

  function updateSendButton() {
    const hasContent = messageInput.value.trim() || currentImages.length > 0;
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
      if (currentImages.length > 0) {
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

  // ── 回覆模式 ────────────────────────────────────────────
  async function loadReplyModes() {
    const { replyModes: stored } = await chrome.storage.sync.get(['replyModes']);
    replyModes = stored && stored.length > 0 ? stored : [
      { id: 'standard', name: '標準', prompt: '' },
      { id: 'discuss', name: '討論模式', prompt: '請針對問題進行多角度分析，引用可靠資訊，交互比對後給出結論，並附上推理過程。' }
    ];
    // 更新 select 選項
    replyModeSelect.innerHTML = '';
    replyModes.forEach(mode => {
      const opt = document.createElement('option');
      opt.value = mode.id;
      opt.textContent = mode.name;
      replyModeSelect.appendChild(opt);
    });
    // 保持目前選取
    if (replyModes.find(m => m.id === currentReplyModeId)) {
      replyModeSelect.value = currentReplyModeId;
    } else {
      currentReplyModeId = replyModes[0]?.id || 'standard';
      replyModeSelect.value = currentReplyModeId;
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

    // 搜尋過濾
    const query = historySearchQuery.toLowerCase();
    let filtered = sessions;
    if (query) {
      filtered = sessions.filter(s => {
        const nameMatch = (s.name || '').toLowerCase().includes(query);
        const msgMatch = s.messages.some(m => (m.content || '').toLowerCase().includes(query));
        return nameMatch || msgMatch;
      });
    }

    if (filtered.length === 0) {
      historyList.innerHTML = `<p class="history-empty">${query ? '找不到相關對話' : '尚無歷史紀錄'}</p>`;
      return;
    }

    // 釘選排序：釘選在前，各自按時間降冪
    const pinned = filtered.filter(s => s.pinned).sort((a, b) => b.id - a.id);
    const normal = filtered.filter(s => !s.pinned).sort((a, b) => b.id - a.id);

    const renderSection = (list, label) => {
      if (list.length === 0) return;
      if (label) {
        const labelEl = document.createElement('div');
        labelEl.className = 'history-section-label';
        labelEl.textContent = label;
        historyList.appendChild(labelEl);
      }
      list.forEach(session => {
        const originalIdx = sessions.findIndex(s => s.id === session.id);
        const div = document.createElement('div');
        div.className = 'history-item' +
          (batchSelectMode && selectedIds.has(session.id) ? ' selected' : '') +
          (session.pinned ? ' pinned' : '');

        const firstUserMsg = session.messages.find(m => m.role === 'user');
        const hasImage = session.messages.some(m => m.image || (m.images && m.images.length > 0));
        const defaultPreview = firstUserMsg
          ? firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
          : '新對話';
        let displayName = session.name || (defaultPreview + (hasImage ? ' [圖]' : ''));

        // 關鍵字高亮
        if (query) {
          const escaped = escapeHtml(displayName);
          const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          displayName = escaped.replace(re, '<mark>$1</mark>');
        } else {
          displayName = escapeHtml(displayName);
        }

        if (batchSelectMode) {
          div.innerHTML = `
            <label class="history-checkbox-label">
              <input type="checkbox" class="history-checkbox" ${selectedIds.has(session.id) ? 'checked' : ''}>
            </label>
            <div class="history-item-body">
              <p class="history-preview" title="${escapeHtml(session.name || defaultPreview)}">${displayName}</p>
              <span class="history-time">${formatTime(session.timestamp)}</span>
            </div>
          `;
          div.querySelector('.history-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) selectedIds.add(session.id);
            else selectedIds.delete(session.id);
            div.classList.toggle('selected', e.target.checked);
            updateBatchDeleteBtn();
          });
          div.querySelector('.history-item-body').addEventListener('click', () => {
            const cb = div.querySelector('.history-checkbox');
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
          });
        } else {
          div.innerHTML = `
            <div class="history-item-body">
              <p class="history-preview" title="${escapeHtml(session.name || defaultPreview)}">${displayName}</p>
              <span class="history-time">${formatTime(session.timestamp)}</span>
            </div>
            <div class="history-item-actions">
              <button class="btn-pin${session.pinned ? ' active' : ''}" title="${session.pinned ? '取消釘選' : '釘選'}" data-id="${session.id}">${PIN_SVG}</button>
              <button class="btn-history-rename" title="重新命名" data-id="${session.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn-history-delete" title="刪除此紀錄" data-id="${session.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          `;
          div.querySelector('.history-item-body').addEventListener('click', () => loadSession(originalIdx));
          div.querySelector('.btn-pin').addEventListener('click', async (e) => {
            e.stopPropagation();
            const newPinned = !session.pinned;
            session.pinned = newPinned;
            await chrome.runtime.sendMessage({ type: 'PIN_SESSION', data: { sessionId: session.id, pinned: newPinned } });
            renderHistory();
          });
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
    };

    if (pinned.length > 0 && normal.length > 0) {
      renderSection(pinned, '📌 釘選');
      renderSection(normal, '最近');
    } else {
      renderSection(pinned, null);
      renderSection(normal, null);
    }

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

    // 還原 session 當時的 model 和 replyMode
    if (currentSession.model) {
      currentModel = currentSession.model;
      modelSelect.value = currentModel;
    }
    if (currentSession.replyModeId) {
      currentReplyModeId = currentSession.replyModeId;
      replyModeSelect.value = currentReplyModeId;
    }

    currentSession.messages.forEach(msg => {
      // 歷史訊息不知道當時語言設定，用內容自動偵測
      const ttsLang = detectLang(msg.content);
      const imgs = msg.images || (msg.image ? [msg.image] : null);
      if (imgs && imgs.length > 0) {
        addMessageWithImages(msg.content, msg.role, imgs, ttsLang);
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
      messages: [],
      model: currentModel,
      replyModeId: currentReplyModeId
    };
    chatMessages.innerHTML = '';
    emptyState.classList.remove('hidden');
  }

  // ── 發送訊息 ────────────────────────────────────────────
  async function handleSend() {
    const message = messageInput.value.trim();
    if (!message && !currentImages.length) return;

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

    // 若有頁面內容，包裝 user message
    const finalMessage = buildPageContextMessage(message);

    const userMessage = { role: 'user', content: message };
    const snapshotImages = [...currentImages]; // 快照，避免 clearImageData 後遺失
    if (snapshotImages.length > 0) {
      userMessage.images = snapshotImages.map(i => i.dataUrl);
    }

    currentSession.messages.push(userMessage);
    addMessageWithImages(message, 'user', snapshotImages.map(i => i.dataUrl));

    const textMessage = finalMessage;

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
        images: m.images || (m.image ? [m.image] : null)
      }));

      // 取得回覆模式的 systemPrompt
      const activeMode = replyModes.find(m => m.id === currentReplyModeId);
      const systemPrompt = activeMode?.prompt || '';

      const memoryContext = buildMemoryBlock();

      const response = await chrome.runtime.sendMessage({
        type: 'SEND_MESSAGE',
        data: {
          message: textMessage,
          history: historyForApi,
          images: snapshotImages,
          translateConfig,
          model: currentModel,
          systemPrompt,
          memoryContext
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

        // AI 自動萃取記憶（非同步，不阻塞 UI）
        const { autoMemoryEnabled } = await chrome.storage.sync.get(['autoMemoryEnabled']);
        if (autoMemoryEnabled && message && reply) {
          chrome.runtime.sendMessage({
            type: 'EXTRACT_MEMORY',
            data: { userMessage: message, aiReply: reply }
          }).then(async (res) => {
            if (res.success && res.items.length > 0) {
              for (const text of res.items) {
                await addMemory(text, 'auto');
              }
            }
          }).catch(() => {});
        }
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


  function buildMessageActions(content, lang, role) {
    if (role === 'error') return '';
    return `
      <div class="message-actions">
        <button class="btn-tts" title="語音播放" data-text="${escapeAttr(content)}" data-lang="${lang}">${TTS_SVG}</button>
        <button class="btn-copy" title="複製訊息" data-text="${escapeAttr(content)}">${COPY_SVG}</button>
      </div>`;
  }

  function addMessage(content, role, ttsLang) {
    const lang = resolveTTSLang(role, ttsLang);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : role === 'error' ? 'error' : 'assistant'}`;
    const contentHtml = (role === 'assistant')
      ? renderMarkdown(content)
      : escapeHtml(content).replace(/\n/g, '<br>');
    div.innerHTML = `
      <div class="message-content">${contentHtml}</div>
      ${buildMessageActions(content, lang, role)}
    `;
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    div.querySelector('.btn-copy')?.addEventListener('click', handleCopy);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addMessageWithImages(content, role, imageUrls, ttsLang) {
    const lang = resolveTTSLang(role, ttsLang);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
    let html = `<div class="message-content">`;
    if (imageUrls && imageUrls.length > 0) {
      html += `<div class="message-images">`;
      imageUrls.forEach(url => {
        html += `<img src="${url}" class="message-image" alt="圖片" title="點擊放大">`;
      });
      html += `</div>`;
    }
    const bodyHtml = (role === 'assistant')
      ? renderMarkdown(content)
      : escapeHtml(content).replace(/\n/g, '<br>');
    html += `${bodyHtml}</div>`;
    html += buildMessageActions(content, lang, role);
    div.innerHTML = html;
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    div.querySelector('.btn-copy')?.addEventListener('click', handleCopy);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  // 向下相容舊呼叫
  function addMessageWithImage(content, role, imageData, ttsLang) {
    addMessageWithImages(content, role, imageData ? [imageData] : [], ttsLang);
  }

  // ── 複製訊息 ─────────────────────────────────────────────
  function handleCopy(e) {
    const btn = e.currentTarget;
    const text = btn.dataset.text;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = COPY_OK_SVG;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = COPY_SVG;
        btn.classList.remove('copied');
      }, 1500);
    }).catch(() => {
      // fallback：document.execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btn.innerHTML = COPY_OK_SVG;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = COPY_SVG;
        btn.classList.remove('copied');
      }, 1500);
    });
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

  // ── Commands ─────────────────────────────────────────────

  const BUILTIN_COMMANDS = [
    { trigger: '/screenshot', name: '全頁截圖',    type: 'action', icon: '📷' },
    { trigger: '/region',     name: '區域截圖',    type: 'action', icon: '✂️' },
    { trigger: '/ocr',        name: 'OCR 文字辨識', type: 'action', icon: '🔍' },
    { trigger: '/page',       name: '讀取當前頁面', type: 'action', icon: '📄' },
    { trigger: '/new',        name: '新對話',      type: 'action', icon: '➕' },
    { trigger: '/clear',      name: '清空對話',    type: 'action', icon: '🗑️' },
    { trigger: '/remember',   name: '記住某件事',  type: 'action', icon: '🧠', argHint: '/remember <內容>' },
    { trigger: '/forget',     name: '管理記憶',    type: 'action', icon: '📋' },
    { trigger: '/mode',       name: '切換回覆模式', type: 'action', icon: '🔄', argHint: '/mode <模式名稱>' },
    { trigger: '/summarize',  name: '摘要此段文字', type: 'template', icon: '📝', template: '請用條列式摘要以下內容：\n\n{input}' },
  ];

  async function loadCustomCommands() {
    const { customCommands: stored } = await chrome.storage.sync.get(['customCommands']);
    customCommands = stored || [];
  }

  function getAllCommands() {
    return [...BUILTIN_COMMANDS, ...customCommands.map(c => ({ ...c, isCustom: true }))];
  }

  function handleCommandPaletteInput() {
    const val = messageInput.value;
    if (!val.startsWith('/')) { hideCommandPalette(); return; }
    const query = val.toLowerCase();
    const all = getAllCommands();
    const filtered = all.filter(c => c.trigger.startsWith(query) || c.name.includes(val.slice(1)));
    if (filtered.length === 0) { hideCommandPalette(); return; }
    showCommandPaletteItems(filtered, val);
  }

  function showCommandPaletteItems(items, query) {
    commandPalette.innerHTML = '';
    cmdPaletteIndex = 0;
    items.forEach((cmd, idx) => {
      const div = document.createElement('div');
      div.className = 'command-item' + (idx === 0 ? ' active' : '');
      div.innerHTML = `
        <span class="command-item-trigger">${escapeHtml(cmd.trigger)}</span>
        <span class="command-item-name">${escapeHtml(cmd.name)}</span>
        <span class="command-item-type">${cmd.type === 'template' ? '模板' : '動作'}</span>
      `;
      div.addEventListener('click', () => applyCommand(cmd, query));
      commandPalette.appendChild(div);
    });
    commandPalette.classList.remove('hidden');
  }

  function renderCommandPaletteActive(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('active', idx === cmdPaletteIndex);
    });
    // 確保選取項目在可視範圍內
    if (cmdPaletteIndex >= 0 && items[cmdPaletteIndex]) {
      items[cmdPaletteIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function hideCommandPalette() {
    commandPalette.classList.add('hidden');
    commandPalette.innerHTML = '';
    cmdPaletteIndex = -1;
  }

  function applyCommand(cmd, inputVal) {
    hideCommandPalette();
    // 擷取 trigger 之後的 args
    const args = inputVal.slice(cmd.trigger.length).trim();

    if (cmd.type === 'template') {
      const filled = cmd.template.replace('{input}', args);
      messageInput.value = filled;
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
      updateSendButton();
      messageInput.focus();
      return;
    }

    // action 類型
    messageInput.value = '';
    updateSendButton();
    executeAction(cmd.trigger, args);
  }

  function executeAction(trigger, args) {
    switch (trigger) {
      case '/screenshot':
        screenshotBtn.click();
        break;
      case '/region':
        regionScreenshotBtn.click();
        break;
      case '/ocr':
        ocrPicker.classList.toggle('hidden');
        break;
      case '/page':
        fetchPageContext();
        break;
      case '/new':
        startNewSession();
        historyPanel.classList.add('hidden');
        break;
      case '/clear':
        chatMessages.innerHTML = '';
        if (currentSession) currentSession.messages = [];
        emptyState.classList.remove('hidden');
        break;
      case '/remember':
        if (args) {
          addMemory(args, 'manual');
        } else {
          statusText.textContent = '用法：/remember <要記住的內容>';
          statusText.classList.remove('error');
          setTimeout(() => { statusText.textContent = ''; }, 3000);
        }
        break;
      case '/forget':
        openMemoryModal();
        break;
      case '/mode':
        if (args) {
          const target = replyModes.find(m => m.name.includes(args) || m.id.includes(args));
          if (target) {
            currentReplyModeId = target.id;
            replyModeSelect.value = target.id;
            statusText.textContent = `已切換至：${target.name}`;
            setTimeout(() => { statusText.textContent = ''; }, 2000);
          } else {
            statusText.textContent = `找不到模式「${args}」`;
            setTimeout(() => { statusText.textContent = ''; }, 3000);
          }
        } else {
          openMemoryModal();
        }
        break;
      default:
        break;
    }
    messageInput.focus();
  }

  // ── Memory ──────────────────────────────────────────────

  async function loadMemories() {
    const result = await chrome.storage.local.get(['memories']);
    memories = result.memories || [];
  }

  async function saveMemories() {
    await chrome.storage.local.set({ memories });
  }

  async function addMemory(text, source) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // 去重
    if (memories.some(m => m.text === trimmed)) {
      statusText.textContent = '此記憶已存在';
      setTimeout(() => { statusText.textContent = ''; }, 2000);
      return;
    }
    memories.push({ id: `mem_${Date.now()}`, text: trimmed, source, createdAt: Date.now() });
    // 上限 50 筆
    if (memories.length > 50) memories.shift();
    await saveMemories();
    statusText.textContent = `✓ 已記住：${trimmed.slice(0, 30)}${trimmed.length > 30 ? '...' : ''}`;
    setTimeout(() => { statusText.textContent = ''; }, 3000);
  }

  function openMemoryModal() {
    renderMemoryList();
    memoryModal.classList.remove('hidden');
  }

  function closeMemoryModal() {
    memoryModal.classList.add('hidden');
  }

  function renderMemoryList() {
    memoryList.innerHTML = '';
    if (memories.length === 0) {
      memoryList.innerHTML = '<p class="memory-empty">尚無長期記憶。<br>使用 /remember 內容 來新增。</p>';
      return;
    }
    memories.slice().reverse().forEach(mem => {
      const div = document.createElement('div');
      div.className = 'memory-item';
      div.innerHTML = `
        <span class="memory-item-badge ${mem.source}">${mem.source === 'manual' ? '手動' : '自動'}</span>
        <span class="memory-item-text">${escapeHtml(mem.text)}</span>
        <button class="btn-memory-delete" title="刪除">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      `;
      div.querySelector('.btn-memory-delete').addEventListener('click', async () => {
        memories = memories.filter(m => m.id !== mem.id);
        await saveMemories();
        renderMemoryList();
      });
      memoryList.appendChild(div);
    });
  }

  function buildMemoryBlock() {
    if (memories.length === 0) return '';
    return `【使用者長期記憶】\n${memories.map(m => `- ${m.text}`).join('\n')}`;
  }

  // ── Page Context ─────────────────────────────────────────

  async function fetchPageContext() {
    statusText.textContent = '讀取頁面中...';
    statusText.classList.remove('error');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'READ_PAGE' });
      if (!response.success) throw new Error(response.error);
      pageContext = response.data;
      const shortTitle = pageContext.title.slice(0, 25) + (pageContext.title.length > 25 ? '...' : '');
      pageContextLabel.textContent = `📄 ${shortTitle}`;
      pageContextChip.classList.remove('hidden');
      statusText.textContent = '';
      messageInput.focus();
    } catch (err) {
      statusText.textContent = '無法讀取頁面：' + err.message;
      statusText.classList.add('error');
      setTimeout(() => { statusText.textContent = ''; statusText.classList.remove('error'); }, 4000);
    }
  }

  function clearPageContext() {
    pageContext = null;
    pageContextChip.classList.add('hidden');
  }

  function buildPageContextMessage(userMessage) {
    if (!pageContext) return userMessage;
    const parts = [`【當前頁面】`, `標題：${pageContext.title}`, `網址：${pageContext.url}`];
    if (pageContext.description) parts.push(`描述：${pageContext.description}`);
    parts.push(`內容：\n${pageContext.text}`);
    parts.push(`\n使用者問題：\n${userMessage}`);
    clearPageContext();
    return parts.join('\n');
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

  // ── Markdown 渲染 ─────────────────────────────────────────
  function renderMarkdown(raw) {
    const blocks = [], inlines = [];

    // 1. 抽出 fenced code block
    let text = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const i = blocks.length;
      const cls = lang ? ` class="lang-${escapeHtml(lang)}"` : '';
      blocks.push(`<pre><code${cls}>${escapeHtml(code.trimEnd())}</code></pre>`);
      return `\x02B${i}\x03`;
    });

    // 2. 抽出 inline code
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const i = inlines.length;
      inlines.push(`<code>${escapeHtml(code)}</code>`);
      return `\x02I${i}\x03`;
    });

    // 3. 轉義剩餘 HTML
    text = escapeHtml(text);

    // 4. inline 樣式（bold / italic / del）
    function applyInline(s) {
      s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^\s].*?[^\s])\*/g, '<em>$1</em>');
      s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
      return s;
    }

    // 5. 逐行解析
    const lines = text.split('\n');
    const out = [];
    let inUl = false, inOl = false;
    let tRows = [], inTable = false;

    function flushTable() {
      if (!tRows.length) return;
      const rows = tRows.filter(r => !/^\|[\s:\-|]+\|$/.test(r));
      let h = '<table>';
      rows.forEach((row, idx) => {
        const cells = row.split('|').slice(1, -1);
        const tag = idx === 0 ? 'th' : 'td';
        h += '<tr>' + cells.map(c => `<${tag}>${applyInline(c.trim())}</${tag}>`).join('') + '</tr>';
      });
      out.push(h + '</table>');
      tRows = []; inTable = false;
    }

    function flushLists() {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    }

    for (const line of lines) {
      // table
      if (/^\|.+\|$/.test(line)) {
        flushLists(); inTable = true; tRows.push(line); continue;
      }
      if (inTable) flushTable();

      // heading
      const hm = line.match(/^(#{1,4}) (.+)/);
      if (hm) { flushLists(); out.push(`<h${hm[1].length}>${applyInline(hm[2])}</h${hm[1].length}>`); continue; }

      // hr
      if (/^---+$/.test(line.trim())) { flushLists(); out.push('<hr>'); continue; }

      // unordered list
      const ulm = line.match(/^[\-\*\+] (.+)/);
      if (ulm) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${applyInline(ulm[1])}</li>`); continue;
      }

      // ordered list
      const olm = line.match(/^\d+\. (.+)/);
      if (olm) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push(`<li>${applyInline(olm[1])}</li>`); continue;
      }

      flushLists();

      // blank
      if (!line.trim()) { out.push('<br>'); continue; }

      // paragraph
      out.push(`<p>${applyInline(line)}</p>`);
    }

    flushLists();
    if (inTable) flushTable();

    let html = out.join('');
    html = html.replace(/\x02B(\d+)\x03/g, (_, i) => blocks[+i]);
    html = html.replace(/\x02I(\d+)\x03/g, (_, i) => inlines[+i]);
    return html;
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
