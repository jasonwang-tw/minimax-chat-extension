// sidepanel.js - 側邊欄邏輯

let currentImages = [];  // [{ dataUrl, mode, fileType, fileName }]  目前附加的檔案（圖片/PDF/文字）
let statusNoticeEl = null; // 聊天區底部的狀態通知元素
let pendingRegionMode = null; // 區域截圖完成後要套用的 mode（null = 'region'）
let currentModel = 'MiniMax-M2.7';  // 目前選擇的模型
let currentReplyModeId = 'standard'; // 目前回覆模式 ID
let replyModes = [];          // 從 storage 載入的回覆模式
let historySearchQuery = '';  // 歷史紀錄搜尋關鍵字
let memories = [];            // 全域長期記憶條目
let memoryCategoryFilter = '';     // 長期記憶分類篩選
let vocabularyCategoryFilter = ''; // 單字簿分類篩選
let knowledgeBase = [];            // 全域知識庫條目
let selectedKnowledge = [];        // 本次訊息已選取的知識庫條目
let kbPaletteIndex = -1;           // @ palette 鍵盤游標
let knowledgeCategoryFilter = '';  // 知識庫分類篩選
let knowledgeTagFilter = '';       // 知識庫標籤篩選
let sessionSummaries = {};         // { [sessionId]: [{ id, text, createdAt, addedToMemory }] }
let isSummarizing = false;         // 防止重複總結
let inputHistory = [];             // 輸入歷史（最多 10 則）
let inputHistoryIndex = -1;        // 當前瀏覽的歷史索引（-1 = 非瀏覽狀態）
let inputHistorySaved = '';        // 暫存使用者正在輸入的文字
// Render 版本計數器：防止 async render 競爭導致資料重複
let _renderMemoryVer = 0;
let _renderVocabVer = 0;
let _renderKbVer = 0;
let customCommands = [];      // 使用者自訂指令
let pageContext = null;       // 當前分頁內容（/page 指令觸發後）
let cmdPaletteIndex = -1;     // 指令選單鍵盤選取游標

document.addEventListener('DOMContentLoaded', async () => {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const sendIcon = document.getElementById('sendIcon');
  const stopIcon = document.getElementById('stopIcon');
  let currentPort = null;    // 追蹤目前串流 port，供停止按鈕使用
  let currentLiveDiv = null; // 追蹤目前 live message div
  let currentRawContent = ''; // 追蹤目前串流已累積的內容
  const chatMessages = document.getElementById('chatMessages');
  const emptyState = document.getElementById('emptyState');
  const typingIndicator = document.getElementById('typingIndicator');
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
  const openMemoryBtn = document.getElementById('openMemoryBtn');
  const vocabularyModal = document.getElementById('vocabularyModal');
  const vocabularyModalOverlay = document.getElementById('vocabularyModalOverlay');
  const vocabularyModalClose = document.getElementById('vocabularyModalClose');
  const vocabularyList = document.getElementById('vocabularyList');
  const vocabularyClearAllBtn = document.getElementById('vocabularyClearAllBtn');
  const openVocabularyBtn = document.getElementById('openVocabularyBtn');
  // 知識庫元素
  const openKnowledgeBtn = document.getElementById('openKnowledgeBtn');
  const knowledgeChips = document.getElementById('knowledgeChips');
  const knowledgePalette = document.getElementById('knowledgePalette');
  const knowledgeModal = document.getElementById('knowledgeModal');
  const knowledgeModalOverlay = document.getElementById('knowledgeModalOverlay');
  const knowledgeModalClose = document.getElementById('knowledgeModalClose');
  const knowledgeList = document.getElementById('knowledgeList');
  const knowledgeClearAllBtn = document.getElementById('knowledgeClearAllBtn');
  const knowledgeCategoryFilterEl = document.getElementById('knowledgeCategoryFilter');
  const manageKnowledgeCatBtn = document.getElementById('manageKnowledgeCatBtn');
  const knowledgeCatManager = document.getElementById('knowledgeCatManager');
  const knowledgeNewCatInput = document.getElementById('knowledgeNewCatInput');
  const knowledgeAddCatBtn = document.getElementById('knowledgeAddCatBtn');
  const knowledgeCatList = document.getElementById('knowledgeCatList');
  const knowledgeTagFilters = document.getElementById('knowledgeTagFilters');
  // 總結工具列元素
  const summarizeBtn = document.getElementById('summarizeBtn');
  const manageSummaryBtn = document.getElementById('manageSummaryBtn');
  const summaryModal = document.getElementById('summaryModal');
  const summaryModalOverlay = document.getElementById('summaryModalOverlay');
  const summaryModalClose = document.getElementById('summaryModalClose');
  const summaryList = document.getElementById('summaryList');

  // 分類管理元素 — Memory
  const memoryCategoryFilterEl = document.getElementById('memoryCategoryFilter');
  const manageMemoryCatBtn = document.getElementById('manageMemoryCatBtn');
  const memoryCatManager = document.getElementById('memoryCatManager');
  const memoryNewCatInput = document.getElementById('memoryNewCatInput');
  const memoryAddCatBtn = document.getElementById('memoryAddCatBtn');
  const memoryCatList = document.getElementById('memoryCatList');
  // 分類管理元素 — Vocabulary
  const vocabularyCategoryFilterEl = document.getElementById('vocabularyCategoryFilter');
  const manageVocabularyCatBtn = document.getElementById('manageVocabularyCatBtn');
  const vocabularyCatManager = document.getElementById('vocabularyCatManager');
  const vocabularyNewCatInput = document.getElementById('vocabularyNewCatInput');
  const vocabularyAddCatBtn = document.getElementById('vocabularyAddCatBtn');
  const vocabularyCatList = document.getElementById('vocabularyCatList');

  // SVG 圖示常數（必須在所有函式之前宣告，避免 TDZ 錯誤）
  const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;
  const TTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const COPY_OK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
  const FILE_SVG_PDF = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`;
  const FILE_SVG_DOC = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`;
  // 判斷 MIME type → fileType
  function getFileType(mimeType) {
    if (!mimeType || mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'text';
  }

  let sessions = [];
  let currentSession = null;
  let isLoading = false;
  let translateEnabled = false;
  let batchSelectMode = false;
  let selectedIds = new Set();
  let currentAudio = null;     // 目前播放中的 Audio 物件（fallback 用）
  let currentTTSBtn = null;    // 目前播放中的按鈕
  let currentAudioCtx = null;  // Web Audio API context
  let currentAudioSrc = null;  // Web Audio API BufferSource

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

  // 載入回覆模式、記憶、自訂指令、知識庫
  await loadReplyModes();
  await loadMemories();
  await migrateCategoriesIfNeeded();
  await loadCustomCommands();
  const { knowledgeBase: initKb = [] } = await chrome.storage.local.get(['knowledgeBase']);
  knowledgeBase = initKb;
  const { sessionSummaries: initSS = {} } = await chrome.storage.local.get(['sessionSummaries']);
  sessionSummaries = initSS;

  // 檢查 API Key
  await checkApiKey();

  chrome.storage.onChanged.addListener((changes, area) => {
    // sync area：API Key、設定、長期記憶、分類（跨裝置同步的資料）
    if (area === 'sync') {
      if (changes.geminiApiKey || changes.apiKey) {
        checkApiKey();
      }
      if (changes.replyModes) {
        loadReplyModes();
      }
      if (changes.customCommands) {
        loadCustomCommands();
      }
      // 右鍵選單從 background 寫入 sync，sidepanel 透過此監聽同步
      if (changes.memories) {
        memories = changes.memories.newValue || [];
        if (memoryModal && !memoryModal.classList.contains('hidden')) {
          renderMemoryList();
        }
      }
    }

    // local area：大型資料（知識庫、單字簿、sessions、總結）
    if (area === 'local') {
      if (changes.vocabulary) {
        if (vocabularyModal && !vocabularyModal.classList.contains('hidden')) {
          renderVocabularyList(changes.vocabulary.newValue || []);
        }
      }
      if (changes.knowledgeBase) {
        knowledgeBase = changes.knowledgeBase.newValue || [];
        if (knowledgeModal && !knowledgeModal.classList.contains('hidden')) {
          renderKnowledgeTagFilters();
          renderKnowledgeList();
        }
      }
      if (changes.sessionSummaries) {
        sessionSummaries = changes.sessionSummaries.newValue || {};
        if (summaryModal && !summaryModal.classList.contains('hidden')) {
          renderSummaryList();
        }
      }
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

  // 自動調整輸入框高度 + 指令選單 + 知識庫 @ palette
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    updateSendButton();
    handleCommandPaletteInput();
    handleKbPaletteInput();
  });

  // 發送 / 停止
  sendBtn.addEventListener('click', async () => {
    if (isLoading && currentPort) {
      // 停止串流：主動斷線並直接清理（自己呼叫 disconnect，onDisconnect 不會在自己這側觸發）
      const port = currentPort;
      const liveDiv = currentLiveDiv;
      const rawContent = currentRawContent;
      port.disconnect();
      // 立即清理狀態
      isLoading = false;
      currentPort = null;
      currentLiveDiv = null;
      currentRawContent = '';
      setStreamingMode(false);
      messageInput.disabled = false;
      clearStatus();
      if (rawContent) {
        const partial = rawContent.trimEnd();
        const stopThinkMatch = !translateEnabled && rawContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
        const stopThinkContent = stopThinkMatch ? stopThinkMatch[1].trim() : undefined;
        if (currentSession) currentSession.messages.push({ role: 'assistant', content: partial, ...(stopThinkContent && { thinkContent: stopThinkContent }) });
        finalizeLiveMessage(liveDiv, partial, partial, translateEnabled ? null : sourceLangSelect.value);
        await saveCurrentSession();
        await loadHistory();
      } else {
        liveDiv?.remove();
      }
      messageInput.focus();
    } else {
      handleSend();
    }
  });
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
        if (active) {
          // 從 data 屬性取得 trigger，找到對應的 cmd 物件
          const trigger = active.querySelector('.command-item-trigger')?.textContent;
          const cmd = getAllCommands().find(c => c.trigger === trigger);
          const query = messageInput.value;
          if (cmd) applyCommand(cmd, query, true); // tabComplete=true
          return;
        }
      }
    }
    // @ palette 鍵盤導航
    if (!knowledgePalette.classList.contains('hidden')) {
      const kbItems = knowledgePalette.querySelectorAll('.kb-palette-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        kbPaletteIndex = Math.min(kbPaletteIndex + 1, kbItems.length - 1);
        renderKbPaletteActive(kbItems); return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        kbPaletteIndex = Math.max(kbPaletteIndex - 1, 0);
        renderKbPaletteActive(kbItems); return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const active = knowledgePalette.querySelector('.kb-palette-item.active') || kbItems[0];
        if (active) { e.preventDefault(); active.click(); return; }
      }
      if (e.key === 'Escape') { hideKbPalette(); return; }
    }
    // 輸入歷史：方向鍵 Up/Down 瀏覽
    if (e.key === 'ArrowUp' && inputHistory.length > 0) {
      // 只在游標位於第一行時觸發（單行或多行首行）
      const cursorPos = messageInput.selectionStart;
      const textBefore = messageInput.value.slice(0, cursorPos);
      if (!textBefore.includes('\n')) {
        e.preventDefault();
        if (inputHistoryIndex === -1) {
          inputHistorySaved = messageInput.value;
          inputHistoryIndex = inputHistory.length - 1;
        } else if (inputHistoryIndex > 0) {
          inputHistoryIndex--;
        }
        messageInput.value = inputHistory[inputHistoryIndex];
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        updateSendButton();
        return;
      }
    }
    if (e.key === 'ArrowDown' && inputHistoryIndex !== -1) {
      const cursorPos = messageInput.selectionStart;
      const textAfter = messageInput.value.slice(cursorPos);
      if (!textAfter.includes('\n')) {
        e.preventDefault();
        if (inputHistoryIndex < inputHistory.length - 1) {
          inputHistoryIndex++;
          messageInput.value = inputHistory[inputHistoryIndex];
        } else {
          messageInput.value = inputHistorySaved;
          inputHistoryIndex = -1;
        }
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        updateSendButton();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
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

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      messageInput.value = btn.dataset.prompt;
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
      updateSendButton();
      messageInput.focus();
    });
  });

  // Memory Modal
  openMemoryBtn.addEventListener('click', openMemoryModal);
  memoryModalClose.addEventListener('click', closeMemoryModal);
  memoryModalOverlay.addEventListener('click', closeMemoryModal);

  // Vocabulary Modal
  openVocabularyBtn.addEventListener('click', openVocabularyModal);
  vocabularyModalClose.addEventListener('click', closeVocabularyModal);
  vocabularyModalOverlay.addEventListener('click', closeVocabularyModal);
  memoryClearAllBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有長期記憶？')) {
      memories = [];
      await saveMemories();
      renderMemoryList();
    }
  });

  vocabularyClearAllBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有單字簿內容？')) {
      await chrome.storage.local.set({ vocabulary: [] });
      renderVocabularyList([]);
    }
  });

  // Knowledge Modal
  openKnowledgeBtn.addEventListener('click', openKnowledgeModal);
  knowledgeModalClose.addEventListener('click', closeKnowledgeModal);
  knowledgeModalOverlay.addEventListener('click', closeKnowledgeModal);
  knowledgeClearAllBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有知識庫內容？')) {
      knowledgeBase = [];
      await chrome.storage.local.set({ knowledgeBase: [] });
      renderKnowledgeList();
    }
  });

  // Summary Toolbar
  summarizeBtn.addEventListener('click', handleSummarize);
  manageSummaryBtn.addEventListener('click', openSummaryModal);
  summaryModalClose.addEventListener('click', closeSummaryModal);
  summaryModalOverlay.addEventListener('click', closeSummaryModal);

  // 點擊其他地方關閉 @ palette
  document.addEventListener('click', (e) => {
    if (!knowledgePalette.contains(e.target) && e.target !== messageInput) {
      hideKbPalette();
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
      const dataUrl = await captureTab();
      addImageData(dataUrl, 'screenshot');
    } catch (error) {
      console.error('截圖失敗:', error);
      setStatus('截圖失敗：' + error.message, true, 4000);
    }
  });

  // ── 區域截圖 ──────────────────────────────────────────
  regionScreenshotBtn.addEventListener('click', async () => {
    try {
      const dataUrl = await captureTab();
      fullScreenshotData = dataUrl;
      openRegionModal(dataUrl);
    } catch (error) {
      console.error('截圖失敗:', error);
      setStatus('截圖失敗：' + error.message, true, 4000);
    }
  });

  // ── 上傳圖片 ──────────────────────────────────────────
  uploadBtn.addEventListener('click', () => {
    imageInput.click();
  });

  imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const fileType = getFileType(file.type);
      const reader = new FileReader();
      reader.onload = (event) => addImageData(event.target.result, 'upload', file.name, fileType);
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
      const dataUrl = await captureTab();
      addImageData(dataUrl, 'ocr');
    } catch (error) {
      setStatus('截圖失敗：' + error.message, true, 4000);
    }
  });

  // OCR picker：區域截圖
  document.getElementById('ocrRegionOpt').addEventListener('click', async () => {
    ocrPicker.classList.add('hidden');
    try {
      const dataUrl = await captureTab();
      fullScreenshotData = dataUrl;
      pendingRegionMode = 'ocr';
      openRegionModal(dataUrl);
    } catch (error) {
      setStatus('截圖失敗：' + error.message, true, 4000);
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
    if (chatMessages.children.length === 0) return; // 空對話不插入
    const divider = document.createElement('div');
    divider.className = 'mode-divider';
    divider.textContent = translateEnabled ? '啟動翻譯模式' : '關閉翻譯模式';
    chatMessages.appendChild(divider);
    divider.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
  function addImageData(dataUrl, mode, fileName = null, fileType = 'image') {
    currentImages.push({ dataUrl, mode, fileName, fileType });
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
    const modeLabels = { screenshot: '全頁截圖', region: '區域截圖', upload: '上傳', ocr: 'OCR' };
    const removeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    imageThumbs.innerHTML = '';
    currentImages.forEach((file, idx) => {
      const item = document.createElement('div');
      item.className = 'thumb-item';
      const isImage = file.fileType === 'image' || !file.fileType;
      const previewHtml = isImage
        ? `<img src="${file.dataUrl}" class="thumb-img" alt="">`
        : `<div class="thumb-file-icon">${file.fileType === 'pdf' ? FILE_SVG_PDF : FILE_SVG_DOC}</div>`;
      const labelText = file.fileName
        ? (file.fileName.length > 12 ? file.fileName.slice(0, 10) + '…' : file.fileName)
        : (modeLabels[file.mode] || file.mode);
      item.innerHTML = `
        ${previewHtml}
        <button class="btn-thumb-remove" title="移除">${removeSvg}</button>
        <span class="thumb-label">${labelText}</span>
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
    const hasContent = messageInput.value.trim() || currentImages.length > 0 || pageContext;
    sendBtn.disabled = !hasContent && !isLoading;
  }

  function setStreamingMode(streaming) {
    if (streaming) {
      sendBtn.disabled = false;
      sendBtn.title = '停止生成';
      sendIcon.style.display = 'none';
      stopIcon.style.display = '';
    } else {
      sendBtn.title = '送出';
      sendIcon.style.display = '';
      stopIcon.style.display = 'none';
      updateSendButton();
    }
  }

  async function checkApiKey() {
    const { apiKey, geminiApiKey } = await chrome.storage.sync.get(['apiKey', 'geminiApiKey']);

    if (!apiKey) {
      setStatus('請先設定 MiniMax API Key', true);
      messageInput.disabled = true;
      sendBtn.disabled = true;
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
      regionScreenshotBtn.disabled = true;
      ocrBtn.disabled = true;
    } else {
      clearStatus();
      messageInput.disabled = false;
    }

    if (!geminiApiKey) {
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
      regionScreenshotBtn.disabled = true;
      ocrBtn.disabled = true;
      if (currentImages.length > 0) {
        setStatus('請先設定 Gemini API Key 才能分析圖片', true);
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
        const fileInfos = msg.fileInfos || null;
        const fileObjs = imgs.map((url, i) => ({
          dataUrl: url,
          fileType: fileInfos?.[i]?.fileType || 'image',
          fileName: fileInfos?.[i]?.fileName || null
        }));
        addMessageWithImages(msg.content, msg.role, fileObjs, ttsLang);
      } else {
        addMessage(msg.content, msg.role, ttsLang, msg.thinkContent || '');
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
    if (isLoading) return; // 串流中不重複送出
    const message = messageInput.value.trim();
    if (!message && !currentImages.length && !pageContext) return;

    // 存入輸入歷史（去重、上限 10 則）
    if (message) {
      inputHistory = inputHistory.filter(h => h !== message);
      inputHistory.push(message);
      if (inputHistory.length > 10) inputHistory.shift();
    }
    inputHistoryIndex = -1;
    inputHistorySaved = '';

    // 指令路由：若訊息以已知指令開頭，交給 executeAction 處理
    if (message.startsWith('/')) {
      const allCmds = getAllCommands();
      const matchedCmd = allCmds.find(c => message === c.trigger || message.startsWith(c.trigger + ' '));
      if (matchedCmd) {
        const args = message.slice(matchedCmd.trigger.length).trim();
        messageInput.value = '';
        messageInput.style.height = 'auto';
        updateSendButton();
        executeAction(matchedCmd.trigger, args);
        return;
      }
    }

    if (!currentSession) {
      startNewSession();
    }

    isLoading = true;
    messageInput.disabled = true;
    typingIndicator.classList.remove('hidden');
    emptyState.classList.add('hidden');
    clearStatus();

    // 若有頁面內容，包裝 user message（先擷取標題供顯示用）
    const pageTitle = pageContext?.title;
    const isPageOnly = !message && !!pageContext;
    const knowledgePrefix = buildKnowledgeBlock();
    const finalMessage = knowledgePrefix + buildPageContextMessage(message);
    // 清除已選知識庫 chips
    selectedKnowledge = [];
    renderKnowledgeChips();

    // 顯示訊息：純 /page 無附帶文字時，顯示頁面標題
    const displayMessage = isPageOnly
      ? `📄 ${pageTitle?.slice(0, 40) || '讀取頁面'}`
      : message;

    const userMessage = { role: 'user', content: displayMessage };
    const snapshotImages = [...currentImages]; // 快照，避免 clearImageData 後遺失
    if (snapshotImages.length > 0) {
      userMessage.images = snapshotImages.map(i => i.dataUrl); // backward compat
      userMessage.fileInfos = snapshotImages.map(i => ({ fileType: i.fileType || 'image', fileName: i.fileName || null }));
    }

    currentSession.messages.push(userMessage);
    addMessageWithImages(displayMessage, 'user', snapshotImages);

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

    const historyForApi = currentSession.messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
      images: m.images || (m.image ? [m.image] : null)
    }));

    const activeMode = replyModes.find(m => m.id === currentReplyModeId);
    const systemPrompt = activeMode?.prompt || '';
    const memoryContext = buildMemoryBlock();
    const replyLang = translateEnabled ? null : sourceLangSelect.value;

    // ── 自動搜尋（有 Search API Key 且純文字訊息時觸發）──────
    let augmentedMessage = textMessage;
    if (message && !snapshotImages.length && !translateEnabled) {
      const { braveApiKey, exaApiKey } = await chrome.storage.sync.get(['braveApiKey', 'exaApiKey']);
      if (braveApiKey || exaApiKey) {
        setStatus('🔍 分析問題...');
        const autoResult = await chrome.runtime.sendMessage({ type: 'AUTO_SEARCH', data: { message } });
        if (autoResult.needed && autoResult.results?.length) {
          const snippets = autoResult.results.map((r, i) =>
            `[${i + 1}] ${r.title}\n${r.snippet}\n來源：${r.url}`
          ).join('\n\n');
          augmentedMessage = `【自動網路搜尋：${autoResult.query}（${autoResult.provider}）】\n${snippets}\n\n---\n${textMessage}`;
          const queryLabel = autoResult.rawQuery && autoResult.rawQuery !== autoResult.query
            ? `${autoResult.rawQuery} → ${autoResult.query}`
            : autoResult.query;
          setStatus(`🔍 已搜尋：${queryLabel}`, false, 4000);
        } else {
          clearStatus();
        }
      }
    }

    // 建立即時串流訊息 div
    typingIndicator.classList.add('hidden');
    const liveDiv = createLiveMessageDiv();
    currentLiveDiv = liveDiv;
    currentRawContent = '';

    const port = chrome.runtime.connect({ name: 'chat-stream' });
    currentPort = port;
    setStreamingMode(true);
    let rawContent = '';

    function resetLoading() {
      isLoading = false;
      currentPort = null;
      currentLiveDiv = null;
      currentRawContent = '';
      setStreamingMode(false);
      messageInput.disabled = false;
      messageInput.focus();
    }

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'status') {
        setStatus(msg.text);
        return;
      }
      if (msg.type === 'chunk') {
        rawContent = msg.full;
        currentRawContent = rawContent;
        updateLiveMessageContent(liveDiv, rawContent);
        scrollToBottom();
        return;
      }
      if (msg.type === 'done') {
        const reply = msg.reply;
        const doneThinkMatch = !translateEnabled && rawContent.match(/<think>([\s\S]*?)<\/think>/i);
        const thinkContent = doneThinkMatch ? doneThinkMatch[1].trim() : undefined;
        currentSession.messages.push({ role: 'assistant', content: reply, ...(thinkContent && { thinkContent }) });
        finalizeLiveMessage(liveDiv, rawContent, reply, replyLang);
        clearStatus();
        port.disconnect();
        resetLoading();
        await saveCurrentSession();
        await loadHistory();
        const { autoMemoryEnabled } = await chrome.storage.sync.get(['autoMemoryEnabled']);
        if (autoMemoryEnabled && message && reply) {
          chrome.runtime.sendMessage({
            type: 'EXTRACT_MEMORY',
            data: { userMessage: message, aiReply: reply }
          }).then(async (res) => {
            if (res.success && res.items.length > 0) {
              for (const text of res.items) await addMemory(text, 'auto');
            }
          }).catch(() => {});
        }
        return;
      }
      if (msg.type === 'error') {
        liveDiv.remove();
        addMessage(`錯誤: ${msg.message}`, 'error');
        clearStatus();
        port.disconnect();
        resetLoading();
      }
    });

    port.onDisconnect.addListener(async () => {
      // 僅處理非主動停止的意外斷線（主動停止已在 click handler 清理完畢）
      if (!isLoading) return;
      clearStatus();
      liveDiv.remove();
      const errMsg = chrome.runtime.lastError?.message;
      if (errMsg) addMessage(`錯誤: ${errMsg}`, 'error');
      resetLoading();
    });

    port.postMessage({
      type: 'STREAM_MESSAGE',
      data: {
        message: augmentedMessage,
        history: historyForApi,
        images: snapshotImages,
        translateConfig,
        model: currentModel,
        systemPrompt,
        memoryContext
      }
    });
  }

  function createLiveMessageDiv() {
    const div = document.createElement('div');
    div.className = 'message message-assistant message-live';
    div.innerHTML = `
      <div class="message-content">
        <div class="think-box hidden">
          <button class="think-toggle-btn" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="think-chevron"><polyline points="6 9 12 15 18 9"/></svg>
            思考過程
          </button>
          <div class="think-body"></div>
        </div>
        <div class="reply-live"><span class="cursor-blink">▋</span></div>
      </div>`;
    div.querySelector('.think-toggle-btn')?.addEventListener('click', () => {
      const thinkBody = div.querySelector('.think-body');
      const chevron = div.querySelector('.think-chevron');
      const closing = !thinkBody.classList.toggle('hidden');
      if (chevron) chevron.style.transform = closing ? '' : 'rotate(-90deg)';
    });
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function updateLiveMessageContent(div, raw) {
    const thinkBox = div.querySelector('.think-box');
    const thinkBody = div.querySelector('.think-body');
    const replyLive = div.querySelector('.reply-live');
    if (!replyLive) return;

    const thinkMatch = !translateEnabled && raw.match(/<think>([\s\S]*?)(<\/think>|$)/i);
    if (thinkMatch) {
      thinkBox.classList.remove('hidden');
      thinkBody.textContent = thinkMatch[1];
      thinkBody.scrollTop = thinkBody.scrollHeight;
      const afterThink = thinkMatch[2] === '</think>'
        ? raw.slice(raw.indexOf('</think>') + 8) : '';
      const replyText = afterThink.replace(/<result>|<\/result>/gi, '').trim();
      replyLive.innerHTML = replyText
        ? escapeHtml(replyText).replace(/\n/g, '<br>') + '<span class="cursor-blink">▋</span>'
        : '<span class="cursor-blink">▋</span>';
    } else {
      const replyText = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*/gi, '')
        .replace(/<result>|<\/result>/gi, '').trim();
      replyLive.innerHTML = replyText
        ? escapeHtml(replyText).replace(/\n/g, '<br>') + '<span class="cursor-blink">▋</span>'
        : '<span class="cursor-blink">▋</span>';
    }
  }

  function finalizeLiveMessage(div, raw, cleanReply, lang) {
    const replyLive = div.querySelector('.reply-live');
    if (replyLive) {
      replyLive.className = '';
      replyLive.innerHTML = renderMarkdown(cleanReply);
    }
    // 翻譯模式下強制隱藏思考過程區塊
    if (translateEnabled) {
      div.querySelector('.think-box')?.classList.add('hidden');
    }
    const actionsHtml = buildMessageActions(cleanReply, resolveTTSLang('assistant', lang, cleanReply), 'assistant');
    div.querySelector('.message-content').insertAdjacentHTML('afterend', actionsHtml);
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    div.querySelector('.btn-copy')?.addEventListener('click', handleCopy);
    div.classList.remove('message-live');
    scrollToBottom();
  }

  // ── 狀態通知（顯示於聊天區底部）──────────────────────
  function setStatus(text, isError = false, duration = 0) {
    if (statusNoticeEl) { statusNoticeEl.remove(); statusNoticeEl = null; }
    if (!text) return;
    statusNoticeEl = document.createElement('div');
    statusNoticeEl.className = 'status-notice' + (isError ? ' error' : '');
    statusNoticeEl.textContent = text;
    chatMessages.appendChild(statusNoticeEl);
    scrollToBottom();
    if (duration > 0) setTimeout(() => { if (statusNoticeEl) { statusNoticeEl.remove(); statusNoticeEl = null; } }, duration);
  }
  function clearStatus() { setStatus(''); }

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
  // ttsLang：明確指定語言；翻譯模式用內容偵測，一般模式用 source/target 設定
  function resolveTTSLang(role, ttsLang, content) {
    if (ttsLang) return ttsLang;
    if (translateEnabled && content) return detectLang(content);
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

  function addMessage(content, role, ttsLang, thinkContent = '') {
    const lang = resolveTTSLang(role, ttsLang, content);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : role === 'error' ? 'error' : 'assistant'}`;
    const contentHtml = (role === 'assistant')
      ? renderMarkdown(content)
      : escapeHtml(content).replace(/\n/g, '<br>');
    const thinkHtml = (role === 'assistant' && thinkContent) ? `
      <div class="think-box">
        <button class="think-toggle-btn" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="think-chevron"><polyline points="6 9 12 15 18 9"/></svg>
          思考過程
        </button>
        <div class="think-body hidden">${escapeHtml(thinkContent)}</div>
      </div>` : '';
    div.innerHTML = `
      <div class="message-content">${thinkHtml}${contentHtml}</div>
      ${buildMessageActions(content, lang, role)}
    `;
    div.querySelector('.think-toggle-btn')?.addEventListener('click', () => {
      const thinkBodyEl = div.querySelector('.think-body');
      const chevron = div.querySelector('.think-chevron');
      const closing = !thinkBodyEl.classList.toggle('hidden');
      if (chevron) chevron.style.transform = closing ? '' : 'rotate(-90deg)';
    });
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    div.querySelector('.btn-copy')?.addEventListener('click', handleCopy);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addMessageWithImages(content, role, files, ttsLang) {
    const lang = resolveTTSLang(role, ttsLang, content);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
    let html = `<div class="message-content">`;
    if (files && files.length > 0) {
      html += `<div class="message-images">`;
      files.forEach(f => {
        const url = typeof f === 'string' ? f : f.dataUrl;
        const fileType = typeof f === 'string' ? 'image' : (f.fileType || 'image');
        const fileName = typeof f === 'string' ? null : f.fileName;
        if (fileType === 'image') {
          html += `<img src="${url}" class="message-image" alt="圖片" title="點擊放大">`;
        } else {
          const icon = fileType === 'pdf' ? FILE_SVG_PDF : FILE_SVG_DOC;
          html += `<div class="message-file">${icon}<span class="message-file-name">${escapeHtml(fileName || '檔案')}</span></div>`;
        }
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
  // 共用 AudioContext（避免每次重建造成硬體初始化延遲）
  let sharedAudioCtx = null;

  function getAudioCtx() {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContext();
    }
    return sharedAudioCtx;
  }

  function stopCurrentAudio() {
    // Web Audio API 停止（不 close context，保持暖機狀態）
    if (currentAudioSrc) {
      try { currentAudioSrc.stop(); } catch (e) {}
      currentAudioSrc = null;
    }
    currentAudioCtx = null;
    // HTML Audio fallback 停止
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

  function base64ToArrayBuffer(base64) {
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    return byteArray.buffer;
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

      // 取得共用 AudioContext 並確保已在 running 狀態
      const audioCtx = getAudioCtx();
      currentAudioCtx = audioCtx;
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      // 完整解碼 MP3 → PCM buffer，start(0) 無啟動延遲
      const arrayBuffer = base64ToArrayBuffer(response.base64);
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      if (currentTTSBtn !== btn) return;

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      currentAudioSrc = source;

      source.onended = () => { if (currentTTSBtn === btn) stopCurrentAudio(); };
      source.start(0);
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
    { trigger: '/page',     name: '讀取當前頁面', type: 'action', icon: '📄' },
    { trigger: '/clear',    name: '清空對話',    type: 'action', icon: '🗑️' },
    { trigger: '/new',      name: '新對話',      type: 'action', icon: '➕' },
    { trigger: '/remember', name: '記住某件事',  type: 'action', icon: '🧠', argHint: '/remember <內容>' },
    { trigger: '/search',      name: '一般搜尋（Brave）', type: 'action', icon: '🔍', argHint: '/search <關鍵字>' },
    { trigger: '/deep-search', name: '深度搜尋（Exa）',   type: 'action', icon: '🔎', argHint: '/deep-search <關鍵字>' },
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

  function applyCommand(cmd, inputVal, tabComplete = false) {
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

    // 有 argHint 的指令（/search、/remember）：Tab 只補全 trigger，讓使用者繼續輸入參數
    if (tabComplete && cmd.argHint) {
      messageInput.value = cmd.trigger + ' ';
      messageInput.style.height = 'auto';
      updateSendButton();
      messageInput.focus();
      return;
    }

    // action 類型：直接執行
    messageInput.value = '';
    updateSendButton();
    executeAction(cmd.trigger, args);
  }

  function executeAction(trigger, args) {
    switch (trigger) {
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
          setStatus('用法：/remember <要記住的內容>', false, 3000);
        }
        break;
      case '/search':
        if (args) {
          handleWebSearch(args, 'WEB_SEARCH');
        } else {
          setStatus('用法：/search <關鍵字>', false, 3000);
        }
        break;
      case '/deep-search':
        if (args) {
          handleWebSearch(args, 'DEEP_SEARCH');
        } else {
          setStatus('用法：/deep-search <關鍵字>', false, 3000);
        }
        break;
      default:
        break;
    }
    messageInput.focus();
  }

  async function handleWebSearch(query, searchType = 'WEB_SEARCH') {
    const isDeep = searchType === 'DEEP_SEARCH';
    const label = isDeep ? '深度搜尋' : '搜尋';
    const icon = isDeep ? '🔎' : '🔍';
    if (!currentSession) startNewSession();
    isLoading = true;
    setStreamingMode(true);
    messageInput.disabled = true;
    typingIndicator.classList.add('hidden');
    emptyState.classList.add('hidden');
    setStatus(`${label}中：${query}`);

    const userMsg = { role: 'user', content: `${icon} /${isDeep ? 'deep-search' : 'search'} ${query}` };
    currentSession.messages.push(userMsg);
    addMessage(`${icon} ${label}：${query}`, 'user');

    const result = await chrome.runtime.sendMessage({ type: searchType, data: { query } });

    if (!result.success) {
      currentSession.messages.pop();
      chatMessages.lastElementChild?.remove();
      isLoading = false;
      setStreamingMode(false);
      messageInput.disabled = false;
      updateSendButton();
      if (result.error === 'NO_KEY') {
        setStatus(`請先至設定頁填入 ${isDeep ? 'Exa' : 'Brave'} Search API Key`, true, 4000);
      } else {
        setStatus(`🔍 ${result.error}`, true, 5000);
      }
      messageInput.focus();
      return;
    }

    // 組成 context 交給 AI 分析
    setStatus(`🔍 ${result.provider} 找到 ${result.results.length} 筆結果，分析中...`);
    const snippets = result.results.map((r, i) =>
      `[${i + 1}] ${r.title}\n${r.snippet}\n來源：${r.url}`
    ).join('\n\n');

    const searchContext = `以下是針對「${query}」的網路搜尋結果，請根據這些資料回答問題：\n\n${snippets}\n\n請綜合以上資料，提供準確、有條理的回覆，並標注資料來源編號。`;

    clearStatus();
    const liveDiv = createLiveMessageDiv();
    const port = chrome.runtime.connect({ name: 'chat-stream' });
    currentPort = port;
    let rawContent = '';

    const replyLang = translateEnabled ? null : sourceLangSelect.value;
    const activeMode = replyModes.find(m => m.id === currentReplyModeId);
    const systemPrompt = activeMode?.prompt || '';
    const memoryContext = buildMemoryBlock();

    function resetWebSearch() {
      isLoading = false;
      currentPort = null;
      setStreamingMode(false);
      messageInput.disabled = false;
      messageInput.focus();
    }

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'chunk') {
        rawContent = msg.full;
        updateLiveMessageContent(liveDiv, rawContent);
        scrollToBottom();
        return;
      }
      if (msg.type === 'done') {
        const reply = msg.reply;
        const doneThinkMatch2 = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
        const thinkContent2 = doneThinkMatch2 ? doneThinkMatch2[1].trim() : undefined;
        currentSession.messages.push({ role: 'assistant', content: reply, ...(thinkContent2 && { thinkContent: thinkContent2 }) });
        finalizeLiveMessage(liveDiv, rawContent, reply, replyLang);
        port.disconnect();
        resetWebSearch();
        await saveCurrentSession();
        await loadHistory();
        return;
      }
      if (msg.type === 'error') {
        liveDiv.remove();
        addMessage(`錯誤：${msg.message}`, 'error');
        port.disconnect();
        resetWebSearch();
      }
    });

    port.onDisconnect.addListener(async () => {
      if (!isLoading) return;
      if (rawContent) {
        const partial = rawContent.trimEnd();
        currentSession.messages.push({ role: 'assistant', content: partial });
        finalizeLiveMessage(liveDiv, partial, partial, replyLang);
        await saveCurrentSession();
        await loadHistory();
      } else {
        liveDiv.remove();
      }
      resetWebSearch();
    });

    port.postMessage({
      type: 'STREAM_MESSAGE',
      data: {
        message: searchContext,
        history: currentSession.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        images: [],
        translateConfig: null,
        model: currentModel,
        systemPrompt,
        memoryContext
      }
    });
  }

  // ── Memory ──────────────────────────────────────────────

  async function loadMemories() {
    const syncResult = await chrome.storage.sync.get(['memories']);
    if (syncResult.memories !== undefined) {
      memories = syncResult.memories;
    } else {
      // 一次性遷移：從 local 搬到 sync
      const localResult = await chrome.storage.local.get(['memories']);
      memories = (localResult.memories || []).slice(-30);
      if (memories.length > 0) {
        await chrome.storage.sync.set({ memories });
        await chrome.storage.local.remove(['memories']);
      }
    }
  }

  async function saveMemories() {
    await chrome.storage.sync.set({ memories });
  }

  async function migrateCategoriesIfNeeded() {
    const syncResult = await chrome.storage.sync.get(['categories']);
    if (syncResult.categories !== undefined) return; // 已在 sync，不需遷移
    const localResult = await chrome.storage.local.get(['categories']);
    if (localResult.categories) {
      await chrome.storage.sync.set({ categories: localResult.categories });
      await chrome.storage.local.remove(['categories']);
    }
  }

  async function addMemory(text, source) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // 去重
    if (memories.some(m => m.text === trimmed)) {
      setStatus('此記憶已存在', false, 2000);
      return;
    }
    memories.push({ id: `mem_${Date.now()}`, text: trimmed, source, createdAt: Date.now() });
    // 上限 30 筆（sync 容量限制）
    if (memories.length > 30) memories.shift();
    await saveMemories();
    setStatus(`✓ 已記住：${trimmed.slice(0, 30)}${trimmed.length > 30 ? '...' : ''}`, false, 3000);
  }

  async function openMemoryModal() {
    memoryModal.classList.remove('hidden');
    await populateCategoryFilter('memory', memoryCategoryFilterEl);
    renderMemoryList();
  }

  function closeMemoryModal() {
    memoryModal.classList.add('hidden');
    memoryCatManager.classList.add('hidden');
    manageMemoryCatBtn.classList.remove('active');
  }

  function formatItemDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  }

  async function renderMemoryList() {
    const _v = ++_renderMemoryVer;
    const cats = await getCategories('memory');
    if (_v !== _renderMemoryVer) return; // 已有更新的 render，捨棄本次
    memoryList.innerHTML = '';
    const filtered = memoryCategoryFilter
      ? memories.filter(m => m.category === memoryCategoryFilter)
      : memories;
    if (filtered.length === 0) {
      memoryList.innerHTML = memoryCategoryFilter
        ? '<p class="memory-empty">此分類沒有記憶。</p>'
        : '<p class="memory-empty">尚無長期記憶。<br>使用 /remember 內容 來新增。</p>';
      return;
    }
    filtered.slice().reverse().forEach(mem => {
      const div = document.createElement('div');
      div.className = 'memory-item';
      const badgeLabel = { manual: '手動', auto: '自動', 'context-menu': '右鍵', summary: '總結' }[mem.source] || mem.source;
      const catOptions = `<option value="">${cats.length ? '無分類' : '新增分類後使用'}</option>`
        + cats.map(c => `<option value="${escapeAttr(c)}" ${mem.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      div.innerHTML = `
        <span class="memory-item-badge ${mem.source}">${badgeLabel}</span>
        <span class="memory-item-text editable" title="點擊編輯">${escapeHtml(mem.text)}</span>
        <span class="memory-item-date">${formatItemDate(mem.createdAt)}</span>
        <select class="item-cat-select ${mem.category ? 'has-value' : ''}" title="分類">${catOptions}</select>
        <button class="btn-memory-delete" title="刪除">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      `;
      // 分類選擇
      div.querySelector('.item-cat-select').addEventListener('change', async e => {
        const idx = memories.findIndex(m => m.id === mem.id);
        if (idx !== -1) {
          memories[idx].category = e.target.value;
          await saveMemories();
          e.target.classList.toggle('has-value', !!e.target.value);
        }
      });
      // 點擊文字進入編輯模式（textarea）
      const textSpan = div.querySelector('.memory-item-text');
      textSpan.addEventListener('click', () => {
        const ta = document.createElement('textarea');
        ta.className = 'memory-item-textarea';
        ta.value = mem.text;
        ta.rows = Math.max(2, Math.ceil(mem.text.length / 40));
        textSpan.replaceWith(ta);
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        const save = async () => {
          const newText = ta.value.trim();
          if (newText && newText !== mem.text) {
            const idx = memories.findIndex(m => m.id === mem.id);
            if (idx !== -1) { memories[idx].text = newText; await saveMemories(); }
          }
          renderMemoryList();
        };
        ta.addEventListener('blur', save);
        ta.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.blur(); }
          if (e.key === 'Escape') { renderMemoryList(); }
        });
      });
      div.querySelector('.btn-memory-delete').addEventListener('click', async () => {
        memories = memories.filter(m => m.id !== mem.id);
        await saveMemories();
        renderMemoryList();
      });
      memoryList.appendChild(div);
    });
  }

  // ── Category Management Helpers ──────────────────────────

  async function getCategories(type) {
    const { categories = {} } = await chrome.storage.sync.get(['categories']);
    return Array.isArray(categories[type]) ? categories[type] : [];
  }

  async function saveCategories(type, list) {
    const { categories = {} } = await chrome.storage.sync.get(['categories']);
    categories[type] = list;
    await chrome.storage.sync.set({ categories });
  }

  async function populateCategoryFilter(type, selectEl) {
    const cats = await getCategories(type);
    const current = selectEl.value;
    selectEl.innerHTML = '<option value="">全部分類</option>';
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === current) opt.selected = true;
      selectEl.appendChild(opt);
    });
    // 若目前篩選值已不存在則重置
    if (current && !cats.includes(current)) {
      selectEl.value = '';
      if (type === 'memory') memoryCategoryFilter = '';
      else vocabularyCategoryFilter = '';
    }
  }

  async function renderCategoryManager(type, listEl) {
    const cats = await getCategories(type);
    listEl.innerHTML = '';
    if (cats.length === 0) {
      listEl.innerHTML = '<span class="cat-empty-hint">尚無分類，請在上方輸入並新增。</span>';
      return;
    }
    cats.forEach(cat => {
      const tag = document.createElement('span');
      tag.className = 'cat-tag';
      tag.innerHTML = `${escapeHtml(cat)}<button class="btn-cat-delete" title="刪除分類">×</button>`;
      tag.querySelector('.btn-cat-delete').addEventListener('click', async () => {
        const updated = cats.filter(c => c !== cat);
        await saveCategories(type, updated);
        // 清除條目中此分類的指派
        if (type === 'memory') {
          memories.forEach(m => { if (m.category === cat) m.category = ''; });
          await saveMemories();
          if (memoryCategoryFilter === cat) { memoryCategoryFilter = ''; memoryCategoryFilterEl.value = ''; }
          await populateCategoryFilter('memory', memoryCategoryFilterEl);
          renderMemoryList();
        } else if (type === 'vocabulary') {
          const { vocabulary: vocab = [] } = await chrome.storage.local.get(['vocabulary']);
          vocab.forEach(v => { if (v.category === cat) v.category = ''; });
          await chrome.storage.local.set({ vocabulary: vocab });
          if (vocabularyCategoryFilter === cat) { vocabularyCategoryFilter = ''; vocabularyCategoryFilterEl.value = ''; }
          await populateCategoryFilter('vocabulary', vocabularyCategoryFilterEl);
          const { vocabulary: latest = [] } = await chrome.storage.local.get(['vocabulary']);
          renderVocabularyList(latest);
        } else if (type === 'knowledge') {
          knowledgeBase.forEach(k => { if (k.category === cat) k.category = ''; });
          await chrome.storage.local.set({ knowledgeBase });
          if (knowledgeCategoryFilter === cat) { knowledgeCategoryFilter = ''; knowledgeCategoryFilterEl.value = ''; }
          await populateCategoryFilter('knowledge', knowledgeCategoryFilterEl);
          renderKnowledgeList();
        }
        await renderCategoryManager(type, listEl);
      });
      listEl.appendChild(tag);
    });
  }

  // 分類篩選事件
  memoryCategoryFilterEl.addEventListener('change', e => {
    memoryCategoryFilter = e.target.value;
    renderMemoryList();
  });
  vocabularyCategoryFilterEl.addEventListener('change', async e => {
    vocabularyCategoryFilter = e.target.value;
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    renderVocabularyList(vocabulary);
  });

  // 管理分類 toggle
  manageMemoryCatBtn.addEventListener('click', async () => {
    const hidden = memoryCatManager.classList.contains('hidden');
    memoryCatManager.classList.toggle('hidden');
    manageMemoryCatBtn.classList.toggle('active', hidden);
    if (hidden) await renderCategoryManager('memory', memoryCatList);
  });
  manageVocabularyCatBtn.addEventListener('click', async () => {
    const hidden = vocabularyCatManager.classList.contains('hidden');
    vocabularyCatManager.classList.toggle('hidden');
    manageVocabularyCatBtn.classList.toggle('active', hidden);
    if (hidden) await renderCategoryManager('vocabulary', vocabularyCatList);
  });

  // 新增分類
  async function handleAddCategory(type, inputEl, listEl, filterEl) {
    const name = inputEl.value.trim();
    if (!name) return;
    const cats = await getCategories(type);
    if (cats.includes(name)) { inputEl.value = ''; return; }
    cats.push(name);
    await saveCategories(type, cats);
    inputEl.value = '';
    await renderCategoryManager(type, listEl);
    await populateCategoryFilter(type, filterEl);
    if (type === 'memory') renderMemoryList();
    else if (type === 'vocabulary') { const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']); renderVocabularyList(vocabulary); }
    else if (type === 'knowledge') renderKnowledgeList();
  }

  memoryAddCatBtn.addEventListener('click', () =>
    handleAddCategory('memory', memoryNewCatInput, memoryCatList, memoryCategoryFilterEl));
  memoryNewCatInput.addEventListener('keydown', e => { if (e.key === 'Enter') memoryAddCatBtn.click(); });

  vocabularyAddCatBtn.addEventListener('click', () =>
    handleAddCategory('vocabulary', vocabularyNewCatInput, vocabularyCatList, vocabularyCategoryFilterEl));
  vocabularyNewCatInput.addEventListener('keydown', e => { if (e.key === 'Enter') vocabularyAddCatBtn.click(); });

  // 知識庫分類
  knowledgeCategoryFilterEl.addEventListener('change', e => {
    knowledgeCategoryFilter = e.target.value;
    renderKnowledgeList();
  });
  manageKnowledgeCatBtn.addEventListener('click', async () => {
    const hidden = knowledgeCatManager.classList.contains('hidden');
    knowledgeCatManager.classList.toggle('hidden');
    manageKnowledgeCatBtn.classList.toggle('active', hidden);
    if (hidden) await renderCategoryManager('knowledge', knowledgeCatList);
  });
  knowledgeAddCatBtn.addEventListener('click', () =>
    handleAddCategory('knowledge', knowledgeNewCatInput, knowledgeCatList, knowledgeCategoryFilterEl));
  knowledgeNewCatInput.addEventListener('keydown', e => { if (e.key === 'Enter') knowledgeAddCatBtn.click(); });

  // ─────────────────────────────────────────────────────────

  // ── Knowledge Base 函式 ──────────────────────────────────

  function buildKnowledgeBlock() {
    if (selectedKnowledge.length === 0) return '';
    const blocks = selectedKnowledge.map(item => {
      const lines = [`【知識庫參考】`, `標題：${item.title}`];
      if (item.summary) lines.push(`摘要：${item.summary}`);
      if (item.tags?.length) lines.push(`標籤：${item.tags.join('、')}`);
      if (item.url && item.source === 'url') lines.push(`來源：${item.url}`);
      if (item.content) lines.push(`內容：\n${item.content.slice(0, 2000)}${item.content.length > 2000 ? '\n...（已截斷）' : ''}`);
      return lines.join('\n');
    });
    return blocks.join('\n\n') + '\n\n';
  }

  function renderKnowledgeChips() {
    knowledgeChips.innerHTML = '';
    if (selectedKnowledge.length === 0) {
      knowledgeChips.classList.add('hidden');
      return;
    }
    knowledgeChips.classList.remove('hidden');
    selectedKnowledge.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'kb-chip';
      chip.innerHTML = `<span class="kb-chip-label" title="${escapeAttr(item.title)}">@ ${escapeHtml(item.title)}</span><button class="kb-chip-remove" title="移除">×</button>`;
      chip.querySelector('.kb-chip-remove').addEventListener('click', () => {
        selectedKnowledge = selectedKnowledge.filter(k => k.id !== item.id);
        renderKnowledgeChips();
        updateSendButton();
      });
      knowledgeChips.appendChild(chip);
    });
  }

  // @ palette
  function handleKbPaletteInput() {
    const val = messageInput.value;
    const cursor = messageInput.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (!atMatch) { hideKbPalette(); return; }
    const query = atMatch[1].toLowerCase();
    const filtered = knowledgeBase.filter(kb =>
      !query ||
      kb.title.toLowerCase().includes(query) ||
      (kb.summary || '').toLowerCase().includes(query) ||
      (kb.tags || []).some(t => t.toLowerCase().includes(query))
    );
    if (knowledgeBase.length === 0) {
      showKbPaletteEmpty();
      return;
    }
    showKbPaletteItems(filtered.length > 0 ? filtered : knowledgeBase);
  }

  function showKbPaletteEmpty() {
    knowledgePalette.innerHTML = '<div class="kb-palette-empty">知識庫尚無內容<br>請先右鍵「加入知識庫」</div>';
    knowledgePalette.classList.remove('hidden');
    kbPaletteIndex = -1;
  }

  function showKbPaletteItems(items) {
    knowledgePalette.innerHTML = '';
    kbPaletteIndex = 0;
    items.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'kb-palette-item' + (idx === 0 ? ' active' : '');
      const statusLabel = item.status === 'processing' ? '分析中' : '就緒';
      const tagsHtml = (item.tags || []).slice(0, 3).map(t => `<span class="kb-palette-tag">${escapeHtml(t)}</span>`).join('');
      div.innerHTML = `
        <span class="kb-palette-status ${item.status}">${statusLabel}</span>
        <div class="kb-palette-info">
          <div class="kb-palette-title">${escapeHtml(item.title)}</div>
          ${item.summary ? `<div class="kb-palette-summary">${escapeHtml(item.summary)}</div>` : ''}
          ${tagsHtml ? `<div class="kb-palette-tags">${tagsHtml}</div>` : ''}
        </div>
      `;
      div.addEventListener('click', () => selectKbItem(item));
      knowledgePalette.appendChild(div);
    });
    knowledgePalette.classList.remove('hidden');
  }

  function renderKbPaletteActive(items) {
    items.forEach((item, idx) => item.classList.toggle('active', idx === kbPaletteIndex));
    if (kbPaletteIndex >= 0 && items[kbPaletteIndex]) {
      items[kbPaletteIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function hideKbPalette() {
    knowledgePalette.classList.add('hidden');
    knowledgePalette.innerHTML = '';
    kbPaletteIndex = -1;
  }

  function selectKbItem(item) {
    // 移除 @query 文字
    const val = messageInput.value;
    const cursor = messageInput.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (atMatch) {
      const start = cursor - atMatch[0].length;
      messageInput.value = val.slice(0, start) + val.slice(cursor);
      messageInput.setSelectionRange(start, start);
    }
    hideKbPalette();
    if (!selectedKnowledge.find(k => k.id === item.id)) {
      selectedKnowledge.push(item);
      renderKnowledgeChips();
    }
    updateSendButton();
    messageInput.focus();
  }

  // Knowledge Modal
  async function openKnowledgeModal() {
    knowledgeModal.classList.remove('hidden');
    await populateCategoryFilter('knowledge', knowledgeCategoryFilterEl);
    renderKnowledgeTagFilters();
    renderKnowledgeList();
    pollKbProcessing(); // 若有分析中項目，每 2 秒自動刷新
  }

  function closeKnowledgeModal() {
    knowledgeModal.classList.add('hidden');
    knowledgeCatManager.classList.add('hidden');
    manageKnowledgeCatBtn.classList.remove('active');
  }

  // ── Summary Toolbar ──────────────────────────────────────────
  async function handleSummarize() {
    if (isSummarizing) return;
    if (!currentSession || currentSession.messages.length === 0) {
      setStatus('目前沒有可總結的對話內容', false, 2500);
      return;
    }
    isSummarizing = true;
    summarizeBtn.disabled = true;

    const convText = currentSession.messages.map(m => {
      const role = m.role === 'user' ? '用戶' : 'AI';
      const content = typeof m.content === 'string' ? m.content : '[多媒體內容]';
      return `${role}：${content}`;
    }).join('\n\n');

    const prompt = `請為以下對話內容生成一份簡潔的繁體中文摘要，重點列出：\n1. 主要討論的主題\n2. 重要結論或決定\n3. 待辦事項（如有）\n\n---\n${convText}`;

    // 建立總結 live div（不加入 currentSession.messages，不影響對話歷史）
    const liveDiv = document.createElement('div');
    liveDiv.className = 'message message-summary message-live';
    liveDiv.innerHTML = `
      <div class="summary-badge">AI 總結</div>
      <div class="message-content">
        <div class="reply-live"><span class="cursor-blink">▋</span></div>
      </div>`;
    chatMessages.appendChild(liveDiv);
    emptyState.classList.add('hidden');
    scrollToBottom();

    const port = chrome.runtime.connect({ name: 'chat-stream' });
    let rawContent = '';

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'chunk') {
        rawContent = msg.full;
        const replyLive = liveDiv.querySelector('.reply-live');
        if (replyLive) {
          replyLive.innerHTML = escapeHtml(rawContent).replace(/\n/g, '<br>') + '<span class="cursor-blink">▋</span>';
        }
        scrollToBottom();
        return;
      }
      if (msg.type === 'done') {
        const reply = msg.reply;
        const replyLive = liveDiv.querySelector('.reply-live');
        if (replyLive) {
          replyLive.className = 'summary-result';
          replyLive.innerHTML = renderMarkdown(reply);
        }
        liveDiv.classList.remove('message-live');
        scrollToBottom();
        port.disconnect();

        // 儲存至 sessionSummaries
        const { sessionSummaries: stored = {} } = await chrome.storage.local.get(['sessionSummaries']);
        const sid = currentSession.id;
        if (!stored[sid]) stored[sid] = [];
        stored[sid].push({ id: `sum_${Date.now()}`, text: reply, createdAt: Date.now(), addedToMemory: false });
        await chrome.storage.local.set({ sessionSummaries: stored });
        sessionSummaries = stored;

        isSummarizing = false;
        summarizeBtn.disabled = false;
        setStatus('總結已儲存', false, 2000);
        return;
      }
      if (msg.type === 'error') {
        liveDiv.remove();
        setStatus(`總結失敗: ${msg.message}`, true, 3000);
        port.disconnect();
        isSummarizing = false;
        summarizeBtn.disabled = false;
      }
    });

    port.onDisconnect.addListener(() => {
      if (!isSummarizing) return;
      liveDiv.remove();
      setStatus('連線中斷，請重試', true, 3000);
      isSummarizing = false;
      summarizeBtn.disabled = false;
    });

    port.postMessage({
      type: 'STREAM_MESSAGE',
      data: {
        message: prompt,
        history: [],
        images: [],
        translateConfig: null,
        model: currentModel,
        systemPrompt: '你是一位專業的對話總結助手，請以繁體中文生成簡潔且有條理的摘要。',
        memoryContext: ''
      }
    });
  }

  function openSummaryModal() {
    summaryModal.classList.remove('hidden');
    renderSummaryList();
  }

  function closeSummaryModal() {
    summaryModal.classList.add('hidden');
  }

  // 純文字預覽（strip markdown 標記）
  function getSummaryPreview(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*{1,3}|_{1,3}|~~|`/g, '')
      .replace(/\n{2,}/g, ' ')
      .replace(/\n/g, ' ')
      .trim();
  }

  function renderSummaryList() {
    if (!summaryList) return;
    const sid = currentSession?.id;
    const items = sid ? (sessionSummaries[sid] || []).slice().reverse() : [];
    if (items.length === 0) {
      summaryList.innerHTML = '<div class="summary-empty-hint">目前沒有總結記錄。<br>點擊右側工具列的「立即總結」按鈕開始。</div>';
      return;
    }

    const CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;
    const TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;

    const actionBtns = (item) => `
      <div class="summary-item-footer">
        <button class="btn-summary-action btn-add-to-memory${item.addedToMemory ? ' disabled' : ''}" data-id="${item.id}"${item.addedToMemory ? ' disabled' : ''}>
          ${item.addedToMemory ? '✓ 已加入長期記憶' : '+ 加入長期記憶'}
        </button>
        <button class="btn-summary-action btn-add-to-kb${item.addedToKb ? ' disabled' : ''}" data-id="${item.id}"${item.addedToKb ? ' disabled' : ''}>
          ${item.addedToKb ? '✓ 已加入知識庫' : '+ 加入知識庫'}
        </button>
      </div>`;

    summaryList.innerHTML = items.map(item => `
      <div class="summary-item" data-id="${item.id}">
        <div class="summary-item-header">
          <span class="summary-item-date">${formatItemDate(item.createdAt)}</span>
          <div class="summary-item-top-actions">
            <button class="summary-expand-btn" data-id="${item.id}" title="展開/收合">${CHEVRON}</button>
            <button class="summary-item-delete" data-id="${item.id}" title="刪除">${TRASH}</button>
          </div>
        </div>
        <div class="summary-preview-text">${escapeHtml(getSummaryPreview(item.text))}</div>
        <div class="summary-full-text hidden">${renderMarkdown(item.text)}</div>
        ${actionBtns(item)}
      </div>
    `).join('');

    // 展開 / 收合
    summaryList.querySelectorAll('.summary-expand-btn, .summary-preview-text').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = el.dataset.id || el.closest('.summary-item')?.dataset.id;
        const itemEl = summaryList.querySelector(`.summary-item[data-id="${id}"]`);
        if (!itemEl) return;
        const isExpanded = itemEl.classList.toggle('expanded');
        const fullText = itemEl.querySelector('.summary-full-text');
        fullText.classList.toggle('hidden', !isExpanded);
        e.stopPropagation();
      });
    });

    // 加入長期記憶
    summaryList.querySelectorAll('.btn-add-to-memory:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const sid = currentSession?.id;
        const arr = sid ? (sessionSummaries[sid] || []) : [];
        const item = arr.find(i => i.id === id);
        if (!item) return;
        await addMemory(item.text, 'summary');
        item.addedToMemory = true;
        await chrome.storage.local.set({ sessionSummaries });
        renderSummaryList();
      });
    });

    // 加入知識庫
    summaryList.querySelectorAll('.btn-add-to-kb:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const sid = currentSession?.id;
        const arr = sid ? (sessionSummaries[sid] || []) : [];
        const item = arr.find(i => i.id === id);
        if (!item) return;
        const { knowledgeBase: kb = [] } = await chrome.storage.local.get(['knowledgeBase']);
        const dateStr = formatItemDate(item.createdAt);
        const kbEntry = {
          id: `kb_${Date.now()}`,
          title: `對話總結 - ${dateStr}`,
          url: '',
          content: item.text,
          summary: item.text,
          tags: ['總結'],
          category: '',
          source: 'summary',
          status: 'ready',
          createdAt: Date.now()
        };
        kb.push(kbEntry);
        await chrome.storage.local.set({ knowledgeBase: kb });
        knowledgeBase = kb;
        item.addedToKb = true;
        await chrome.storage.local.set({ sessionSummaries });
        renderSummaryList();
        setStatus('已加入知識庫', false, 2000);
      });
    });

    // 刪除
    summaryList.querySelectorAll('.summary-item-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const sid = currentSession?.id;
        if (!sid || !sessionSummaries[sid]) return;
        sessionSummaries[sid] = sessionSummaries[sid].filter(i => i.id !== id);
        await chrome.storage.local.set({ sessionSummaries });
        renderSummaryList();
      });
    });
  }

  // 當 Modal 開著且有 processing 項目時，輪詢 storage 更新顯示
  function pollKbProcessing() {
    if (knowledgeModal.classList.contains('hidden')) return;
    if (!knowledgeBase.some(k => k.status === 'processing')) return;
    setTimeout(async () => {
      if (knowledgeModal.classList.contains('hidden')) return;
      const { knowledgeBase: latest = [] } = await chrome.storage.local.get(['knowledgeBase']);
      const changed = latest.some(item => {
        const old = knowledgeBase.find(k => k.id === item.id);
        return !old || old.status !== item.status || old.summary !== item.summary;
      });
      if (changed) {
        knowledgeBase = latest;
        renderKnowledgeTagFilters();
        renderKnowledgeList();
      }
      pollKbProcessing(); // 繼續輪詢直到全部 ready
    }, 2000);
  }

  function renderKnowledgeTagFilters() {
    const allTags = [...new Set(knowledgeBase.flatMap(k => k.tags || []))].sort();
    if (allTags.length === 0) {
      knowledgeTagFilters.classList.add('hidden');
      knowledgeTagFilter = '';
      return;
    }
    knowledgeTagFilters.classList.remove('hidden');
    knowledgeTagFilters.innerHTML = '';
    // 「全部」chip
    const allChip = document.createElement('button');
    allChip.className = 'kb-tag-filter-chip' + (!knowledgeTagFilter ? ' active' : '');
    allChip.textContent = '全部';
    allChip.addEventListener('click', () => {
      knowledgeTagFilter = '';
      renderKnowledgeTagFilters();
      renderKnowledgeList();
    });
    knowledgeTagFilters.appendChild(allChip);
    // 各標籤
    allTags.forEach(tag => {
      const chip = document.createElement('button');
      chip.className = 'kb-tag-filter-chip' + (knowledgeTagFilter === tag ? ' active' : '');
      chip.textContent = tag;
      chip.addEventListener('click', () => {
        knowledgeTagFilter = knowledgeTagFilter === tag ? '' : tag;
        renderKnowledgeTagFilters();
        renderKnowledgeList();
      });
      knowledgeTagFilters.appendChild(chip);
    });
  }

  async function renderKnowledgeList() {
    const _v = ++_renderKbVer;
    const cats = await getCategories('knowledge');
    if (_v !== _renderKbVer) return; // 已有更新的 render，捨棄本次
    knowledgeList.innerHTML = '';
    let filtered = knowledgeCategoryFilter
      ? knowledgeBase.filter(kb => kb.category === knowledgeCategoryFilter)
      : [...knowledgeBase];
    if (knowledgeTagFilter) {
      filtered = filtered.filter(kb => (kb.tags || []).includes(knowledgeTagFilter));
    }
    if (filtered.length === 0) {
      const hasFilter = knowledgeCategoryFilter || knowledgeTagFilter;
      knowledgeList.innerHTML = hasFilter
        ? '<p class="memory-empty">此篩選條件沒有知識庫項目。</p>'
        : '<p class="memory-empty">尚無內容。<br>在任意頁面右鍵「加入知識庫」。</p>';
      return;
    }
    const catOptions = (item) =>
      `<option value="">${cats.length ? '無分類' : '新增分類後使用'}</option>`
      + cats.map(c => `<option value="${escapeAttr(c)}" ${item.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

    const LINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

    filtered.slice().reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'kb-item';
      const statusLabel = item.status === 'processing' ? '分析中' : '就緒';
      const sourceLabel = item.source === 'url' ? '網頁' : '選取';
      const tagsHtml = (item.tags || []).map(t =>
        `<span class="kb-item-tag${knowledgeTagFilter === t ? ' active' : ''}">${escapeHtml(t)}</span>`
      ).join('');
      div.innerHTML = `
        <div class="kb-item-header">
          <span class="kb-item-status ${item.status}">${statusLabel}</span>
          <span class="kb-item-source ${item.source}">${sourceLabel}</span>
          <span class="kb-item-title" title="點擊編輯">${escapeHtml(item.title)}</span>
          ${item.url ? `<button class="kb-item-link" title="${escapeAttr(item.url)}">${LINK_SVG}</button>` : ''}
          <button class="kb-item-delete" title="刪除">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="kb-item-meta">
          <span class="kb-item-date">${formatItemDate(item.createdAt)}</span>
          <select class="item-cat-select ${item.category ? 'has-value' : ''}" title="分類">${catOptions(item)}</select>
        </div>
        ${item.summary ? `<div class="kb-item-summary">${escapeHtml(item.summary)}</div>` : ''}
        ${tagsHtml ? `<div class="kb-item-tags">${tagsHtml}</div>` : ''}
      `;
      // URL 連結
      div.querySelector('.kb-item-link')?.addEventListener('click', () => {
        if (item.url) chrome.tabs.create({ url: item.url });
      });
      // 標籤點擊篩選
      div.querySelectorAll('.kb-item-tag').forEach(tagEl => {
        tagEl.style.cursor = 'pointer';
        tagEl.title = '點擊篩選此標籤';
        tagEl.addEventListener('click', () => {
          const tag = tagEl.textContent;
          knowledgeTagFilter = knowledgeTagFilter === tag ? '' : tag;
          renderKnowledgeTagFilters();
          renderKnowledgeList();
        });
      });
      // 編輯標題
      const titleEl = div.querySelector('.kb-item-title');
      titleEl.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'kb-item-title-input';
        input.value = item.title;
        titleEl.replaceWith(input);
        input.focus();
        input.select();
        const save = async () => {
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== item.title) {
            const idx = knowledgeBase.findIndex(k => k.id === item.id);
            if (idx !== -1) { knowledgeBase[idx].title = newTitle; await chrome.storage.local.set({ knowledgeBase }); }
          }
          renderKnowledgeList();
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') renderKnowledgeList();
        });
      });
      // 分類選擇
      div.querySelector('.item-cat-select').addEventListener('change', async e => {
        const idx = knowledgeBase.findIndex(k => k.id === item.id);
        if (idx !== -1) {
          knowledgeBase[idx].category = e.target.value;
          await chrome.storage.local.set({ knowledgeBase });
          e.target.classList.toggle('has-value', !!e.target.value);
        }
      });
      // 刪除
      div.querySelector('.kb-item-delete').addEventListener('click', async () => {
        knowledgeBase = knowledgeBase.filter(k => k.id !== item.id);
        await chrome.storage.local.set({ knowledgeBase });
        renderKnowledgeList();
      });
      knowledgeList.appendChild(div);
    });
  }

  // ─────────────────────────────────────────────────────────

  function buildMemoryBlock() {
    if (memories.length === 0) return '';
    return `【使用者長期記憶】\n${memories.map(m => `- ${m.text}`).join('\n')}`;
  }

  // ── Vocabulary ───────────────────────────────────────────

  async function openVocabularyModal() {
    vocabularyModal.classList.remove('hidden');
    await populateCategoryFilter('vocabulary', vocabularyCategoryFilterEl);
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    renderVocabularyList(vocabulary);
  }

  function closeVocabularyModal() {
    vocabularyModal.classList.add('hidden');
    vocabularyCatManager.classList.add('hidden');
    manageVocabularyCatBtn.classList.remove('active');
  }

  async function renderVocabularyList(vocabulary) {
    const _v = ++_renderVocabVer;
    const cats = await getCategories('vocabulary');
    if (_v !== _renderVocabVer) return; // 已有更新的 render，捨棄本次
    vocabularyList.innerHTML = '';
    const filtered = vocabularyCategoryFilter
      ? vocabulary.filter(v => v.category === vocabularyCategoryFilter)
      : vocabulary;
    if (filtered.length === 0) {
      vocabularyList.innerHTML = vocabularyCategoryFilter
        ? '<p class="memory-empty">此分類沒有單字。</p>'
        : '<p class="memory-empty">尚無單字。<br>在任意網頁反白文字後右鍵「加入單字簿」。</p>';
      return;
    }
    const langLabel = { en: 'EN', zh: '中', ja: '日', other: '?' };
    const ttsLangMap = { en: 'en-US', zh: 'zh-TW', ja: 'ja-JP', other: 'zh-TW' };
    filtered.slice().reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'memory-item';
      const ttsLang = ttsLangMap[item.lang] || 'zh-TW';
      const catOptions = `<option value="">${cats.length ? '無分類' : '新增分類後使用'}</option>`
        + cats.map(c => `<option value="${escapeAttr(c)}" ${item.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      const zhBtnHtml = item.lang !== 'zh'
        ? `<span class="btn-vocab-zh btn-icon-xs" title="${item.zhTranslation ? escapeAttr(item.zhTranslation) : '載入中...'}" data-word="${escapeAttr(item.word)}" data-id="${item.id}">中</span>`
        : '';
      div.innerHTML = `
        <span class="memory-item-badge context-menu">${langLabel[item.lang] || '?'}</span>
        <span class="memory-item-text vocab-word editable" title="點擊編輯">${escapeHtml(item.word)}</span>
        <span class="memory-item-date">${formatItemDate(item.createdAt)}</span>
        <select class="item-cat-select ${item.category ? 'has-value' : ''}" title="分類">${catOptions}</select>
        ${zhBtnHtml}
        <button class="btn-vocab-tts btn-icon-xs" title="朗讀" data-text="${escapeAttr(item.word)}" data-lang="${ttsLang}">${TTS_SVG}</button>
        <button class="btn-vocab-copy btn-icon-xs" title="複製" data-text="${escapeAttr(item.word)}">${COPY_SVG}</button>
        <button class="btn-memory-delete" title="刪除">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      `;
      // 分類選擇
      div.querySelector('.item-cat-select').addEventListener('change', async e => {
        const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
        const idx = current.findIndex(v => v.id === item.id);
        if (idx !== -1) {
          current[idx].category = e.target.value;
          await chrome.storage.local.set({ vocabulary: current });
          e.target.classList.toggle('has-value', !!e.target.value);
        }
      });
      // 點擊單字進入編輯模式
      const wordSpan = div.querySelector('.vocab-word');
      const ttsBtn = div.querySelector('.btn-vocab-tts');
      const copyBtn = div.querySelector('.btn-vocab-copy');
      wordSpan.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'memory-item-input';
        input.value = item.word;
        wordSpan.replaceWith(input);
        input.focus();
        input.select();
        const save = async () => {
          const newWord = input.value.trim();
          if (newWord && newWord !== item.word) {
            const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
            const idx = current.findIndex(v => v.id === item.id);
            if (idx !== -1) { current[idx].word = newWord; await chrome.storage.local.set({ vocabulary: current }); }
          }
          const { vocabulary: latest = [] } = await chrome.storage.local.get(['vocabulary']);
          renderVocabularyList(latest);
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          if (e.key === 'Escape') { chrome.storage.local.get(['vocabulary'], r => renderVocabularyList(r.vocabulary || [])); }
        });
      });
      ttsBtn.addEventListener('click', handleTTS);
      copyBtn.addEventListener('click', handleCopy);
      // 中文翻譯 hover
      const zhBtn = div.querySelector('.btn-vocab-zh');
      if (zhBtn && !item.zhTranslation) {
        zhBtn.addEventListener('mouseenter', async () => {
          if (zhBtn.dataset.loaded) return;
          zhBtn.dataset.loaded = '1';
          const res = await chrome.runtime.sendMessage({ type: 'TRANSLATE_WORD', data: { text: item.word } });
          if (res.success) {
            zhBtn.title = res.translated;
            const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
            const idx = current.findIndex(v => v.id === item.id);
            if (idx !== -1) { current[idx].zhTranslation = res.translated; await chrome.storage.local.set({ vocabulary: current }); }
          } else {
            zhBtn.title = '翻譯失敗';
          }
        }, { once: true });
      }
      div.querySelector('.btn-memory-delete').addEventListener('click', async () => {
        const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
        const updated = current.filter(v => v.id !== item.id);
        await chrome.storage.local.set({ vocabulary: updated });
        renderVocabularyList(updated);
      });
      vocabularyList.appendChild(div);
    });
  }

  // ── Page Context ─────────────────────────────────────────

  async function fetchPageContext() {
    setStatus('讀取頁面中...');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'READ_PAGE' });
      if (!response.success) throw new Error(response.error);
      pageContext = response.data;
      const shortTitle = pageContext.title.slice(0, 25) + (pageContext.title.length > 25 ? '...' : '');
      pageContextLabel.textContent = `📄 ${shortTitle}`;
      pageContextChip.classList.remove('hidden');
      clearStatus();
      updateSendButton();
      messageInput.focus();
    } catch (err) {
      setStatus('無法讀取頁面：' + err.message, true, 4000);
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
    if (userMessage) parts.push(`\n使用者問題：\n${userMessage}`);
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

    // 2.5. 抽出連結（HTML escape 前處理，避免 & 被轉成 &amp; 破壞 URL）
    // Markdown 連結：[text](url)
    text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\)\s]+)\)/g, (_, linkText, url) => {
      const i = inlines.length;
      inlines.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`);
      return `\x02I${i}\x03`;
    });
    // Bare URL 自動連結
    text = text.replace(/(https?:\/\/[^\s\)\]"'<>]+)/g, (_, url) => {
      const i = inlines.length;
      inlines.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
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
