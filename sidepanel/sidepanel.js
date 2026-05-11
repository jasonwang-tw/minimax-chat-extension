// sidepanel.js - 側邊欄邏輯

let currentImages = [];  // [{ dataUrl, mode, fileType, fileName }]  目前附加的檔案（圖片/PDF/文字）
let statusNoticeEl = null; // 聊天區底部的狀態通知元素
let agentStatusEl = null;  // Agent Loop 狀態列
let _agentTimer = null;
let _agentStartTime = 0;
let _agentIter = 0;
let _agentSearchLog = [];  // 方案 B：搜尋歷程記錄 [{ tool, query, count, error }]
let _agentNotices = [];    // Agent fallback / tool error notices for the current reply
let pendingRegionMode = null; // 區域截圖完成後要套用的 mode（null = 'region'）
let currentModel = 'MiniMax-M2.7';  // 目前選擇的模型
let currentAgentDepth = 'standard'; // Agent 搜尋深度
let historySearchQuery = '';  // 歷史紀錄搜尋關鍵字
let memories = [];            // 全域長期記憶條目
let memoryCategoryFilter = '';     // 長期記憶分類篩選
let memorySearchQuery = '';        // 長期記憶關鍵字篩選
let vocabularyCategoryFilter = ''; // 單字簿分類篩選
let vocabularyLangFilter = '';     // 單字簿語言篩選
let vocabularySearchQuery = '';    // 單字簿關鍵字篩選
let vocabularyReviewMode = false;  // 單字簿複習模式
let vocabularyReviewItems = [];    // 複習中的單字項目
let vocabularyReviewIndex = 0;     // 複習卡片游標
let vocabularyReviewAnswerVisible = false;
let lessonRecords = [];            // 英文課錄音與整理紀錄
let lessonAudioDb = null;           // IndexedDB handle for local lesson audio blobs
let knowledgeBase = [];            // 全域知識庫條目
let selectedKnowledge = [];        // 本次訊息已選取的知識庫條目
let kbPaletteIndex = -1;           // @ palette 鍵盤游標
let knowledgeCategoryFilter = '';  // 知識庫分類篩選
let knowledgeTagFilter = '';       // 知識庫標籤篩選
let knowledgeSearchQuery = '';     // 知識庫關鍵字篩選
let sessionSummaries = {};         // { [sessionId]: [{ id, text, createdAt, addedToMemory }] }
let isSummarizing = false;         // 防止重複總結
let isSessionToVocabularyRunning = false; // 防止重複整理單字
let inputHistory = [];             // 輸入歷史（最多 10 則）
let inputHistoryIndex = -1;        // 當前瀏覽的歷史索引（-1 = 非瀏覽狀態）
let inputHistorySaved = '';        // 暫存使用者正在輸入的文字
// Render 版本計數器：防止 async render 競爭導致資料重複
let _renderMemoryVer = 0;
let _renderVocabVer = 0;
let _renderKbVer = 0;
let customCommands = [];      // 使用者自訂指令
let pageContext = null;       // 當前分頁內容（/page 指令觸發後）
let messageQueue = [];       // 串流中排入的待發送訊息 [{ message, images, pageCtx }]
let cmdPaletteIndex = -1;     // 指令選單鍵盤選取游標
let activeCommandToken = null; // { start, end, query } 游標前正在輸入的 slash command
const APPROX_CHARS_PER_TOKEN = 2;
const DEFAULT_CONTEXT_TOKENS = 20000;
const MODEL_CONTEXT_LIMITS = {
  'MiniMax-M2.7': { tokens: 200000, source: 'MiniMax 預設' }
};
const AGENT_DEPTH_OPTIONS = {
  fast: { label: '快速', iterations: 3, description: '較快回覆，適合簡單查詢' },
  standard: { label: '標準', iterations: 6, description: '預設平衡速度與完整度' },
  deep: { label: '深入', iterations: 10, description: '適合部署教學與疑難排查' },
  research: { label: '研究', iterations: 12, description: '最完整，耗時與成本較高' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const messageInput = document.getElementById('messageInput');
  const charCounter = document.getElementById('charCounter');
  const charCountText = document.getElementById('charCountText');
  const charCounterFill = document.getElementById('charCounterFill');
  const charLimitText = document.getElementById('charLimitText');
  const charHistoryText = document.getElementById('charHistoryText');
  const charInputText = document.getElementById('charInputText');
  const charExtraText = document.getElementById('charExtraText');
  const charStatusText = document.getElementById('charStatusText');
  const queuePanel = document.getElementById('queuePanel');
  const queuePanelToggle = document.getElementById('queuePanelToggle');
  const queueListEl = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  const queueChevron = document.getElementById('queueChevron');
  let queueListOpen = false;
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
  const currentSessionNameEl = document.getElementById('currentSessionName');
  const renameCurrentSessionBtn = document.getElementById('renameCurrentSessionBtn');
  const deleteCurrentSessionBtn = document.getElementById('deleteCurrentSessionBtn');
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
  const historySearchInput = document.getElementById('historySearch');
  const historyClearSearchBtn = document.getElementById('historyClearSearch');
  const commandPalette = document.getElementById('commandPalette');
  const commandChip = document.getElementById('commandChip');
  const commandChipLabel = document.getElementById('commandChipLabel');
  const commandChipRemove = document.getElementById('commandChipRemove');
  const pageContextChip = document.getElementById('pageContextChip');
  const pageContextLabel = document.getElementById('pageContextLabel');
  const pageContextRemove = document.getElementById('pageContextRemove');
  const memoryModal = document.getElementById('memoryModal');
  const memoryModalOverlay = document.getElementById('memoryModalOverlay');
  const memoryModalClose = document.getElementById('memoryModalClose');
  const memoryList = document.getElementById('memoryList');
  const memorySearchInput = document.getElementById('memorySearchInput');
  const memoryClearAllBtn = document.getElementById('memoryClearAllBtn');
  const openMemoryBtn = document.getElementById('openMemoryBtn');
  const vocabularyModal = document.getElementById('vocabularyModal');
  const vocabularyModalOverlay = document.getElementById('vocabularyModalOverlay');
  const vocabularyModalClose = document.getElementById('vocabularyModalClose');
  const vocabularyList = document.getElementById('vocabularyList');
  const vocabularyStats = document.getElementById('vocabularyStats');
  const vocabularySearchInput = document.getElementById('vocabularySearchInput');
  const vocabularyLangFilterEl = document.getElementById('vocabularyLangFilter');
  const vocabularyReviewBtn = document.getElementById('vocabularyReviewBtn');
  const vocabularyReviewPanel = document.getElementById('vocabularyReviewPanel');
  const vocabularyClearAllBtn = document.getElementById('vocabularyClearAllBtn');
  const openVocabularyBtn = document.getElementById('openVocabularyBtn');
  const vocabularyWordsTab = document.getElementById('vocabularyWordsTab');
  const lessonRecordingTab = document.getElementById('lessonRecordingTab');
  const vocabularyWordsView = document.getElementById('vocabularyWordsView');
  const lessonRecordingView = document.getElementById('lessonRecordingView');
  const lessonNotice = document.getElementById('lessonNotice');
  const lessonNoticeAck = document.getElementById('lessonNoticeAck');
  const lessonRecordingStateEl = document.getElementById('lessonRecordingState');
  const lessonRecordingTimer = document.getElementById('lessonRecordingTimer');
  const lessonTranscriptStatus = document.getElementById('lessonTranscriptStatus');
  const lessonMicPermissionBtn = document.getElementById('lessonMicPermissionBtn');
  const lessonPermissionHelp = document.getElementById('lessonPermissionHelp');
  const lessonStartBtn = document.getElementById('lessonStartBtn');
  const lessonStopBtn = document.getElementById('lessonStopBtn');
  const lessonOrganizeBtn = document.getElementById('lessonOrganizeBtn');
  const lessonTranscriptDraft = document.getElementById('lessonTranscriptDraft');
  const lessonRecordsList = document.getElementById('lessonRecordsList');
  const lessonFloatingBar = document.getElementById('lessonFloatingBar');
  const lessonFloatingState = document.getElementById('lessonFloatingState');
  const lessonFloatingTimer = document.getElementById('lessonFloatingTimer');
  const lessonFloatingPauseBtn = document.getElementById('lessonFloatingPauseBtn');
  const lessonFloatingStopBtn = document.getElementById('lessonFloatingStopBtn');
  // 知識庫元素
  const openKnowledgeBtn = document.getElementById('openKnowledgeBtn');
  const openMarketBtn = document.getElementById('openMarketBtn');
  const marketPanel = document.getElementById('marketPanel');
  const marketPanelClose = document.getElementById('marketPanelClose');
  const marketRefreshBtn = document.getElementById('marketRefreshBtn');
  const marketFreshness = document.getElementById('marketFreshness');
  const marketWarnings = document.getElementById('marketWarnings');
  const marketHeatmap = document.getElementById('marketHeatmap');
  const marketGroups = document.getElementById('marketGroups');
  const marketNews = document.getElementById('marketNews');
  const marketDetail = document.getElementById('marketDetail');
  const marketDetailHint = document.getElementById('marketDetailHint');
  const knowledgeChips = document.getElementById('knowledgeChips');
  const knowledgePalette = document.getElementById('knowledgePalette');
  const knowledgeModal = document.getElementById('knowledgeModal');
  const knowledgeModalOverlay = document.getElementById('knowledgeModalOverlay');
  const knowledgeModalClose = document.getElementById('knowledgeModalClose');
  const knowledgeList = document.getElementById('knowledgeList');
  const knowledgeClearAllBtn = document.getElementById('knowledgeClearAllBtn');
  const knowledgeSearchInput = document.getElementById('knowledgeSearchInput');
  const knowledgeCategoryFilterEl = document.getElementById('knowledgeCategoryFilter');
  const manageKnowledgeCatBtn = document.getElementById('manageKnowledgeCatBtn');
  const manageKnowledgeTagBtn = document.getElementById('manageKnowledgeTagBtn');
  const knowledgeCatManager = document.getElementById('knowledgeCatManager');
  const knowledgeTagManager = document.getElementById('knowledgeTagManager');
  const knowledgeNewCatInput = document.getElementById('knowledgeNewCatInput');
  const knowledgeAddCatBtn = document.getElementById('knowledgeAddCatBtn');
  const knowledgeCatList = document.getElementById('knowledgeCatList');
  const knowledgeTagList = document.getElementById('knowledgeTagList');
  const knowledgeTagFilters = document.getElementById('knowledgeTagFilters');
  // 搜尋工具列元素
  const tocBtn = document.getElementById('tocBtn');
  const tocPanel = document.getElementById('tocPanel');
  const tocList = document.getElementById('tocList');
  const tocClose = document.getElementById('tocClose');
  const sessionSearchBtn = document.getElementById('sessionSearchBtn');
  const sessionSearchBar = document.getElementById('sessionSearchBar');
  const sessionSearchInput = document.getElementById('sessionSearchInput');
  const sessionSearchCount = document.getElementById('sessionSearchCount');
  const sessionSearchPrev = document.getElementById('sessionSearchPrev');
  const sessionSearchNext = document.getElementById('sessionSearchNext');
  const sessionSearchClose = document.getElementById('sessionSearchClose');

  // 總結工具列元素
  const summarizeBtn = document.getElementById('summarizeBtn');
  const sessionToVocabularyBtn = document.getElementById('sessionToVocabularyBtn');
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
  const FILE_SVG_DOC = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ec2970" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>`;
  // 判斷 MIME type → fileType
  function getFileType(mimeType) {
    if (!mimeType || mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'text';
  }

  let sessions = [];
  let currentSession = null;
  let isLoading = false;
  let spaces = [];
  let currentSpaceId = null;
  let planModeSetting = 'auto';
  let _currentPlanRecordIndex = -1;
  let pendingCommand = null; // { cmd, icon } — 選取但尚未送出的指令
  let translateEnabled = false;
  let batchSelectMode = false;
  let selectedIds = new Set();
  let currentAudio = null;     // 目前播放中的 Audio 物件（fallback 用）
  let currentTTSBtn = null;    // 目前播放中的按鈕
  let currentAudioCtx = null;  // Web Audio API context
let currentAudioSrc = null;  // Web Audio API BufferSource
  let lessonRecorderState = null; // { recorder, chunks, startedAt, timer, streams, audioContext, recognition, transcript }
  let activeMarket = 'US';
  let marketDashboard = null;
  let selectedMarketStock = null;

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

  // 模型選擇器
  const modelPickerBtn = document.getElementById('modelPickerBtn');
  const modelPickerLabel = document.getElementById('modelPickerLabel');
  const modelPickerDropdown = document.getElementById('modelPickerDropdown');
  const agentDepthBtn = document.getElementById('agentDepthBtn');
  const agentDepthLabel = document.getElementById('agentDepthLabel');
  const agentDepthDropdown = document.getElementById('agentDepthDropdown');

  const OPENROUTER_MODELS_API_URL = 'https://openrouter.ai/api/v1/models';
  const MODEL_PRICING_CACHE_KEY = 'openrouterModelPricingCache';
  let modelPickerSort = { key: 'name', direction: 'asc' };
  let modelContextById = { ...MODEL_CONTEXT_LIMITS };

  function pricePerMillion(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : null;
  }

  function formatUsdPerMillion(value) {
    if (value === null) return '?';
    if (value === 0) return 'Free';
    if (value < 0.01) return `$${value.toFixed(4)}`;
    if (value < 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(value >= 10 ? 0 : 2)}`;
  }

  function formatModelPrice(modelInfo) {
    const pricing = modelInfo?.pricing;
    if (!pricing) return null;
    const input = pricePerMillion(pricing.prompt);
    const output = pricePerMillion(pricing.completion);
    if (input === null && output === null) return null;
    if (input === 0 && output === 0) return 'Free';
    return `輸入 ${formatUsdPerMillion(input)}/M · 輸出 ${formatUsdPerMillion(output)}/M`;
  }

  function modelPriceValue(model, key) {
    const pricing = model?.pricing || {};
    const value = key === 'output' ? pricing.completion : pricing.prompt;
    return pricePerMillion(value);
  }

  function sortModelItems(items) {
    return [...items].sort((a, b) => {
      if (modelPickerSort.key === 'name') {
        const result = String(a.label || a.modelId).localeCompare(String(b.label || b.modelId));
        return modelPickerSort.direction === 'asc' ? result : -result;
      }
      const av = modelPriceValue(a, modelPickerSort.key);
      const bv = modelPriceValue(b, modelPickerSort.key);
      if (av === null && bv === null) return String(a.label || a.modelId).localeCompare(String(b.label || b.modelId));
      if (av === null) return 1;
      if (bv === null) return -1;
      const result = av - bv;
      return modelPickerSort.direction === 'asc' ? result : -result;
    });
  }

  function normalizeContextTokens(value) {
    const tokens = Number(value);
    return Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : null;
  }

  function getModelContextInfo(modelId = currentModel) {
    const known = modelContextById[modelId] || MODEL_CONTEXT_LIMITS[modelId];
    const tokens = normalizeContextTokens(known?.tokens || known?.contextLength);
    if (tokens) return { tokens, source: known?.source || '模型 metadata' };
    return { tokens: DEFAULT_CONTEXT_TOKENS, source: '預設保守值' };
  }

  function getCurrentContextCharBudget() {
    return getModelContextInfo().tokens * APPROX_CHARS_PER_TOKEN;
  }

  function getOutputModalities(model) {
    const values = model?.architecture?.output_modalities || model?.output_modalities || model?.outputModalities || [];
    return Array.isArray(values)
      ? values.map(v => String(v).trim().toLowerCase()).filter(Boolean)
      : String(values || '').split('+').map(v => v.trim().toLowerCase()).filter(Boolean);
  }

  function getInputModalities(model) {
    const values = model?.architecture?.input_modalities || model?.input_modalities || model?.inputModalities || [];
    return Array.isArray(values)
      ? values.map(v => String(v).trim().toLowerCase()).filter(Boolean)
      : String(values || '').split('+').map(v => v.trim().toLowerCase()).filter(Boolean);
  }

  async function currentModelSupportsOpenRouterImages(openrouterApiKey) {
    if (!openrouterApiKey || currentModel === 'MiniMax-M2.7') return false;
    const pricingMap = await getOpenRouterPricingMap(openrouterApiKey);
    return getInputModalities(pricingMap[currentModel] || {}).includes('image');
  }

  async function getOpenRouterPricingMap(apiKey) {
    const now = Date.now();
    const { [MODEL_PRICING_CACHE_KEY]: cache } = await chrome.storage.local.get([MODEL_PRICING_CACHE_KEY]);
    if (cache?.models && now - (cache.updatedAt || 0) < 24 * 60 * 60 * 1000) {
      return cache.models;
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
          inputModalities: model.architecture?.input_modalities || model.input_modalities || [],
          outputModalities: getOutputModalities(model),
          contextLength: model.context_length || model.top_provider?.context_length || null,
          updatedAt: now
        };
      }
      await chrome.storage.local.set({ [MODEL_PRICING_CACHE_KEY]: { updatedAt: now, models } });
      return models;
    } catch (err) {
      console.warn('Failed to load OpenRouter pricing:', err);
      return cache?.models || {};
    }
  }

  async function safeInitModelPicker() {
    try {
      await initModelPicker();
    } catch (err) {
      console.error('Failed to initialize model picker:', err);
    }
  }

  async function initAgentDepthPicker() {
    const { agentDepth } = await chrome.storage.sync.get(['agentDepth']);
    if (AGENT_DEPTH_OPTIONS[agentDepth]) currentAgentDepth = agentDepth;
    renderAgentDepthPicker();
  }

  function getCurrentAgentDepthConfig() {
    return AGENT_DEPTH_OPTIONS[currentAgentDepth] || AGENT_DEPTH_OPTIONS.standard;
  }

  function renderAgentDepthPicker() {
    if (!agentDepthLabel || !agentDepthDropdown) return;
    const activeConfig = getCurrentAgentDepthConfig();
    agentDepthLabel.textContent = activeConfig.label;
    agentDepthDropdown.innerHTML = '';
    Object.entries(AGENT_DEPTH_OPTIONS).forEach(([key, config]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `agent-depth-item${currentAgentDepth === key ? ' active' : ''}`;
      btn.innerHTML = `<span class="agent-depth-item-title">${escSp(config.label)} · ${config.iterations} 輪</span><span class="agent-depth-item-desc">${escSp(config.description)}</span>`;
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        currentAgentDepth = key;
        await chrome.storage.sync.set({ agentDepth: key });
        renderAgentDepthPicker();
        agentDepthDropdown.classList.add('hidden');
        agentDepthBtn?.classList.remove('open');
      });
      agentDepthDropdown.appendChild(btn);
    });
  }

  await initAgentDepthPicker();
  await safeInitModelPicker();

  agentDepthBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !agentDepthDropdown.classList.contains('hidden');
    agentDepthDropdown.classList.toggle('hidden', isOpen);
    agentDepthBtn.classList.toggle('open', !isOpen);
  });

  modelPickerBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = !modelPickerDropdown.classList.contains('hidden');
    if (!isOpen) await safeInitModelPicker();  // 開啟時重新讀取最新模型清單
    modelPickerDropdown.classList.toggle('hidden', isOpen);
    modelPickerBtn.classList.toggle('open', !isOpen);
  });

  document.addEventListener('click', () => {
    agentDepthDropdown?.classList.add('hidden');
    agentDepthBtn?.classList.remove('open');
    modelPickerDropdown?.classList.add('hidden');
    modelPickerBtn?.classList.remove('open');
  });

  // 設定變更時刷新模型清單
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.openrouterApiKey || changes.customModels)) {
      safeInitModelPicker();
    }
    if (area === 'sync' && changes.agentDepth && AGENT_DEPTH_OPTIONS[changes.agentDepth.newValue]) {
      currentAgentDepth = changes.agentDepth.newValue;
      renderAgentDepthPicker();
    }
  });

  async function initModelPicker() {
    const { openrouterApiKey, customModels } =
      await chrome.storage.sync.get(['openrouterApiKey', 'customModels']);
    const pricingMap = openrouterApiKey ? await getOpenRouterPricingMap(openrouterApiKey) : {};
    const sections = [];

    // MiniMax 永遠顯示
    sections.push({ title: null, items: [{ label: 'MiniMax', modelId: 'MiniMax-M2.7', contextLength: MODEL_CONTEXT_LIMITS['MiniMax-M2.7'].tokens }] });

    if (openrouterApiKey) {
      const enrich = m => {
        const metadata = pricingMap[m.modelId] || {};
        const priceText = formatModelPrice(metadata);
        return {
          ...m,
          priceText: priceText || '價格未知',
          pricing: metadata.pricing || null,
          contextLength: normalizeContextTokens(m.contextLength || metadata.contextLength)
        };
      };
      const custom = (Array.isArray(customModels) ? customModels : [])
        .filter(m => m.modelId)
        .map(m => enrich({ label: m.label || m.modelId, modelId: m.modelId }));
      if (custom.length > 0) sections.push({ title: 'OpenRouter 已啟用', items: custom });
    }

    renderModelPicker(sections);
  }

  function renderModelPicker(sections) {
    modelPickerDropdown.innerHTML = '';
    const allItems = sections.flatMap(s => s.items);
    modelContextById = { ...MODEL_CONTEXT_LIMITS };
    allItems.forEach(m => {
      const tokens = normalizeContextTokens(m.contextLength);
      if (m.modelId && tokens) modelContextById[m.modelId] = { tokens, source: m.modelId === 'MiniMax-M2.7' ? 'MiniMax 預設' : 'OpenRouter metadata' };
    });
    const currentValid = allItems.some(m => m.modelId === currentModel);
    if (!currentValid && allItems.length > 0) {
      currentModel = allItems[0].modelId;
      modelPickerLabel.textContent = allItems[0].label;
    }

    if (sections.some(s => s.title && s.items.length > 1)) {
      const controls = document.createElement('div');
      controls.className = 'model-picker-sort';
      controls.innerHTML = `
        <span>排序</span>
        <button type="button" data-sort-key="name">名稱</button>
        <button type="button" data-sort-key="input">Input</button>
        <button type="button" data-sort-key="output">Output</button>
      `;
      controls.querySelectorAll('button').forEach(btn => {
        const active = btn.dataset.sortKey === modelPickerSort.key;
        btn.classList.toggle('active', active);
        if (active) btn.textContent += modelPickerSort.direction === 'asc' ? ' ↑' : ' ↓';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.sortKey;
          modelPickerSort = {
            key,
            direction: modelPickerSort.key === key && modelPickerSort.direction === 'asc' ? 'desc' : 'asc'
          };
          renderModelPicker(sections);
        });
      });
      modelPickerDropdown.appendChild(controls);
    }

    sections.forEach(({ title, items }) => {
      if (title) {
        const div = document.createElement('div');
        div.className = 'model-picker-section-title';
        div.textContent = title;
        modelPickerDropdown.appendChild(div);
      }
      sortModelItems(items).forEach(m => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `model-picker-item${currentModel === m.modelId ? ' active' : ''}`;
        const priceLine = m.priceText ? `<span class="model-picker-item-price">${escSp(m.priceText)}</span>` : '';
        btn.innerHTML = `<span class="model-picker-item-label">${escSp(m.label)}</span><span class="model-picker-item-sub">${escSp(m.modelId)}</span>${priceLine}`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          currentModel = m.modelId;
          modelPickerLabel.textContent = m.label;
          modelPickerDropdown.classList.add('hidden');
          modelPickerBtn.classList.remove('open');
          modelPickerDropdown.querySelectorAll('.model-picker-item').forEach(el => el.classList.toggle('active', el === btn));
          updateCharCounter();
          checkApiKey();
        });
        modelPickerDropdown.appendChild(btn);
      });
    });

    const active = allItems.find(m => m.modelId === currentModel);
    if (active) modelPickerLabel.textContent = active.label;
    updateCharCounter();
    checkApiKey();
  }

  function escSp(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // 載入記憶、自訂指令、知識庫
  await loadMemories();
  await migrateCategoriesIfNeeded();
  await loadCustomCommands();
  const { knowledgeBase: initKb = [], lessonRecords: initLessons = [] } = await chrome.storage.local.get(['knowledgeBase', 'lessonRecords']);
  knowledgeBase = initKb;
  lessonRecords = Array.isArray(initLessons) ? initLessons : [];
  const { sessionSummaries: initSS = {} } = await chrome.storage.local.get(['sessionSummaries']);
  sessionSummaries = initSS;

  // 檢查 API Key
  await checkApiKey();

  // 載入計畫模式設定
  {
    const { settings: _initSettings } = await chrome.storage.sync.get(['settings']);
    planModeSetting = _initSettings?.planMode || 'auto';
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    // sync area：API Key、設定、長期記憶、分類（跨裝置同步的資料）
    if (area === 'sync') {
      if (changes.geminiApiKey || changes.apiKey || changes.openrouterApiKey || changes.customModels) {
        checkApiKey();
      }
      if (changes.settings) {
        planModeSetting = changes.settings.newValue?.planMode || 'auto';
      }
      // customCommands 已移至 local storage，不在此監聽
      // 右鍵選單從 background 寫入 sync，sidepanel 透過此監聽同步
      if (changes.memories) {
        memories = changes.memories.newValue || [];
        if (memoryModal && !memoryModal.classList.contains('hidden')) {
          renderMemoryList();
        }
      }
    }

    // local area：大型資料（知識庫、單字簿、sessions、總結、自訂指令）
    if (area === 'local') {
      if (changes.customCommands) {
        loadCustomCommands();
      }
      if (changes.vocabulary) {
        if (vocabularyModal && !vocabularyModal.classList.contains('hidden')) {
          if (vocabularyReviewMode) openVocabularyReviewMode(changes.vocabulary.newValue || []);
          else renderVocabularyList(changes.vocabulary.newValue || []);
        }
      }
      if (changes.knowledgeBase) {
        knowledgeBase = changes.knowledgeBase.newValue || [];
        if (knowledgeModal && !knowledgeModal.classList.contains('hidden')) {
          renderKnowledgeTagFilters();
          renderKnowledgeTagManager();
          renderKnowledgeList();
        }
      }
      if (changes.lessonRecords) {
        lessonRecords = changes.lessonRecords.newValue || [];
        if (lessonRecordsList && !lessonRecordingView.classList.contains('hidden')) {
          renderLessonRecords();
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

  // 載入空間（要先於歷史記錄，讓 history item 能正確顯示空間 tag）
  await loadSpaces();
  // 載入歷史記錄
  await loadHistory();


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
  // Context window 使用率：使用目前模型的 contextLength，並以字元 / 2 粗估 token。
  function compactTokenCount(value) {
    const count = Math.max(0, Number(value) || 0);
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}m`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  }

  function estimateTextLength(value) {
    return typeof value === 'string' ? value.length : 0;
  }

  function estimateKnowledgeLength() {
    return selectedKnowledge.reduce((sum, item) => {
      return sum
        + estimateTextLength(item.title)
        + estimateTextLength(item.summary)
        + Math.min(estimateTextLength(item.content), 2000);
    }, 0);
  }

  function estimatePageContextLength() {
    if (!pageContext) return 0;
    return estimateTextLength(pageContext.title)
      + estimateTextLength(pageContext.url)
      + estimateTextLength(pageContext.description)
      + estimateTextLength(pageContext.text);
  }

  function estimateMessageTokens(message) {
    const textTokens = Math.ceil(estimateTextLength(message?.content) / APPROX_CHARS_PER_TOKEN);
    const usageTokens = Number(message?.usage?.totalTokens || message?.usage?.total_tokens || 0);
    const attachmentTokens = (message?.attachments || []).reduce((sum, attachment) => {
      if (attachment?.type === 'image' || String(attachment?.mimeType || '').startsWith('image/')) return sum + 1290;
      return sum;
    }, 0);
    return Math.max(textTokens, usageTokens, attachmentTokens);
  }

  function updateCharCounter() {
    const historyTokens = (currentSession?.messages || [])
      .reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    const inputChars = estimateTextLength(messageInput?.value || '');
    const extraChars = estimateKnowledgeLength() + estimatePageContextLength();
    const inputTokens = Math.ceil(inputChars / APPROX_CHARS_PER_TOKEN);
    const extraTokens = Math.ceil(extraChars / APPROX_CHARS_PER_TOKEN);
    const totalTokens = historyTokens + inputTokens + extraTokens;
    const contextInfo = getModelContextInfo();
    const pct = Math.min(Math.round(totalTokens / contextInfo.tokens * 100), 999);
    charCounter.classList.remove('warn', 'danger', 'over');
    charCountText.textContent = `~${compactTokenCount(totalTokens)} / ${compactTokenCount(contextInfo.tokens)} (${pct}%)`;
    charCounterFill.style.width = `${Math.min(pct, 100)}%`;
    charLimitText.textContent = `${compactTokenCount(contextInfo.tokens)} token`;
    charHistoryText.textContent = `~${compactTokenCount(historyTokens)}`;
    charInputText.textContent = `~${compactTokenCount(inputTokens)}`;
    charExtraText.textContent = `~${compactTokenCount(extraTokens)}`;
    if (pct >= 100) {
      charStatusText.textContent = '已超出，送出時會嘗試裁切歷史';
    } else if (pct >= 80) {
      charStatusText.textContent = '接近上限，送出時可能壓縮';
    } else if (pct >= 60) {
      charStatusText.textContent = '偏高';
    } else {
      charStatusText.textContent = `正常（${contextInfo.source}）`;
    }
    charCounter.setAttribute(
      'aria-label',
      `Context window 使用量約 ${pct}%，${totalTokens} / ${contextInfo.tokens} token。歷史約 ${historyTokens}，目前輸入約 ${inputTokens}，附加 context 約 ${extraTokens}。`
    );
    if (pct >= 100) charCounter.classList.add('danger', 'over');
    else if (pct >= 80) charCounter.classList.add('danger');
    else if (pct >= 60) charCounter.classList.add('warn');
  }

  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    updateSendButton();
    handleCommandPaletteInput();
    handleKbPaletteInput();
    updateCharCounter();
  });
  updateCharCounter();

  // 發送 / 停止
  sendBtn.addEventListener('click', async () => {
    if (isLoading && currentPort) {
      // 停止串流：主動斷線並直接清理（自己呼叫 disconnect，onDisconnect 不會在自己這側觸發）
      const port = currentPort;
      const liveDiv = currentLiveDiv;
      const rawContent = currentRawContent;
      port.disconnect();
      // 立即清理狀態（同時清空佇列，停止即終止所有排隊訊息）
      isLoading = false;
      currentPort = null;
      currentLiveDiv = null;
      currentRawContent = '';
      messageInput.disabled = false;
      setStreamingMode(false);
      messageQueue = [];
      updateQueueIndicator();
      clearAgentStatus();
      const stopSearchLog = _agentSearchLog.length > 0 ? [..._agentSearchLog] : null;
      const stopAgentNotices = _agentNotices.length > 0 ? [..._agentNotices] : null;
      clearStatus();
      if (rawContent) {
        const partial = rawContent.trimEnd();
        const stopThinkMatch = !translateEnabled && rawContent.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
        const stopThinkContent = stopThinkMatch ? stopThinkMatch[1].trim() : undefined;
        // 剝除 think 區塊，避免 <think> 標籤被 renderMarkdown 當作純文字渲染
        const stopCleanReply = partial
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<think>[\s\S]*/gi, '')
          .replace(/<result>|<\/result>/gi, '').trim();
        if (currentSession) currentSession.messages.push({ role: 'assistant', content: stopCleanReply, ...(stopThinkContent && { thinkContent: stopThinkContent }), ...(stopSearchLog && { searchLog: stopSearchLog }) });
        if (stopAgentNotices && liveDiv) liveDiv.parentNode?.insertBefore(buildAgentNoticeEl(stopAgentNotices), liveDiv);
        if (stopSearchLog && liveDiv) liveDiv.parentNode?.insertBefore(buildSearchHistoryEl(stopSearchLog), liveDiv);
        finalizeLiveMessage(liveDiv, partial, stopCleanReply, translateEnabled ? null : sourceLangSelect.value);
        await saveCurrentSession();
        await loadHistory();
      } else {
        liveDiv?.remove();
      }
      _agentSearchLog = [];
      _agentNotices = [];
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
          const trigger = active.querySelector('.command-item-trigger')?.textContent;
          const cmd = getAllCommands().find(c => c.trigger === trigger);
          if (cmd) applyCommand(cmd);
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
  commandChipRemove.addEventListener('click', () => { clearCommandChip(); messageInput.focus(); });
  pageContextRemove.addEventListener('click', clearPageContext);

  // Suggestion chips（空白頁預設提示）
  document.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.action === 'summarize-page') {
        await attachPageContext({ focusInput: true });
        if (pageContext) {
          messageInput.value = '請摘要目前頁面的重點。';
          messageInput.style.height = 'auto';
          messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
          updateSendButton();
          updateCharCounter();
        }
        return;
      }
      messageInput.value = btn.dataset.prompt;
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
      updateSendButton();
      messageInput.focus();
    });
  });

  // AI 回覆中的 suggestion chip（event delegation，點擊直接送出）
  chatMessages.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-suggestion');
    if (!chip) return;
    const text = chip.dataset.text;
    if (!text) return;
    messageInput.value = text;
    messageInput.dispatchEvent(new Event('input'));
    handleSend();
  });

  // 佇列面板展開/收合
  queuePanelToggle.addEventListener('click', () => {
    queueListOpen = !queueListOpen;
    queueListEl.classList.toggle('hidden', !queueListOpen);
    queueChevron.style.transform = queueListOpen ? 'rotate(180deg)' : '';
    if (queueListOpen) renderQueueList();
  });

  // 佇列面板刪除（event delegation）
  queueListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.queue-item-delete');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    messageQueue.splice(idx, 1);
    updateQueueIndicator();
    if (queueListOpen) renderQueueList();
  });

  // Memory Modal
  openMemoryBtn.addEventListener('click', () => { closeAllPanels(); openMemoryModal(); });
  memoryModalClose.addEventListener('click', closeMemoryModal);
  memorySearchInput.addEventListener('input', () => {
    memorySearchQuery = memorySearchInput.value.trim();
    renderMemoryList();
  });

  // Vocabulary Modal
  openVocabularyBtn.addEventListener('click', () => { closeAllPanels(); openVocabularyModal(); });
  vocabularyModalClose.addEventListener('click', closeVocabularyModal);
  vocabularyWordsTab.addEventListener('click', () => switchVocabularyTab('words'));
  lessonRecordingTab.addEventListener('click', () => switchVocabularyTab('lessons'));
  lessonNoticeAck.addEventListener('click', async () => {
    await chrome.storage.local.set({ lessonRecordingNoticeAck: true });
    lessonNotice.classList.add('hidden');
    setStatus('錄音提醒已確認，可開始錄音。', false, 2200);
  });
  lessonMicPermissionBtn.addEventListener('click', requestLessonMicrophonePermission);
  lessonStartBtn.addEventListener('click', startLessonRecording);
  lessonStopBtn.addEventListener('click', stopLessonRecording);
  lessonFloatingStopBtn.addEventListener('click', stopLessonRecording);
  lessonFloatingPauseBtn.addEventListener('click', toggleLessonRecordingPause);
  lessonOrganizeBtn.addEventListener('click', () => organizeLessonRecord());
  lessonTranscriptDraft.addEventListener('input', () => {
    lessonOrganizeBtn.disabled = !lessonTranscriptDraft.value.trim() && !lessonRecords[0]?.transcriptSegments?.length;
  });
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
  openKnowledgeBtn.addEventListener('click', () => { closeAllPanels(); openKnowledgeModal(); });
  knowledgeModalClose.addEventListener('click', closeKnowledgeModal);
  openMarketBtn.addEventListener('click', () => { closeAllPanels(); openMarketPanel(); });
  marketPanelClose.addEventListener('click', closeMarketPanel);
  marketRefreshBtn.addEventListener('click', () => loadMarketDashboard(true));
  document.querySelectorAll('.market-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeMarket = btn.dataset.market || 'US';
      marketDashboard = null;
      selectedMarketStock = null;
      document.querySelectorAll('.market-tab').forEach(el => el.classList.toggle('active', el === btn));
      loadMarketDashboard(true);
    });
  });
  marketPanel.addEventListener('click', e => {
    const stockBtn = e.target.closest('[data-market-symbol]');
    if (stockBtn) {
      const symbol = stockBtn.dataset.marketSymbol;
      const stock = (marketDashboard?.groups || []).flatMap(g => g.stocks || []).find(s => s.symbol === symbol);
      if (stock) {
        renderMarketDetail(stock);
        loadMarketStockDetail(stock);
      }
      return;
    }
    const commandBtn = e.target.closest('[data-market-command]');
    if (commandBtn) {
      const command = commandBtn.dataset.marketCommand;
      const symbol = commandBtn.dataset.symbol || selectedMarketStock?.symbol || '';
      if (!symbol && command !== 'add') return;
      if (command === 'finance') sendFinanceQuickCommand('finance', symbol);
      else if (command === 'news') sendFinanceQuickCommand('news', symbol);
      else if (command === 'add') addMarketContextToChat();
    }
  });
  knowledgeSearchInput.addEventListener('input', () => {
    knowledgeSearchQuery = knowledgeSearchInput.value.trim();
    renderKnowledgeList();
  });
  knowledgeClearAllBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有知識庫內容？')) {
      knowledgeBase = [];
      await chrome.storage.local.set({ knowledgeBase: [] });
      renderKnowledgeTagFilters();
      renderKnowledgeTagManager();
      renderKnowledgeList();
    }
  });

  // TOC
  function buildToc() {
    const headings = chatMessages.querySelectorAll('h1, h2, h3, h4');
    tocList.innerHTML = '';
    if (headings.length === 0) {
      tocList.innerHTML = '<div class="toc-empty">此對話沒有標題</div>';
      return;
    }
    headings.forEach(h => {
      const level = parseInt(h.tagName[1], 10);
      const btn = document.createElement('button');
      btn.className = `toc-item toc-h${level}`;
      btn.textContent = h.textContent;
      btn.addEventListener('click', () => {
        const offset = h.getBoundingClientRect().top
          - chatMessages.getBoundingClientRect().top
          + chatMessages.scrollTop - 20;
        chatMessages.scrollTo({ top: offset, behavior: 'smooth' });
      });
      tocList.appendChild(btn);
    });
  }

  function openToc() {
    buildToc();
    tocPanel.classList.remove('hidden');
    tocBtn.classList.add('active');
  }

  function closeToc() {
    tocPanel.classList.add('hidden');
    tocBtn.classList.remove('active');
  }

  tocBtn.addEventListener('click', () => {
    tocPanel.classList.contains('hidden') ? openToc() : closeToc();
  });
  tocClose.addEventListener('click', closeToc);

  // 當 TOC 面板開啟時，監聽聊天區域 DOM 變動並自動更新目錄
  const tocObserver = new MutationObserver(() => {
    if (!tocPanel.classList.contains('hidden')) {
      buildToc();
    }
  });
  tocObserver.observe(chatMessages, { childList: true, subtree: true });

  // Session Search
  let sessionSearchMatches = []; // 每個元素為 <mark> DOM 節點
  let sessionSearchIndex = -1;
  const _searchBackups = new Map(); // messageContent el -> original innerHTML

  function openSessionSearch() {
    sessionSearchBar.classList.remove('hidden');
    sessionSearchBtn.classList.add('active');
    sessionSearchInput.focus();
    sessionSearchInput.select();
  }

  function closeSessionSearch() {
    sessionSearchBar.classList.add('hidden');
    sessionSearchBtn.classList.remove('active');
    clearSessionSearchHighlights();
    sessionSearchInput.value = '';
    sessionSearchCount.textContent = '';
    sessionSearchMatches = [];
    sessionSearchIndex = -1;
  }

  function clearSessionSearchHighlights() {
    _searchBackups.forEach((html, el) => { el.innerHTML = html; });
    _searchBackups.clear();
    chatMessages.querySelectorAll('.search-match').forEach(el => {
      el.classList.remove('search-match');
    });
  }

  // 走訪 DOM 樹的文字節點，將關鍵字包在 <mark> 內，回傳所有產生的 <mark> 元素
  function wrapTextNodes(node, lowerQuery, queryLen) {
    const marks = [];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const lower = text.toLowerCase();
      let idx = lower.indexOf(lowerQuery);
      if (idx === -1) return marks;
      const frag = document.createDocumentFragment();
      let last = 0;
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.className = 'search-keyword';
        mark.textContent = text.slice(idx, idx + queryLen);
        frag.appendChild(mark);
        marks.push(mark);
        last = idx + queryLen;
        idx = lower.indexOf(lowerQuery, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
      return marks;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK' ||
          tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE') return marks;
      for (const child of Array.from(node.childNodes)) {
        marks.push(...wrapTextNodes(child, lowerQuery, queryLen));
      }
    }
    return marks;
  }

  function runSessionSearch() {
    clearSessionSearchHighlights();
    sessionSearchMatches = [];
    sessionSearchIndex = -1;
    const query = sessionSearchInput.value.trim();
    const lowerQuery = query.toLowerCase();
    if (!query) {
      sessionSearchCount.textContent = '';
      updateSessionSearchNav();
      return;
    }
    chatMessages.querySelectorAll('.message').forEach(msg => {
      const content = msg.querySelector('.message-content');
      if (!content || !content.textContent.toLowerCase().includes(lowerQuery)) return;
      _searchBackups.set(content, content.innerHTML);
      const marks = wrapTextNodes(content, lowerQuery, query.length);
      if (marks.length > 0) {
        msg.classList.add('search-match');
        sessionSearchMatches.push(...marks);
      }
    });
    if (sessionSearchMatches.length > 0) {
      sessionSearchIndex = 0;
      highlightCurrentMatch();
    }
    updateSessionSearchCount();
    updateSessionSearchNav();
  }

  function highlightCurrentMatch() {
    sessionSearchMatches.forEach((m, i) => {
      m.classList.toggle('search-keyword-current', i === sessionSearchIndex);
    });
    const cur = sessionSearchMatches[sessionSearchIndex];
    if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function updateSessionSearchCount() {
    if (sessionSearchMatches.length === 0) {
      sessionSearchCount.textContent = sessionSearchInput.value.trim() ? '無結果' : '';
    } else {
      sessionSearchCount.textContent = `${sessionSearchIndex + 1}/${sessionSearchMatches.length}`;
    }
  }

  function updateSessionSearchNav() {
    sessionSearchPrev.disabled = sessionSearchMatches.length === 0;
    sessionSearchNext.disabled = sessionSearchMatches.length === 0;
  }

  sessionSearchBtn.addEventListener('click', () => {
    if (sessionSearchBar.classList.contains('hidden')) {
      openSessionSearch();
    } else {
      closeSessionSearch();
    }
  });

  sessionSearchClose.addEventListener('click', closeSessionSearch);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      if (sessionSearchBar.classList.contains('hidden')) {
        openSessionSearch();
      } else {
        closeSessionSearch();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      tocPanel.classList.contains('hidden') ? openToc() : closeToc();
    }
  });

  sessionSearchInput.addEventListener('input', runSessionSearch);

  sessionSearchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sessionSearchMatches.length === 0) return;
      sessionSearchIndex = e.shiftKey
        ? (sessionSearchIndex - 1 + sessionSearchMatches.length) % sessionSearchMatches.length
        : (sessionSearchIndex + 1) % sessionSearchMatches.length;
      highlightCurrentMatch();
      updateSessionSearchCount();
    } else if (e.key === 'Escape') {
      closeSessionSearch();
    }
  });

  sessionSearchNext.addEventListener('click', () => {
    if (sessionSearchMatches.length === 0) return;
    sessionSearchIndex = (sessionSearchIndex + 1) % sessionSearchMatches.length;
    highlightCurrentMatch();
    updateSessionSearchCount();
  });

  sessionSearchPrev.addEventListener('click', () => {
    if (sessionSearchMatches.length === 0) return;
    sessionSearchIndex = (sessionSearchIndex - 1 + sessionSearchMatches.length) % sessionSearchMatches.length;
    highlightCurrentMatch();
    updateSessionSearchCount();
  });

  // Summary Toolbar
  summarizeBtn.addEventListener('click', handleSummarize);
  sessionToVocabularyBtn.addEventListener('click', handleSessionToVocabulary);
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

  // ── 上傳檔案 ──────────────────────────────────────────
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

  // OCR picker：上傳圖片/PDF
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
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxCounter = document.getElementById('lightboxCounter');
  let _lbImages = [];
  let _lbIndex = 0;

  function openLightbox(src) {
    _lbImages = Array.from(chatMessages.querySelectorAll('.message-image')).map(el => el.src);
    _lbIndex = _lbImages.indexOf(src);
    if (_lbIndex === -1) { _lbImages = [src]; _lbIndex = 0; }
    lightboxImg.src = src;
    lightbox.classList.remove('hidden');
    updateLightboxNav();
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
    _lbImages = [];
  }

  function updateLightboxNav() {
    const total = _lbImages.length;
    lightboxPrev.classList.toggle('hidden', total <= 1);
    lightboxNext.classList.toggle('hidden', total <= 1);
    lightboxCounter.textContent = total > 1 ? `${_lbIndex + 1} / ${total}` : '';
    lightboxPrev.style.opacity = _lbIndex === 0 ? '0.3' : '1';
    lightboxNext.style.opacity = _lbIndex === total - 1 ? '0.3' : '1';
  }

  function lightboxGo(delta) {
    const next = _lbIndex + delta;
    if (next < 0 || next >= _lbImages.length) return;
    _lbIndex = next;
    lightboxImg.src = _lbImages[_lbIndex];
    updateLightboxNav();
  }

  lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); lightboxGo(-1); });
  lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); lightboxGo(1); });
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxGo(-1);
    if (e.key === 'ArrowRight') lightboxGo(1);
  });
  // 使用事件委派：chatMessages 內所有 .message-image 均可點擊
  chatMessages.addEventListener('click', (e) => {
    if (e.target.classList.contains('message-image')) {
      openLightbox(e.target.src);
    }
  });

  // ── 歷史面板 ───────────────────────────────────────────
  newSessionBtn.addEventListener('click', async () => {
    closeAllPanels();
    await startNewSessionWithPageContext();
  });

  // 當前對話空間 tag 點擊 → 開啟 space picker
  document.getElementById('currentSessionSpaceTag')?.addEventListener('click', (e) => {
    if (!currentSession) return;
    e.stopPropagation();
    openSpacePicker(e.currentTarget, currentSession);
  });

  // 點擊空白處關閉 space picker
  document.addEventListener('click', (e) => {
    const pop = document.getElementById('spacePickerPopover');
    if (!pop || pop.classList.contains('hidden')) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest('.history-space-tag, #currentSessionSpaceTag')) return;
    closeSpacePicker();
  });

  renameCurrentSessionBtn?.addEventListener('click', async () => {
    if (!currentSession) startNewSession();
    const defaultName = getSessionDefaultName(currentSession);
    const initialName = (currentSession.name || defaultName || '').trim();
    const nextRaw = prompt('請輸入當前對話名稱', initialName);
    if (nextRaw === null) return;
    const nextName = nextRaw.trim();
    const oldName = (currentSession.name || '').trim();
    if (nextName === oldName) return;

    currentSession.name = nextName;
    const idx = sessions.findIndex(s => s.id === currentSession.id);
    if (idx !== -1) {
      sessions[idx].name = nextName;
      await chrome.runtime.sendMessage({
        type: 'RENAME_SESSION',
        data: { sessionId: currentSession.id, name: nextName }
      });
    }
    renderHistory();
    updateCurrentSessionBar();
  });

  deleteCurrentSessionBtn?.addEventListener('click', async () => {
    if (!currentSession) {
      startNewSession();
      return;
    }
    if (!confirm('確定要刪除當前對話嗎？刪除後會立即開啟新對話。')) return;

    const deletingId = currentSession.id;
    try {
      if (sessions.some(s => s.id === deletingId)) {
        await chrome.runtime.sendMessage({ type: 'DELETE_SESSION', data: { sessionId: deletingId } });
        sessions = sessions.filter(s => s.id !== deletingId);
      }

      if (sessionSummaries[deletingId]) {
        delete sessionSummaries[deletingId];
        await chrome.storage.local.set({ sessionSummaries });
      }

      startNewSession();
      renderHistory();
      historyPanel.classList.add('hidden'); toggleHistoryBtn.classList.remove('active');
      setStatus('已刪除當前對話', false, 1600);
    } catch (error) {
      setStatus(`刪除失敗：${error.message}`, true, 2500);
    }
  });

  toggleHistoryBtn.addEventListener('click', () => {
    const isOpen = !historyPanel.classList.contains('hidden');
    closeAllPanels();
    if (!isOpen) {
      historyPanel.classList.remove('hidden');
      toggleHistoryBtn.classList.add('active');
    }
  });

  document.getElementById('historyPanelClose').addEventListener('click', () => {
    historyPanel.classList.add('hidden'); toggleHistoryBtn.classList.remove('active');
    toggleHistoryBtn.classList.remove('active');
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
      historyPanel.classList.add('hidden'); toggleHistoryBtn.classList.remove('active');
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
    const hasContent = messageInput.value.trim() || currentImages.length > 0 || pageContext || pendingCommand;
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
    const { apiKey, geminiApiKey, openrouterApiKey } =
      await chrome.storage.sync.get(['apiKey', 'geminiApiKey', 'openrouterApiKey']);
    const usingMiniMax = currentModel === 'MiniMax-M2.7';
    const hasActiveChatKey = usingMiniMax ? !!apiKey : !!openrouterApiKey;
    const canDirectImageInput = await currentModelSupportsOpenRouterImages(openrouterApiKey);
    const canAnalyzeImages = !!geminiApiKey || canDirectImageInput;

    if (!hasActiveChatKey) {
      setStatus(usingMiniMax ? '請先設定 MiniMax API Key' : '請先設定 OpenRouter API Key', true);
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

    if (!canAnalyzeImages) {
      screenshotBtn.disabled = true;
      uploadBtn.disabled = true;
      regionScreenshotBtn.disabled = true;
      ocrBtn.disabled = true;
      if (currentImages.length > 0) {
        setStatus('目前模型不支援直接圖片輸入，請先設定 Gemini API Key 才能分析圖片', true);
      }
    } else {
      if (hasActiveChatKey) {
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
      updateCurrentSessionBar();
    }
  }

  function getSessionDefaultName(session) {
    if (!session) return '新對話';
    const firstUserMsg = (session.messages || []).find(m => m.role === 'user');
    const fileSuffix = getSessionFileSuffix(session);
    const base = firstUserMsg
      ? firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
      : '新對話';
    return base + fileSuffix;
  }

  function getSessionDisplayName(session) {
    if (!session) return '新對話';
    return (session.name || getSessionDefaultName(session) || '新對話').trim() || '新對話';
  }

  function getSpaceLabel(spaceId) {
    if (!spaceId) return '預設';
    return spaces.find(sp => String(sp.id) === String(spaceId))?.name || '預設';
  }

  function updateCurrentSessionBar() {
    if (currentSessionNameEl) {
      currentSessionNameEl.textContent = getSessionDisplayName(currentSession);
    }
    const spaceTagEl = document.getElementById('currentSessionSpaceTag');
    if (spaceTagEl) {
      spaceTagEl.textContent = getSpaceLabel(currentSession?.spaceId);
      spaceTagEl.dataset.spaceId = currentSession?.spaceId || '';
      spaceTagEl.classList.toggle('is-default', !currentSession?.spaceId);
    }
    if (renameCurrentSessionBtn) {
      renameCurrentSessionBtn.disabled = !currentSession;
    }
    if (deleteCurrentSessionBtn) {
      deleteCurrentSessionBtn.disabled = !currentSession;
    }
    if (sessionToVocabularyBtn) {
      sessionToVocabularyBtn.disabled = !currentSession;
    }
  }

  // ── 空間切換 popover ────────────────────────────────────
  let _spacePickerSession = null;

  function closeSpacePicker() {
    const pop = document.getElementById('spacePickerPopover');
    if (pop) {
      pop.classList.add('hidden');
      pop.innerHTML = '';
    }
    _spacePickerSession = null;
  }

  function openSpacePicker(anchorEl, session) {
    const pop = document.getElementById('spacePickerPopover');
    if (!pop) return;
    if (_spacePickerSession?.id === session.id && !pop.classList.contains('hidden')) {
      closeSpacePicker();
      return;
    }
    _spacePickerSession = session;
    const currentId = session.spaceId || '';
    const items = [
      { id: '', name: '預設', isDefault: true },
      ...spaces.map(sp => ({ id: sp.id, name: sp.name }))
    ];
    pop.innerHTML = items.map(it => `
      <button class="space-picker-item${String(it.id) === String(currentId) ? ' active' : ''}${it.isDefault ? ' is-default' : ''}" data-space-id="${escapeHtml(String(it.id))}">
        <span>${escapeHtml(it.name)}</span>
      </button>
    `).join('');
    pop.querySelectorAll('.space-picker-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newSpaceId = btn.dataset.spaceId || null;
        await assignSessionToSpace(session, newSpaceId);
        closeSpacePicker();
      });
    });
    // 定位
    const rect = anchorEl.getBoundingClientRect();
    pop.classList.remove('hidden');
    const popRect = pop.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.left;
    if (left + popRect.width > window.innerWidth - 8) left = window.innerWidth - popRect.width - 8;
    if (top + popRect.height > window.innerHeight - 8) top = rect.top - popRect.height - 4;
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  async function assignSessionToSpace(session, newSpaceId) {
    const normalized = newSpaceId || null;
    if ((session.spaceId || null) === normalized) return;
    session.spaceId = normalized;
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) sessions[idx].spaceId = normalized;
    if (currentSession && currentSession.id === session.id) {
      currentSession.spaceId = normalized;
    }
    await chrome.runtime.sendMessage({
      type: 'SAVE_SESSION',
      data: { session: sessions[idx] || session }
    });
    renderHistory();
    updateCurrentSessionBar();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    if (sessions.length === 0) {
      historyList.innerHTML = '<p class="history-empty">尚無歷史紀錄</p>';
      if (batchSelectMode) exitBatchMode();
      updateCurrentSessionBar();
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
      updateCurrentSessionBar();
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
        const fileSuffix = getSessionFileSuffix(session);
        const defaultPreview = firstUserMsg
          ? firstUserMsg.content.substring(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
          : '新對話';
        let displayName = session.name || (defaultPreview + fileSuffix);

        // 關鍵字高亮
        if (query) {
          const escaped = escapeHtml(displayName);
          const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          displayName = escaped.replace(re, '<mark>$1</mark>');
        } else {
          displayName = escapeHtml(displayName);
        }

        if (batchSelectMode) {
          const spaceLabel = getSpaceLabel(session.spaceId);
          const isDefaultSpace = !session.spaceId;
          div.innerHTML = `
            <button class="history-space-tag${isDefaultSpace ? ' is-default' : ''}" title="切換空間" data-id="${session.id}">${escapeHtml(spaceLabel)}</button>
            <div class="history-item-content">
              <label class="history-checkbox-label">
                <input type="checkbox" class="history-checkbox" ${selectedIds.has(session.id) ? 'checked' : ''}>
              </label>
              <div class="history-item-body">
                <p class="history-preview" title="${escapeHtml(session.name || defaultPreview)}">${displayName}</p>
                <span class="history-time">${formatTime(session.timestamp)}</span>
              </div>
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
          div.querySelector('.history-space-tag').addEventListener('click', (e) => {
            e.stopPropagation();
            openSpacePicker(e.currentTarget, session);
          });
        } else {
          const spaceLabel = getSpaceLabel(session.spaceId);
          const isDefaultSpace = !session.spaceId;
          div.innerHTML = `
            <button class="history-space-tag${isDefaultSpace ? ' is-default' : ''}" title="切換空間" data-id="${session.id}">${escapeHtml(spaceLabel)}</button>
            <div class="history-item-content">
              <div class="history-item-body">
                <p class="history-preview" title="${escapeHtml(session.name || defaultPreview)}">${displayName}</p>
                <div class="history-item-meta">
                  <span class="history-time">${formatTime(session.timestamp)}</span>
                </div>
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
            </div>
          `;
          div.querySelector('.history-item-body').addEventListener('click', (e) => {
            if (e.target.closest('.history-space-tag')) return;
            loadSession(originalIdx);
          });
          div.querySelector('.history-space-tag').addEventListener('click', (e) => {
            e.stopPropagation();
            openSpacePicker(e.currentTarget, session);
          });
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
    updateCurrentSessionBar();
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
      updateCurrentSessionBar();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderHistory(); updateCurrentSessionBar(); }
    });
  }

  function loadSession(index) {
    currentSession = sessions[index];
    chatMessages.innerHTML = '';
    updateCurrentSessionBar();
    messageInput.value = '';
    messageInput.style.height = 'auto';
    updateCharCounter();

    currentSession.messages.forEach(msg => {
      // 計畫歷程卡
      if (msg.role === 'plan') {
        const statusLabel = msg.status === 'approved' ? '已批准' : msg.status === 'cancelled' ? '已取消' : '待處理';
        const statusClass = msg.status === 'approved' ? 'approved' : msg.status === 'cancelled' ? 'cancelled' : 'pending';
        const div = document.createElement('div');
        div.className = `plan-history-record plan-history-${statusClass}`;
        div.innerHTML = `<span class="plan-history-icon">${getToolIconSvg('plan')}</span><span class="plan-history-summary">${escapeHtml(msg.summary || msg.originalMessage || '計畫')}</span><span class="plan-history-status">${statusLabel}</span>`;
        chatMessages.appendChild(div);
        return;
      }
      // 歷史訊息不知道當時語言設定，用內容自動偵測
      const ttsLang = detectLang(msg.content);
      if (msg.role === 'assistant' && msg.searchLog?.length > 0) {
        chatMessages.appendChild(buildSearchHistoryEl(msg.searchLog));
      }
      const attachments = legacyMessageAttachments(msg);
      if (attachments.length > 0) {
        addMessageWithAttachments(msg.content, msg.role, attachments, ttsLang);
      } else {
        addMessage(msg.content, msg.role, ttsLang, msg.thinkContent || '', msg.continuation || null);
      }
    });

    emptyState.classList.add('hidden');
    historyPanel.classList.add('hidden'); toggleHistoryBtn.classList.remove('active');
    scrollToBottom();
  }

  function startNewSession() {
    currentSession = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      messages: [],
      model: currentModel
    };
    messageQueue = [];
    updateQueueIndicator();
    chatMessages.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateCurrentSessionBar();
    updateCharCounter();
  }

  async function startNewSessionWithPageContext() {
    startNewSession();
    clearPageContext();
    await attachPageContext({ focusInput: false });
  }

  function renderQueueList() {
    queueListEl.innerHTML = '';
    messageQueue.forEach((item, idx) => {
      let preview;
      if (item.message) {
        preview = item.message.length > 55 ? item.message.slice(0, 55) + '…' : item.message;
      } else if (item.images.length > 0) {
        const first = item.images[0];
        preview = first.fileName ? `附件 ${first.fileName}` : `附件 ${item.images.length} 個`;
      } else if (item.pageCtx) {
        preview = `頁面 ${(item.pageCtx.title || '頁面').slice(0, 35)}`;
      } else {
        preview = '（空）';
      }
      const div = document.createElement('div');
      div.className = 'queue-item';
      div.innerHTML = `
        <span class="queue-item-num">${idx + 1}</span>
        <span class="queue-item-text" title="${escapeAttr(item.message || '')}">${escapeHtml(preview)}</span>
        <button class="queue-item-delete" data-idx="${idx}" title="從佇列移除">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>`;
      queueListEl.appendChild(div);
    });
  }

  function updateQueueIndicator() {
    if (messageQueue.length === 0) {
      queuePanel.classList.add('hidden');
      queueListEl.classList.add('hidden');
      queueChevron.style.transform = '';
      queueListOpen = false;
      return;
    }
    queuePanel.classList.remove('hidden');
    queueCount.textContent = messageQueue.length;
    if (queueListOpen) renderQueueList();
  }

  // ── 發送訊息 ────────────────────────────────────────────
  async function handleSend(options = {}) {
    const programmaticMessage = typeof options.apiMessageOverride === 'string';
    // 有待執行指令時，用輸入框文字作為 args 執行
    let commandDisplayLabel = null;
    let planModeForSend = false;
    // 強制計畫模式：每次發送都需批准
    if (planModeSetting === 'always' && !planModeForSend && !programmaticMessage) {
      planModeForSend = true;
    }
    const pendingWasSet = !!pendingCommand;
    if (!programmaticMessage && pendingCommand) {
      const { cmd } = pendingCommand;
      const args = messageInput.value.trim();
      clearCommandChip();
      messageInput.value = '';
      messageInput.style.height = 'auto';
      updateSendButton();
      if (cmd.trigger === '/plan') {
        if (!args && !pageContext && !currentImages.length) { messageInput.focus(); return; }
        planModeForSend = true;
        commandDisplayLabel = cmd.name + (args ? ` · ${args}` : '');
        messageInput.value = args;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        updateSendButton();
      } else if (cmd.type === 'template') {
        const filled = cmd.template.replace('{input}', args);
        if (!filled.trim()) { messageInput.focus(); return; }
        // 記錄縮減顯示標籤
        commandDisplayLabel = cmd.name + (args ? ` · ${args}` : '');
        messageInput.value = filled;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        updateSendButton();
        // 讓正常發送流程繼續帶著 filled 內容送出
      } else {
        executeAction(cmd.trigger, args);
        return;
      }
    }

    let message = programmaticMessage
      ? (options.displayMessageOverride || options.apiMessageOverride).trim()
      : messageInput.value.trim();
    if (!message && !currentImages.length && !pageContext) return;

    // 意圖偵測：自動對應指令（僅在非載入中、無明確 /指令、無待執行指令時）
    if (!programmaticMessage && !isLoading && !pendingWasSet && message && !message.startsWith('/')) {
      const intent = detectCommandIntent(message, getAllCommands());
      if (intent) {
        if (intent.type === 'fetch-page' || intent.type === 'fetch-page-code') {
          if (!pageContext) {
            let ctx;
            if (intent.type === 'fetch-page') {
              ctx = await attachPageContext({ focusInput: false });
            } else {
              ctx = await attachPageCodeContext({ question: message, focusInput: false });
            }
            if (!ctx) return;
          }
          // pageContext 已設定，繼續走正常發送流程
        } else if (intent.type === 'execute') {
          messageInput.value = '';
          messageInput.style.height = 'auto';
          updateSendButton();
          executeAction(intent.trigger, intent.args);
          return;
        } else if (intent.type === 'plan') {
          if (!intent.task && !pageContext && !currentImages.length) return;
          planModeForSend = true;
          commandDisplayLabel = '計畫模式' + (intent.task ? ` · ${intent.task}` : '');
          message = intent.task;
          messageInput.value = intent.task;
          messageInput.style.height = 'auto';
          messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
          updateSendButton();
        } else if (intent.type === 'template') {
          const filled = intent.cmd.template.replace('{input}', intent.args);
          if (filled.trim()) {
            message = filled;
            messageInput.value = filled;
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
            commandDisplayLabel = intent.cmd.name;
            updateSendButton();
          }
        }
      }
    }

    // 串流中：入佇列，等待當前回覆完成後自動送出
    if (isLoading) {
      if (programmaticMessage) {
        setStatus('目前仍有回覆進行中，完成後再繼續搜尋。', true, 3000);
        return;
      }
      messageQueue.push({
        message,
        images: [...currentImages],
        pageCtx: pageContext ? { ...pageContext } : null
      });
      messageInput.value = '';
      messageInput.style.height = 'auto';
      if (currentImages.length) clearImageData();
      if (pageContext) clearPageContext();
      updateSendButton();
      updateQueueIndicator();
      return;
    }

    // 存入輸入歷史（去重、上限 10 則）
    if (!programmaticMessage && message) {
      inputHistory = inputHistory.filter(h => h !== message);
      inputHistory.push(message);
      if (inputHistory.length > 10) inputHistory.shift();
    }
    inputHistoryIndex = -1;
    inputHistorySaved = '';

    // 指令路由：若訊息以已知指令開頭，交給 executeAction 處理
    if (!programmaticMessage && message.startsWith('/')) {
      const allCmds = getAllCommands();
      const matchedCmd = allCmds.find(c => message === c.trigger || message.startsWith(c.trigger + ' '));
      if (matchedCmd) {
        const args = message.slice(matchedCmd.trigger.length).trim();
        if (matchedCmd.trigger === '/plan') {
          if (!args && !pageContext && !currentImages.length) { messageInput.value = ''; updateSendButton(); messageInput.focus(); return; }
          planModeForSend = true;
          commandDisplayLabel = matchedCmd.name + (args ? ` · ${args}` : '');
          message = args;
          messageInput.value = args;
          messageInput.style.height = 'auto';
          updateSendButton();
        } else {
          messageInput.value = '';
          messageInput.style.height = 'auto';
          updateSendButton();
          executeAction(matchedCmd.trigger, args);
          return;
        }
      }
    }

    if (!currentSession) {
      startNewSession();
    }

    isLoading = true;
    typingIndicator.classList.remove('hidden');
    emptyState.classList.add('hidden');
    clearStatus();

    // 若有頁面內容，包裝 user message（先擷取標題供顯示用）
    const pageTitle = programmaticMessage ? null : pageContext?.title;
    const hadPageContext = programmaticMessage ? false : !!pageContext; // 記錄是否有頁面內容（buildPageContextMessage 會清除 pageContext）
    const isPageOnly = !programmaticMessage && !message && !!pageContext;
    const isLongPage = !programmaticMessage && !!pageContext && pageContext.text.length > PAGE_INLINE_LIMIT;
    // 長頁：轉 text file（buildPageContextFile 內會 clearPageContext）
    const pageFile = isLongPage ? buildPageContextFile() : null;
    const knowledgePrefix = programmaticMessage ? '' : buildKnowledgeBlock();
    const finalMessage = programmaticMessage ? options.apiMessageOverride : knowledgePrefix + buildPageContextMessage(message);
    // 清除已選知識庫 chips
    if (!programmaticMessage) {
      selectedKnowledge = [];
      renderKnowledgeChips();
    }

    // 長輸入（貼入代碼/大量文字）自動轉 text file 走 pipeline 分段分析
    const LARGE_INPUT_LIMIT = 6000;
    let longInputFile = null;
    let apiMessage = finalMessage;
    if (!pageFile && !currentImages.length && message.length > LARGE_INPUT_LIMIT) {
      const b64 = btoa(unescape(encodeURIComponent(message)));
      longInputFile = { dataUrl: `data:text/plain;base64,${b64}`, fileType: 'text', fileName: '輸入內容.txt' };
      apiMessage = ''; // 內容已在 file，無需重複附在訊息
    }

    // 顯示訊息
    const displayMessage = programmaticMessage
      ? (options.displayMessageOverride || '繼續深入搜尋')
      : commandDisplayLabel
      ? commandDisplayLabel
      : isPageOnly
        ? `讀取頁面：${pageTitle?.slice(0, 40) || '目前頁面'}`
        : longInputFile
          ? `長輸入（${(message.length / 1000).toFixed(1)}k 字）`
          : message;

    const userMessage = { role: 'user', content: displayMessage };
    const snapshotImages = programmaticMessage ? [] : [...currentImages]; // 快照，避免 clearImageData 後遺失
    if (pageFile) snapshotImages.unshift(pageFile); // 長頁 file 插到最前
    if (longInputFile) snapshotImages.unshift(longInputFile); // 長輸入 file
    if (snapshotImages.length > 0) {
      userMessage.images = snapshotImages.map(i => i.dataUrl); // backward compat
      userMessage.fileInfos = snapshotImages.map(i => ({ fileType: i.fileType || 'image', fileName: i.fileName || null }));
      userMessage.attachments = filesToAttachments(snapshotImages);
    }

    currentSession.messages.push(userMessage);
    addMessageWithAttachments(displayMessage, 'user', userMessage.attachments || filesToAttachments(snapshotImages));

    const textMessage = apiMessage;

    if (!programmaticMessage) {
      messageInput.value = '';
      messageInput.style.height = 'auto';
      clearImageData();
    }

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

    const systemPrompt = '';
    const memoryContext = buildMemoryBlock();
    const replyLang = translateEnabled ? null : sourceLangSelect.value;

    // Agent Loop 接管搜尋決策，skipTools 時回退正常 streaming
    const augmentedMessage = textMessage;
    const skipTools = programmaticMessage ? false : !!(snapshotImages.length || translateEnabled || hadPageContext);

    // 建立即時串流訊息 div
    _agentSearchLog = [];
    _agentNotices = [];
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
      // 佇列有訊息：還原並自動送出
      if (messageQueue.length > 0) {
        const next = messageQueue.shift();
        messageInput.value = next.message;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        if (next.images.length > 0) {
          currentImages = next.images;
          renderImagePreviews();
        }
        if (next.pageCtx) {
          pageContext = next.pageCtx;
          renderPageContextChip();
        }
        updateSendButton();
        updateQueueIndicator();
        setTimeout(() => handleSend(), 50);
      } else {
        messageInput.focus();
      }
    }

    // 若計畫模式設為關閉，強制 reset（不觸發計畫批准流程）
    if (planModeSetting === 'off') {
      planModeForSend = false;
    }

    const requestData = {
      message: augmentedMessage,
      history: historyForApi,
      images: snapshotImages,
      translateConfig,
      model: currentModel,
      contextCharBudget: getCurrentContextCharBudget(),
      maxAgentIterations: getCurrentAgentDepthConfig().iterations,
      systemPrompt,
      memoryContext,
      sessionId: currentSession?.id,
      skipTools,
      planMode: planModeForSend,
      spaceInstructions: currentSession?.spaceId ? (spaces.find(s => s.id === currentSession.spaceId)?.instructions || '') : ''
    };

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'status') {
        setStatus(msg.text);
        return;
      }
      if (msg.type === 'agent_notice') {
        const notice = {
          text: msg.text || '',
          level: msg.level === 'warning' || msg.level === 'error' ? msg.level : 'info'
        };
        if (notice.text) {
          _agentNotices.push(notice);
          setStatus(notice.text, notice.level === 'error', notice.level === 'info' ? 3500 : 6000);
        }
        return;
      }
      if (msg.type === 'compressed') {
        setStatus('歷史對話已自動壓縮，保留最近輪次', false, 3000);
        return;
      }
      if (msg.type === 'agent_thinking') {
        _agentIter = msg.iter;
        if (!agentStatusEl) startAgentStatus();
        updateAgentStatus(msg.maxIter ? `第 ${msg.iter}/${msg.maxIter} 輪，思考中...` : `第 ${msg.iter} 輪，思考中...`);
        return;
      }
      if (msg.type === 'tool_start') {
        const label = getAgentToolLabel(msg.tool);
        updateAgentStatus(`第 ${_agentIter} 輪 · ${label}：${msg.query}`);
        _agentSearchLog.push({ tool: msg.tool, query: msg.query, count: null });
        return;
      }
      if (msg.type === 'tool_done') {
        updateAgentStatus(msg.error ? `第 ${_agentIter} 輪，工具失敗，改用補救流程...` : `第 ${_agentIter} 輪，分析結果中...`);
        if (_agentSearchLog.length > 0) {
          _agentSearchLog[_agentSearchLog.length - 1].count = msg.count;
          _agentSearchLog[_agentSearchLog.length - 1].error = msg.error || null;
        }
        return;
      }
      if (msg.type === 'plan_required') {
        liveDiv.remove();
        clearAgentStatus();
        _agentSearchLog = [];
        _agentNotices = [];
        clearStatus();
        resetLoading();
        port.disconnect();
        chatMessages.appendChild(buildPlanApprovalEl(msg.plan, requestData));
        scrollToBottom();
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
        const savedAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0 ? msg.attachments : null;
        const reply = (msg.reply && String(msg.reply).trim())
          ? msg.reply
          : (savedAttachments ? '已生成圖片。' : '');
        if (!reply) {
          liveDiv.remove();
          addMessage('錯誤: 模型未返回文字內容，請稍後重試或切換模型。', 'error');
          clearAgentStatus();
          _agentSearchLog = [];
          _agentNotices = [];
          clearStatus();
          port.disconnect();
          resetLoading();
          return;
        }
        const rawForFinalize = rawContent || reply;
        const doneThinkMatch = !translateEnabled && rawForFinalize.match(/<think>([\s\S]*?)<\/think>/i);
        const thinkContent = doneThinkMatch ? doneThinkMatch[1].trim() : undefined;
        const savedSearchLog = _agentSearchLog.length > 0 ? [..._agentSearchLog] : null;
        const savedAgentNotices = _agentNotices.length > 0 ? [..._agentNotices] : null;
        const savedUsage = msg.usage && Number(msg.usage.totalTokens || 0) > 0 ? msg.usage : null;
        const savedContinuation = msg.continuation?.prompt
          ? { prompt: msg.continuation.prompt, label: msg.continuation.label || '繼續深入搜尋' }
          : null;
        currentSession.messages.push({ role: 'assistant', content: reply, ...(thinkContent && { thinkContent }), ...(savedSearchLog && { searchLog: savedSearchLog }), ...(savedAttachments && { attachments: savedAttachments }), ...(savedUsage && { usage: savedUsage }), ...(savedContinuation && { continuation: savedContinuation }) });
        if (savedAgentNotices) {
          liveDiv.parentNode.insertBefore(buildAgentNoticeEl(savedAgentNotices), liveDiv);
        }
        if (savedSearchLog) {
          liveDiv.parentNode.insertBefore(buildSearchHistoryEl(savedSearchLog), liveDiv);
        }
        finalizeLiveMessage(liveDiv, rawForFinalize, reply, replyLang, savedAttachments, savedContinuation);
        clearAgentStatus();
        _agentSearchLog = [];
        _agentNotices = [];
        clearStatus();
        port.disconnect();
        resetLoading();
        await saveCurrentSession();
        await loadHistory();
        updateCharCounter();
        const { autoMemoryEnabled } = await chrome.storage.sync.get(['autoMemoryEnabled']);
        if (autoMemoryEnabled && message && reply) {
          chrome.runtime.sendMessage({
            type: 'EXTRACT_MEMORY',
            data: { userMessage: message, aiReply: reply }
          }).then(async (res) => {
            if (res.success && res.items.length > 0) {
              for (const item of res.items) {
                // 新格式：物件有 title/summary；舊格式相容：字串
                if (typeof item === 'string') {
                  await addMemory(item, 'auto');
                } else if (item && item.summary) {
                  const trimmed = item.summary.trim();
                  if (!trimmed) continue;
                  if (memories.some(m => (m.summary || m.text) === trimmed)) continue;
                  memories.push({
                    id: `mem_${Date.now()}`,
                    title: (item.title || trimmed).slice(0, 30),
                    summary: trimmed,
                    tags: Array.isArray(item.tags) ? item.tags : [],
                    source: 'auto',
                    category: '',
                    createdAt: Date.now()
                  });
                  if (memories.length > 30) memories.shift();
                  await saveMemories();
                }
              }
            }
          }).catch(() => {});
        }
        return;
      }
      if (msg.type === 'error') {
        liveDiv.remove();
        addMessage(`錯誤: ${msg.message}`, 'error');
        clearAgentStatus();
        _agentSearchLog = [];
        _agentNotices = [];
        clearStatus();
        port.disconnect();
        resetLoading();
      }
    });

    port.onDisconnect.addListener(async () => {
      // 僅處理非主動停止的意外斷線（主動停止已在 click handler 清理完畢）
      if (!isLoading) return;
      clearAgentStatus();
      _agentSearchLog = [];
      _agentNotices = [];
      clearStatus();
      const disconnectErr = chrome.runtime.lastError?.message;
      if (rawContent) {
        // 有部分回應：保留已產生的內容並標注中斷
        const partial = rawContent.trimEnd();
        currentSession.messages.push({ role: 'assistant', content: partial });
        finalizeLiveMessage(liveDiv, partial, partial, replyLang, null);
        await saveCurrentSession();
        await loadHistory();
        addMessage(`⚠️ 回應中斷（連線異常），以上為部分內容。${disconnectErr ? `\n[Debug] ${disconnectErr}` : ''}`, 'error');
      } else {
        liveDiv.remove();
        const errMsg = disconnectErr || '連線中斷，背景服務未回應，請稍後重試。';
        addMessage(`錯誤: ${errMsg}`, 'error');
      }
      resetLoading();
    });

    port.postMessage({ type: 'STREAM_MESSAGE', data: requestData });
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

  function finalizeLiveMessage(div, raw, cleanReply, lang, attachments = null, continuation = null) {
    const replyLive = div.querySelector('.reply-live');
    if (replyLive) {
      replyLive.className = '';
      replyLive.innerHTML = renderMarkdown(cleanReply);
    }
    if (attachments && attachments.length > 0) {
      const attachmentHtml = renderAttachments(attachments);
      if (attachmentHtml) {
        const contentEl = div.querySelector('.message-content');
        contentEl?.insertAdjacentHTML('afterbegin', attachmentHtml);
      }
    }
    // 翻譯模式下強制隱藏思考過程區塊
    if (translateEnabled) {
      div.querySelector('.think-box')?.classList.add('hidden');
    }
    const actionsHtml = buildMessageActions(cleanReply, resolveTTSLang('assistant', lang, cleanReply), 'assistant');
    div.querySelector('.message-content').insertAdjacentHTML('afterend', actionsHtml);
    appendContinuationAction(div, continuation);
    div.querySelector('.btn-tts')?.addEventListener('click', handleTTS);
    div.querySelector('.btn-copy')?.addEventListener('click', handleCopy);
    div.classList.remove('message-live');
    scrollToBottom();
  }

  function appendContinuationAction(messageEl, continuation) {
    if (!messageEl || !continuation?.prompt) return;
    const action = document.createElement('div');
    action.className = 'agent-continuation-action';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-agent-continue';
    btn.textContent = continuation.label || '繼續深入搜尋';
    btn.addEventListener('click', async () => {
      if (isLoading) {
        setStatus('目前仍有回覆進行中，完成後再繼續搜尋。', true, 3000);
        return;
      }
      btn.disabled = true;
      await handleSend({
        apiMessageOverride: continuation.prompt,
        displayMessageOverride: continuation.label || '繼續深入搜尋上一段未完成的部分'
      });
      action.remove();
    });
    action.appendChild(btn);
    messageEl.appendChild(action);
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
    const currentNotice = statusNoticeEl;
    if (duration > 0) {
      setTimeout(() => {
        if (statusNoticeEl === currentNotice) {
          statusNoticeEl.remove();
          statusNoticeEl = null;
        }
      }, duration);
    }
  }
  function clearStatus() { setStatus(''); }

  // ── Agent Loop 狀態列（持續顯示於聊天區底部，帶秒數計時）───────────
  function _createAgentStatusEl() {
    if (agentStatusEl) return;
    agentStatusEl = document.createElement('div');
    agentStatusEl.className = 'agent-status-bar';
    agentStatusEl.innerHTML =
      '<span class="agent-status-dot"></span>' +
      '<span class="agent-status-text">思考中...</span>' +
      '<span class="agent-status-timer">0s</span>';
    chatMessages.appendChild(agentStatusEl);
    scrollToBottom();
  }

  function startAgentStatus() {
    _agentStartTime = Date.now();
    _agentIter = 1;
    _createAgentStatusEl();
    _agentTimer = setInterval(() => {
      if (!agentStatusEl) return;
      const elapsed = Math.floor((Date.now() - _agentStartTime) / 1000);
      agentStatusEl.querySelector('.agent-status-timer').textContent = elapsed + 's';
    }, 1000);
  }

  function updateAgentStatus(text) {
    if (!agentStatusEl) _createAgentStatusEl();
    agentStatusEl.querySelector('.agent-status-text').textContent = text;
    scrollToBottom();
  }

  function clearAgentStatus() {
    if (_agentTimer) { clearInterval(_agentTimer); _agentTimer = null; }
    if (agentStatusEl) { agentStatusEl.remove(); agentStatusEl = null; }
    _agentStartTime = 0;
    _agentIter = 0;
  }

  function getToolIconSvg(kind) {
    const map = {
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
      deep_search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>',
      api: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M4.2 7.5l3.5 2"/><path d="M16.3 14.5l3.5 2"/><path d="M19.8 7.5l-3.5 2"/><path d="M7.7 14.5l-3.5 2"/><circle cx="12" cy="12" r="5"/></svg>',
      finance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-7"/><path d="M19 7v5h-5"/></svg>',
      plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
      browser_click: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3l10 10-5 1.2L9.8 20 7 3Z"/></svg>',
      browser_fill: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      browser_select: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>',
      browser_get_text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h4"/></svg>',
      browser_get_html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 9-4 3 4 3"/><path d="m16 9 4 3-4 3"/><path d="m14 5-4 14"/></svg>',
      browser_scroll: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m8 9 4-4 4 4"/><path d="m8 15 4 4 4-4"/></svg>',
      browser_wait_for: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      browser_navigate: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>'
    };
    return map[kind] || map.api;
  }

  function getBrowserToolLabel(tool) {
    const map = {
      browser_click: '點擊', browser_fill: '填入', browser_select: '選擇',
      browser_get_text: '讀取文字', browser_get_html: '讀取 HTML',
      browser_scroll: '捲動', browser_wait_for: '等待元素', browser_navigate: '開新分頁'
    };
    return map[tool] || tool;
  }

  function getAgentToolLabel(tool) {
    if (tool === 'deep_search') return '深度搜尋';
    if (tool === 'web_search') return '搜尋網路';
    if (tool?.startsWith('browser_')) return getBrowserToolLabel(tool);
    if (tool?.startsWith('finance_')) {
      const map = {
        finance_resolve_symbol: '辨識標的',
        finance_get_quote: '查詢報價',
        finance_get_history: '查詢歷史走勢',
        finance_get_company_profile: '查詢公司資訊',
        finance_get_fundamentals: '查詢基本面',
        finance_get_news: '查詢金融新聞',
        finance_get_risk_trend: '計算風險走勢'
      };
      return map[tool] || '金融資料';
    }
    return tool;
  }

  function buildSearchHistoryEl(log) {
    const total = log.length;
    const hasBrowser = log.some(e => e.tool?.startsWith('browser_'));
    const hasApi = log.some(e => !['deep_search','web_search'].includes(e.tool) && !e.tool?.startsWith('browser_'));
    const summaryText = (hasBrowser || hasApi) ? `已執行 ${total} 次操作` : `已執行 ${total} 次搜尋`;
    const items = log.map(e => {
      let icon, label;
      if (e.tool === 'deep_search') { icon = getToolIconSvg('deep_search'); label = '深度搜尋'; }
      else if (e.tool === 'web_search') { icon = getToolIconSvg('search'); label = '搜尋'; }
      else if (e.tool?.startsWith('browser_')) { icon = getToolIconSvg(e.tool); label = getBrowserToolLabel(e.tool); }
      else if (e.tool?.startsWith('finance_')) { icon = getToolIconSvg('finance'); label = getAgentToolLabel(e.tool); }
      else { icon = getToolIconSvg('api'); label = e.tool; }
      const countStr = e.error
        ? `<span class="agent-sh-count error">失敗</span>`
        : (e.count != null ? `<span class="agent-sh-count">${e.count} 筆</span>` : '');
      const errorText = e.error ? `<div class="agent-sh-error">${escapeHtml(e.error)}</div>` : '';
      const queryText = e.query ? `<span class="agent-sh-query">「${escapeHtml(e.query)}」</span>` : '';
      return `<li><span class="agent-sh-icon">${icon}</span><span class="agent-sh-label">${escapeHtml(label)}</span>${queryText}${countStr}${errorText}</li>`;
    }).join('');
    const div = document.createElement('div');
    div.className = 'agent-search-history';
    div.innerHTML =
      `<details class="agent-search-details">` +
      `<summary><span class="agent-sh-summary-text">${summaryText}</span><span class="agent-sh-chevron">▾</span></summary>` +
      `<ul class="agent-search-log">${items}</ul>` +
      `</details>`;
    return div;
  }

  function buildAgentNoticeEl(notices) {
    const filtered = (notices || []).filter(n => n?.text);
    const div = document.createElement('div');
    div.className = 'agent-notice-list';
    div.innerHTML = filtered.map(n => {
      const level = n.level === 'warning' || n.level === 'error' ? n.level : 'info';
      return `<div class="agent-notice agent-notice-${level}">${escapeHtml(n.text)}</div>`;
    }).join('');
    return div;
  }

  function buildPlanApprovalEl(plan, requestData) {
    const steps = Array.isArray(plan?.steps) && plan.steps.length > 0
      ? plan.steps
      : String(plan?.text || '').split(/\n+/).map(s => s.replace(/^\d+[\).\s-]*/, '').trim()).filter(Boolean).slice(0, 6);
    const tools = Array.isArray(plan?.tools) && plan.tools.length > 0 ? plan.tools : ['既有 Agent 工具'];
    const sites = Array.isArray(plan?.sites) && plan.sites.length > 0 ? plan.sites : [];

    // 計畫持久化：寫入 session（pending 狀態）
    if (currentSession) {
      const planRecord = {
        role: 'plan',
        status: 'pending',
        summary: plan?.summary || '',
        tools: plan?.tools || [],
        risk: plan?.risk || '',
        originalMessage: requestData?.message || ''
      };
      currentSession.messages.push(planRecord);
      _currentPlanRecordIndex = currentSession.messages.length - 1;
      saveCurrentSession();
    }

    // 風險等級
    const riskText = plan?.risk || '';
    const riskLevel = /高/.test(riskText) ? 'high' : /中/.test(riskText) ? 'medium' : 'low';
    const riskLabel = { high: '高風險', medium: '中風險', low: '低風險' }[riskLevel];
    const riskReason = riskText.replace(/^(低|中|高)\s*[—\-–]\s*/u, '').trim();

    const card = document.createElement('div');
    card.className = 'agent-plan-card';
    card.innerHTML = `
      <div class="agent-plan-header">
        <span class="agent-plan-icon">${getToolIconSvg('plan')}</span>
        <span>計畫模式</span>
      </div>
      <div class="agent-plan-body">
        ${sites.length ? `<div class="agent-plan-section"><span>允許存取</span><strong>${sites.map(escapeHtml).join('、')}</strong></div>` : ''}
        <div class="agent-plan-section"><span>可用工具</span><strong>${tools.map(escapeHtml).join('、')}</strong></div>
        <div class="agent-plan-section">
          <span>風險等級</span>
          <strong class="plan-risk-badge plan-risk-${riskLevel}">${riskLabel}${riskReason ? ` — ${escapeHtml(riskReason)}` : ''}</strong>
        </div>
        <div class="agent-plan-section">
          <span>執行步驟</span>
          <ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        </div>
      </div>
      <div class="agent-plan-actions">
        <button type="button" class="agent-plan-approve">批准計畫</button>
        <button type="button" class="agent-plan-cancel">修改計畫</button>
      </div>
      <div class="agent-plan-footnote">批准後才會執行工具。高風險 API / SSH 工具未啟用。</div>
    `;
    card.querySelector('.agent-plan-approve').addEventListener('click', () => {
      // 更新 session 狀態為 approved
      if (_currentPlanRecordIndex >= 0 && currentSession?.messages[_currentPlanRecordIndex]?.role === 'plan') {
        currentSession.messages[_currentPlanRecordIndex].status = 'approved';
        saveCurrentSession();
        _currentPlanRecordIndex = -1;
      }
      card.remove();
      runApprovedPlan(requestData, plan);
    });
    card.querySelector('.agent-plan-cancel').addEventListener('click', () => {
      // 更新 session 狀態為 cancelled
      if (_currentPlanRecordIndex >= 0 && currentSession?.messages[_currentPlanRecordIndex]?.role === 'plan') {
        currentSession.messages[_currentPlanRecordIndex].status = 'cancelled';
        saveCurrentSession();
        _currentPlanRecordIndex = -1;
      }
      card.remove();
      // 把原始任務帶回輸入框，恢復 /plan chip
      const originalMsg = requestData?.message || '';
      const planCmd = BUILTIN_COMMANDS.find(c => c.trigger === '/plan');
      if (planCmd && originalMsg) {
        showCommandChip(planCmd, originalMsg);
      } else if (originalMsg) {
        messageInput.value = originalMsg;
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        updateSendButton();
      }
      messageInput.focus();
    });
    return card;
  }

  function runApprovedPlan(requestData, plan) {
    if (isLoading) return;
    isLoading = true;
    typingIndicator.classList.add('hidden');
    emptyState.classList.add('hidden');
    clearStatus();
    _agentSearchLog = [];
    _agentNotices = [];

    const liveDiv = createLiveMessageDiv();
    currentLiveDiv = liveDiv;
    currentRawContent = '';
    let rawContent = '';
    const port = chrome.runtime.connect({ name: 'chat-stream' });
    currentPort = port;
    setStreamingMode(true);

    function resetApprovedLoading() {
      isLoading = false;
      currentPort = null;
      currentLiveDiv = null;
      currentRawContent = '';
      setStreamingMode(false);
      messageInput.focus();
    }

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'status') { setStatus(msg.text); return; }
      if (msg.type === 'agent_notice') {
        const notice = { text: msg.text || '', level: msg.level === 'warning' || msg.level === 'error' ? msg.level : 'info' };
        if (notice.text) _agentNotices.push(notice);
        return;
      }
      if (msg.type === 'agent_thinking') {
        _agentIter = msg.iter;
        if (!agentStatusEl) startAgentStatus();
        updateAgentStatus(msg.maxIter ? `第 ${msg.iter}/${msg.maxIter} 輪，思考中...` : `第 ${msg.iter} 輪，思考中...`);
        return;
      }
      if (msg.type === 'tool_start') {
        const label = getAgentToolLabel(msg.tool);
        updateAgentStatus(`第 ${_agentIter} 輪 · ${label}：${msg.query}`);
        _agentSearchLog.push({ tool: msg.tool, query: msg.query, count: null });
        return;
      }
      if (msg.type === 'tool_done') {
        updateAgentStatus(msg.error ? `第 ${_agentIter} 輪，工具失敗，改用補救流程...` : `第 ${_agentIter} 輪，分析結果中...`);
        if (_agentSearchLog.length > 0) {
          _agentSearchLog[_agentSearchLog.length - 1].count = msg.count;
          _agentSearchLog[_agentSearchLog.length - 1].error = msg.error || null;
        }
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
        const savedSearchLog = _agentSearchLog.length > 0 ? [..._agentSearchLog] : null;
        const savedAgentNotices = _agentNotices.length > 0 ? [..._agentNotices] : null;
        const savedContinuation = msg.continuation?.prompt
          ? { prompt: msg.continuation.prompt, label: msg.continuation.label || '繼續深入搜尋' }
          : null;
        currentSession.messages.push({ role: 'assistant', content: reply, ...(savedSearchLog && { searchLog: savedSearchLog }), ...(savedContinuation && { continuation: savedContinuation }) });
        if (savedAgentNotices) liveDiv.parentNode.insertBefore(buildAgentNoticeEl(savedAgentNotices), liveDiv);
        if (savedSearchLog) liveDiv.parentNode.insertBefore(buildSearchHistoryEl(savedSearchLog), liveDiv);
        finalizeLiveMessage(liveDiv, rawContent || reply, reply, undefined, null, savedContinuation);
        clearAgentStatus();
        _agentSearchLog = [];
        _agentNotices = [];
        clearStatus();
        port.disconnect();
        resetApprovedLoading();
        await saveCurrentSession();
        await loadHistory();
        updateCharCounter();
        return;
      }
      if (msg.type === 'error') {
        liveDiv.remove();
        addMessage(`錯誤: ${msg.message}`, 'error');
        clearAgentStatus();
        clearStatus();
        port.disconnect();
        resetApprovedLoading();
      }
    });

    port.onDisconnect.addListener(async () => {
      if (!isLoading) return;
      clearAgentStatus();
      const disconnectErr = chrome.runtime.lastError?.message;
      if (rawContent) {
        const partial = rawContent.trimEnd();
        currentSession.messages.push({ role: 'assistant', content: partial });
        finalizeLiveMessage(liveDiv, partial, partial, undefined, null);
        await saveCurrentSession();
        await loadHistory();
        addMessage(`⚠️ 回應中斷（計畫執行連線異常），以上為部分內容。${disconnectErr ? `\n[Debug] ${disconnectErr}` : ''}`, 'error');
      } else {
        liveDiv.remove();
        addMessage(`錯誤: ${disconnectErr || '計畫執行連線中斷，請稍後重試。'}`, 'error');
      }
      resetApprovedLoading();
    });

    port.postMessage({
      type: 'STREAM_MESSAGE',
      data: {
        ...requestData,
        planMode: true,
        planApproved: true,
        approvedPlan: plan?.text || ''
      }
    });
  }

  // 將流程結果寫入 chat 末端（非短暫底部提示）
  function addProcessStatusMessage(text, isError = false) {
    if (!text) return;
    const div = document.createElement('div');
    div.className = 'message message-process-status' + (isError ? ' error' : '');
    div.innerHTML = `<div class="message-content">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    chatMessages.appendChild(div);
    emptyState.classList.add('hidden');
    scrollToBottom();
  }

  async function saveCurrentSession() {
    if (!currentSession || currentSession.messages.length === 0) return;
    const existingIndex = sessions.findIndex(s => s.id === currentSession.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = currentSession;
    } else {
      sessions.push(currentSession);
    }
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SESSION',
      data: { session: currentSession }
    });
    if (!response?.success) {
      const reason = response?.error || '歷史紀錄保存失敗';
      console.error('[History] 保存失敗:', reason);
      setStatus(`歷史紀錄保存失敗：${reason}`, true, 8000);
      return false;
    }
    return true;
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

  function filesToAttachments(files, source = 'upload') {
    return (files || []).map((file, i) => {
      const dataUrl = typeof file === 'string' ? file : file.dataUrl;
      const fileType = typeof file === 'string' ? 'image' : (file.fileType || 'image');
      const name = typeof file === 'string' ? `image-${i + 1}` : (file.fileName || `檔案 ${i + 1}`);
      const mimeType = dataUrl?.match(/^data:([^;]+);/)?.[1] || (fileType === 'pdf' ? 'application/pdf' : fileType === 'image' ? 'image/*' : 'text/plain');
      return {
        type: fileType === 'pdf' || fileType === 'text' ? 'file' : fileType,
        fileType,
        name,
        mimeType,
        url: dataUrl,
        source
      };
    }).filter(a => a.url);
  }

  function messageHasImage(msg) {
    if (!msg) return false;
    if (msg.image || (Array.isArray(msg.images) && msg.images.length > 0)) return true;
    return (msg.attachments || []).some(att => {
      const type = String(att?.type || att?.fileType || '').toLowerCase();
      const mimeType = String(att?.mimeType || att?.mime_type || '').toLowerCase();
      return type === 'image' || mimeType.startsWith('image/');
    });
  }

  function messageAttachmentTypes(msg) {
    if (!msg) return [];
    const types = [];
    const addType = (type, mimeType = '') => {
      const normalizedType = String(type || '').toLowerCase();
      const normalizedMime = String(mimeType || '').toLowerCase();
      if (normalizedType === 'pdf' || normalizedMime === 'application/pdf') types.push('pdf');
      else if (normalizedType === 'text' || normalizedMime.startsWith('text/')) types.push('text');
      else if (normalizedType === 'image' || normalizedMime.startsWith('image/')) types.push('image');
      else if (normalizedType === 'file') types.push('file');
    };

    if (msg.image) addType('image');
    if (Array.isArray(msg.images)) {
      const fileInfos = Array.isArray(msg.fileInfos) ? msg.fileInfos : [];
      msg.images.forEach((url, i) => {
        const info = fileInfos[i] || {};
        const mimeType = info.mimeType || info.mime_type || String(url || '').match(/^data:([^;]+);/)?.[1] || '';
        addType(info.fileType || (mimeType === 'application/pdf' ? 'pdf' : 'image'), mimeType);
      });
    }
    (msg.attachments || []).forEach(att => {
      addType(att?.fileType || att?.type, att?.mimeType || att?.mime_type);
    });
    return [...new Set(types)];
  }

  function getSessionFileSuffix(session) {
    const types = new Set((session.messages || []).flatMap(messageAttachmentTypes));
    if (types.has('pdf')) return ' [PDF]';
    if (types.has('image')) return ' [圖]';
    if (types.has('text')) return ' [文字]';
    if (types.has('file')) return ' [檔]';
    return '';
  }

  function legacyMessageAttachments(msg) {
    if (Array.isArray(msg.attachments) && msg.attachments.length > 0) return msg.attachments;
    const imgs = msg.images || (msg.image ? [msg.image] : null);
    if (!imgs || imgs.length === 0) return [];
    const fileInfos = msg.fileInfos || null;
    return imgs.map((url, i) => ({
      dataUrl: url,
      fileType: fileInfos?.[i]?.fileType || 'image',
      fileName: fileInfos?.[i]?.fileName || null
    })).map((file, i) => filesToAttachments([file], msg.role === 'assistant' ? 'assistant' : 'upload')[0]).filter(Boolean);
  }

  function normalizeAttachment(raw, index = 0) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      return { type: 'image', fileType: 'image', name: `image-${index + 1}`, url: raw, mimeType: raw.match(/^data:([^;]+);/)?.[1] || 'image/*', source: 'unknown' };
    }
    const url = raw.url || raw.dataUrl || raw.file_data || raw.data_url;
    if (!url) return null;
    const rawType = String(raw.type || raw.fileType || '').toLowerCase();
    const mimeType = raw.mimeType || raw.mime_type || String(url).match(/^data:([^;]+);/)?.[1] || '';
    const inferred = rawType || (mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('audio/') ? 'audio' : mimeType.startsWith('video/') ? 'video' : 'file');
    const fileType = raw.fileType || (inferred === 'file' && mimeType === 'application/pdf' ? 'pdf' : inferred);
    return {
      type: inferred,
      fileType,
      name: raw.name || raw.fileName || raw.filename || `attachment-${index + 1}`,
      mimeType,
      url,
      source: raw.source || 'unknown'
    };
  }

  function renderAttachments(attachments) {
    const normalized = (attachments || []).map(normalizeAttachment).filter(Boolean);
    if (normalized.length === 0) return '';
    const items = normalized.map(att => {
      const safeUrl = escapeAttr(att.url);
      const safeName = escapeHtml(att.name || '檔案');
      if (att.type === 'image') {
        return `<img src="${safeUrl}" class="message-image" alt="${safeName}" title="點擊放大">`;
      }
      if (att.type === 'audio') {
        return `<div class="message-media"><span class="message-file-name">${safeName}</span><audio controls src="${safeUrl}"></audio></div>`;
      }
      if (att.type === 'video') {
        return `<div class="message-media"><video controls src="${safeUrl}"></video><span class="message-file-name">${safeName}</span></div>`;
      }
      const icon = att.fileType === 'pdf' || att.mimeType === 'application/pdf' ? FILE_SVG_PDF : FILE_SVG_DOC;
      return `<div class="message-file">${icon}<span class="message-file-name">${safeName}</span></div>`;
    }).join('');
    return `<div class="message-attachments">${items}</div>`;
  }

  function addMessage(content, role, ttsLang, thinkContent = '', continuation = null) {
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
    if (role === 'assistant') appendContinuationAction(div, continuation);
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function addMessageWithImages(content, role, files, ttsLang) {
    addMessageWithAttachments(content, role, filesToAttachments(files), ttsLang);
  }

  function addMessageWithAttachments(content, role, attachments, ttsLang) {
    const lang = resolveTTSLang(role, ttsLang, content);
    const div = document.createElement('div');
    div.className = `message message-${role === 'user' ? 'user' : 'assistant'}`;
    let html = `<div class="message-content">`;
    html += renderAttachments(attachments);
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

  const FINANCE_RESEARCH_TEMPLATE = '請用金融研究助理模式分析「{input}」。請自動查詢標的代碼、即時或最新可用資訊、公司資訊、近期新聞、基本面、風險走勢圖摘要，並提供短中長期進場策略、失效條件與風險控管。請標明資料來源、資料時間與延遲限制，且不要給個人化投資建議。';
  const US_STOCK_RESEARCH_TEMPLATE = '請用金融研究助理模式分析美股「{input}」。請涵蓋即時或最新可用報價、公司資訊、新聞、基本面、風險分數與風險走勢，並整理短中長期策略情境。';
  const TW_STOCK_RESEARCH_TEMPLATE = '請用金融研究助理模式分析台股「{input}」。請涵蓋最新可用報價、公司資訊、新聞、籌碼或基本面可用資料、風險分數與風險走勢，並整理短中長期策略情境。';
  const FINANCE_NEWS_TEMPLATE = '請整理「{input}」的最新金融市場或個股新聞，優先補充對股價、基本面、產業與風險的影響，並標明來源與時間。';

  const BUILTIN_COMMANDS = [
    { trigger: '/page',      name: '讀取當前頁面',       type: 'action' },
    { trigger: '/page-code', name: '分析頁面原始碼/樣式', type: 'action', argHint: '/page-code <問題（可選）>' },
    { trigger: '/plan',      name: '計畫模式',    type: 'action', argHint: '/plan <任務>' },
    { trigger: '/clear',    name: '清空對話',    type: 'action' },
    { trigger: '/new',      name: '新對話',      type: 'action' },
    { trigger: '/remember', name: '記住某件事',  type: 'action', argHint: '/remember <內容>' },
    { trigger: '/search',      name: '一般搜尋（Brave）', type: 'action', argHint: '/search <關鍵字>' },
    { trigger: '/deep-search', name: '深度搜尋（Exa）',   type: 'action', argHint: '/deep-search <關鍵字>' },
    { trigger: '/finance', name: '金融快速指令：研究助理', type: 'template', argHint: '/finance <股票代碼或公司名>', template: FINANCE_RESEARCH_TEMPLATE },
    { trigger: '/stock', name: '金融快速指令：美股研究', type: 'template', argHint: '/stock <美股代碼或公司名>', template: US_STOCK_RESEARCH_TEMPLATE },
    { trigger: '/twstock', name: '金融快速指令：台股研究', type: 'template', argHint: '/twstock <台股代碼或公司名>', template: TW_STOCK_RESEARCH_TEMPLATE },
    { trigger: '/news', name: '金融快速指令：新聞', type: 'template', argHint: '/news <市場、產業或股票>', template: FINANCE_NEWS_TEMPLATE },
  ];

  async function loadCustomCommands() {
    const { customCommands: localStored } = await chrome.storage.local.get(['customCommands']);
    if (localStored && localStored.length > 0) {
      customCommands = localStored;
      return;
    }
    // 遷移：從 sync 救回舊資料
    const { customCommands: syncStored } = await chrome.storage.sync.get(['customCommands']);
    if (syncStored && syncStored.length > 0) {
      customCommands = syncStored;
      await chrome.storage.local.set({ customCommands: syncStored });
      await chrome.storage.sync.remove(['customCommands']);
    } else {
      customCommands = [];
    }
  }

  function getAllCommands() {
    const enabledCustomCommands = customCommands
      .filter(c => c.enabled !== false)
      .map(c => ({ ...c, isCustom: true }));
    return [...BUILTIN_COMMANDS, ...enabledCustomCommands];
  }

  function getActiveSlashCommandToken() {
    const value = messageInput.value;
    const cursor = messageInput.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const match = before.match(/(^|\s)(\/[^\s/]*)$/);
    if (!match) return null;
    const slash = match[2];
    const start = cursor - slash.length;
    return { start, end: cursor, query: slash };
  }

  function handleCommandPaletteInput() {
    const token = getActiveSlashCommandToken();
    activeCommandToken = token;
    if (!token) { hideCommandPalette(); return; }
    const query = token.query.toLowerCase();
    const all = getAllCommands();
    const keyword = token.query.slice(1);
    const filtered = all.filter(c => c.trigger.startsWith(query) || c.name.toLowerCase().includes(keyword.toLowerCase()));
    if (filtered.length === 0) { hideCommandPalette(); return; }
    showCommandPaletteItems(filtered);
  }

  function showCommandPaletteItems(items) {
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
      div.addEventListener('click', () => applyCommand(cmd));
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
    activeCommandToken = null;
  }

  function applyCommand(cmd) {
    const token = activeCommandToken || getActiveSlashCommandToken();
    hideCommandPalette();
    if (!token) return;
    const before = messageInput.value.slice(0, token.start);
    const after = messageInput.value.slice(token.end);
    const args = after.trim();
    if ((cmd.trigger === '/page' || cmd.trigger === '/page-code') && !args) {
      messageInput.value = `${before}${after.replace(/^\s+/, '')}`;
      messageInput.style.height = 'auto';
      messageInput.selectionStart = messageInput.selectionEnd = before.length;
      updateSendButton();
      executeAction(cmd.trigger, args);
      return;
    }
    messageInput.value = `${before}${after.replace(/^\s+/, '')}`;
    messageInput.selectionStart = messageInput.selectionEnd = before.length;
    showCommandChip(cmd, args);
  }

  function showCommandChip(cmd, prefillArgs = '') {
    pendingCommand = { cmd };
    commandChipLabel.textContent = cmd.name + (prefillArgs ? ` · ${prefillArgs}` : '');
    commandChip.classList.remove('hidden');
    if (prefillArgs) messageInput.value = prefillArgs;
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    updateSendButton();
    messageInput.focus();
  }

  function clearCommandChip() {
    pendingCommand = null;
    commandChip.classList.add('hidden');
    commandChipLabel.textContent = '';
  }

  function executeAction(trigger, args) {
    switch (trigger) {
      case '/page':
        fetchPageContext();
        break;
      case '/page-code':
        attachPageCodeContext({ question: args, focusInput: true });
        break;
      case '/new':
        startNewSessionWithPageContext();
        historyPanel.classList.add('hidden'); toggleHistoryBtn.classList.remove('active');
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

  // 意圖偵測：判斷訊息是否隱含指令意圖，回傳對應動作或 null
  function detectCommandIntent(message, allCmds) {
    // /plan（優先偵測，避免「規劃這個頁面」誤觸 /page）
    const planRegexes = [
      /^幫(?:我)?計(?:畫|劃)[：:，,\s]*(.*)/s,                    // 幫我計畫 / 幫計畫
      /^幫(?:我)?規劃[：:，,\s]*(.*)/s,                            // 幫我規劃 / 幫規劃
      /^幫(?:我)?制定(?:個?)?計(?:畫|劃)[：:，,\s]*(.*)/s,        // 幫我制定計畫
      /^幫(?:我)?擬定(?:個?)?計(?:畫|劃)[：:，,\s]*(.*)/s,        // 幫我擬定計畫
      /^計(?:畫|劃)[：:，,\s]+(.+)/s,                             // 計畫：XXX（需分隔符）
      /^規劃(.+)/s,                                               // 規劃以下專案 / 規劃 XXX
    ];
    for (const re of planRegexes) {
      const m = message.match(re);
      if (m !== null) {
        return { type: 'plan', task: (m[1] || '').trim() };
      }
    }

    // /page-code（比 /page 更具體，優先偵測）
    if (
      /(?:分析|看|查看|檢查|查一下)(?:一下)?(?:當前|這個?|此|目前)?(?:頁面|網頁)(?:的)?(?:原始碼|源碼|代碼|HTML|CSS|JS)/i.test(message) ||
      /(?:頁面|網頁)(?:原始碼|源碼|代碼)/i.test(message)
    ) {
      return { type: 'fetch-page-code' };
    }

    // /page
    if (
      /(?:分析|總結|摘要|閱讀|讀取|理解|翻譯|幫我看)(?:一下)?(?:當前|這個?|此|目前)?(?:頁面|網頁|文章|這篇)/i.test(message) ||
      /(?:當前|這個?|目前)(?:頁面|網頁|文章)(?:說|在說|寫|內容|是什麼|說什麼|的重點|的摘要)/i.test(message) ||
      /(?:summarize|analyze|read|explain|translate)\s+(?:this|current|the)\s+(?:page|article|content)/i.test(message) ||
      /what\s+(?:is|does|do)\s+(?:this|the current)\s+page/i.test(message)
    ) {
      return { type: 'fetch-page' };
    }

    // /remember（嚴格前綴：訊息必須以記住相關詞開頭）
    const rememberMatch = message.match(/^(?:記住|幫(?:我)?記住|請記住|幫我記)[：:，,\s]+(.+)/s);
    if (rememberMatch) {
      return { type: 'execute', trigger: '/remember', args: rememberMatch[1].trim() };
    }

    // /deep-search（比 /search 更具體，優先偵測）
    const deepSearchMatch = message.match(/^(?:深度搜尋|深度搜索|深入搜尋|深入搜索|詳細搜尋)[：:，,\s]+(.+)/);
    if (deepSearchMatch) {
      return { type: 'execute', trigger: '/deep-search', args: deepSearchMatch[1].trim() };
    }

    // /search（嚴格前綴：避免與 agent 自動搜尋衝突）
    const searchMatch = message.match(/^(?:搜尋|搜索|幫(?:我)?搜|查一下)[：:，,\s]+(.+)/);
    if (searchMatch) {
      return { type: 'execute', trigger: '/search', args: searchMatch[1].trim() };
    }

    // 自訂 template 指令：名稱前綴匹配（需有 args，必須以空格/符號分隔）
    const customTemplateCmds = allCmds.filter(c => c.isCustom && c.type === 'template' && c.name);
    for (const cmd of customTemplateCmds) {
      const msgLC = message.toLowerCase();
      const nameLC = cmd.name.toLowerCase();
      if (msgLC.startsWith(nameLC)) {
        const afterName = message.slice(cmd.name.length);
        if (afterName && !/^[：:，,\s]/.test(afterName)) continue; // 需要分隔符
        const args = afterName.replace(/^[：:，,\s]+/, '').trim();
        if (!args) continue; // 沒有 args 就跳過
        return { type: 'template', cmd, args };
      }
    }

    return null;
  }

  async function handleWebSearch(query, searchType = 'WEB_SEARCH') {
    const isDeep = searchType === 'DEEP_SEARCH';
    const label = isDeep ? '深度搜尋' : '搜尋';
    if (!currentSession) startNewSession();
    isLoading = true;
    setStreamingMode(true);
    messageInput.disabled = true;
    typingIndicator.classList.add('hidden');
    emptyState.classList.add('hidden');
    setStatus(`${label}中：${query}`);

    const userMsg = { role: 'user', content: `/${isDeep ? 'deep-search' : 'search'} ${query}` };
    currentSession.messages.push(userMsg);
    addMessage(`${label}：${query}`, 'user');

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
        setStatus(result.error, true, 5000);
      }
      messageInput.focus();
      return;
    }

    // 組成 context 交給 AI 分析
    setStatus(`${result.provider} 找到 ${result.results.length} 筆結果，分析中...`);
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
    const systemPrompt = '';
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
        const attachments = Array.isArray(msg.attachments) && msg.attachments.length > 0 ? msg.attachments : null;
        currentSession.messages.push({ role: 'assistant', content: reply, ...(thinkContent2 && { thinkContent: thinkContent2 }), ...(attachments && { attachments }) });
        finalizeLiveMessage(liveDiv, rawContent, reply, replyLang, attachments);
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
        contextCharBudget: getCurrentContextCharBudget(),
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
    // 去重（檢查 summary 或舊版 text）
    if (memories.some(m => (m.summary || m.text) === trimmed)) {
      setStatus('此記憶已存在', false, 2000);
      return;
    }
    memories.push({
      id: `mem_${Date.now()}`,
      title: trimmed.slice(0, 30),
      summary: trimmed,
      tags: [],
      source,
      category: '',
      createdAt: Date.now()
    });
    // 上限 30 筆（sync 容量限制）
    if (memories.length > 30) memories.shift();
    await saveMemories();
    setStatus(`已記住：${trimmed.slice(0, 30)}${trimmed.length > 30 ? '...' : ''}`, false, 3000);
  }

  async function openMemoryModal() {
    memoryModal.classList.remove('hidden');
    openMemoryBtn.classList.add('active');
    await populateCategoryFilter('memory', memoryCategoryFilterEl);
    memorySearchInput.value = memorySearchQuery;
    renderMemoryList();
  }

  function closeMemoryModal() {
    memoryModal.classList.add('hidden');
    openMemoryBtn.classList.remove('active');
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
    let filtered = memoryCategoryFilter
      ? memories.filter(m => m.category === memoryCategoryFilter)
      : memories;
    if (memorySearchQuery) {
      const query = memorySearchQuery.toLowerCase();
      filtered = filtered.filter(m => {
        const haystack = [m.title, m.summary, m.text, ...(m.tags || [])].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }
    if (filtered.length === 0) {
      const hasFilter = memoryCategoryFilter || memorySearchQuery;
      memoryList.innerHTML = hasFilter
        ? '<p class="memory-empty">此篩選條件沒有記憶。</p>'
        : '<p class="memory-empty">尚無長期記憶。<br>使用 /remember 內容 來新增。</p>';
      return;
    }
    filtered.slice().reverse().forEach(mem => {
      // 向下相容：舊格式只有 text，新格式有 title + summary
      const displayTitle = mem.title || mem.text || '';
      const displaySummary = mem.summary && mem.summary !== displayTitle ? mem.summary : '';
      const tags = Array.isArray(mem.tags) && mem.tags.length ? mem.tags : [];

      const div = document.createElement('div');
      div.className = 'memory-item';
      const badgeLabel = { manual: '手動', auto: '自動', 'context-menu': '右鍵', summary: '總結' }[mem.source] || mem.source;
      const catOptions = `<option value="">${cats.length ? '無分類' : '新增分類後使用'}</option>`
        + cats.map(c => `<option value="${escapeAttr(c)}" ${mem.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      const tagsHtml = tags.length ? `<div class="memory-item-tags">${tags.map(t => `<span class="memory-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';
      div.innerHTML = `
        <span class="memory-item-badge ${mem.source}">${badgeLabel}</span>
        <div class="memory-item-body">
          <span class="memory-item-text editable" title="點擊編輯">${escapeHtml(displayTitle)}</span>
          ${displaySummary ? `<span class="memory-item-summary">${escapeHtml(displaySummary)}</span>` : ''}
          ${tagsHtml}
        </div>
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
      // 點擊 title 進入編輯模式（textarea，編輯 summary）
      const textSpan = div.querySelector('.memory-item-text');
      textSpan.addEventListener('click', () => {
        const editVal = mem.summary || mem.text || '';
        const ta = document.createElement('textarea');
        ta.className = 'memory-item-textarea';
        ta.value = editVal;
        ta.rows = Math.max(2, Math.ceil(editVal.length / 40));
        textSpan.replaceWith(ta);
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        const save = async () => {
          const newText = ta.value.trim();
          if (newText && newText !== editVal) {
            const idx = memories.findIndex(m => m.id === mem.id);
            if (idx !== -1) {
              memories[idx].summary = newText;
              memories[idx].title = newText.slice(0, 30);
              // 相容舊格式
              if (memories[idx].text !== undefined) memories[idx].text = newText;
              await saveMemories();
            }
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
    if (vocabularyReviewMode) openVocabularyReviewMode(vocabulary);
    else renderVocabularyList(vocabulary);
  });
  vocabularyLangFilterEl.addEventListener('change', async e => {
    vocabularyLangFilter = e.target.value;
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    if (vocabularyReviewMode) openVocabularyReviewMode(vocabulary);
    else renderVocabularyList(vocabulary);
  });
  vocabularySearchInput.addEventListener('input', async e => {
    vocabularySearchQuery = e.target.value.trim();
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    if (vocabularyReviewMode) {
      openVocabularyReviewMode(vocabulary);
    } else {
      renderVocabularyList(vocabulary);
    }
  });
  vocabularyReviewBtn.addEventListener('click', async () => {
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    if (vocabularyReviewMode) closeVocabularyReviewMode();
    else openVocabularyReviewMode(vocabulary);
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
    if (hidden) {
      knowledgeTagManager.classList.add('hidden');
      manageKnowledgeTagBtn.classList.remove('active');
    }
    knowledgeCatManager.classList.toggle('hidden');
    manageKnowledgeCatBtn.classList.toggle('active', hidden);
    if (hidden) await renderCategoryManager('knowledge', knowledgeCatList);
  });
  manageKnowledgeTagBtn.addEventListener('click', async () => {
    const hidden = knowledgeTagManager.classList.contains('hidden');
    if (hidden) {
      knowledgeCatManager.classList.add('hidden');
      manageKnowledgeCatBtn.classList.remove('active');
    }
    knowledgeTagManager.classList.toggle('hidden');
    manageKnowledgeTagBtn.classList.toggle('active', hidden);
    if (hidden) await renderKnowledgeTagManager();
  });
  knowledgeAddCatBtn.addEventListener('click', () =>
    handleAddCategory('knowledge', knowledgeNewCatInput, knowledgeCatList, knowledgeCategoryFilterEl));
  knowledgeNewCatInput.addEventListener('keydown', e => { if (e.key === 'Enter') knowledgeAddCatBtn.click(); });

  // ─────────────────────────────────────────────────────────

  // ── Knowledge Base 函式 ──────────────────────────────────

  function buildKnowledgeBlock() {
    if (selectedKnowledge.length === 0) return '';
    const blocks = selectedKnowledge.map(item => {
      if (item.source === 'lesson-recording') {
        const lines = [`【課程錄音參考】`, `課程：${item.title}`];
        if (item.summary) lines.push(`摘要：${item.summary}`);
        const snippets = Array.isArray(item.transcriptSegments) ? item.transcriptSegments.slice(0, 4) : [];
        if (snippets.length) lines.push(`相關逐字稿片段：\n${snippets.map(s => `- ${s}`).join('\n')}`);
        if (item.corrections?.length) lines.push(`老師修正：\n${item.corrections.slice(0, 5).map(c => `- ${c}`).join('\n')}`);
        if (item.usefulSentences?.length) lines.push(`實用句型：\n${item.usefulSentences.slice(0, 5).map(s => `- ${s}`).join('\n')}`);
        return lines.join('\n');
      }
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
      updateCharCounter();
      return;
    }
    knowledgeChips.classList.remove('hidden');
    selectedKnowledge.forEach(item => {
      const chip = document.createElement('span');
      chip.className = 'kb-chip';
      const prefix = item.source === 'lesson-recording' ? '@課程' : '@';
      chip.innerHTML = `<span class="kb-chip-label" title="${escapeAttr(item.title)}">${prefix} ${escapeHtml(item.title)}</span><button class="kb-chip-remove" title="移除">×</button>`;
      chip.querySelector('.kb-chip-remove').addEventListener('click', () => {
        selectedKnowledge = selectedKnowledge.filter(k => k.id !== item.id);
        renderKnowledgeChips();
        updateSendButton();
      });
      knowledgeChips.appendChild(chip);
    });
    updateCharCounter();
  }

  // @ palette
  function handleKbPaletteInput() {
    const val = messageInput.value;
    const cursor = messageInput.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@([^\s@]*)$/);
    if (!atMatch) { hideKbPalette(); return; }
    const query = atMatch[1].toLowerCase();
    const lessonItems = lessonRecords.map(lesson => ({
      ...lesson,
      source: 'lesson-recording',
      status: 'ready',
      tags: ['課程錄音', 'English'],
      title: lesson.title || `English lesson ${formatItemDate(lesson.createdAt)}`
    }));
    const allItems = [...knowledgeBase, ...lessonItems];
    const filtered = allItems.filter(kb =>
      !query ||
      (kb.title || '').toLowerCase().includes(query) ||
      (kb.summary || '').toLowerCase().includes(query) ||
      (kb.tags || []).some(t => t.toLowerCase().includes(query)) ||
      (kb.transcriptSegments || []).some(s => String(s).toLowerCase().includes(query))
    );
    if (allItems.length === 0) {
      showKbPaletteEmpty();
      return;
    }
    showKbPaletteItems(filtered.length > 0 ? filtered : allItems);
  }

  function showKbPaletteEmpty() {
    knowledgePalette.innerHTML = '<div class="kb-palette-empty">尚無可引用內容<br>請先加入知識庫或整理課程錄音</div>';
    knowledgePalette.classList.remove('hidden');
    kbPaletteIndex = -1;
  }

  function showKbPaletteItems(items) {
    knowledgePalette.innerHTML = '';
    kbPaletteIndex = 0;
    items.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'kb-palette-item' + (idx === 0 ? ' active' : '');
      const isLesson = item.source === 'lesson-recording';
      const statusLabel = isLesson ? '課程' : (item.status === 'processing' ? '分析中' : '就緒');
      const tagsHtml = (item.tags || []).slice(0, 3).map(t => `<span class="kb-palette-tag">${escapeHtml(t)}</span>`).join('');
      div.innerHTML = `
        <span class="kb-palette-status ${isLesson ? 'lesson' : item.status}">${statusLabel}</span>
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
    openKnowledgeBtn.classList.add('active');
    await populateCategoryFilter('knowledge', knowledgeCategoryFilterEl);
    knowledgeSearchInput.value = knowledgeSearchQuery;
    renderKnowledgeTagFilters();
    renderKnowledgeTagManager();
    renderKnowledgeList();
    pollKbProcessing(); // 若有分析中項目，每 2 秒自動刷新
  }

  function closeKnowledgeModal() {
    knowledgeModal.classList.add('hidden');
    openKnowledgeBtn.classList.remove('active');
    knowledgeCatManager.classList.add('hidden');
    knowledgeTagManager.classList.add('hidden');
    manageKnowledgeCatBtn.classList.remove('active');
    manageKnowledgeTagBtn.classList.remove('active');
  }

  // ── Summary Toolbar ──────────────────────────────────────────
  function detectVocabularyLang(word) {
    if (/[\u4e00-\u9fff]/.test(word)) return 'zh';
    if (/[\u3040-\u30ff]/.test(word)) return 'ja';
    if (/^[\x00-\x7F]+$/.test(word)) return 'en';
    return 'other';
  }

  function normalizeVocabularyLang(lang, word) {
    const raw = String(lang || '').trim().toLowerCase();
    if (!raw) return detectVocabularyLang(word);
    if (['en', 'zh', 'ja', 'ko', 'vi', 'th', 'ar', 'other'].includes(raw)) return raw;
    if (raw.startsWith('zh')) return 'zh';
    if (raw.startsWith('ja')) return 'ja';
    if (raw.startsWith('ko')) return 'ko';
    if (raw.startsWith('vi')) return 'vi';
    if (raw.startsWith('th')) return 'th';
    if (raw.startsWith('ar')) return 'ar';
    if (raw.startsWith('en')) return 'en';
    return detectVocabularyLang(word);
  }

  function openLessonAudioDb() {
    if (lessonAudioDb) return Promise.resolve(lessonAudioDb);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('open-chat-hub-lessons', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
      };
      req.onsuccess = () => {
        lessonAudioDb = req.result;
        resolve(lessonAudioDb);
      };
      req.onerror = () => reject(req.error || new Error('無法開啟課程音檔資料庫'));
    });
  }

  async function saveLessonAudio(audioId, blob) {
    const db = await openLessonAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').put(blob, audioId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('音檔保存失敗'));
    });
  }

  async function getLessonAudio(audioId) {
    const db = await openLessonAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readonly');
      const req = tx.objectStore('audio').get(audioId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('音檔讀取失敗'));
    });
  }

  async function deleteLessonAudio(audioId) {
    if (!audioId) return;
    const db = await openLessonAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('audio', 'readwrite');
      tx.objectStore('audio').delete(audioId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('音檔刪除失敗'));
    });
  }

  function switchVocabularyTab(tab) {
    const lessons = tab === 'lessons';
    vocabularyWordsTab.classList.toggle('active', !lessons);
    lessonRecordingTab.classList.toggle('active', lessons);
    vocabularyWordsView.classList.toggle('hidden', lessons);
    lessonRecordingView.classList.toggle('hidden', !lessons);
    if (lessons) renderLessonRecords();
  }

  function formatLessonTimer(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const min = String(Math.floor(total / 60)).padStart(2, '0');
    const sec = String(total % 60).padStart(2, '0');
    return `${min}:${sec}`;
  }

  function getLessonElapsedMs(state = lessonRecorderState) {
    if (!state) return 0;
    const now = state.isPaused && state.pausedAt ? state.pausedAt : Date.now();
    return Math.max(0, now - state.startedAt - (state.pausedMs || 0));
  }

  function updateLessonRecordingTimer() {
    const text = formatLessonTimer(getLessonElapsedMs());
    lessonRecordingTimer.textContent = text;
    lessonFloatingTimer.textContent = text;
  }

  function showLessonFloatingBar() {
    lessonFloatingBar.classList.remove('hidden');
    lessonFloatingState.textContent = '錄音中';
    lessonFloatingPauseBtn.textContent = '暫停';
    updateLessonRecordingTimer();
  }

  function hideLessonFloatingBar() {
    lessonFloatingBar.classList.add('hidden');
    lessonFloatingState.textContent = '錄音中';
    lessonFloatingPauseBtn.textContent = '暫停';
  }

  function setLessonRecordingPaused(paused) {
    if (!lessonRecorderState) return;
    lessonRecorderState.isPaused = paused;
    lessonFloatingState.textContent = paused ? '已暫停' : '錄音中';
    lessonFloatingPauseBtn.textContent = paused ? '繼續' : '暫停';
    lessonRecordingStateEl.textContent = paused ? '錄音已暫停' : lessonRecorderState.recordingLabel || '錄音中';
    updateLessonRecordingTimer();
  }

  async function ensureLessonNotice() {
    const { lessonRecordingNoticeAck } = await chrome.storage.local.get(['lessonRecordingNoticeAck']);
    if (lessonRecordingNoticeAck) return true;
    lessonNotice.classList.remove('hidden');
    return false;
  }

  async function requestLessonMicrophonePermission({ silent = false } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('此瀏覽器不支援麥克風錄音權限');
    }
    if (!silent) {
      lessonTranscriptStatus.textContent = '正在要求麥克風權限';
      lessonPermissionHelp.classList.add('hidden');
      lessonMicPermissionBtn.disabled = true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      lessonTranscriptStatus.textContent = '麥克風已授權';
      lessonMicPermissionBtn.textContent = '麥克風已授權';
      lessonMicPermissionBtn.disabled = true;
      lessonPermissionHelp.classList.add('hidden');
      if (!silent) setStatus('麥克風權限已取得，可開始錄音。', false, 2400);
      return true;
    } catch (err) {
      const dismissed = /dismissed/i.test(err.message || '');
      lessonTranscriptStatus.textContent = dismissed ? '麥克風授權視窗已關閉，尚未允許' : `麥克風未授權：${err.message}`;
      lessonMicPermissionBtn.disabled = false;
      lessonMicPermissionBtn.textContent = dismissed ? '重新授權麥克風' : '授權麥克風';
      lessonPermissionHelp.classList.remove('hidden');
      if (!silent) setStatus(`麥克風權限取得失敗：${err.message}`, true, 3600);
      throw err;
    }
  }

  function startSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      lessonTranscriptStatus.textContent = '此瀏覽器不支援 Web Speech 轉寫';
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = event => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += text + ' ';
        else interim += text;
      }
      if (finalText && lessonRecorderState) {
        lessonRecorderState.transcript += finalText;
        lessonTranscriptDraft.value = `${lessonRecorderState.transcript}${interim ? `\n${interim}` : ''}`.trim();
      } else if (lessonRecorderState && interim) {
        lessonTranscriptDraft.value = `${lessonRecorderState.transcript}\n${interim}`.trim();
      }
    };
    recognition.onerror = () => {
      lessonTranscriptStatus.textContent = '轉寫暫停，可課後手動補逐字稿';
    };
    recognition.onend = () => {
      if (lessonRecorderState?.recognition === recognition) {
        try { recognition.start(); } catch {}
      }
    };
    try {
      recognition.start();
      lessonTranscriptStatus.textContent = '正在即時英文轉寫';
      return recognition;
    } catch {
      lessonTranscriptStatus.textContent = '轉寫啟動失敗，可課後手動補逐字稿';
      return null;
    }
  }

  async function captureLessonStreams() {
    let micStream = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      throw new Error(`麥克風權限或裝置不可用：${err.message}`);
    }
    const tabStream = await new Promise(resolve => {
      if (!chrome.tabCapture?.capture) return resolve(null);
      chrome.tabCapture.capture({ audio: true, video: false }, stream => {
        resolve(chrome.runtime.lastError ? null : stream);
      });
    });
    return { micStream, tabStream };
  }

  async function startLessonRecording() {
    if (lessonRecorderState) return;
    const noticeReady = await ensureLessonNotice();
    if (!noticeReady) {
      setStatus('請先閱讀錄音提醒，按「了解」後即可開始。', false, 2600);
      return;
    }
    lessonRecordingStateEl.textContent = '正在啟動錄音...';
    lessonTranscriptStatus.textContent = '正在要求錄音權限';
    lessonStartBtn.disabled = true;
    lessonStopBtn.disabled = true;
    lessonOrganizeBtn.disabled = true;
    let offscreenError = '';
    try {
      await requestLessonMicrophonePermission({ silent: true }).catch(err => {
        offscreenError = `麥克風授權失敗：${err.message}`;
      });
      const offscreenStart = await chrome.runtime.sendMessage({ type: 'LESSON_RECORDING_START' }).catch(err => {
        offscreenError = err.message || String(err);
        return null;
      });
      if (offscreenStart?.success) {
        lessonRecorderState = {
          mode: 'offscreen',
          startedAt: Date.now(),
          pausedAt: null,
          pausedMs: 0,
          isPaused: false,
          transcript: lessonTranscriptDraft.value.trim() ? `${lessonTranscriptDraft.value.trim()}\n` : '',
          recognition: startSpeechRecognition(),
          hasMic: Boolean(offscreenStart.data?.hasMic)
        };
        lessonRecorderState.recordingLabel = lessonRecorderState.hasMic ? '錄音中：分頁聲音 + 麥克風' : '錄音中：分頁聲音（麥克風未取得）';
        lessonStartBtn.disabled = true;
        lessonStopBtn.disabled = false;
        lessonOrganizeBtn.disabled = true;
        lessonRecordingStateEl.textContent = lessonRecorderState.recordingLabel;
        showLessonFloatingBar();
        lessonRecorderState.timer = setInterval(updateLessonRecordingTimer, 500);
        return;
      } else if (offscreenStart?.error) {
        offscreenError = offscreenStart.error;
      }

      const { micStream, tabStream } = await captureLessonStreams();
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const destination = audioContext.createMediaStreamDestination();
      const streams = [micStream, tabStream].filter(Boolean);
      streams.forEach(stream => {
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(destination);
      });
      const recorderOptions = MediaRecorder.isTypeSupported?.('audio/webm') ? { mimeType: 'audio/webm' } : {};
      const recorder = new MediaRecorder(destination.stream, recorderOptions);
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
      recorder.start(1000);
      lessonRecorderState = {
        recorder,
        chunks,
        streams,
        audioContext,
        startedAt: Date.now(),
        pausedAt: null,
        pausedMs: 0,
        isPaused: false,
        transcript: lessonTranscriptDraft.value.trim() ? `${lessonTranscriptDraft.value.trim()}\n` : '',
        recognition: startSpeechRecognition()
      };
      lessonRecorderState.recordingLabel = tabStream ? '錄音中：分頁聲音 + 麥克風' : '錄音中：麥克風（分頁聲音未取得）';
      lessonStartBtn.disabled = true;
      lessonStopBtn.disabled = false;
      lessonOrganizeBtn.disabled = true;
      lessonRecordingStateEl.textContent = lessonRecorderState.recordingLabel;
      showLessonFloatingBar();
      lessonRecorderState.timer = setInterval(updateLessonRecordingTimer, 500);
      if (offscreenError && !tabStream) {
        lessonTranscriptStatus.textContent = `分頁音訊未取得，已改用麥克風錄音：${offscreenError}`;
      }
    } catch (err) {
      setStatus(`錄音啟動失敗：${err.message}`, true, 4000);
      lessonRecordingStateEl.textContent = '錄音啟動失敗';
      lessonTranscriptStatus.textContent = offscreenError ? `分頁音訊失敗：${offscreenError}；${err.message}` : err.message;
      lessonStartBtn.disabled = false;
      lessonStopBtn.disabled = true;
      lessonOrganizeBtn.disabled = !(lessonTranscriptDraft.value.trim() || lessonRecords[0]?.transcriptSegments?.length);
    }
  }

  async function toggleLessonRecordingPause() {
    if (!lessonRecorderState) return;
    const state = lessonRecorderState;
    try {
      if (state.isPaused) {
        if (state.mode === 'offscreen') {
          const res = await chrome.runtime.sendMessage({ type: 'LESSON_RECORDING_RESUME' });
          if (!res?.success) throw new Error(res?.error || '錄音繼續失敗');
        } else if (state.recorder?.state === 'paused') {
          state.recorder.resume();
        }
        if (state.pausedAt) {
          state.pausedMs = (state.pausedMs || 0) + (Date.now() - state.pausedAt);
          state.pausedAt = null;
        }
        state.recognition = startSpeechRecognition();
        setLessonRecordingPaused(false);
      } else {
        if (state.mode === 'offscreen') {
          const res = await chrome.runtime.sendMessage({ type: 'LESSON_RECORDING_PAUSE' });
          if (!res?.success) throw new Error(res?.error || '錄音暫停失敗');
        } else if (state.recorder?.state === 'recording') {
          state.recorder.pause();
        }
        state.pausedAt = Date.now();
        state.recognition?.stop?.();
        setLessonRecordingPaused(true);
      }
    } catch (err) {
      setStatus(`錄音控制失敗：${err.message}`, true, 3200);
    }
  }

  async function stopLessonRecording() {
    if (!lessonRecorderState) return;
    const state = lessonRecorderState;
    lessonRecorderState = null;
    clearInterval(state.timer);
    state.recognition?.stop?.();
    hideLessonFloatingBar();

    if (state.mode === 'offscreen') {
      try {
        const stoppedRecording = await chrome.runtime.sendMessage({ type: 'LESSON_RECORDING_STOP' });
        if (!stoppedRecording?.success) throw new Error(stoppedRecording?.error || 'offscreen 錄音停止失敗');
        const data = stoppedRecording.data || {};
        const now = data.finishedAt || Date.now();
        const transcriptText = lessonTranscriptDraft.value.trim();
        const lesson = {
          id: `lesson_${now}`,
          title: `English lesson ${new Date(now).toLocaleDateString('zh-TW')}`,
          audioId: data.audioId,
          audioType: data.audioType || 'audio/webm',
          durationMs: data.durationMs || getLessonElapsedMs(state),
          transcriptSegments: transcriptText ? transcriptText.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 80) : [],
          summary: transcriptText ? '尚未整理。點擊「整理」產生英文學習摘要。' : '已保存音檔，但尚無逐字稿。',
          corrections: [],
          usefulSentences: [],
          vocabularyIds: [],
          createdAt: now
        };
        lessonRecords = [lesson, ...lessonRecords].slice(0, 100);
        await chrome.storage.local.set({ lessonRecords });
        lessonRecordingStateEl.textContent = '錄音已保存';
        lessonStartBtn.disabled = false;
        lessonStopBtn.disabled = true;
        lessonOrganizeBtn.disabled = !transcriptText;
        renderLessonRecords();
        setStatus('課程錄音已保存本機', false, 2600);
      } catch (err) {
        lessonRecordingStateEl.textContent = '錄音保存失敗';
        lessonStartBtn.disabled = false;
        lessonStopBtn.disabled = true;
        lessonOrganizeBtn.disabled = !lessonTranscriptDraft.value.trim();
        setStatus(`錄音保存失敗：${err.message}`, true, 4000);
      }
      return;
    }

    const stopped = new Promise(resolve => {
      state.recorder.onstop = resolve;
    });
    state.recorder.stop();
    await stopped;
    state.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    await state.audioContext.close().catch(() => {});
    if (!state.chunks.length) {
      lessonRecordingStateEl.textContent = '錄音沒有取得音訊資料';
      lessonStartBtn.disabled = false;
      lessonStopBtn.disabled = true;
      lessonOrganizeBtn.disabled = !lessonTranscriptDraft.value.trim();
      setStatus('錄音沒有取得音訊資料，請確認分頁或麥克風權限。', true, 3600);
      return;
    }
    const blob = new Blob(state.chunks, { type: state.chunks[0]?.type || 'audio/webm' });
    const now = Date.now();
    const audioId = `lesson_audio_${now}`;
    await saveLessonAudio(audioId, blob);
    const transcriptText = lessonTranscriptDraft.value.trim();
    const lesson = {
      id: `lesson_${now}`,
      title: `English lesson ${new Date(now).toLocaleDateString('zh-TW')}`,
      audioId,
      audioType: blob.type,
      durationMs: getLessonElapsedMs(state),
      transcriptSegments: transcriptText ? transcriptText.split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 80) : [],
      summary: transcriptText ? '尚未整理。點擊「整理」產生英文學習摘要。' : '已保存音檔，但尚無逐字稿。',
      corrections: [],
      usefulSentences: [],
      vocabularyIds: [],
      createdAt: now
    };
    lessonRecords = [lesson, ...lessonRecords].slice(0, 100);
    await chrome.storage.local.set({ lessonRecords });
    lessonRecordingStateEl.textContent = '錄音已保存';
    lessonStartBtn.disabled = false;
    lessonStopBtn.disabled = true;
    lessonOrganizeBtn.disabled = !transcriptText;
    renderLessonRecords();
    setStatus('課程錄音已保存本機', false, 2600);
  }

  function parseVocabularyExtractionResult(text) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const source = (fenceMatch?.[1] || text || '').trim();
    let jsonText = source;
    if (!(jsonText.startsWith('[') && jsonText.endsWith(']'))) {
      const start = jsonText.indexOf('[');
      const end = jsonText.lastIndexOf(']');
      if (start !== -1 && end > start) {
        jsonText = jsonText.slice(start, end + 1);
      }
    }
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error('AI 回傳格式不是陣列');
    return parsed
      .map(item => {
        if (typeof item === 'string') {
          return { word: item.trim(), lang: '' };
        }
        if (!item || typeof item !== 'object') return null;
        const word = String(item.word || item.term || item.vocab || '').trim();
        const lang = String(item.lang || item.language || '').trim();
        return { word, lang };
      })
      .filter(item => item && item.word);
  }

  function parseLessonOrganizeResult(text) {
    const fenceMatch = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const source = (fenceMatch?.[1] || text || '').trim();
    const jsonText = source.match(/\{[\s\S]*\}/)?.[0] || source;
    const parsed = JSON.parse(jsonText);
    return {
      summary: String(parsed.summary || '').trim(),
      transcriptSegments: Array.isArray(parsed.transcriptSegments) ? parsed.transcriptSegments.map(String).filter(Boolean).slice(0, 20) : [],
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.map(String).filter(Boolean).slice(0, 20) : [],
      usefulSentences: Array.isArray(parsed.usefulSentences) ? parsed.usefulSentences.map(String).filter(Boolean).slice(0, 20) : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : []
    };
  }

  async function organizeLessonRecord(lessonId = null) {
    const lesson = lessonRecords.find(l => l.id === lessonId) || lessonRecords[0];
    if (!lesson) {
      setStatus('目前沒有可整理的課程紀錄', false, 2500);
      return;
    }
    const transcript = lessonTranscriptDraft.value.trim() || (lesson.transcriptSegments || []).join('\n');
    if (!transcript) {
      setStatus('此課程沒有逐字稿，請先貼上文字內容再整理。', true, 3200);
      return;
    }
    setStatus('正在整理英文課程...');
    const prompt = `You are an English learning assistant. Organize this one-on-one English tutoring lesson transcript for review.

Return JSON only, no markdown. Schema:
{
  "summary": "Traditional Chinese summary of what the lesson covered",
  "transcriptSegments": ["important English transcript snippet"],
  "corrections": ["teacher correction or improved sentence"],
  "usefulSentences": ["useful English sentence pattern"],
  "vocabulary": [{"word":"word or phrase","lang":"en","context":"short English context","exampleSentence":"example sentence","translation":"Traditional Chinese translation","speakerNote":"why it matters"}]
}

Keep vocabulary practical for review, max 30 items.

Transcript:
${transcript}`;

    const port = chrome.runtime.connect({ name: 'chat-stream' });
    let rawContent = '';
    port.onMessage.addListener(async msg => {
      if (msg.type === 'chunk') {
        rawContent = msg.full || '';
        return;
      }
      if (msg.type === 'done') {
        try {
          const parsed = parseLessonOrganizeResult((msg.reply || rawContent || '').trim());
          const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
          const existingWords = new Set(current.map(v => String(v.word || '').trim().toLowerCase()).filter(Boolean));
          const now = Date.now();
          const vocabularyIds = [];
          parsed.vocabulary.forEach((item, idx) => {
            const word = String(item.word || item.term || '').trim();
            if (!word || word.length > 120) return;
            const key = word.toLowerCase();
            if (existingWords.has(key)) return;
            existingWords.add(key);
            const id = `vocab_${now}_${idx}`;
            vocabularyIds.push(id);
            current.push({
              id,
              word,
              definition: '',
              category: '',
              lang: normalizeVocabularyLang(item.lang || 'en', word),
              translation: String(item.translation || '').trim(),
              context: String(item.context || '').trim(),
              exampleSentence: String(item.exampleSentence || '').trim(),
              speakerNote: String(item.speakerNote || '').trim(),
              source: 'lesson-recording',
              lessonId: lesson.id,
              createdAt: Date.now()
            });
          });
          lessonRecords = lessonRecords.map(l => l.id === lesson.id ? {
            ...l,
            summary: parsed.summary || l.summary,
            transcriptSegments: parsed.transcriptSegments.length ? parsed.transcriptSegments : l.transcriptSegments,
            corrections: parsed.corrections,
            usefulSentences: parsed.usefulSentences,
            vocabularyIds: [...new Set([...(l.vocabularyIds || []), ...vocabularyIds])],
            organizedAt: Date.now()
          } : l);
          await chrome.storage.local.set({ vocabulary: current, lessonRecords });
          renderLessonRecords();
          if (!vocabularyModal.classList.contains('hidden')) renderVocabularyList(current);
          setStatus(`課程整理完成，新增 ${vocabularyIds.length} 個單字/片語`, false, 3000);
        } catch (err) {
          setStatus(`課程整理失敗：${err.message}`, true, 3600);
        }
        port.disconnect();
      }
      if (msg.type === 'error') {
        setStatus(`課程整理失敗：${msg.message}`, true, 3600);
        port.disconnect();
      }
    });
    port.postMessage({
      type: 'STREAM_MESSAGE',
      data: {
        message: prompt,
        history: [],
        images: [],
        translateConfig: null,
        model: currentModel,
        contextCharBudget: getCurrentContextCharBudget(),
        maxAgentIterations: 3,
        systemPrompt: '',
        memoryContext: '',
        sessionId: currentSession?.id,
        skipTools: true,
        planMode: false
      }
    });
  }

  async function playLessonAudio(audioId) {
    const blob = await getLessonAudio(audioId);
    if (!blob) {
      setStatus('找不到本機音檔', true, 2500);
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(err => setStatus(`播放失敗：${err.message}`, true, 2500));
  }

  async function deleteLessonRecord(lessonId) {
    const lesson = lessonRecords.find(l => l.id === lessonId);
    if (!lesson) return;
    if (!confirm(`確定刪除「${lesson.title || 'English lesson'}」？音檔也會一併從本機刪除。`)) return;
    try {
      await deleteLessonAudio(lesson.audioId);
      lessonRecords = lessonRecords.filter(l => l.id !== lessonId);
      await chrome.storage.local.set({ lessonRecords });
      renderLessonRecords();
      setStatus('課程錄音已刪除', false, 2200);
    } catch (err) {
      setStatus(`刪除失敗：${err.message}`, true, 3200);
    }
  }

  function renderLessonRecords() {
    lessonRecordsList.innerHTML = '';
    if (!lessonRecords.length) {
      lessonRecordsList.innerHTML = '<p class="memory-empty">尚無課程錄音。開始錄音後，音檔只會保存在本機。</p>';
      lessonOrganizeBtn.disabled = true;
      return;
    }
    lessonOrganizeBtn.disabled = !(lessonTranscriptDraft.value.trim() || lessonRecords[0]?.transcriptSegments?.length);
    lessonRecords.forEach(lesson => {
      const div = document.createElement('div');
      div.className = 'lesson-record-card';
      const snippets = (lesson.transcriptSegments || []).slice(0, 2).map(s => `<li>${escapeHtml(s)}</li>`).join('');
      const corrections = (lesson.corrections || []).slice(0, 2).map(s => `<li>${escapeHtml(s)}</li>`).join('');
      div.innerHTML = `
        <div class="lesson-record-head">
          <div>
            <strong>${escapeHtml(lesson.title || 'English lesson')}</strong>
            <span>${formatItemDate(lesson.createdAt)} · ${formatLessonTimer(lesson.durationMs || 0)}</span>
          </div>
          <span class="lesson-record-badge">${lesson.organizedAt ? '已整理' : '待整理'}</span>
        </div>
        <p>${escapeHtml(lesson.summary || '尚未整理')}</p>
        ${snippets ? `<ul class="lesson-snippets">${snippets}</ul>` : ''}
        ${corrections ? `<div class="lesson-corrections"><span>老師修正</span><ul>${corrections}</ul></div>` : ''}
        <div class="lesson-record-actions">
          <button class="btn-secondary-sm lesson-play" type="button">播放</button>
          <button class="btn-secondary-sm lesson-fill" type="button">載入逐字稿</button>
          <button class="btn-primary-sm lesson-organize-one" type="button">整理</button>
          <button class="btn-secondary-sm lesson-delete" type="button">刪除</button>
        </div>
      `;
      div.querySelector('.lesson-play').addEventListener('click', () => playLessonAudio(lesson.audioId));
      div.querySelector('.lesson-fill').addEventListener('click', () => {
        lessonTranscriptDraft.value = (lesson.transcriptSegments || []).join('\n');
        lessonOrganizeBtn.disabled = !lessonTranscriptDraft.value.trim();
      });
      div.querySelector('.lesson-organize-one').addEventListener('click', () => organizeLessonRecord(lesson.id));
      div.querySelector('.lesson-delete').addEventListener('click', () => deleteLessonRecord(lesson.id));
      lessonRecordsList.appendChild(div);
    });
  }

  async function handleSessionToVocabulary() {
    if (isSessionToVocabularyRunning) return;
    if (!currentSession || currentSession.messages.length === 0) {
      setStatus('目前沒有可整理的對話內容', false, 2500);
      return;
    }
    isSessionToVocabularyRunning = true;
    sessionToVocabularyBtn.disabled = true;
    setStatus('整理單字中...');

    const convText = currentSession.messages.map(m => {
      const role = m.role === 'user' ? '用戶' : 'AI';
      const content = typeof m.content === 'string' ? m.content : '[多媒體內容]';
      return `${role}：${content}`;
    }).join('\n\n');

    const prompt = `請從以下對話中擷取「值得收藏到單字簿」的詞彙或短語。\n要求：\n1. 僅輸出 JSON 陣列，不要任何額外文字或 markdown。\n2. 每個元素格式：{"word":"詞彙","lang":"en|zh|ja|ko|vi|th|ar|other"}。\n3. 同義或重複項目只保留一個。\n4. 最多輸出 30 個項目。\n\n---\n${convText}`;

    const port = chrome.runtime.connect({ name: 'chat-stream' });
    let rawContent = '';

    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'chunk') {
        rawContent = msg.full || '';
        return;
      }
      if (msg.type === 'done') {
        try {
          const reply = (msg.reply || rawContent || '').trim();
          const parsedItems = parseVocabularyExtractionResult(reply);
          const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
          const now = Date.now();
          const existingWords = new Set(current.map(v => String(v.word || '').trim().toLowerCase()).filter(Boolean));
          let added = 0;

          parsedItems.forEach((item, idx) => {
            const word = item.word.trim();
            if (!word || word.length > 120) return;
            const key = word.toLowerCase();
            if (existingWords.has(key)) return;
            existingWords.add(key);
            current.push({
              id: `vocab_${now}_${idx}`,
              word,
              definition: '',
              category: '',
              lang: normalizeVocabularyLang(item.lang, word),
              createdAt: Date.now()
            });
            added++;
          });

          if (added > 0) {
            await chrome.storage.local.set({ vocabulary: current });
            if (vocabularyModal && !vocabularyModal.classList.contains('hidden')) {
              renderVocabularyList(current);
            }
            setStatus(`已加入 ${added} 個單字到單字簿`, false, 2600);
            addProcessStatusMessage(`✅ 單字整理並存入完畢（新增 ${added} 筆）`);
          } else {
            setStatus('沒有可新增的單字（可能都已存在）', false, 2600);
            addProcessStatusMessage('✅ 單字整理完成，沒有新增項目（可能都已存在）');
          }
        } catch (error) {
          setStatus(`整理單字失敗: ${error.message}`, true, 3200);
          addProcessStatusMessage(`❌ 整理單字失敗：${error.message}`, true);
        }
        isSessionToVocabularyRunning = false;
        sessionToVocabularyBtn.disabled = !currentSession;
        port.disconnect();
        return;
      }
      if (msg.type === 'error') {
        setStatus(`整理單字失敗: ${msg.message}`, true, 3200);
        addProcessStatusMessage(`❌ 整理單字失敗：${msg.message}`, true);
        isSessionToVocabularyRunning = false;
        sessionToVocabularyBtn.disabled = !currentSession;
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (!isSessionToVocabularyRunning) return;
      isSessionToVocabularyRunning = false;
      sessionToVocabularyBtn.disabled = !currentSession;
      setStatus('連線中斷，請重試', true, 3000);
    });

    port.postMessage({
      type: 'STREAM_MESSAGE',
      data: {
        message: prompt,
        history: [],
        images: [],
        translateConfig: null,
        model: currentModel,
        contextCharBudget: getCurrentContextCharBudget(),
        systemPrompt: '你是精準的語言學習助手，擅長從對話萃取高價值詞彙，並嚴格輸出指定 JSON 格式。',
        memoryContext: ''
      }
    });
  }

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
        addProcessStatusMessage('✅ 當前對話總結整理並存入完畢');
        return;
      }
      if (msg.type === 'error') {
        liveDiv.remove();
        setStatus(`總結失敗: ${msg.message}`, true, 3000);
        addProcessStatusMessage(`❌ 總結失敗：${msg.message}`, true);
        port.disconnect();
        isSummarizing = false;
        summarizeBtn.disabled = false;
      }
    });

    port.onDisconnect.addListener(() => {
      if (!isSummarizing) return;
      liveDiv.remove();
      setStatus('連線中斷，請重試', true, 3000);
      addProcessStatusMessage('❌ 總結連線中斷，請重試', true);
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
        contextCharBudget: getCurrentContextCharBudget(),
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
          ${item.addedToMemory ? '已加入長期記憶' : '+ 加入長期記憶'}
        </button>
        <button class="btn-summary-action btn-add-to-kb${item.addedToKb ? ' disabled' : ''}" data-id="${item.id}"${item.addedToKb ? ' disabled' : ''}>
          ${item.addedToKb ? '已加入知識庫' : '+ 加入知識庫'}
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
        renderKnowledgeTagManager();
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

  async function renderKnowledgeTagManager() {
    if (!knowledgeTagList) return;
    const tagMap = new Map();
    knowledgeBase.forEach(item => {
      (item.tags || []).forEach(tag => {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      });
    });
    const tags = [...tagMap.keys()].sort();
    knowledgeTagList.innerHTML = '';
    if (tags.length === 0) {
      knowledgeTagList.innerHTML = '<span class="cat-empty-hint">尚無標籤可管理。</span>';
      return;
    }

    tags.forEach(tag => {
      const row = document.createElement('span');
      row.className = 'cat-tag';
      row.innerHTML = `
        ${escapeHtml(tag)}
        <span class="kb-tag-manager-count">(${tagMap.get(tag)})</span>
        <button class="btn-cat-delete" title="移除標籤">×</button>
      `;
      row.querySelector('.btn-cat-delete').addEventListener('click', async () => {
        knowledgeBase = knowledgeBase.map(item => ({
          ...item,
          tags: (item.tags || []).filter(t => t !== tag)
        }));
        if (knowledgeTagFilter === tag) knowledgeTagFilter = '';
        await chrome.storage.local.set({ knowledgeBase });
        renderKnowledgeTagFilters();
        renderKnowledgeList();
        renderKnowledgeTagManager();
      });
      knowledgeTagList.appendChild(row);
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
    if (knowledgeSearchQuery) {
      const query = knowledgeSearchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        (item.title || '').toLowerCase().includes(query) ||
        (item.summary || '').toLowerCase().includes(query) ||
        (item.content || '').toLowerCase().includes(query) ||
        (item.url || '').toLowerCase().includes(query) ||
        (item.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    }
    if (filtered.length === 0) {
      const hasFilter = knowledgeCategoryFilter || knowledgeTagFilter || knowledgeSearchQuery;
      knowledgeList.innerHTML = hasFilter
        ? '<p class="memory-empty">此篩選條件沒有知識庫項目。</p>'
        : '<p class="memory-empty">尚無內容。<br>在任意頁面右鍵「加入知識庫」。</p>';
      return;
    }
    const catOptions = (item) =>
      `<option value="">${cats.length ? '無分類' : '新增分類後使用'}</option>`
      + cats.map(c => `<option value="${escapeAttr(c)}" ${item.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

    const LINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;
    const REANALYZE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"/><path d="M3 22v-6h6"/><path d="M20.49 9A9 9 0 0 0 6.38 5.66L3 8"/><path d="M3.51 15A9 9 0 0 0 17.62 18.34L21 16"/></svg>`;
    const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

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
          ${item.summary ? `<button class="kb-expand-btn" title="展開/收合摘要">${CHEVRON_SVG}</button>` : ''}
          <button class="kb-item-reanalyze" title="重新分析" ${item.status === 'processing' ? 'disabled' : ''}>${REANALYZE_SVG}</button>
          <button class="kb-item-delete" title="刪除">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="kb-item-meta">
          <span class="kb-item-date">${formatItemDate(item.createdAt)}</span>
          <select class="item-cat-select ${item.category ? 'has-value' : ''}" title="分類">${catOptions(item)}</select>
        </div>
        ${item.summary ? `
          <div class="kb-item-summary">${escapeHtml(item.summary)}</div>
          <div class="kb-item-summary-full hidden">${escapeHtml(item.summary)}</div>
        ` : ''}
        ${tagsHtml ? `<div class="kb-item-tags">${tagsHtml}</div>` : ''}
      `;
      // URL 連結
      div.querySelector('.kb-item-link')?.addEventListener('click', () => {
        if (item.url) chrome.tabs.create({ url: item.url });
      });
      // 重新分析
      div.querySelector('.kb-item-reanalyze')?.addEventListener('click', async () => {
        if (item.status === 'processing') return;
        const idx = knowledgeBase.findIndex(k => k.id === item.id);
        if (idx === -1) return;
        const prevStatus = knowledgeBase[idx].status;
        try {
          knowledgeBase[idx].status = 'processing';
          await chrome.storage.local.set({ knowledgeBase });
          renderKnowledgeList();
          pollKbProcessing();
          const res = await chrome.runtime.sendMessage({
            type: 'REANALYZE_KNOWLEDGE',
            data: { itemId: item.id }
          });
          if (!res?.success) throw new Error(res?.error || '重新分析失敗');
          setStatus(`已重新分析：${item.title}`, false, 2000);
        } catch (err) {
          knowledgeBase[idx].status = prevStatus;
          await chrome.storage.local.set({ knowledgeBase });
          renderKnowledgeList();
          setStatus(`重新分析失敗：${err.message}`, true, 3000);
        }
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
        renderKnowledgeTagFilters();
        renderKnowledgeTagManager();
        renderKnowledgeList();
      });
      // 展開/收合摘要
      if (item.summary) {
        const expandBtn = div.querySelector('.kb-expand-btn');
        const summaryPreview = div.querySelector('.kb-item-summary');
        const summaryFull = div.querySelector('.kb-item-summary-full');
        const toggleExpand = () => {
          const isExpanded = div.classList.toggle('expanded');
          summaryFull.classList.toggle('hidden', !isExpanded);
        };
        expandBtn.addEventListener('click', toggleExpand);
        summaryPreview.addEventListener('click', toggleExpand);
      }
      knowledgeList.appendChild(div);
    });
  }

  // ─────────────────────────────────────────────────────────

  function buildMemoryBlock() {
    if (memories.length === 0) return '';
    const lines = memories.map(m => {
      const title = m.title || m.text || '';
      const summary = m.summary && m.summary !== title ? m.summary : '';
      const tags = Array.isArray(m.tags) && m.tags.length ? ` [${m.tags.join(', ')}]` : '';
      return summary ? `- ${title}：${summary}${tags}` : `- ${title}${tags}`;
    });
    return `【使用者長期記憶】\n${lines.join('\n')}`;
  }

  // ── Vocabulary ───────────────────────────────────────────

  function getVocabularyLangLabel(lang) {
    const labels = {
      en: '英文',
      zh: '中文',
      ja: '日文',
      ko: '韓文',
      vi: '越南文',
      th: '泰文',
      ar: '阿拉伯文',
      other: '其他'
    };
    return labels[lang] || lang?.toUpperCase() || '未知';
  }

  function populateVocabularyLangFilter(vocabulary) {
    const allLangs = [...new Set(vocabulary.map(v => v.lang).filter(Boolean))].sort();
    const previous = vocabularyLangFilterEl.value || vocabularyLangFilter;
    vocabularyLangFilterEl.innerHTML = '<option value="">全部語言</option>';
    allLangs.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = getVocabularyLangLabel(lang);
      vocabularyLangFilterEl.appendChild(opt);
    });
    if (previous && allLangs.includes(previous)) {
      vocabularyLangFilter = previous;
      vocabularyLangFilterEl.value = previous;
    } else {
      vocabularyLangFilter = '';
      vocabularyLangFilterEl.value = '';
    }
  }

  async function openVocabularyModal() {
    vocabularyModal.classList.remove('hidden');
    openVocabularyBtn.classList.add('active');
    await populateCategoryFilter('vocabulary', vocabularyCategoryFilterEl);
    const { vocabulary = [] } = await chrome.storage.local.get(['vocabulary']);
    vocabularySearchInput.value = vocabularySearchQuery;
    populateVocabularyLangFilter(vocabulary);
    renderVocabularyList(vocabulary);
    renderLessonRecords();
  }

  function closeVocabularyModal() {
    vocabularyModal.classList.add('hidden');
    openVocabularyBtn.classList.remove('active');
    vocabularyCatManager.classList.add('hidden');
    manageVocabularyCatBtn.classList.remove('active');
    closeVocabularyReviewMode();
  }

  function renderVocabularyStats(total, filtered) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = total.filter(v => Number(v.createdAt || 0) >= todayStart.getTime()).length;
    const reviewDueCount = total.filter(v => (v.mastery || 'new') !== 'mastered').length;
    const masteredCount = total.filter(v => v.mastery === 'mastered').length;
    vocabularyStats.innerHTML = `
      <div class="vocab-stat"><strong>${total.length}</strong><span>總單字</span></div>
      <div class="vocab-stat"><strong>${todayCount}</strong><span>今日新增</span></div>
      <div class="vocab-stat"><strong>${reviewDueCount}</strong><span>待複習</span></div>
      <div class="vocab-stat"><strong>${masteredCount}</strong><span>已掌握</span></div>
      <div class="vocab-stat"><strong>${filtered.length}</strong><span>目前顯示</span></div>
    `;
  }

  function getVocabularySearchHaystack(item) {
    return [
      item.word,
      item.definition,
      item.zhTranslation,
      item.category,
      item.sourceTitle,
      item.sourceUrl,
      item.contextSentence,
      getVocabularyMasteryLabel(item.mastery),
      getVocabularyLangLabel(item.lang)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function getVocabularySourceLabel(item) {
    if (item.sourceTitle) return item.sourceTitle;
    if (item.sourceUrl) {
      try { return new URL(item.sourceUrl).hostname; } catch { return item.sourceUrl; }
    }
    const labels = {
      'selection-toolbar': '網頁選取',
      'context-menu': '右鍵加入',
      session: '對話整理',
      chat: '對話整理'
    };
    return labels[item.source] || '';
  }

  function getVocabularyMasteryLabel(mastery) {
    const labels = {
      new: '新單字',
      learning: '學習中',
      mastered: '已掌握'
    };
    return labels[mastery || 'new'] || '新單字';
  }

  function getVocabularyTranslationText(item) {
    if (item.lang === 'zh') return item.definition || '中文詞條';
    return item.zhTranslation || item.definition || '';
  }

  function getFilteredVocabulary(vocabulary) {
    const query = vocabularySearchQuery.toLowerCase();
    return vocabulary.filter(v => {
      if (vocabularyCategoryFilter && v.category !== vocabularyCategoryFilter) return false;
      if (vocabularyLangFilter && (v.lang || '') !== vocabularyLangFilter) return false;
      if (query && !getVocabularySearchHaystack(v).includes(query)) return false;
      return true;
    });
  }

  function getVocabularyReviewItems(vocabulary) {
    const filtered = getFilteredVocabulary(vocabulary);
    const candidates = filtered.filter(v => (v.mastery || 'new') !== 'mastered');
    const pool = candidates.length ? candidates : filtered;
    return pool.slice().sort((a, b) => {
      const aLast = Number(a.lastReviewedAt || 0);
      const bLast = Number(b.lastReviewedAt || 0);
      if (aLast !== bLast) return aLast - bLast;
      return Number(a.createdAt || 0) - Number(b.createdAt || 0);
    });
  }

  function openVocabularyReviewMode(vocabulary) {
    vocabularyReviewMode = true;
    vocabularyReviewItems = getVocabularyReviewItems(vocabulary);
    vocabularyReviewIndex = 0;
    vocabularyReviewAnswerVisible = false;
    vocabularyReviewBtn.classList.add('active');
    vocabularyReviewBtn.textContent = '結束複習';
    vocabularyList.classList.add('hidden');
    vocabularyReviewPanel.classList.remove('hidden');
    renderVocabularyStats(vocabulary, getFilteredVocabulary(vocabulary));
    renderVocabularyReviewPanel();
  }

  function closeVocabularyReviewMode() {
    vocabularyReviewMode = false;
    vocabularyReviewItems = [];
    vocabularyReviewIndex = 0;
    vocabularyReviewAnswerVisible = false;
    vocabularyReviewBtn.classList.remove('active');
    vocabularyReviewBtn.textContent = '複習模式';
    vocabularyReviewPanel.classList.add('hidden');
    vocabularyReviewPanel.innerHTML = '';
    vocabularyList.classList.remove('hidden');
  }

  function renderVocabularyReviewPanel() {
    if (!vocabularyReviewMode) return;
    if (vocabularyReviewItems.length === 0) {
      vocabularyReviewPanel.innerHTML = `
        <div class="vocab-review-empty">
          <strong>沒有可複習的單字</strong>
          <span>調整搜尋、語言或分類篩選後再試。</span>
        </div>
      `;
      return;
    }

    const item = vocabularyReviewItems[Math.min(vocabularyReviewIndex, vocabularyReviewItems.length - 1)];
    const progress = `${vocabularyReviewIndex + 1} / ${vocabularyReviewItems.length}`;
    const translationText = getVocabularyTranslationText(item) || '尚無翻譯';
    const sourceLabel = getVocabularySourceLabel(item);
    const contextHtml = item.contextSentence
      ? `<div class="vocab-review-context">${escapeHtml(item.contextSentence)}</div>`
      : '';
    const sourceHtml = sourceLabel
      ? `<div class="vocab-review-source">${item.sourceUrl ? `<a href="${escapeAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)}</a>` : escapeHtml(sourceLabel)}</div>`
      : '';
    vocabularyReviewPanel.innerHTML = `
      <div class="vocab-review-card">
        <div class="vocab-review-head">
          <span>${progress}</span>
          <span>${getVocabularyMasteryLabel(item.mastery)} · 已複習 ${Number(item.reviewCount || 0)} 次</span>
        </div>
        <div class="vocab-review-word">${escapeHtml(item.word)}</div>
        <div class="vocab-review-answer ${vocabularyReviewAnswerVisible ? '' : 'hidden'}">
          <div class="vocab-review-translation">${escapeHtml(translationText)}</div>
          ${contextHtml}
          ${sourceHtml}
        </div>
        <div class="vocab-review-actions">
          <button type="button" class="btn-secondary-sm vocab-review-show">${vocabularyReviewAnswerVisible ? '隱藏答案' : '顯示答案'}</button>
          <button type="button" class="btn-secondary-sm vocab-review-grade" data-grade="hard">不熟</button>
          <button type="button" class="btn-secondary-sm vocab-review-grade" data-grade="ok">普通</button>
          <button type="button" class="btn-secondary-sm vocab-review-grade" data-grade="mastered">已掌握</button>
        </div>
      </div>
    `;

    vocabularyReviewPanel.querySelector('.vocab-review-show').addEventListener('click', () => {
      vocabularyReviewAnswerVisible = !vocabularyReviewAnswerVisible;
      renderVocabularyReviewPanel();
    });
    vocabularyReviewPanel.querySelectorAll('.vocab-review-grade').forEach(btn => {
      btn.addEventListener('click', () => handleVocabularyReviewGrade(item.id, btn.dataset.grade));
    });
  }

  async function handleVocabularyReviewGrade(itemId, grade) {
    const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
    const idx = current.findIndex(v => v.id === itemId);
    if (idx === -1) return;
    current[idx] = {
      ...current[idx],
      mastery: grade === 'mastered' ? 'mastered' : 'learning',
      reviewCount: Number(current[idx].reviewCount || 0) + 1,
      lastReviewedAt: Date.now()
    };
    await chrome.storage.local.set({ vocabulary: current });

    vocabularyReviewItems = getVocabularyReviewItems(current);
    if (vocabularyReviewIndex >= vocabularyReviewItems.length) {
      vocabularyReviewIndex = Math.max(0, vocabularyReviewItems.length - 1);
    }
    vocabularyReviewAnswerVisible = false;
    renderVocabularyStats(current, getFilteredVocabulary(current));
    renderVocabularyReviewPanel();
  }

  async function renderVocabularyList(vocabulary) {
    const _v = ++_renderVocabVer;
    const cats = await getCategories('vocabulary');
    if (_v !== _renderVocabVer) return; // 已有更新的 render，捨棄本次
    populateVocabularyLangFilter(vocabulary);
    vocabularyList.innerHTML = '';
    const filtered = getFilteredVocabulary(vocabulary);
    renderVocabularyStats(vocabulary, filtered);
    if (filtered.length === 0) {
      const hasFilter = vocabularyCategoryFilter || vocabularyLangFilter || vocabularySearchQuery;
      vocabularyList.innerHTML = hasFilter
        ? '<p class="memory-empty">此篩選條件沒有單字。</p>'
        : '<p class="memory-empty">尚無單字。<br>在任意網頁反白文字後使用浮動小選單「加入單字」。</p>';
      return;
    }
    const langLabel = { en: 'EN', zh: '中', ja: '日', ko: '韓', vi: '越', th: '泰', ar: '阿', other: '?' };
    const ttsLangMap = { en: 'en-US', zh: 'zh-TW', ja: 'ja-JP', ko: 'ko-KR', vi: 'vi-VN', th: 'th-TH', ar: 'ar-SA', other: 'zh-TW' };
    filtered.slice().reverse().forEach(item => {
      const div = document.createElement('div');
      div.className = 'vocab-card';
      const ttsLang = ttsLangMap[item.lang] || 'zh-TW';
      const catOptions = `<option value="">${cats.length ? '無分類' : '新增分類後使用'}</option>`
        + cats.map(c => `<option value="${escapeAttr(c)}" ${item.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      const translationText = item.lang === 'zh'
        ? (item.definition || '中文詞條')
        : (item.zhTranslation || item.definition || '');
      const sourceLabel = getVocabularySourceLabel(item);
      const sourceHtml = sourceLabel
        ? `<div class="vocab-source">${item.sourceUrl ? `<a href="${escapeAttr(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)}</a>` : escapeHtml(sourceLabel)}</div>`
        : '';
      const contextHtml = item.contextSentence
        ? `<div class="vocab-context">${escapeHtml(item.contextSentence)}</div>`
        : '';
      const translationHtml = translationText
        ? `<div class="vocab-translation">${escapeHtml(translationText)}</div>`
        : `<button type="button" class="vocab-translate-btn" data-id="${escapeAttr(item.id)}" data-word="${escapeAttr(item.word)}">取得中文翻譯</button>`;
      div.innerHTML = `
        <div class="vocab-card-main">
          <div class="vocab-card-top">
            <span class="memory-item-badge context-menu">${langLabel[item.lang] || '?'}</span>
            <div class="vocab-card-content">
              <div class="vocab-word-row">
                <span class="memory-item-text vocab-word editable" title="點擊編輯">${escapeHtml(item.word)}</span>
                <div class="vocab-card-actions">
                  <button class="btn-vocab-tts btn-icon-xs" title="朗讀" data-text="${escapeAttr(item.word)}" data-lang="${ttsLang}">${TTS_SVG}</button>
                  <button class="btn-vocab-copy btn-icon-xs" title="複製" data-text="${escapeAttr(item.word)}">${COPY_SVG}</button>
                  <button class="btn-memory-delete" title="刪除">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              </div>
              ${translationHtml}
              ${contextHtml}
              ${sourceHtml}
            </div>
          </div>
        </div>
        <div class="vocab-card-meta">
          <span class="memory-item-date">${formatItemDate(item.createdAt)}</span>
          <span class="vocab-mastery ${escapeAttr(item.mastery || 'new')}">${getVocabularyMasteryLabel(item.mastery)}</span>
          <select class="item-cat-select ${item.category ? 'has-value' : ''}" title="分類">${catOptions}</select>
        </div>
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
        input.className = 'memory-item-input vocab-word-input';
        input.value = item.word;
        wordSpan.replaceWith(input);
        input.focus();
        input.select();
        const save = async () => {
          const newWord = input.value.trim();
          if (newWord && newWord !== item.word) {
            const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
            const idx = current.findIndex(v => v.id === item.id);
            if (idx !== -1) {
              current[idx].word = newWord;
              current[idx].zhTranslation = '';
              await chrome.storage.local.set({ vocabulary: current });
            }
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
      const translateBtn = div.querySelector('.vocab-translate-btn');
      if (translateBtn) {
        translateBtn.addEventListener('click', async () => {
          translateBtn.disabled = true;
          translateBtn.textContent = '翻譯中...';
          const res = await chrome.runtime.sendMessage({ type: 'TRANSLATE_WORD', data: { text: item.word } });
          if (res.success) {
            const { vocabulary: current = [] } = await chrome.storage.local.get(['vocabulary']);
            const idx = current.findIndex(v => v.id === item.id);
            if (idx !== -1) {
              current[idx].zhTranslation = res.translated;
              await chrome.storage.local.set({ vocabulary: current });
            }
            renderVocabularyList(current);
          } else {
            translateBtn.disabled = false;
            translateBtn.textContent = '翻譯失敗，重試';
          }
        });
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
    return attachPageContext({ focusInput: true });
  }

  async function attachPageContext({ focusInput = false } = {}) {
    setStatus('讀取頁面中...');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'READ_PAGE' });
      if (!response.success) throw new Error(response.error);
      pageContext = response.data;
      pageContext.kind = 'page';
      renderPageContextChip();
      clearStatus();
      updateSendButton();
      updateCharCounter();
      if (focusInput) messageInput.focus();
      return pageContext;
    } catch (err) {
      setStatus('無法讀取頁面：' + err.message, true, 4000);
      return null;
    }
  }

  function renderPageContextChip() {
    if (!pageContext) return;
    const rawTitle = pageContext.title || pageContext.url || '目前頁面';
    const shortTitle = rawTitle.slice(0, 25) + (rawTitle.length > 25 ? '...' : '');
    const suffix = pageContext.kind === 'code' ? '（分析程式碼與樣式）' : '';
    pageContextLabel.textContent = `${shortTitle}${suffix}`;
    pageContextChip.classList.remove('hidden');
  }

  async function attachPageCodeContext({ question = '', focusInput = false } = {}) {
    if (isLoading) return;
    setStatus('讀取頁面代碼中...');
    let pageData;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'READ_PAGE_CODE' });
      if (!response.success) throw new Error(response.error);
      pageData = response.data;
    } catch (err) {
      setStatus('無法讀取頁面代碼：' + err.message, true, 4000);
      return;
    }

    const { title, url, styles, cssLinks, html } = pageData;

    // 組合代碼內容：CSS 優先，HTML 附後
    let codeContent = `標題：${title}\n網址：${url}\n`;
    if (cssLinks) codeContent += `\n=== 外部 CSS 路徑 ===\n${cssLinks}\n`;
    if (styles) codeContent += `\n=== 內嵌 <style> ===\n${styles}\n`;
    codeContent += `\n=== HTML 原始碼 ===\n${html}`;
    pageContext = {
      kind: 'code',
      title,
      url,
      description: '分析程式碼與樣式',
      text: codeContent
    };
    renderPageContextChip();
    clearStatus();
    updateSendButton();
    updateCharCounter();
    if (question) {
      messageInput.value = question;
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
      updateSendButton();
    }
    if (focusInput) messageInput.focus();
    return pageContext;
  }

  function clearPageContext() {
    pageContext = null;
    pageContextChip.classList.add('hidden');
    updateCharCounter();
  }

  const PAGE_INLINE_LIMIT = 6000; // 超過此字數改用分段分析 pipeline

  function buildPageContextMessage(userMessage) {
    if (!pageContext) return userMessage;
    // 長頁：不 inline 嵌入（由 handleSend 轉 text file 走 pipeline）
    if (pageContext.text.length > PAGE_INLINE_LIMIT) {
      if (userMessage) return userMessage;
      return ''; // 純 /page 時，message 由 pipeline 負責
    }
    const contextTitle = pageContext.kind === 'code' ? '【當前頁面程式碼與樣式】' : '【當前頁面】';
    const parts = [contextTitle, `標題：${pageContext.title}`, `網址：${pageContext.url}`];
    if (pageContext.description) parts.push(`描述：${pageContext.description}`);
    parts.push(`內容：\n${pageContext.text}`);
    if (userMessage) parts.push(`\n使用者問題：\n${userMessage}`);
    clearPageContext();
    return parts.join('\n');
  }

  // 長頁時把 pageContext 轉成 text file，走 streamTextFilesPipeline
  function buildPageContextFile() {
    if (!pageContext || pageContext.text.length <= PAGE_INLINE_LIMIT) return null;
    const { kind, title, url, description, text } = pageContext;
    let content = `標題：${title}\n網址：${url}\n`;
    if (description) content += `描述：${description}\n`;
    content += `\n內容：\n${text}`;
    const b64 = btoa(unescape(encodeURIComponent(content)));
    clearPageContext();
    return { dataUrl: `data:text/plain;base64,${b64}`, fileType: 'text', fileName: `${title || url}.${kind === 'code' ? 'html' : 'txt'}` };
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
      // 文法標籤：**Faulty:** 格式需在 bold 前處理，否則 ** 會先被消耗
      s = s.replace(/\*\*Faulty[：:]\*\*/g,
        '<span class="grammar-label grammar-faulty">Faulty：</span>');
      s = s.replace(/\*\*Correct[：:]\*\*/g,
        '<span class="grammar-label grammar-correct">Correct：</span>');
      s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^\s].*?[^\s])\*/g, '<em>$1</em>');
      s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
      // 文法標籤：Faulty（錯誤）：/ Correct（正確）：
      s = s.replace(/Faulty[（(][^）)]*[）)][\s]*[：:]/g,
        '<span class="grammar-label grammar-faulty">$&</span>');
      s = s.replace(/Correct[（(][^）)]*[）)][\s]*[：:]/g,
        '<span class="grammar-label grammar-correct">$&</span>');
      s = s.replace(/^(問題)[：:]/,
        '<span class="grammar-note-label">$1</span>：');
      s = s.replace(/^(說明)[：:]/,
        '<span class="grammar-note-label">$1</span>：');
      // 填空底線（3個以上底線）
      s = s.replace(/_{3,}/g, '<span class="fill-blank"></span>');
      // （全形括號中文）淡色
      s = s.replace(/（[^）\n]+）/g, '<span class="zh-translation">$&</span>');
      return s;
    }

    // 5. 逐行解析
    const lines = text.split('\n');
    const out = [];
    let inUl = false, inOl = false;
    let tRows = [], inTable = false;
    let inBq = false, bqTexts = [], bqChips = [];

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

    function flushBlockquote() {
      if (!inBq) return;
      out.push('<div class="ai-suggestion-block">');
      if (bqTexts.length) out.push(`<p class="suggestion-prompt">${bqTexts.join('<br>')}</p>`);
      if (bqChips.length) {
        out.push('<div class="suggestion-chips-row">');
        for (const chip of bqChips) {
          const attr = chip.replace(/"/g, '&quot;');
          out.push(`<button class="suggestion-chip ai-suggestion" data-text="${attr}">${chip}</button>`);
        }
        out.push('</div>');
      }
      out.push('</div>');
      inBq = false; bqTexts = []; bqChips = [];
    }

    for (const line of lines) {
      // blockquote（> text 或 > - item）
      if (line.startsWith('&gt; ') || line === '&gt;') {
        flushLists();
        if (inTable) flushTable();
        const content = line.startsWith('&gt; ') ? line.slice(5) : '';
        const bqList = content.match(/^[-\*\+] (.+)/);
        if (!inBq) { inBq = true; bqTexts = []; bqChips = []; }
        if (bqList) { bqChips.push(applyInline(bqList[1])); }
        else if (content) { bqTexts.push(applyInline(content)); }
        continue;
      }
      if (inBq) flushBlockquote();

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
      const ulm = line.match(/^\s*[\-\*\+] (.+)/);
      if (ulm) {
        const liContent = ulm[1].replace(/^&gt;\s+/, '');
        // 偵測選擇題選項行：開頭為 a. / (a) 且含有 b. 選項
        if (/^[（(]?a[.)）]\s/.test(liContent) && /\s+[b-e][.）)]/i.test(liContent)) {
          flushLists();
          const parts = liContent.split(/\s+(?=[b-e][.）)])/i);
          out.push('<div class="quiz-options">');
          for (const part of parts) {
            const trimmed = part.trim();
            const lm = trimmed.match(/^([a-e])[.)）]\s*/i);
            if (lm) {
              const content = trimmed.slice(lm[0].length);
              out.push(`<span class="quiz-option"><span class="quiz-option-badge">${lm[1].toLowerCase()}</span>${applyInline(content)}</span>`);
            } else {
              out.push(`<span class="quiz-option">${applyInline(trimmed)}</span>`);
            }
          }
          out.push('</div>');
        } else {
          if (inOl) { out.push('</ol>'); inOl = false; }
          if (!inUl) { out.push('<ul>'); inUl = true; }
          out.push(`<li>${applyInline(liContent)}</li>`);
        }
        continue;
      }

      // ordered list
      const olm = line.match(/^\s*(\d+)\. (.+)/);
      if (olm) {
        const num = parseInt(olm[1], 10);
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push(num > 1 ? `<ol start="${num}">` : '<ol>'); inOl = true; }
        out.push(`<li>${applyInline(olm[2])}</li>`); continue;
      }

      flushLists();

      // blank
      if (!line.trim()) { out.push('<br>'); continue; }

      // paragraph
      out.push(`<p>${applyInline(line)}</p>`);
    }

    flushLists();
    flushBlockquote();
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

  // ── Market Dashboard ───────────────────────────────────────

  function openMarketPanel() {
    marketPanel.classList.remove('hidden');
    openMarketBtn.classList.add('active');
    loadMarketDashboard(false);
  }

  function closeMarketPanel() {
    marketPanel.classList.add('hidden');
    openMarketBtn.classList.remove('active');
  }

  function formatMarketTime(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(value);
    }
  }

  function formatMarketNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    return n.toFixed(digits);
  }

  function marketChangeClass(value) {
    const n = Number(value || 0);
    if (n > 0.05) return 'up';
    if (n < -0.05) return 'down';
    return 'flat';
  }

  async function loadMarketDashboard(force = false) {
    if (!force && marketDashboard?.market === activeMarket) {
      renderMarketDashboard(marketDashboard);
      return;
    }
    const requestedMarket = activeMarket;
    marketFreshness.textContent = '載入中...';
    marketHeatmap.innerHTML = '<div class="market-loading">正在取得市場資料...</div>';
    marketGroups.innerHTML = '';
    marketNews.innerHTML = '';
    marketDetail.innerHTML = '尚未選取個股。';
    marketWarnings.innerHTML = '';
    marketWarnings.classList.add('hidden');
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_FINANCE_DASHBOARD', data: { market: requestedMarket } });
      if (requestedMarket !== activeMarket) return;
      if (!res?.success) throw new Error(res?.error || '市場資料載入失敗');
      marketDashboard = res.data;
      selectedMarketStock = null;
      renderMarketDashboard(marketDashboard);
    } catch (err) {
      if (requestedMarket !== activeMarket) return;
      marketFreshness.textContent = '資料不足';
      marketHeatmap.innerHTML = `<div class="market-empty">市場資料載入失敗：${escapeHtml(err.message)}</div>`;
    }
  }

  function renderMarketDashboard(data) {
    const freshness = data.freshness || {};
    marketFreshness.textContent = `${freshness.label || '最新可用'}${freshness.timestamp ? ` · ${formatMarketTime(freshness.timestamp)}` : ''}`;
    if (data.warnings?.length) {
      const apiHint = data.market === 'TW'
        ? '台股 API 目前沒有回傳可用資料；請設定 FinMind token 後重新整理，或稍後再試。'
        : '美股 API 目前沒有回傳可用資料；請設定 Finnhub 或 Alpha Vantage API Key 後重新整理。';
      const warnings = data.hasApiError ? [apiHint] : data.warnings;
      marketWarnings.innerHTML = warnings.map(w => `<div>${escapeHtml(w)}</div>`).join('');
      marketWarnings.classList.remove('hidden');
    } else {
      marketWarnings.innerHTML = '';
      marketWarnings.classList.add('hidden');
    }
    renderMarketHeatmap(data.groups || [], data);
    renderMarketGroups(data.groups || []);
    renderMarketNews(data.news || []);
  }

  function renderMarketHeatmap(groups, dashboard = {}) {
    const shouldHideForApiIssue = dashboard.hasApiError && (dashboard.market === 'TW' || Number(dashboard.validQuoteCount || 0) === 0);
    if (!groups.length || Number(dashboard.validQuoteCount || 0) === 0 || shouldHideForApiIssue) {
      const isTw = dashboard.market === 'TW';
      marketHeatmap.innerHTML = `
        <div class="market-empty">
          <strong>目前沒有取得可用行情資料</strong>
          <div>下一步建議：</div>
          <ul>
            <li>${isTw ? '台股請先在設定頁填入 FinMind token，免費方案仍可能有流量限制。' : '美股請先在設定頁填入 Finnhub API Key 或 Alpha Vantage API Key。'}</li>
            <li>填完 key 後回到市場 panel 按右上角重新整理。</li>
            <li>若只想單一查詢，可先用 ${isTw ? '`/twstock 2330`' : '`/finance NVDA`'} 確認金融資料層是否可用。</li>
          </ul>
        </div>`;
      return;
    }
    const validGroups = groups
      .map(group => ({ ...group, stocks: (group.stocks || []).filter(stock => !stock.error && Number.isFinite(Number(stock.price))) }))
      .filter(group => group.stocks.length > 0);
    const maxAbs = Math.max(...validGroups.flatMap(g => (g.stocks || []).map(s => Math.abs(Number(s.percentChange || 0)))), 1);
    marketHeatmap.innerHTML = validGroups.map(group => `
      <div class="market-heatmap-group">
        <div class="market-heatmap-group-title">${escapeHtml(group.name)} <span>${formatMarketNumber(group.avgChange)}%</span></div>
        <div class="market-heatmap-tiles">
          ${(group.stocks || []).map(stock => {
            const change = Number(stock.percentChange || 0);
            const intensity = Math.min(1, Math.abs(change) / maxAbs);
            const alpha = 0.18 + intensity * 0.5;
            const color = change >= 0 ? `rgba(16,185,129,${alpha})` : `rgba(239,68,68,${alpha})`;
            const weight = Math.min(2.4, Math.max(1, Math.log10(Math.max(Number(stock.volume || 0), 10)) / 5));
            return `<button class="market-tile ${marketChangeClass(change)}" data-market-symbol="${escapeAttr(stock.symbol)}" style="background:${color};flex:${weight}">
              <strong>${escapeHtml(stock.displaySymbol || stock.symbol)}</strong>
              <span>${escapeHtml(stock.name || '')}</span>
              <em>${formatMarketNumber(change)}%</em>
            </button>`;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  function renderMarketGroups(groups) {
    if (marketDashboard?.hasApiError && marketDashboard?.market === 'TW') {
      marketGroups.innerHTML = '<div class="market-empty">台股 API 回傳錯誤，暫時隱藏族群資料。請設定 FinMind token 後重新整理，或稍後再試。</div>';
      return;
    }
    const validGroups = groups.filter(group => (group.stocks || []).some(stock => !stock.error && Number.isFinite(Number(stock.price))));
    marketGroups.innerHTML = validGroups.length ? validGroups.map(group => `
      <div class="market-group-row">
        <div>
          <strong>${escapeHtml(group.name)}</strong>
          <span>上漲比例 ${Math.round(Number(group.upRatio || 0) * 100)}%</span>
        </div>
        <span class="market-change ${marketChangeClass(group.avgChange)}">${formatMarketNumber(group.avgChange)}%</span>
      </div>
    `).join('') : '<div class="market-empty">尚無可用族群資料。請先設定金融 API key 或稍後重試。</div>';
  }

  function renderMarketNews(newsGroups) {
    const items = newsGroups.flatMap(group => {
      const newsItems = (group.news || []).map(news => ({ ...news, symbol: group.displaySymbol || group.symbol, name: group.name }));
      if (newsItems.length) return newsItems;
      return (group.fallbackQueries || []).slice(0, 1).map(query => ({
        symbol: group.displaySymbol || group.symbol,
        headline: `搜尋 ${query}`,
        source: 'Search',
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        datetime: null
      }));
    });
    marketNews.innerHTML = items.length ? items.slice(0, 8).map(item => `
      <div class="market-news-item">
        <span class="market-news-symbol">${escapeHtml(item.symbol || '')}</span>
        <a class="market-news-title" href="${escapeAttr(item.url || '#')}" target="_blank" rel="noopener">${escapeHtml(item.headline || item.summary || '未命名消息')}</a>
        <small class="market-news-meta">${escapeHtml(item.source || '')}${item.datetime ? `<br>${formatMarketTime(item.datetime)}` : ''}</small>
      </div>
    `).join('') : '<div class="market-empty">尚無結構化新聞；可使用 /news 指令搭配搜尋 fallback。</div>';
  }

  function renderSparkline(points = [], change = 0) {
    const closes = points.map(p => Number(p.close)).filter(Number.isFinite).slice(-30);
    if (closes.length < 2) {
      return `<div class="market-chart-empty">尚無足夠歷史資料可繪製趨勢圖</div>`;
    }
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const width = 260;
    const height = 82;
    const d = closes.map((value, idx) => {
      const x = (idx / (closes.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const first = closes[0];
    const last = closes.at(-1);
    const periodChange = first ? ((last / first) - 1) * 100 : 0;
    return `
      <div class="market-sparkline ${marketChangeClass(change || periodChange)}">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="近 30 日收盤價趨勢">
          <path d="${d}"></path>
        </svg>
        <div class="market-sparkline-meta">
          <span>近 ${closes.length} 日收盤趨勢</span>
          <strong>${formatMarketNumber(periodChange)}%</strong>
        </div>
      </div>
    `;
  }

  function renderMarketDetailStats(stock, detail = null) {
    const q = detail?.quote?.quote || {};
    const profile = detail?.profile?.profile || {};
    const fundamentals = detail?.fundamentals?.fundamentals || {};
    const latestRevenue = fundamentals.monthlyRevenue?.at?.(-1);
    const valuation = fundamentals.valuation || {};
    const rows = [
      ['開盤', q.open ?? stock.open],
      ['最高', q.high ?? stock.high],
      ['最低', q.low ?? stock.low],
      ['前收', q.previousClose ?? stock.previousClose],
      ['成交量', q.volume ?? stock.volume, 0],
      ['成交值', q.turnover ?? stock.turnover, 0],
      ['產業', profile.industryCategory || profile.industry || profile.sector],
      ['本益比', fundamentals.peRatio ?? valuation.peRatio],
      ['股價淨值比', fundamentals.priceToBook ?? valuation.priceToBook],
      ['殖利率', fundamentals.dividendYield ?? valuation.dividendYield],
      ['月營收 YoY', latestRevenue?.yoy != null ? `${formatMarketNumber(latestRevenue.yoy)}%` : null]
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');
    return rows.length ? `
      <div class="market-detail-stats">
        ${rows.slice(0, 10).map(([label, value, digits]) => `
          <div><span>${escapeHtml(label)}</span><strong>${typeof value === 'number' ? formatMarketNumber(value, digits ?? 2) : escapeHtml(String(value))}</strong></div>
        `).join('')}
      </div>
    ` : '';
  }

  function renderMarketDetail(stock, detail = null) {
    selectedMarketStock = stock;
    marketDetailHint.textContent = stock.displaySymbol || stock.symbol;
    const change = Number(stock.percentChange || 0);
    const price = detail?.quote?.quote?.current ?? stock.price;
    const freshness = detail?.freshness || stock.freshness || {};
    const points = detail?.history?.points || [];
    marketDetail.innerHTML = `
      <div class="market-detail-card">
        <div class="market-detail-top">
          <div>
            <strong>${escapeHtml(stock.displaySymbol || stock.symbol)}</strong>
            <span>${escapeHtml(stock.name || '')}</span>
          </div>
          <span class="market-change ${marketChangeClass(change)}">${formatMarketNumber(change)}%</span>
        </div>
        <div class="market-detail-price">${formatMarketNumber(price)} <span>${escapeHtml(freshness.label || '最新可用')} ${freshness.timestamp ? `· ${formatMarketTime(freshness.timestamp)}` : ''}</span></div>
        ${renderSparkline(points, change)}
        ${renderMarketDetailStats(stock, detail)}
        <div class="market-detail-actions">
          <button class="btn-primary-sm" type="button" data-market-command="finance" data-symbol="${escapeAttr(stock.symbol)}">深入分析</button>
          <button class="btn-secondary-sm" type="button" data-market-command="news" data-symbol="${escapeAttr(stock.symbol)}">新聞</button>
          <button class="btn-secondary-sm" type="button" data-market-command="add" data-symbol="${escapeAttr(stock.symbol)}">加入對話</button>
        </div>
      </div>
    `;
  }

  async function loadMarketStockDetail(stock) {
    marketDetailHint.textContent = '載入個股資料...';
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GET_FINANCE_STOCK_DETAIL',
        data: { symbol: stock.symbol, market: stock.market || activeMarket, companyName: stock.name }
      });
      if (!res?.success) throw new Error(res?.error || '個股資料載入失敗');
      renderMarketDetail(stock, res.data);
    } catch (err) {
      marketDetailHint.textContent = '個股資料不足';
      setStatus(`個股資料載入失敗：${err.message}`, true, 2600);
    }
  }

  function sendFinanceQuickCommand(type, symbol) {
    const template = type === 'news' ? FINANCE_NEWS_TEMPLATE : FINANCE_RESEARCH_TEMPLATE;
    const trigger = type === 'news' ? '/news' : '/finance';
    const message = template.replace('{input}', symbol);
    closeMarketPanel();
    messageInput.value = '';
    messageInput.dispatchEvent(new Event('input'));
    setStatus(`已送出 ${trigger} ${symbol}`, false, 1800);
    handleSend({ apiMessageOverride: message, displayMessageOverride: type === 'news' ? `新聞．${symbol}` : `深入分析．${symbol}` });
  }

  function addMarketContextToChat() {
    if (!selectedMarketStock) return;
    const stock = selectedMarketStock;
    const line = `加入對話．${stock.displaySymbol || stock.symbol}\n【市場摘要】${stock.displaySymbol || stock.symbol} ${stock.name || ''}：價格 ${formatMarketNumber(stock.price)}，漲跌 ${formatMarketNumber(stock.percentChange)}%，資料狀態 ${stock.freshness?.label || '最新可用'} ${stock.freshness?.timestamp ? formatMarketTime(stock.freshness.timestamp) : ''}。`;
    messageInput.value = `${messageInput.value ? `${messageInput.value}\n\n` : ''}${line}`;
    messageInput.dispatchEvent(new Event('input'));
    closeMarketPanel();
    messageInput.focus();
    setStatus('已加入市場摘要到對話輸入框', false, 2200);
  }

  // ── Spaces ────────────────────────────────────────────────────

  const SPACE_ICONS = [
    { id: 'folder',       path: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
    { id: 'briefcase',    path: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><path d="M2 12h20"/>' },
    { id: 'trending-up',  path: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
    { id: 'code',         path: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
    { id: 'book-open',    path: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
    { id: 'pen',          path: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
    { id: 'heart',        path: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
    { id: 'globe',        path: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    { id: 'home',         path: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { id: 'rocket',       path: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>' },
    { id: 'star',         path: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    { id: 'music',        path: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
    { id: 'target',       path: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    { id: 'zap',          path: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
    { id: 'coffee',       path: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>' },
    { id: 'graduation',   path: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>' },
    { id: 'layers',       path: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' },
    { id: 'cpu',          path: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>' },
    { id: 'message',      path: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
    { id: 'search',       path: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
    { id: 'bar-chart',    path: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    { id: 'dollar',       path: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    { id: 'airplane',     path: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-1 0-2 .5-2.8 1.3L13 9 4.8 6.2c-.5-.2-1.1 0-1.4.5l-.5.9c-.2.4-.1.9.3 1.2L9 12H5l-1-1H2l2 4 2 2h4l-1-1v-1l3.6 3.6c.3.3.8.5 1.2.3l.9-.5c.5-.3.7-.9.5-1.4z"/>' },
    { id: 'flask',        path: '<path d="M9 3h6v11l3.5 6H5.5L9 14V3z"/><line x1="9" y1="3" x2="15" y2="3"/><path d="M6 14h12"/>' },
    { id: 'sun',          path: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' },
    { id: 'gamepad',      path: '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/>' },
    { id: 'shopping',     path: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
    { id: 'camera',       path: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>' },
    { id: 'tool',         path: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
    { id: 'users',        path: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    { id: 'leaf',         path: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>' },
  ];

  function getSpaceIconSvg(iconId, size = 18) {
    const icon = SPACE_ICONS.find(i => i.id === iconId) || SPACE_ICONS[0];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.path}</svg>`;
  }

  function getSpaceDisplayIcon(space, size = 18) {
    if (space.icon) return getSpaceIconSvg(space.icon, size);
    if (space.emoji) return `<span style="font-size:${size}px;line-height:1">${space.emoji}</span>`;
    return getSpaceIconSvg('folder', size);
  }

  const openSpacesBtn     = document.getElementById('openSpacesBtn');
  const spacesPanel       = document.getElementById('spacesPanel');
  const spacesListView    = document.getElementById('spacesListView');
  const spaceDetailView   = document.getElementById('spaceDetailView');
  const spacesPanelClose  = document.getElementById('spacesPanelClose');
  const spaceDetailClose  = document.getElementById('spaceDetailClose');
  const spacesSearchToggleBtn = document.getElementById('spacesSearchToggleBtn');
  const spacesSearchBar   = document.getElementById('spacesSearchBar');
  const spacesSearchInput = document.getElementById('spacesSearchInput');
  const spacesClearSearch = document.getElementById('spacesClearSearch');
  const spacesList        = document.getElementById('spacesList');
  const createSpaceBtn    = document.getElementById('createSpaceBtn');
  const spaceBackBtn      = document.getElementById('spaceBackBtn');
  const spaceDetailEmoji  = document.getElementById('spaceDetailEmoji');
  const spaceDetailName   = document.getElementById('spaceDetailName');
  const spaceSettingsBtn  = document.getElementById('spaceSettingsBtn');
  const spaceInfoBar      = document.getElementById('spaceInfoBar');
  const spaceSessionsList = document.getElementById('spaceSessionsList');
  const spaceMessageInput = document.getElementById('spaceMessageInput');
  const spaceStartSessionBtn   = document.getElementById('spaceStartSessionBtn');
  const spaceAddSessionDrawer  = document.getElementById('spaceAddSessionDrawer');
  const spaceAddSessionClose   = document.getElementById('spaceAddSessionClose');
  const spaceAddSessionList    = document.getElementById('spaceAddSessionList');
  const spaceSettingsDrawer  = document.getElementById('spaceSettingsDrawer');
  const spaceSettingsClose   = document.getElementById('spaceSettingsClose');
  const spaceIconBtn         = document.getElementById('spaceIconBtn');
  const spaceIconPicker      = document.getElementById('spaceIconPicker');
  const spaceNameInput       = document.getElementById('spaceNameInput');
  const spaceInstructionsInput = document.getElementById('spaceInstructionsInput');
  const spaceLinkInput       = document.getElementById('spaceLinkInput');
  const spaceAddLinkBtn      = document.getElementById('spaceAddLinkBtn');
  const spaceLinksList       = document.getElementById('spaceLinksList');
  const spaceDeleteBtn       = document.getElementById('spaceDeleteBtn');
  const spaceSettingsSave    = document.getElementById('spaceSettingsSave');
  const createSpaceModal     = document.getElementById('createSpaceModal');
  const createSpaceModalOverlay = document.getElementById('createSpaceModalOverlay');
  const createSpaceModalClose   = document.getElementById('createSpaceModalClose');
  const createSpaceIconBtn      = document.getElementById('createSpaceIconBtn');
  const createSpaceIconPicker   = document.getElementById('createSpaceIconPicker');
  const createSpaceNameInput    = document.getElementById('createSpaceNameInput');
  const createSpaceConfirmBtn   = document.getElementById('createSpaceConfirmBtn');

  let editingSpaceId = null;
  let settingsDrawerIcon = 'folder';
  let createModalIcon = 'folder';

  async function loadSpaces() {
    const res = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
    spaces = res?.data || [];
  }

  async function saveSpaceData(space) {
    await chrome.runtime.sendMessage({ type: 'SAVE_SPACE', data: { space } });
    await loadSpaces();
  }

  async function deleteSpaceData(spaceId) {
    await chrome.runtime.sendMessage({ type: 'DELETE_SPACE', data: { spaceId } });
    await loadSpaces();
  }

  function openSpacesPanel() {
    spacesPanel.classList.remove('hidden');
    openSpacesBtn.classList.add('active');
    showSpacesListView();
    renderSpacesList();
  }

  function closeSpacesPanel() {
    spacesPanel.classList.add('hidden');
    openSpacesBtn.classList.remove('active');
    closeSettingsDrawer();
  }

  function closeAllPanels() {
    historyPanel.classList.add('hidden');
    toggleHistoryBtn.classList.remove('active');
    closeSpacesPanel();
    closeMemoryModal();
    closeVocabularyModal();
    closeKnowledgeModal();
    closeMarketPanel();
    closeSpacePicker();
  }

  function showSpacesListView() {
    spacesListView.classList.remove('hidden');
    spaceDetailView.classList.add('hidden');
    currentSpaceId = null;
  }

  function showSpaceDetailView(spaceId) {
    currentSpaceId = spaceId;
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;
    spaceDetailEmoji.innerHTML = getSpaceDisplayIcon(space, 20);
    spaceDetailName.textContent = space.name;
    spacesListView.classList.add('hidden');
    spaceDetailView.classList.remove('hidden');
    renderSpaceInfoBar(space);
    renderSpaceSessionsList();
  }

  function renderSpaceInfoBar(space) {
    const parts = [];
    const hasInstructions = space.instructions?.trim();
    const hasLinks = Array.isArray(space.links) && space.links.length > 0;

    if (hasInstructions) {
      const id = 'sib_' + space.id;
      parts.push(`<div class="space-info-instructions">
        <div class="space-info-instructions-text clamped" id="${id}">${escapeHtml(space.instructions.trim())}</div>
        <button class="space-info-expand-btn" data-target="${id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          展開說明
        </button>
      </div>`);
    }

    if (hasLinks) {
      const chips = space.links.map(link => {
        const host = (() => { try { return new URL(link.url).hostname; } catch { return ''; } })();
        const label = host || link.url;
        return `<a class="space-info-link-chip" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">
          <img src="https://www.google.com/s2/favicons?domain=${host}&sz=16" alt="" onerror="this.style.display='none'">
          ${escapeHtml(label)}
        </a>`;
      }).join('');
      parts.push(`<div class="space-info-links">${chips}</div>`);
    }

    if (!hasInstructions && !hasLinks) {
      parts.push(`<div class="space-info-setup-hint" id="spaceSetupHintBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        設定空間指示、連結，讓 AI 更了解此空間的用途
      </div>`);
    }

    spaceInfoBar.innerHTML = parts.join('');

    // 展開/收合說明
    spaceInfoBar.querySelectorAll('.space-info-expand-btn').forEach(btn => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      btn.addEventListener('click', () => {
        const collapsed = target.classList.toggle('clamped');
        btn.innerHTML = collapsed
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg> 展開說明`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> 收合說明`;
      });
    });

    // 設定提示按鈕點擊直接開設定
    document.getElementById('spaceSetupHintBtn')?.addEventListener('click', () => {
      if (currentSpaceId) openSettingsDrawer(currentSpaceId);
    });
  }

  const SPACE_EXAMPLES = [
    { icon: 'briefcase', name: '工作專案' },
    { icon: 'trending-up', name: '美股分析' },
    { icon: 'code', name: '程式開發' },
    { icon: 'book-open', name: '學習筆記' },
    { icon: 'pen', name: '寫作創作' },
    { icon: 'leaf', name: '健康管理' },
  ];

  function renderSpacesList(query = '') {
    const q = query.toLowerCase().trim();
    const filtered = q ? spaces.filter(s => s.name.toLowerCase().includes(q)) : spaces;

    if (filtered.length === 0 && !q) {
      spacesList.innerHTML = `
        <div class="spaces-onboarding">
          <div class="spaces-onboarding-hero">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            <h4>什麼是空間？</h4>
            <p>空間是獨立的工作區，讓不同主題的對話彼此隔離。每個空間可以設定專屬的 AI 指示、參考連結，讓 AI 更了解你在這個空間的工作情境。</p>
          </div>
          <div class="spaces-onboarding-tips">
            <div class="spaces-tip-item">
              <span class="spaces-tip-icon">🗂️</span>
              <div>
                <strong>對話隔離</strong>
                <span>每個空間有獨立的對話記錄，不同任務互不干擾</span>
              </div>
            </div>
            <div class="spaces-tip-item">
              <span class="spaces-tip-icon">🧠</span>
              <div>
                <strong>空間指示</strong>
                <span>設定 AI 在此空間的角色與行為，每次對話自動套用</span>
              </div>
            </div>
            <div class="spaces-tip-item">
              <span class="spaces-tip-icon">🔗</span>
              <div>
                <strong>參考連結</strong>
                <span>加入常用網址，讓 AI 知道此空間優先參考的資源</span>
              </div>
            </div>
          </div>
          <div class="spaces-onboarding-examples">
            <p class="spaces-examples-label">快速新增範例空間</p>
            <div class="spaces-examples-chips">
              ${SPACE_EXAMPLES.map(ex =>
                `<button class="spaces-example-chip" data-icon="${ex.icon}" data-name="${ex.name}">
                  ${getSpaceIconSvg(ex.icon, 13)} ${ex.name}
                </button>`
              ).join('')}
            </div>
          </div>
        </div>`;

      spacesList.querySelectorAll('.spaces-example-chip').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.name;
          const icon = btn.dataset.icon;
          const newSpace = {
            id: 'space_' + Date.now(),
            name, icon,
            instructions: '', files: [], links: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await saveSpaceData(newSpace);
          showSpaceDetailView(newSpace.id);
        });
      });
      return;
    }

    if (filtered.length === 0 && q) {
      spacesList.innerHTML = `<div class="space-sessions-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span>找不到「${escapeHtml(q)}」相關空間</span>
      </div>`;
      return;
    }

    spacesList.innerHTML = filtered.map(space => {
      const sessionCount = sessions.filter(s => s.spaceId === space.id).length;
      const meta = sessionCount > 0 ? `${sessionCount} 個對話` : '尚無對話';
      return `<div class="space-item" data-id="${space.id}">
        <div class="space-item-emoji">${getSpaceDisplayIcon(space, 20)}</div>
        <div class="space-item-info">
          <div class="space-item-name">${escapeHtml(space.name)}</div>
          <div class="space-item-meta">${meta}</div>
        </div>
        <div class="space-item-chevron">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>`;
    }).join('');

    spacesList.querySelectorAll('.space-item').forEach(el => {
      el.addEventListener('click', () => showSpaceDetailView(el.dataset.id));
    });
  }

  function renderSpaceSessionsList() {
    const spaceSessions = sessions
      .filter(s => String(s.spaceId) === String(currentSpaceId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const addBtn = `<div class="space-add-session-row">
      <button id="spaceAddExistingBtn" class="btn-add-existing-session">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        加入現有對話
      </button>
    </div>`;

    if (spaceSessions.length === 0) {
      spaceSessionsList.innerHTML = `<div class="space-sessions-empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>尚無對話，在下方輸入開始第一個</span>
      </div>${addBtn}`;
      document.getElementById('spaceAddExistingBtn')?.addEventListener('click', openAddSessionDrawer);
      return;
    }

    spaceSessionsList.innerHTML = spaceSessions.map(session => {
      const firstMsg = session.messages.find(m => m.role === 'user');
      const preview = session.name || (firstMsg ? firstMsg.content.substring(0, 50) : '新對話');
      return `<div class="space-session-item" data-id="${session.id}">
        <div class="space-session-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="space-session-info">
          <div class="space-session-preview">${escapeHtml(preview)}</div>
          <div class="space-session-time">${formatTime(session.timestamp)}</div>
        </div>
      </div>`;
    }).join('');

    spaceSessionsList.querySelectorAll('.space-session-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = sessions.findIndex(s => String(s.id) === el.dataset.id);
        if (idx >= 0) {
          loadSession(idx);
          closeSpacesPanel();
        }
      });
    });

    // 「加入現有對話」按鈕（有對話時也顯示）
    const addRowHtml = `<div class="space-add-session-row">
      <button id="spaceAddExistingBtn" class="btn-add-existing-session">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        加入現有對話
      </button>
    </div>`;
    spaceSessionsList.insertAdjacentHTML('beforeend', addRowHtml);
    document.getElementById('spaceAddExistingBtn')?.addEventListener('click', openAddSessionDrawer);
  }

  function openAddSessionDrawer() {
    // 列出不屬於目前空間的 sessions
    const others = sessions
      .filter(s => String(s.spaceId) !== String(currentSpaceId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (others.length === 0) {
      spaceAddSessionList.innerHTML = `<div class="space-sessions-empty"><span>沒有可加入的對話</span></div>`;
    } else {
      spaceAddSessionList.innerHTML = others.map(session => {
        const firstMsg = session.messages.find(m => m.role === 'user');
        const preview = session.name || (firstMsg ? firstMsg.content.substring(0, 50) : '新對話');
        const tag = session.spaceId
          ? `<span class="session-space-tag">${escapeHtml(spaces.find(sp => String(sp.id) === String(session.spaceId))?.name || '其他空間')}</span>`
          : '';
        return `<div class="space-session-item space-session-pick" data-id="${session.id}">
          <div class="space-session-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="space-session-info">
            <div class="space-session-preview">${escapeHtml(preview)}${tag}</div>
            <div class="space-session-time">${formatTime(session.timestamp)}</div>
          </div>
        </div>`;
      }).join('');

      spaceAddSessionList.querySelectorAll('.space-session-pick').forEach(el => {
        el.addEventListener('click', async () => {
          const s = sessions.find(s => String(s.id) === el.dataset.id);
          if (!s) return;
          s.spaceId = currentSpaceId;
          await chrome.runtime.sendMessage({ type: 'SAVE_SESSION', data: { session: s } });
          closeAddSessionDrawer();
          renderSpaceSessionsList();
        });
      });
    }

    spaceAddSessionDrawer.classList.remove('hidden');
    requestAnimationFrame(() => spaceAddSessionDrawer.classList.add('visible'));
  }

  function closeAddSessionDrawer() {
    spaceAddSessionDrawer.classList.remove('visible');
    setTimeout(() => spaceAddSessionDrawer.classList.add('hidden'), 230);
  }

  function openSettingsDrawer(spaceId) {
    editingSpaceId = spaceId;
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    settingsDrawerIcon = space.icon || 'folder';
    spaceIconBtn.innerHTML = getSpaceIconSvg(settingsDrawerIcon, 18);
    spaceNameInput.value = space.name || '';
    spaceInstructionsInput.value = space.instructions || '';
    renderSettingsLinks(space.links || []);
    renderIconPicker(spaceIconPicker, settingsDrawerIcon, (iconId) => {
      settingsDrawerIcon = iconId;
      spaceIconBtn.innerHTML = getSpaceIconSvg(iconId, 18);
      spaceIconPicker.classList.add('hidden');
    });

    spaceSettingsDrawer.classList.remove('hidden');
    requestAnimationFrame(() => spaceSettingsDrawer.classList.add('visible'));
  }

  function closeSettingsDrawer() {
    spaceSettingsDrawer.classList.remove('visible');
    spaceIconPicker.classList.add('hidden');
    setTimeout(() => spaceSettingsDrawer.classList.add('hidden'), 230);
  }

  function renderSettingsLinks(links) {
    if (!links.length) { spaceLinksList.innerHTML = ''; return; }
    spaceLinksList.innerHTML = links.map((link, i) => {
      const host = (() => { try { return new URL(link.url).hostname; } catch { return ''; } })();
      return `<div class="space-link-item" data-idx="${i}">
        <img class="space-link-favicon" src="https://www.google.com/s2/favicons?domain=${host}&sz=16" alt="" onerror="this.classList.add('fallback')">
        <span class="space-link-url" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</span>
        <button class="space-link-delete" data-idx="${i}" title="移除">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');

    spaceLinksList.querySelectorAll('.space-link-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const space = spaces.find(s => s.id === editingSpaceId);
        if (!space) return;
        space.links.splice(Number(btn.dataset.idx), 1);
        renderSettingsLinks(space.links);
      });
    });
  }

  function renderIconPicker(container, selectedId, onSelect) {
    container.innerHTML = SPACE_ICONS.map(icon =>
      `<button class="space-icon-option${icon.id === selectedId ? ' active' : ''}" data-id="${icon.id}" title="${icon.id}">
        ${getSpaceIconSvg(icon.id, 17)}
      </button>`
    ).join('');
    container.querySelectorAll('.space-icon-option').forEach(el => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.space-icon-option').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        onSelect(el.dataset.id);
      });
    });
  }

  function openCreateSpaceModal() {
    createModalIcon = 'folder';
    createSpaceIconBtn.innerHTML = getSpaceIconSvg(createModalIcon, 18);
    createSpaceNameInput.value = '';
    createSpaceIconPicker.classList.add('hidden');
    renderIconPicker(createSpaceIconPicker, createModalIcon, (iconId) => {
      createModalIcon = iconId;
      createSpaceIconBtn.innerHTML = getSpaceIconSvg(iconId, 18);
      createSpaceIconPicker.classList.add('hidden');
    });
    createSpaceModal.classList.remove('hidden');
    setTimeout(() => createSpaceNameInput.focus(), 50);
  }

  function closeCreateSpaceModal() {
    createSpaceModal.classList.add('hidden');
  }

  // ── Spaces Event Listeners ────────────────────────────────

  openSpacesBtn.addEventListener('click', async () => {
    closeAllPanels();
    await loadSpaces();
    openSpacesPanel();
  });

  spacesPanelClose.addEventListener('click', closeSpacesPanel);
  spaceDetailClose.addEventListener('click', closeSpacesPanel);

  spaceBackBtn.addEventListener('click', () => {
    closeSettingsDrawer();
    showSpacesListView();
    renderSpacesList();
  });

  spacesSearchToggleBtn.addEventListener('click', () => {
    const hidden = spacesSearchBar.classList.toggle('hidden');
    if (!hidden) spacesSearchInput.focus();
    else { spacesSearchInput.value = ''; renderSpacesList(); }
  });

  spacesSearchInput.addEventListener('input', () => {
    const q = spacesSearchInput.value;
    spacesClearSearch.classList.toggle('hidden', !q);
    renderSpacesList(q);
  });

  spacesClearSearch.addEventListener('click', () => {
    spacesSearchInput.value = '';
    spacesClearSearch.classList.add('hidden');
    renderSpacesList();
    spacesSearchInput.focus();
  });

  createSpaceBtn.addEventListener('click', openCreateSpaceModal);

  spaceSettingsBtn.addEventListener('click', () => {
    if (currentSpaceId) openSettingsDrawer(currentSpaceId);
  });

  spaceSettingsClose.addEventListener('click', closeSettingsDrawer);
  spaceAddSessionClose.addEventListener('click', closeAddSessionDrawer);

  spaceIconBtn.addEventListener('click', () => {
    spaceIconPicker.classList.toggle('hidden');
  });

  spaceAddLinkBtn.addEventListener('click', () => {
    const url = spaceLinkInput.value.trim();
    if (!url) return;
    let normalized = url;
    if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
    const space = spaces.find(s => s.id === editingSpaceId);
    if (!space) return;
    if (!Array.isArray(space.links)) space.links = [];
    space.links.push({ url: normalized });
    renderSettingsLinks(space.links);
    spaceLinkInput.value = '';
  });

  spaceLinkInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); spaceAddLinkBtn.click(); }
  });

  spaceSettingsSave.addEventListener('click', async () => {
    const space = spaces.find(s => s.id === editingSpaceId);
    if (!space) return;
    const name = spaceNameInput.value.trim();
    if (!name) { spaceNameInput.focus(); return; }
    space.name = name;
    space.icon = settingsDrawerIcon;
    space.instructions = spaceInstructionsInput.value.trim();
    space.updatedAt = new Date().toISOString();
    await saveSpaceData(space);
    spaceDetailEmoji.innerHTML = getSpaceDisplayIcon(space, 20);
    spaceDetailName.textContent = space.name;
    renderSpaceInfoBar(space);
    closeSettingsDrawer();
  });

  spaceDeleteBtn.addEventListener('click', async () => {
    const space = spaces.find(s => s.id === editingSpaceId);
    if (!space) return;
    if (!confirm(`確定要刪除「${space.name}」空間？空間內的對話將回歸一般歷史紀錄。`)) return;
    await deleteSpaceData(editingSpaceId);
    closeSettingsDrawer();
    showSpacesListView();
    renderSpacesList();
  });

  // 空間輸入框：自動高度
  spaceMessageInput.addEventListener('input', () => {
    spaceMessageInput.style.height = 'auto';
    spaceMessageInput.style.height = Math.min(spaceMessageInput.scrollHeight, 120) + 'px';
  });

  spaceMessageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      startSessionFromSpace();
    }
  });

  spaceStartSessionBtn.addEventListener('click', startSessionFromSpace);

  async function startSessionFromSpace() {
    const text = spaceMessageInput.value.trim();
    if (!text || !currentSpaceId) return;
    // 建立新 session，帶入 spaceId
    currentSession = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      messages: [],
      model: currentModel,
      spaceId: currentSpaceId
    };
    sessions.push(currentSession);
    spaceMessageInput.value = '';
    spaceMessageInput.style.height = 'auto';
    closeSpacesPanel();
    chatMessages.innerHTML = '';
    emptyState.classList.add('hidden');
    updateCurrentSessionBar();
    // 發送第一則訊息
    messageInput.value = text;
    await handleSend();
  }

  // Create Space Modal
  createSpaceIconBtn.addEventListener('click', () => {
    createSpaceIconPicker.classList.toggle('hidden');
  });

  createSpaceModalClose.addEventListener('click', closeCreateSpaceModal);
  createSpaceModalOverlay.addEventListener('click', closeCreateSpaceModal);

  createSpaceConfirmBtn.addEventListener('click', async () => {
    const name = createSpaceNameInput.value.trim();
    if (!name) { createSpaceNameInput.focus(); return; }
    const newSpace = {
      id: 'space_' + Date.now(),
      name,
      icon: createModalIcon,
      instructions: '',
      files: [],
      links: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await saveSpaceData(newSpace);
    closeCreateSpaceModal();
    showSpaceDetailView(newSpace.id);
  });

  createSpaceNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); createSpaceConfirmBtn.click(); }
  });

  await loadSpaces();
});
