import { collectSettingsBackupPayload, restoreSettingsBackupPayload } from '../sync/settings-backup.js';

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const TEST_MODEL = 'MiniMax-M2.7';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_API_URL = 'https://openrouter.ai/api/v1/models';
const DEFAULT_WORDPRESS_BASE_URL = 'https://jasonsbase.com';
const MODEL_PRICING_CACHE_KEY = 'openrouterModelPricingCache';
const MODEL_USAGE_LEDGER_KEY = 'modelUsageLedger';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Options] DOMContentLoaded fired');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleKeyBtn = document.getElementById('toggleKey');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const toggleGeminiKeyBtn = document.getElementById('toggleGeminiKey');
  const braveApiKeyInput = document.getElementById('braveApiKey');
  const toggleBraveKeyBtn = document.getElementById('toggleBraveKey');
  const exaApiKeyInput = document.getElementById('exaApiKey');
  const toggleExaKeyBtn = document.getElementById('toggleExaKey');
  const openrouterApiKeyInput = document.getElementById('openrouterApiKey');
  const toggleOpenrouterKeyBtn = document.getElementById('toggleOpenrouterKey');
  const customModelsListEl = document.getElementById('customModelsList');
  const addCustomModelBtn = document.getElementById('addCustomModelBtn');
  const testOpenrouterBtn = document.getElementById('testOpenrouterBtn');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const testGeminiBtn = document.getElementById('testGeminiBtn');
  const maxHistorySelect = document.getElementById('maxHistory');
  const planModeSelect = document.getElementById('planModeSelect');
  const saveConversationBtn = document.getElementById('saveConversationBtn');
  const usageRangeSelect = document.getElementById('usageRange');
  const refreshPricingBtn = document.getElementById('refreshPricingBtn');
  const clearUsageBtn = document.getElementById('clearUsageBtn');
  const usageSummaryEl = document.getElementById('usageSummary');
  const usageByModelBody = document.getElementById('usageByModelBody');
  const modelPricingBody = document.getElementById('modelPricingBody');
  const pricingUpdatedAtEl = document.getElementById('pricingUpdatedAt');
  const pricingSearchInput = document.getElementById('pricingSearch');
  const pricingModalityFilter = document.getElementById('pricingModalityFilter');
  const pricingOutputModalityFilter = document.getElementById('pricingOutputModalityFilter');
  const pricingUseCaseFilter = document.getElementById('pricingUseCaseFilter');
  const pricingToolFilter = document.getElementById('pricingToolFilter');
  const pricingPrevBtn = document.getElementById('pricingPrevBtn');
  const pricingNextBtn = document.getElementById('pricingNextBtn');
  const pricingPageInfo = document.getElementById('pricingPageInfo');
  const globalPromptInput = document.getElementById('globalPrompt');
  const promptChatInput = document.getElementById('promptChat');
  const promptImageAnalysisInput = document.getElementById('promptImageAnalysis');
  const promptOcrInput = document.getElementById('promptOcr');
  const savePromptsBtn = document.getElementById('savePromptsBtn');
  const customCommandsList = document.getElementById('customCommandsList');
  const addCommandBtn = document.getElementById('addCommandBtn');
  const saveCommandsBtn = document.getElementById('saveCommandsBtn');
  const autoMemoryEnabledChk = document.getElementById('autoMemoryEnabled');
  const syncProviderSelect = document.getElementById('syncProvider');
  const googleDriveClientIdInput = document.getElementById('googleDriveClientId');
  const syncAutoRestoreChk = document.getElementById('syncAutoRestoreEnabled');
  const saveSyncSettingsBtn = document.getElementById('saveSyncSettingsBtn');
  const connectGoogleDriveBtn = document.getElementById('connectGoogleDriveBtn');
  const disconnectGoogleDriveBtn = document.getElementById('disconnectGoogleDriveBtn');
  const wpBaseUrlInput = null; // 已硬編碼為 jasonsbase.com，移除輸入欄位
  const connectWordPressBtn = document.getElementById('connectWordPressBtn');
  const exportSettingsBtn = document.getElementById('exportSettingsBtn');
  const importSettingsBtn = document.getElementById('importSettingsBtn');
  const importSettingsInput = document.getElementById('importSettingsInput');
  const backupWordPressBtn = document.getElementById('backupWordPressBtn');
  const restoreWordPressBtn = document.getElementById('restoreWordPressBtn');
  const disconnectWordPressBtn = document.getElementById('disconnectWordPressBtn');
  const syncStatusText = document.getElementById('syncStatusText');
  const googleDriveStatusText = document.getElementById('googleDriveStatusText');
  const wordpressStatusText = document.getElementById('wordpressStatusText');
  const googleRedirectUriEl = document.getElementById('googleRedirectUri');

  let customCommands = [];
  let customModels = [];
  let apiToolRegistry = [];
  let editingToolId = null;
  let pricingSort = { key: 'input', direction: 'asc' };
  let pricingPage = 1;
  const PRICING_PAGE_SIZE = 50;
  let currentPage = 'sec-api';

  // ── TOC 多頁導覽 ─────────────────────────────────────────
  const tocLinks = document.querySelectorAll('.toc a[data-page]');
  const allSections = document.querySelectorAll('.section[id]');

  function switchPage(pageId) {
    if (pageId === currentPage) return;
    const currentEl = document.getElementById(currentPage);
    const nextEl = document.getElementById(pageId);
    if (!nextEl) return;

    if (currentEl) {
      currentEl.classList.add('fading-out');
      currentEl.classList.remove('active');
      setTimeout(() => {
        currentEl.classList.remove('fading-out');
        nextEl.classList.add('active');
      }, 150);
    } else {
      nextEl.classList.add('active');
    }

    currentPage = pageId;
    tocLinks.forEach(l => l.classList.toggle('active', l.dataset.page === pageId));
    if (pageId === 'sec-usage') renderUsagePage();
  }

  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage(link.dataset.page);
    });
  });

  console.log('[Options] DOM queries done, binding listeners');
  // ── Event listener 全部先綁定，不受 await 失敗影響 ────────
  bindPasswordToggle(toggleKeyBtn, apiKeyInput);
  bindPasswordToggle(toggleGeminiKeyBtn, geminiApiKeyInput);
  bindPasswordToggle(toggleBraveKeyBtn, braveApiKeyInput);
  bindPasswordToggle(toggleExaKeyBtn, exaApiKeyInput);
  bindPasswordToggle(toggleOpenrouterKeyBtn, openrouterApiKeyInput);

  addCustomModelBtn?.addEventListener('click', () => {
    customModels.push({ id: `model_${Date.now()}`, label: '', modelId: '' });
    renderCustomModels();
  });

  console.log('[Options] saveBtn element:', saveBtn);
  saveBtn?.addEventListener('click', async () => {
    console.log('[Options] saveBtn clicked');
    customModels = collectCustomModelsFromDom();
    try {
      await chrome.storage.sync.set({
        apiKey: apiKeyInput.value.trim(),
        geminiApiKey: geminiApiKeyInput.value.trim(),
        braveApiKey: braveApiKeyInput.value.trim(),
        exaApiKey: exaApiKeyInput.value.trim(),
        openrouterApiKey: openrouterApiKeyInput.value.trim(),
        customModels
      });
      await chrome.storage.sync.remove(['openrouterModel', 'hiddenPresetModelIds']);
      showMessage('Agent 設定已儲存', 'success');
    } catch (err) {
      showMessage(`儲存失敗：${err.message}`, 'error');
    }
  });

  saveConversationBtn?.addEventListener('click', async () => {
    await chrome.storage.sync.set({
      settings: {
        maxHistory: parseInt(maxHistorySelect.value, 10),
        planMode: planModeSelect.value
      }
    });
    showMessage('對話設定已儲存', 'success');
  });

  usageRangeSelect?.addEventListener('change', renderUsagePage);
  refreshPricingBtn?.addEventListener('click', async () => {
    refreshPricingBtn.disabled = true;
    refreshPricingBtn.textContent = '更新中...';
    try {
      await refreshOpenRouterPricing(true);
      await renderUsagePage();
      showMessage('OpenRouter 費用表已更新', 'success');
    } catch (err) {
      showMessage(`費用表更新失敗：${err.message}`, 'error');
    } finally {
      refreshPricingBtn.disabled = false;
      refreshPricingBtn.textContent = '重新整理價格';
    }
  });
  clearUsageBtn?.addEventListener('click', async () => {
    if (!confirm('確定清除所有 OpenRouter 使用紀錄？')) return;
    await chrome.storage.local.set({ [MODEL_USAGE_LEDGER_KEY]: [] });
    await renderUsagePage();
    showMessage('使用量紀錄已清除', 'success');
  });

  document.querySelectorAll('[data-pricing-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pricingSort;
      pricingSort = {
        key,
        direction: pricingSort.key === key && pricingSort.direction === 'asc' ? 'desc' : 'asc'
      };
      renderUsagePage();
    });
  });
  pricingSearchInput?.addEventListener('input', () => {
    pricingPage = 1;
    renderUsagePage();
  });
  pricingModalityFilter?.addEventListener('change', () => {
    pricingPage = 1;
    renderUsagePage();
  });
  pricingOutputModalityFilter?.addEventListener('change', () => {
    pricingPage = 1;
    renderUsagePage();
  });
  pricingUseCaseFilter?.addEventListener('change', () => {
    pricingPage = 1;
    renderUsagePage();
  });
  pricingToolFilter?.addEventListener('change', () => {
    pricingPage = 1;
    renderUsagePage();
  });
  pricingPrevBtn?.addEventListener('click', () => {
    if (pricingPage <= 1) return;
    pricingPage -= 1;
    renderUsagePage();
  });
  pricingNextBtn?.addEventListener('click', () => {
    pricingPage += 1;
    renderUsagePage();
  });
  modelPricingBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-model-action]');
    if (!btn) return;
    const modelId = btn.dataset.modelId;
    if (!modelId) return;
    const { [MODEL_PRICING_CACHE_KEY]: priceCache } = await chrome.storage.local.get([MODEL_PRICING_CACHE_KEY]);
    const modelInfo = priceCache?.models?.[modelId];
    customModels = collectCustomModelsFromDom();
    if (btn.dataset.modelAction === 'enable') {
      if (!customModels.some(m => m.modelId === modelId)) {
        customModels.push({
          id: `model_${Date.now()}`,
          label: modelInfo?.name || modelId,
          modelId
        });
      }
    } else if (btn.dataset.modelAction === 'remove') {
      customModels = customModels.filter(m => m.modelId !== modelId);
    }
    await chrome.storage.sync.set({ customModels });
    await chrome.storage.sync.remove(['openrouterModel', 'hiddenPresetModelIds']);
    renderCustomModels();
    await renderUsagePage();
  });

  savePromptsBtn?.addEventListener('click', async () => {
    await chrome.storage.sync.set({
      globalPrompt: globalPromptInput.value.trim(),
      defaultPrompts: {
        chat: promptChatInput.value.trim(),
        imageAnalysis: promptImageAnalysisInput.value.trim(),
        ocr: promptOcrInput.value.trim()
      }
    });
    showMessage('提示詞已儲存', 'success');
  });

  addCommandBtn?.addEventListener('click', () => {
    customCommands.push({
      id: `cmd_${Date.now()}`,
      trigger: '/cmd',
      name: '指令說明',
      type: 'template',
      template: '{input}'
    });
    renderCustomCommands();
  });

  saveCommandsBtn?.addEventListener('click', async () => {
    customCommands = collectCommandsFromDom(customCommandsList);
    try {
      await chrome.storage.local.set({ customCommands });
      showMessage('自訂指令已儲存', 'success');
    } catch (err) {
      showMessage('儲存失敗：內容超出儲存限制，請縮短模板內容', 'error');
    }
  });

  testBtn?.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showMessage('請先輸入 MiniMax API Key', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = '測試中...';
    try {
      const response = await fetch(MINIMAX_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: TEST_MODEL,
          max_tokens: 64,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (response.ok) {
        showMessage('MiniMax 連線成功', 'success');
      } else {
        const error = await response.json().catch(() => ({}));
        showMessage(`MiniMax 測試失敗：${error.error?.message || error.message || response.status}`, 'error');
      }
    } catch (error) {
      showMessage(`MiniMax 測試失敗：${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '測試 MiniMax 連線';
    }
  });

  testGeminiBtn?.addEventListener('click', async () => {
    const geminiApiKey = geminiApiKeyInput.value.trim();
    if (!geminiApiKey) {
      showMessage('請先輸入 Gemini API Key', 'error');
      return;
    }

    testGeminiBtn.disabled = true;
    testGeminiBtn.textContent = '測試中...';
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }]
        })
      });

      if (response.ok) {
        showMessage('Gemini 連線成功', 'success');
      } else {
        const error = await response.json().catch(() => ({}));
        showMessage(`Gemini 測試失敗：${error.error?.message || response.status}`, 'error');
      }
    } catch (error) {
      showMessage(`Gemini 測試失敗：${error.message}`, 'error');
    } finally {
      testGeminiBtn.disabled = false;
      testGeminiBtn.textContent = '測試 Gemini 連線';
    }
  });

  testOpenrouterBtn?.addEventListener('click', async () => {
    const key = openrouterApiKeyInput.value.trim();
    if (!key) {
      showMessage('請先輸入 OpenRouter API Key', 'error');
      return;
    }
    const liveModels = collectCustomModelsFromDom();
    const rawModel = liveModels[0]?.modelId?.trim() || '';
    if (!rawModel) {
      showMessage('請先在自訂模型清單中新增至少一個模型', 'error');
      return;
    }

    testOpenrouterBtn.disabled = true;
    testOpenrouterBtn.textContent = '測試中...';
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Open Chat Hub'
        },
        body: JSON.stringify({
          model: rawModel,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const modelUsed = data.model || rawModel;
        showMessage(`OpenRouter 連線成功（${modelUsed}）`, 'success');
      } else {
        const error = await response.json().catch(() => ({}));
        showMessage(`OpenRouter 測試失敗：${error.error?.message || response.status}`, 'error');
      }
    } catch (error) {
      showMessage(`OpenRouter 測試失敗：${error.message}`, 'error');
    } finally {
      testOpenrouterBtn.disabled = false;
      testOpenrouterBtn.textContent = '測試 OpenRouter 連線';
    }
  });

  async function loadSettings() {
    const { apiKey, geminiApiKey, braveApiKey, exaApiKey, settings, openrouterApiKey } =
      await chrome.storage.sync.get([
        'apiKey', 'geminiApiKey', 'braveApiKey', 'exaApiKey', 'settings', 'openrouterApiKey'
      ]);

    apiKeyInput.value = apiKey || '';
    geminiApiKeyInput.value = geminiApiKey || '';
    braveApiKeyInput.value = braveApiKey || '';
    exaApiKeyInput.value = exaApiKey || '';
    maxHistorySelect.value = String(settings?.maxHistory || 50);
    planModeSelect.value = settings?.planMode || 'auto';
    openrouterApiKeyInput.value = openrouterApiKey || '';
  }

  async function loadCustomModels() {
    const { customModels: stored, openrouterModel } =
      await chrome.storage.sync.get(['customModels', 'openrouterModel']);

    if (Array.isArray(stored)) {
      customModels = stored;
    } else if (openrouterModel) {
      // 遷移：舊的單一 openrouterModel 轉成清單
      customModels = [{ id: `model_${Date.now()}`, label: openrouterModel.split('/').pop(), modelId: openrouterModel }];
    } else {
      customModels = [];
    }
    renderCustomModels();
  }

  function renderCustomModels() {
    customModelsListEl.innerHTML = '';
    customModels.forEach((m, idx) => {
      const item = document.createElement('div');
      item.className = 'custom-model-item';
      item.dataset.id = m.id;
      item.innerHTML = `
        <input type="text" class="custom-model-label mode-name" value="${escapeVal(m.label)}" placeholder="顯示名稱（如 Claude 3.5）">
        <input type="text" class="custom-model-id mode-name" value="${escapeVal(m.modelId)}" placeholder="模型 ID（anthropic/claude-3.5-sonnet）">
        <button class="btn-mode-delete" data-index="${idx}" type="button" title="刪除">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      `;
      item.querySelector('.btn-mode-delete').addEventListener('click', () => {
        customModels.splice(idx, 1);
        renderCustomModels();
      });
      customModelsListEl.appendChild(item);
    });
  }

  function collectCustomModelsFromDom() {
    return Array.from(customModelsListEl.querySelectorAll('.custom-model-item')).map(item => ({
      id: item.dataset.id || `model_${Date.now()}`,
      label: item.querySelector('.custom-model-label').value.trim(),
      modelId: item.querySelector('.custom-model-id').value.trim()
    })).filter(m => m.modelId);
  }

  function usd(value, digits = 4) {
    if (value === null || value === undefined || Number.isNaN(Number(value)) || Number(value) < 0) return '未知';
    return `$${Number(value).toFixed(digits)}`;
  }

  function compactInt(value) {
    return Number(value || 0).toLocaleString();
  }

  function pricePerMillion(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : null;
  }

  function formatPricePerMillion(value) {
    if (value === null) return '未知';
    if (value === 0) return 'Free';
    if (value < 0.01) return `$${value.toFixed(4)}`;
    if (value < 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(value >= 10 ? 0 : 2)}`;
  }

  function pricingValue(model, key) {
    if (key === 'enabled') {
      const enabledModelIds = new Set((Array.isArray(customModels) ? customModels : []).map(m => m.modelId));
      return enabledModelIds.has(model?.id) ? 1 : 0;
    }
    const pricing = model?.pricing || {};
    if (key === 'input') return pricePerMillion(pricing.prompt);
    if (key === 'output') return pricePerMillion(pricing.completion);
    if (key === 'request') {
      const request = Number(pricing.request);
      return Number.isFinite(request) && request >= 0 ? request : null;
    }
    return null;
  }

  function getInputModalities(model) {
    const values = model?.inputModalities
      || model?.architecture?.input_modalities
      || model?.architecture?.modality
      || model?.input_modalities
      || [];
    const list = Array.isArray(values) ? values : String(values || '').split('->')[0].split('+');
    return list.map(v => String(v).trim().toLowerCase()).filter(Boolean);
  }

  function getOutputModalities(model) {
    const values = model?.outputModalities
      || model?.architecture?.output_modalities
      || model?.output_modalities
      || (typeof model?.architecture?.modality === 'string' && model.architecture.modality.includes('->')
        ? model.architecture.modality.split('->')[1]
        : []);
    const list = Array.isArray(values) ? values : String(values || '').split('+');
    return list.map(v => String(v).trim().toLowerCase()).filter(Boolean);
  }

  function formatModalityLabel(modality) {
    const labels = { text: 'Text', image: 'Image', file: 'File', audio: 'Audio', video: 'Video', embeddings: 'Embeddings' };
    return labels[modality] || modality;
  }

  function updateOutputModalityFilter(models) {
    if (!pricingOutputModalityFilter) return;
    const current = pricingOutputModalityFilter.value || 'all';
    const order = ['text', 'image', 'audio', 'video', 'embeddings'];
    const found = new Set();
    Object.values(models || {}).forEach(model => {
      getOutputModalities(model).forEach(modality => found.add(modality));
    });
    const sorted = Array.from(found).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.localeCompare(b);
    });
    pricingOutputModalityFilter.innerHTML = [
      '<option value="all">全部輸出類型</option>',
      ...sorted.map(modality => `<option value="${escapeVal(modality)}">${escapeVal(formatModalityLabel(modality))}</option>`)
    ].join('');
    pricingOutputModalityFilter.value = found.has(current) ? current : 'all';
  }

  function renderModalityBadges(model) {
    const inputModalities = getInputModalities(model);
    const outputModalities = getOutputModalities(model);
    if (inputModalities.length === 0 && outputModalities.length === 0) return '';
    const renderRow = (label, modalities, className) => modalities.length > 0
      ? `<div class="modality-row ${className}"><span class="modality-label">${label}</span>${modalities.map(m => `<span>${escapeVal(formatModalityLabel(m))}</span>`).join('')}</div>`
      : '';
    return `<div class="modality-badges">${renderRow('Input', inputModalities, 'modality-input')}${renderRow('Output', outputModalities, 'modality-output')}</div>`;
  }

  function supportsToolUse(model) {
    return Array.isArray(model?.supportedParameters) && model.supportedParameters.includes('tools');
  }

  function getModelUseCases(model) {
    const cases = new Set();
    const inputModalities = getInputModalities(model);
    const outputModalities = getOutputModalities(model);
    const inputCost = pricePerMillion(model?.pricing?.prompt);
    const outputCost = pricePerMillion(model?.pricing?.completion);
    const contextLength = Number(model?.contextLength || 0);
    const idText = `${model?.id || ''} ${model?.name || ''}`.toLowerCase();
    const isCodeModel = /\b(code|coder|coding|devstral|codestral|qwen.*coder|deepseek.*coder|kimi.*dev|gpt-oss)\b/i.test(idText);
    const isReasoningModel = /\b(reasoning|thinking|r1|o[34]|gpt-5|grok-4|deepseek-r1|qwq|math)\b/i.test(idText);

    if (contextLength >= 128000) cases.add('long-context');
    if (supportsToolUse(model) && outputModalities.includes('text')) cases.add('analysis-tools');
    if (isReasoningModel && outputModalities.includes('text')) cases.add('reasoning');
    if (isCodeModel && outputModalities.includes('text')) cases.add('coding');
    if ((isCodeModel || supportsToolUse(model)) && outputModalities.includes('text')) cases.add('debug');
    if (contextLength >= 128000 && (isCodeModel || outputModalities.includes('text'))) cases.add('long-code');
    if ((inputModalities.includes('image') || inputModalities.includes('file')) && outputModalities.includes('text')) cases.add('vision');
    if (outputModalities.includes('image')) cases.add('image-gen');
    if (outputModalities.includes('audio') || inputModalities.includes('audio')) cases.add('audio');
    if (inputCost === 0 && outputCost === 0) cases.add('free');
    if (inputCost !== null && outputCost !== null && inputCost <= 0.5 && outputCost <= 2) cases.add('low-cost');
    if (/\b(gpt-5|claude|opus|sonnet|gemini-3|gemini-2\.5-pro|grok-4|o[34]|deepseek-r1)\b/i.test(idText)) {
      cases.add('premium');
    }
    return Array.from(cases);
  }

  function renderRecommendationBadges(model) {
    const labels = {
      'long-context': '長文本',
      'analysis-tools': '工具/資料',
      reasoning: '推理',
      coding: 'Coding',
      debug: 'Debug',
      'long-code': '長程式碼',
      vision: '圖片/PDF',
      'image-gen': '生圖',
      audio: '語音',
      'low-cost': '低成本',
      free: '免費',
      premium: '高品質'
    };
    const cases = getModelUseCases(model);
    if (cases.length === 0) return '';
    return `<div class="recommendation-badges"><span class="rec-label">適合</span>${cases.map(id => `<span class="rec-${escapeVal(id)}">${escapeVal(labels[id] || id)}</span>`).join('')}</div>`;
  }

  function renderCapabilityBadges(model) {
    const toolSupported = supportsToolUse(model);
    const className = toolSupported ? 'tool-supported' : 'tool-unsupported';
    const label = toolSupported ? 'Tool Use' : 'No Tool Use';
    return `<div class="capability-badges"><span class="${className}">${label}</span></div>`;
  }

  function updatePricingSortHeaders() {
    document.querySelectorAll('[data-pricing-sort]').forEach(btn => {
      const active = btn.dataset.pricingSort === pricingSort.key;
      btn.classList.toggle('active', active);
      const base = btn.textContent.replace(/\s*[↑↓]$/, '');
      btn.textContent = active ? `${base} ${pricingSort.direction === 'asc' ? '↑' : '↓'}` : base;
    });
  }

  function filterUsageByRange(entries) {
    const range = usageRangeSelect?.value || '7';
    if (range === 'all') return entries;
    const days = Number(range);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter(entry => Date.parse(entry.timestamp || 0) >= since);
  }

  async function refreshOpenRouterPricing(force = false) {
    const now = Date.now();
    const { [MODEL_PRICING_CACHE_KEY]: cache } = await chrome.storage.local.get([MODEL_PRICING_CACHE_KEY]);
    if (!force && cache?.models && now - (cache.updatedAt || 0) < 24 * 60 * 60 * 1000) return cache;

    const key = openrouterApiKeyInput.value.trim();
    const headers = key ? { Authorization: `Bearer ${key}` } : {};
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
    const next = { updatedAt: now, models };
    await chrome.storage.local.set({ [MODEL_PRICING_CACHE_KEY]: next });
    return next;
  }

  async function renderUsagePage() {
    if (!usageSummaryEl || !usageByModelBody || !modelPricingBody) return;
    const { [MODEL_USAGE_LEDGER_KEY]: ledger = [], [MODEL_PRICING_CACHE_KEY]: priceCache } =
      await chrome.storage.local.get([MODEL_USAGE_LEDGER_KEY, MODEL_PRICING_CACHE_KEY]);
    const entries = filterUsageByRange(Array.isArray(ledger) ? ledger : []);

    const total = entries.reduce((acc, entry) => {
      acc.requests += 1;
      acc.promptTokens += Number(entry.promptTokens || 0);
      acc.completionTokens += Number(entry.completionTokens || 0);
      acc.totalTokens += Number(entry.totalTokens || 0);
      if (entry.totalCostUsd !== null && entry.totalCostUsd !== undefined) {
        acc.cost += Number(entry.totalCostUsd || 0);
        acc.costKnown += 1;
      }
      return acc;
    }, { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, costKnown: 0 });

    usageSummaryEl.innerHTML = `
      <div><span>請求</span><strong>${compactInt(total.requests)}</strong></div>
      <div><span>Input tokens</span><strong>${compactInt(total.promptTokens)}</strong></div>
      <div><span>Output tokens</span><strong>${compactInt(total.completionTokens)}</strong></div>
      <div><span>估算費用</span><strong>${total.costKnown ? usd(total.cost) : '未知'}</strong></div>
    `;

    const byModel = new Map();
    for (const entry of entries) {
      const row = byModel.get(entry.modelId) || {
        modelId: entry.modelId,
        modelName: entry.modelName || entry.modelId,
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
        costKnown: 0
      };
      row.requests += 1;
      row.promptTokens += Number(entry.promptTokens || 0);
      row.completionTokens += Number(entry.completionTokens || 0);
      if (entry.totalCostUsd !== null && entry.totalCostUsd !== undefined) {
        row.cost += Number(entry.totalCostUsd || 0);
        row.costKnown += 1;
      }
      byModel.set(entry.modelId, row);
    }

    usageByModelBody.innerHTML = Array.from(byModel.values())
      .sort((a, b) => b.cost - a.cost)
      .map(row => `
        <tr>
          <td><strong>${escapeVal(row.modelName)}</strong><br><span>${escapeVal(row.modelId)}</span></td>
          <td>${compactInt(row.requests)}</td>
          <td>${compactInt(row.promptTokens)}</td>
          <td>${compactInt(row.completionTokens)}</td>
          <td>${row.costKnown ? usd(row.cost) : '未知'}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="empty-cell">尚無 OpenRouter 使用紀錄</td></tr>';

    const models = priceCache?.models || {};
    updateOutputModalityFilter(models);
    const enabledModelIds = new Set((Array.isArray(customModels) ? customModels : []).map(m => m.modelId));
    const query = (pricingSearchInput?.value || '').trim().toLowerCase();
    const modalityFilter = pricingModalityFilter?.value || 'all';
    const outputModalityFilter = pricingOutputModalityFilter?.value || 'all';
    const useCaseFilter = pricingUseCaseFilter?.value || 'all';
    const toolFilter = pricingToolFilter?.value || 'all';
    const allRows = Object.values(models)
      .filter(model => model?.pricing)
      .filter(model => {
        if (!query) return true;
        return String(model.name || '').toLowerCase().includes(query) || String(model.id || '').toLowerCase().includes(query);
      })
      .filter(model => modalityFilter === 'all' || getInputModalities(model).includes(modalityFilter))
      .filter(model => outputModalityFilter === 'all' || getOutputModalities(model).includes(outputModalityFilter))
      .filter(model => useCaseFilter === 'all' || getModelUseCases(model).includes(useCaseFilter))
      .filter(model => {
        if (toolFilter === 'all') return true;
        const supported = supportsToolUse(model);
        return toolFilter === 'supported' ? supported : !supported;
      })
      .sort((a, b) => {
        const av = pricingValue(a, pricingSort.key);
        const bv = pricingValue(b, pricingSort.key);
        if (av === null && bv === null) return String(a.name || a.id).localeCompare(String(b.name || b.id));
        if (av === null) return 1;
        if (bv === null) return -1;
        const diff = av - bv;
        return pricingSort.direction === 'asc' ? diff : -diff;
      });
    const totalPages = Math.max(1, Math.ceil(allRows.length / PRICING_PAGE_SIZE));
    pricingPage = Math.min(Math.max(1, pricingPage), totalPages);
    const rows = allRows.slice((pricingPage - 1) * PRICING_PAGE_SIZE, pricingPage * PRICING_PAGE_SIZE);
    modelPricingBody.innerHTML = rows.map(model => {
      const pricing = model.pricing || {};
      const enabled = enabledModelIds.has(model.id);
      return `
        <tr>
          <td><strong>${escapeVal(model.name || model.id)}</strong><br><span>${escapeVal(model.id)}</span>${renderModalityBadges(model)}${renderRecommendationBadges(model)}${renderCapabilityBadges(model)}</td>
          <td>${formatPricePerMillion(pricePerMillion(pricing.prompt))}</td>
          <td>${formatPricePerMillion(pricePerMillion(pricing.completion))}</td>
          <td>${usd(Number(pricing.request || 0), 6)}</td>
          <td><button class="btn-secondary btn-model-toggle ${enabled ? 'danger' : ''}" type="button" data-model-action="${enabled ? 'remove' : 'enable'}" data-model-id="${escapeVal(model.id)}">${enabled ? '移除' : '啟用'}</button></td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="5" class="empty-cell">沒有符合條件的模型，或尚未載入費用表</td></tr>';

    if (pricingPageInfo) pricingPageInfo.textContent = `第 ${pricingPage} / ${totalPages} 頁，共 ${allRows.length.toLocaleString()} 個模型`;
    if (pricingPrevBtn) pricingPrevBtn.disabled = pricingPage <= 1;
    if (pricingNextBtn) pricingNextBtn.disabled = pricingPage >= totalPages;

    pricingUpdatedAtEl.textContent = priceCache?.updatedAt
      ? `最後更新：${new Date(priceCache.updatedAt).toLocaleString()}`
      : '尚未載入 OpenRouter 費用表。';
    updatePricingSortHeaders();
  }

  async function loadPrompts() {
    const { globalPrompt, defaultPrompts } = await chrome.storage.sync.get(['globalPrompt', 'defaultPrompts']);
    globalPromptInput.value = globalPrompt || '';
    promptChatInput.value = defaultPrompts?.chat || '';
    promptImageAnalysisInput.value = defaultPrompts?.imageAnalysis || '';
    promptOcrInput.value = defaultPrompts?.ocr || '';
  }

  async function loadCustomCommands() {
    const { customCommands: localStored } = await chrome.storage.local.get(['customCommands']);
    if (Array.isArray(localStored) && localStored.length > 0) {
      customCommands = localStored;
    } else {
      // 遷移：從 sync 救回舊資料
      const { customCommands: syncStored } = await chrome.storage.sync.get(['customCommands']);
      if (Array.isArray(syncStored) && syncStored.length > 0) {
        customCommands = syncStored;
        await chrome.storage.local.set({ customCommands: syncStored });
        await chrome.storage.sync.remove(['customCommands']);
      } else {
        customCommands = [];
      }
    }
    renderCustomCommands();
  }

  async function loadMemorySection() {
    const { autoMemoryEnabled } = await chrome.storage.sync.get(['autoMemoryEnabled']);
    autoMemoryEnabledChk.checked = !!autoMemoryEnabled;
  }

  autoMemoryEnabledChk?.addEventListener('change', async () => {
    await chrome.storage.sync.set({ autoMemoryEnabled: autoMemoryEnabledChk.checked });
  });

  async function loadSyncSection() {
    console.log('[Options] loadSyncSection start, googleRedirectUriEl:', googleRedirectUriEl);
    try {
      googleRedirectUriEl.textContent = chrome.identity.getRedirectURL('google-drive-sync');
    } catch(e) { console.error('[Options] getRedirectURL error:', e); }

    const settingsResp = await sendRuntimeMessage({ type: 'GET_SYNC_SETTINGS' });
    if (settingsResp.success && settingsResp.data) {
      const settings = settingsResp.data;
      syncProviderSelect.value = settings.provider || 'none';
      googleDriveClientIdInput.value = settings.googleDriveClientId || '';
      if (wpBaseUrlInput) wpBaseUrlInput.value = settings.wpBaseUrl || DEFAULT_WORDPRESS_BASE_URL;
      syncAutoRestoreChk.checked = !!settings.autoSync;
    }

    await refreshSyncStatus();
  }

  exportSettingsBtn?.addEventListener('click', async () => {
    try {
      const payload = await collectSettingsBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `minimax-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('設定已匯出為 JSON 檔', 'success');
    } catch (err) {
      showMessage(`匯出失敗：${err.message}`, 'error');
    }
  });

  importSettingsBtn?.addEventListener('click', () => importSettingsInput?.click());

  importSettingsInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importSettingsInput.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const payload = JSON.parse(evt.target.result);
        await restoreSettingsBackupPayload(payload);
        showMessage('設定已從本機 JSON 還原', 'success');
        await loadSettings();
        await loadPrompts();
        await loadCustomCommands();
        await loadCustomModels();
        await loadMemorySection();
        await renderUsagePage();
      } catch (err) {
        showMessage(`還原失敗：${err.message}`, 'error');
      }
    };
    reader.onerror = () => showMessage('檔案讀取失敗', 'error');
    reader.readAsText(file, 'utf-8');
  });

  saveSyncSettingsBtn?.addEventListener('click', async () => {
    const resp = await sendRuntimeMessage({
      type: 'SAVE_SYNC_SETTINGS',
      data: buildSyncSettingsPayload()
    });

    if (!resp.success) {
      showMessage(`儲存同步設定失敗：${resp.error || '未知錯誤'}`, 'error');
      return;
    }

    showMessage('同步設定已儲存', 'success');
    await refreshSyncStatus();
  });

  connectGoogleDriveBtn?.addEventListener('click', async () => {
    if (!googleDriveClientIdInput.value.trim()) {
      showMessage('請先輸入 Google OAuth Client ID', 'error');
      return;
    }

    connectGoogleDriveBtn.disabled = true;
    connectGoogleDriveBtn.textContent = '授權中...';
    try {
      const saveResp = await sendRuntimeMessage({
        type: 'SAVE_SYNC_SETTINGS',
        data: {
          ...buildSyncSettingsPayload(),
          provider: 'googleDrive'
        }
      });
      if (!saveResp.success) {
        showMessage(`儲存同步設定失敗：${saveResp.error || '未知錯誤'}`, 'error');
        return;
      }

      const resp = await sendRuntimeMessage({ type: 'GOOGLE_DRIVE_CONNECT' });
      if (!resp.success) {
        showMessage(`Google Drive 授權失敗：${resp.error || '未知錯誤'}`, 'error');
        return;
      }

      showMessage('Google Drive 連線成功', 'success');
      syncProviderSelect.value = 'googleDrive';
      await refreshSyncStatus();
    } finally {
      connectGoogleDriveBtn.disabled = false;
      connectGoogleDriveBtn.textContent = '連線 Google Drive';
    }
  });

  disconnectGoogleDriveBtn?.addEventListener('click', async () => {
    disconnectGoogleDriveBtn.disabled = true;
    disconnectGoogleDriveBtn.textContent = '中斷中...';
    try {
      const resp = await sendRuntimeMessage({ type: 'GOOGLE_DRIVE_DISCONNECT' });
      if (!resp.success) {
        showMessage(`中斷 Google Drive 失敗：${resp.error || '未知錯誤'}`, 'error');
        return;
      }

      showMessage('Google Drive 已中斷連線', 'success');
      await refreshSyncStatus();
    } finally {
      disconnectGoogleDriveBtn.disabled = false;
      disconnectGoogleDriveBtn.textContent = '中斷連線';
    }
  });

  connectWordPressBtn?.addEventListener('click', async () => {
    connectWordPressBtn.disabled = true;
    connectWordPressBtn.textContent = '登入中...';
    try {
      const saveResp = await sendRuntimeMessage({
        type: 'SAVE_SYNC_SETTINGS',
        data: {
          ...buildSyncSettingsPayload(),
          provider: 'wordpress'
        }
      });
      if (!saveResp.success) {
        showMessage(`儲存同步設定失敗：${saveResp.error || '未知錯誤'}`, 'error');
        return;
      }

      const resp = await sendRuntimeMessage({ type: 'WORDPRESS_CONNECT' });
      if (!resp.success) {
        showMessage(`WordPress 登入失敗：${resp.error || '未知錯誤'}`, 'error');
        return;
      }

      showMessage('WordPress 授權成功', 'success');
      syncProviderSelect.value = 'wordpress';
      await refreshSyncStatus();
    } finally {
      connectWordPressBtn.disabled = false;
      connectWordPressBtn.textContent = '使用 WordPress 登入';
    }
  });

  backupWordPressBtn?.addEventListener('click', async () => {
    backupWordPressBtn.disabled = true;
    backupWordPressBtn.textContent = '備份中...';
    try {
      const resp = await sendRuntimeMessage({ type: 'WORDPRESS_BACKUP_SETTINGS' });
      if (!resp.success) {
        showMessage(`WordPress 備份失敗：${resp.error || '未知錯誤'}`, 'error');
        return;
      }

      showMessage('設定已備份到 WordPress', 'success');
      await refreshSyncStatus();
    } finally {
      backupWordPressBtn.disabled = false;
      backupWordPressBtn.textContent = '立即備份設定';
    }
  });

  restoreWordPressBtn?.addEventListener('click', async () => {
    const confirmed = window.confirm('從 WordPress 還原會以雲端設定覆蓋目前本地設定，確定要繼續嗎？');
    if (!confirmed) return;

    restoreWordPressBtn.disabled = true;
    restoreWordPressBtn.textContent = '還原中...';
    try {
      const resp = await sendRuntimeMessage({ type: 'WORDPRESS_RESTORE_SETTINGS' });
      if (!resp.success) {
        showMessage(`WordPress 還原失敗：${resp.error || '未知錯誤'}`, 'error');
        return;
      }

      showMessage('已從 WordPress 還原設定', 'success');
      await loadSettings();
      await loadPrompts();
      await loadCustomCommands();
      await loadMemorySection();
      await loadSyncSection();
    } finally {
      restoreWordPressBtn.disabled = false;
      restoreWordPressBtn.textContent = '從雲端還原';
    }
  });

  disconnectWordPressBtn?.addEventListener('click', async () => {
    disconnectWordPressBtn.disabled = true;
    disconnectWordPressBtn.textContent = '登出中...';
    try {
      const resp = await sendRuntimeMessage({ type: 'WORDPRESS_DISCONNECT' });
      if (!resp.success) {
        showMessage(`登出 WordPress 失敗：${resp.error || '未知錯誤'}`, 'error');
        return;
      }

      showMessage('WordPress 已登出', 'success');
      await refreshSyncStatus();
    } finally {
      disconnectWordPressBtn.disabled = false;
      disconnectWordPressBtn.textContent = '登出 WordPress';
    }
  });

  async function refreshSyncStatus() {
    const resp = await sendRuntimeMessage({ type: 'GET_SYNC_STATUS' });
    if (!resp.success || !resp.data) {
      syncStatusText.textContent = `同步狀態讀取失敗：${resp.error || '未知錯誤'}`;
      return;
    }

    const status = resp.data;
    const googleDrive = status.googleDrive || { connected: false };
    const wordpress = status.wordpress || { connected: false };
    const wordpressAuthorized = !!(wordpress.authorized || wordpress.connected);
    const wordpressDisplayName = wordpress.account?.email || wordpress.account?.displayName || wordpress.account?.username || '已授權';

    googleDriveStatusText.textContent = googleDrive.connected
      ? `Google Drive：已連線（${googleDrive.account?.email || googleDrive.account?.name || '已授權'}）`
      : 'Google Drive：未連線';

    if (wordpress.connected) {
      wordpressStatusText.textContent = `WordPress：已登入（${wordpressDisplayName}，最近備份：${wordpress.lastBackupAt ? new Date(wordpress.lastBackupAt).toLocaleString() : '尚未備份'}）`;
    } else if (wordpressAuthorized) {
      wordpressStatusText.textContent = `WordPress：已授權（${wordpressDisplayName}，狀態檢查失敗：${wordpress.reason || '未知錯誤'}）`;
    } else {
      wordpressStatusText.textContent = `WordPress：未登入${wordpress.baseUrl ? `（${wordpress.baseUrl}）` : ''}`;
    }

    syncStatusText.textContent = `目前供應商：${status.provider || 'none'}｜Google Drive：${googleDrive.connected ? '已連線' : '未連線'}｜WordPress：${wordpressAuthorized ? (wordpress.connected ? '已登入' : '已授權（狀態檢查失敗）') : '未登入'}`;

    connectWordPressBtn.style.display = wordpressAuthorized ? 'none' : '';
    backupWordPressBtn.style.display = wordpressAuthorized ? '' : 'none';
    restoreWordPressBtn.style.display = wordpressAuthorized ? '' : 'none';
    disconnectWordPressBtn.style.display = wordpressAuthorized ? '' : 'none';
  }

  function buildSyncSettingsPayload() {
    return {
      provider: syncProviderSelect.value,
      googleDriveClientId: googleDriveClientIdInput.value.trim(),
      wpBaseUrl: DEFAULT_WORDPRESS_BASE_URL,
      autoSync: !!syncAutoRestoreChk.checked
    };
  }

  function renderCustomCommands() {
    customCommandsList.innerHTML = '';
    customCommands.forEach((command, index) => {
      const item = document.createElement('div');
      item.className = 'reply-mode-item';
      item.dataset.id = command.id;
      item.innerHTML = `
        <div class="reply-mode-header">
          <div style="display:flex;gap:6px;flex:1;align-items:center">
            <span style="color:#aaa;font-size:12px">/</span>
            <input type="text" class="cmd-trigger mode-name" value="${escapeVal((command.trigger || '/').replace(/^\/+/, ''))}" placeholder="指令名稱">
            <input type="text" class="cmd-name mode-name" value="${escapeVal(command.name || '')}" placeholder="指令說明">
          </div>
          <button class="btn-mode-delete" data-index="${index}" title="刪除指令" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <textarea class="cmd-template mode-prompt" rows="2" placeholder="輸入提示詞模板。{input} 會被替換成指令後方輸入的文字，例如：請將以下內容翻譯成英文：{input}">${escapeVal(command.template || '')}</textarea>
      `;
      item.querySelector('.btn-mode-delete').addEventListener('click', () => {
        customCommands.splice(index, 1);
        renderCustomCommands();
      });
      customCommandsList.appendChild(item);
    });
  }

  function collectCommandsFromDom(container) {
    return Array.from(container.querySelectorAll('.reply-mode-item')).map((item) => ({
      id: item.dataset.id,
      trigger: `/${(item.querySelector('.cmd-trigger').value || 'cmd').replace(/^\/+/, '').trim() || 'cmd'}`,
      name: item.querySelector('.cmd-name').value.trim() || '指令說明',
      type: 'template',
      template: item.querySelector('.cmd-template').value.trim()
    }));
  }

  function bindPasswordToggle(button, input) {
    button?.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
    });
  }

  function escapeVal(value) {
    return (value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function showMessage(text, type) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fading-out');
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  function sendRuntimeMessage(payload) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(payload, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { success: false, error: 'EMPTY_RESPONSE' });
      });
    });
  }

  // ── API 預設工具庫 ─────────────────────────────────────────
  const API_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M4.2 7.5l3.5 2"/><path d="M16.3 14.5l3.5 2"/><path d="M19.8 7.5l-3.5 2"/><path d="M7.7 14.5l-3.5 2"/><circle cx="12" cy="12" r="5"/></svg>';
  const GLOBE_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>';
  const GMAIL_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>';
  const CALENDAR_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>';
  const NOTION_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8v9"/><path d="M9 8l6 9"/><path d="M15 8v9"/></svg>';
  const ANALYTICS_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9"/><path d="M9 21V5"/><path d="M15 21v-8"/><path d="M21 21V3"/></svg>';

  const API_PRESETS = [
    {
      id: 'wordpress',
      name: 'WordPress REST API',
      description: '讓 AI 讀取、建立與更新文章、分類與標籤',
      icon: GLOBE_ICON_SVG,
      toolPrefix: 'wp_',
      fields: [
        { id: 'baseUrl',   label: '站台網址',                         placeholder: 'https://yoursite.com',    type: 'text',     toggle: false },
        { id: 'username',  label: '帳號',                             placeholder: 'admin',                   type: 'text',     toggle: false },
        { id: 'password',  label: '密碼（Application Password）',     placeholder: 'xxxx xxxx xxxx xxxx',     type: 'password', toggle: true  }
      ],
      generate: (c) => {
        const auth = { authType: 'basic_auth', authUsername: c.username, authPassword: c.password };
        const base = c.baseUrl.replace(/\/+$/, '') + '/wp-json/wp/v2';
        return [
          {
            name: 'wp_get_posts', method: 'GET', url: `${base}/posts?per_page=20&_fields=id,date,slug,status,link,title`,
            description: '取得 WordPress 文章列表，可依狀態或關鍵字篩選',
            parameters: [
              { name: 'per_page', description: '每頁筆數（最多 100）', type: 'number', location: 'query', required: false },
              { name: 'search',   description: '搜尋關鍵字',           type: 'string', location: 'query', required: false },
              { name: 'status',   description: '狀態：publish。查詢草稿等非公開狀態需要 WordPress 權限，沒有特別指定時請不要帶此參數', type: 'string', location: 'query', required: false }
            ],
            ...auth, responseLimit: 8000, enabled: true
          },
          {
            name: 'wp_get_post', method: 'GET', url: `${base}/posts/{id}`,
            description: '取得指定 ID 的 WordPress 文章完整內容',
            parameters: [
              { name: 'id', description: '文章 ID', type: 'number', location: 'path', required: true }
            ],
            ...auth, responseLimit: 3000, enabled: true
          },
          {
            name: 'wp_create_post', method: 'POST', url: `${base}/posts`,
            description: '在 WordPress 建立新文章',
            parameters: [
              { name: 'title',   description: '文章標題',       type: 'string', location: 'body', required: true  },
              { name: 'content', description: '文章內容（HTML）', type: 'string', location: 'body', required: true  },
              { name: 'status',  description: 'draft 或 publish', type: 'string', location: 'body', required: true  },
              { name: 'excerpt', description: '文章摘要',        type: 'string', location: 'body', required: false }
            ],
            ...auth, responseLimit: 1000, enabled: true
          },
          {
            name: 'wp_update_post', method: 'POST', url: `${base}/posts/{id}`,
            description: '更新指定 WordPress 文章的標題、內容或狀態',
            parameters: [
              { name: 'id',      description: '文章 ID',         type: 'number', location: 'path', required: true  },
              { name: 'title',   description: '新標題',           type: 'string', location: 'body', required: false },
              { name: 'content', description: '新內容（HTML）',   type: 'string', location: 'body', required: false },
              { name: 'status',  description: 'draft / publish',  type: 'string', location: 'body', required: false }
            ],
            ...auth, responseLimit: 1000, enabled: true
          },
          {
            name: 'wp_get_categories', method: 'GET', url: `${base}/categories`,
            description: '取得 WordPress 分類列表',
            parameters: [
              { name: 'per_page', description: '每頁筆數', type: 'number', location: 'query', required: false }
            ],
            ...auth, responseLimit: 2000, enabled: true
          },
          {
            name: 'wp_get_tags', method: 'GET', url: `${base}/tags`,
            description: '取得 WordPress 標籤列表',
            parameters: [
              { name: 'per_page', description: '每頁筆數', type: 'number', location: 'query', required: false }
            ],
            ...auth, responseLimit: 2000, enabled: true
          }
        ];
      }
    },
    {
      id: 'gmail',
      kind: 'oauth2',
      name: 'Gmail',
      description: '讓 AI 搜尋、列出、讀取 Gmail 信件、線串與標籤',
      icon: GMAIL_ICON_SVG,
      toolPrefix: 'gmail_',
      oauthProvider: 'google',
      scopeNote: 'gmail.readonly · gmail.send · gmail.modify',
      consoleUrl: 'https://console.cloud.google.com/apis/credentials',
      generate: () => {
        const base = 'https://gmail.googleapis.com/gmail/v1/users/me';
        const auth = { authType: 'oauth2', oauthPresetId: 'gmail', presetId: 'gmail' };
        return [
          {
            name: 'gmail_list_messages', method: 'GET', url: `${base}/messages`,
            description: '搜尋或列出 Gmail 信件，支援 Gmail 搜尋語法（如 from:、subject:、is:unread、newer_than:7d）',
            parameters: [
              { name: 'q',           description: 'Gmail 搜尋語法，例如 is:unread newer_than:3d',  type: 'string', location: 'query', required: false },
              { name: 'maxResults',  description: '每頁筆數，建議 5-20',                            type: 'number', location: 'query', required: false },
              { name: 'pageToken',   description: '下一頁 token',                                   type: 'string', location: 'query', required: false },
              { name: 'labelIds',    description: '只列出含此 label 的信件（如 INBOX）',            type: 'string', location: 'query', required: false }
            ],
            ...auth, responseLimit: 4000, enabled: true
          },
          {
            name: 'gmail_get_message', method: 'GET', url: `${base}/messages/{id}`,
            description: '取得指定 Gmail 信件內容（標題、寄件人、摘要、收信時間）',
            parameters: [
              { name: 'id',     description: '信件 ID（從 gmail_list_messages 取得）',                       type: 'string', location: 'path',  required: true  },
              { name: 'format', description: '回傳格式：metadata（預設，僅 header）、full（含內文）、raw',   type: 'string', location: 'query', required: false }
            ],
            ...auth, responseLimit: 6000, enabled: true
          },
          {
            name: 'gmail_list_threads', method: 'GET', url: `${base}/threads`,
            description: '搜尋或列出 Gmail 線串（threads）',
            parameters: [
              { name: 'q',          description: 'Gmail 搜尋語法',  type: 'string', location: 'query', required: false },
              { name: 'maxResults', description: '每頁筆數',         type: 'number', location: 'query', required: false }
            ],
            ...auth, responseLimit: 4000, enabled: true
          },
          {
            name: 'gmail_get_thread', method: 'GET', url: `${base}/threads/{id}`,
            description: '取得指定線串內所有信件',
            parameters: [
              { name: 'id', description: '線串 ID', type: 'string', location: 'path', required: true }
            ],
            ...auth, responseLimit: 6000, enabled: true
          },
          {
            name: 'gmail_list_labels', method: 'GET', url: `${base}/labels`,
            description: '取得 Gmail 標籤列表（INBOX、SENT 等系統與自訂 label）',
            parameters: [],
            ...auth, responseLimit: 2000, enabled: true
          }
        ];
      }
    },
    {
      id: 'gcal',
      kind: 'oauth2',
      name: 'Google 日曆',
      description: '讓 AI 查詢、建立、更新與刪除 Google Calendar 事件',
      icon: CALENDAR_ICON_SVG,
      toolPrefix: 'gcal_',
      oauthProvider: 'google',
      scopeNote: 'calendar（讀寫）',
      consoleUrl: 'https://console.cloud.google.com/apis/credentials',
      generate: () => {
        const base = 'https://www.googleapis.com/calendar/v3';
        const auth = { authType: 'oauth2', oauthPresetId: 'gcal', presetId: 'gcal' };
        return [
          {
            name: 'gcal_list_calendars', method: 'GET', url: `${base}/users/me/calendarList`,
            description: '列出使用者所有 Google 日曆',
            parameters: [],
            ...auth, responseLimit: 3000, enabled: true
          },
          {
            name: 'gcal_list_events', method: 'GET', url: `${base}/calendars/{calendarId}/events`,
            description: '列出指定日曆的事件，可依時間範圍與關鍵字篩選',
            parameters: [
              { name: 'calendarId',   description: '日曆 ID，主日曆請填 primary',                              type: 'string',  location: 'path',  required: true  },
              { name: 'timeMin',      description: 'RFC3339 起始時間，例如 2026-05-01T00:00:00+08:00',          type: 'string',  location: 'query', required: false },
              { name: 'timeMax',      description: 'RFC3339 結束時間',                                          type: 'string',  location: 'query', required: false },
              { name: 'q',            description: '關鍵字搜尋',                                                type: 'string',  location: 'query', required: false },
              { name: 'maxResults',   description: '每頁筆數，建議 10-50',                                      type: 'number',  location: 'query', required: false },
              { name: 'singleEvents', description: '是否展開週期事件（建議 true）',                             type: 'boolean', location: 'query', required: false },
              { name: 'orderBy',      description: '排序：startTime 或 updated',                                type: 'string',  location: 'query', required: false }
            ],
            ...auth, responseLimit: 6000, enabled: true
          },
          {
            name: 'gcal_get_event', method: 'GET', url: `${base}/calendars/{calendarId}/events/{eventId}`,
            description: '取得指定事件的完整內容',
            parameters: [
              { name: 'calendarId', description: '日曆 ID（如 primary）', type: 'string', location: 'path', required: true },
              { name: 'eventId',    description: '事件 ID',               type: 'string', location: 'path', required: true }
            ],
            ...auth, responseLimit: 3000, enabled: true
          },
          {
            name: 'gcal_create_event', method: 'POST', url: `${base}/calendars/{calendarId}/events`,
            description: '在指定日曆建立新事件',
            parameters: [
              { name: 'calendarId',  description: '日曆 ID（如 primary）',                                                                  type: 'string', location: 'path', required: true  },
              { name: 'summary',     description: '事件標題',                                                                                type: 'string', location: 'body', required: true  },
              { name: 'description', description: '事件描述',                                                                                type: 'string', location: 'body', required: false },
              { name: 'location',    description: '地點',                                                                                    type: 'string', location: 'body', required: false },
              { name: 'start',       description: '開始時間，物件格式 { "dateTime": "2026-05-10T10:00:00+08:00", "timeZone": "Asia/Taipei" }', type: 'object', location: 'body', required: true  },
              { name: 'end',         description: '結束時間，物件格式同 start',                                                              type: 'object', location: 'body', required: true  },
              { name: 'attendees',   description: '出席者陣列，例如 [{"email":"a@b.com"}]',                                                  type: 'array',  items: { type: 'object' }, location: 'body', required: false }
            ],
            ...auth, responseLimit: 2000, enabled: true
          },
          {
            name: 'gcal_update_event', method: 'PATCH', url: `${base}/calendars/{calendarId}/events/{eventId}`,
            description: '更新指定事件，只需傳送要修改的欄位',
            parameters: [
              { name: 'calendarId',  description: '日曆 ID',         type: 'string', location: 'path', required: true  },
              { name: 'eventId',     description: '事件 ID',         type: 'string', location: 'path', required: true  },
              { name: 'summary',     description: '新標題',          type: 'string', location: 'body', required: false },
              { name: 'description', description: '新描述',          type: 'string', location: 'body', required: false },
              { name: 'location',    description: '新地點',          type: 'string', location: 'body', required: false },
              { name: 'start',       description: '新開始時間物件',  type: 'object', location: 'body', required: false },
              { name: 'end',         description: '新結束時間物件',  type: 'object', location: 'body', required: false }
            ],
            ...auth, responseLimit: 2000, enabled: true
          },
          {
            name: 'gcal_delete_event', method: 'DELETE', url: `${base}/calendars/{calendarId}/events/{eventId}`,
            description: '刪除指定事件',
            parameters: [
              { name: 'calendarId', description: '日曆 ID', type: 'string', location: 'path', required: true },
              { name: 'eventId',    description: '事件 ID', type: 'string', location: 'path', required: true }
            ],
            ...auth, responseLimit: 500, enabled: true
          }
        ];
      }
    },
    {
      id: 'notion',
      kind: 'oauth2',
      name: 'Notion',
      description: '讓 AI 搜尋 Notion、讀取/建立/更新頁面、查詢資料庫',
      icon: NOTION_ICON_SVG,
      toolPrefix: 'notion_',
      oauthProvider: 'notion',
      scopeNote: '依 Notion integration 設定授權範圍',
      consoleUrl: 'https://www.notion.so/profile/integrations/public',
      generate: () => {
        const base = 'https://api.notion.com/v1';
        const auth = { authType: 'oauth2', oauthPresetId: 'notion', presetId: 'notion' };
        return [
          {
            name: 'notion_search', method: 'POST', url: `${base}/search`,
            description: '搜尋 Notion workspace 內可被 integration 存取的頁面與資料庫',
            parameters: [
              { name: 'query',     description: '搜尋關鍵字',                                                              type: 'string', location: 'body', required: false },
              { name: 'filter',    description: '篩選物件，例如 { "value": "page", "property": "object" }',                  type: 'object', location: 'body', required: false },
              { name: 'sort',      description: '排序物件，例如 { "direction": "descending", "timestamp": "last_edited_time" }', type: 'object', location: 'body', required: false },
              { name: 'page_size', description: '每頁筆數，建議 5-20',                                                       type: 'number', location: 'body', required: false }
            ],
            ...auth, responseLimit: 4000, enabled: true
          },
          {
            name: 'notion_get_page', method: 'GET', url: `${base}/pages/{page_id}`,
            description: '取得指定 Notion 頁面屬性（不含內容區塊，需另呼叫 notion_get_block_children）',
            parameters: [
              { name: 'page_id', description: '頁面 ID', type: 'string', location: 'path', required: true }
            ],
            ...auth, responseLimit: 3000, enabled: true
          },
          {
            name: 'notion_get_block_children', method: 'GET', url: `${base}/blocks/{block_id}/children`,
            description: '取得頁面或區塊內的子區塊內容',
            parameters: [
              { name: 'block_id',  description: '區塊或頁面 ID',  type: 'string', location: 'path',  required: true  },
              { name: 'page_size', description: '每頁筆數',        type: 'number', location: 'query', required: false }
            ],
            ...auth, responseLimit: 5000, enabled: true
          },
          {
            name: 'notion_append_block_children', method: 'PATCH', url: `${base}/blocks/{block_id}/children`,
            description: '在指定 Notion 頁面或區塊底下追加內容區塊（需 Public connection 開啟 Insert content 權限）',
            parameters: [
              { name: 'block_id', description: '要追加內容的頁面 ID 或區塊 ID', type: 'string', location: 'path', required: true },
              { name: 'children', description: '要追加的 Notion block 陣列，單次最多 100 個 children', type: 'array', items: { type: 'object' }, location: 'body', required: true },
              { name: 'after',    description: '選填，指定要插入在哪個既有 block ID 後方', type: 'string', location: 'body', required: false }
            ],
            ...auth, responseLimit: 3000, enabled: true
          },
          {
            name: 'notion_create_page', method: 'POST', url: `${base}/pages`,
            description: '建立新 Notion 頁面（在指定 parent 頁面或資料庫底下，可用 children 一併寫入初始內容；需 Insert content 權限）',
            parameters: [
              { name: 'parent',     description: 'parent 物件，例如 { "page_id": "..." } 或 { "database_id": "..." }', type: 'object', location: 'body', required: true  },
              { name: 'properties', description: 'properties 物件；page parent 通常使用 { "title": [{ "text": { "content": "標題" } }] }，database parent 必須符合資料庫 schema', type: 'object', location: 'body', required: true  },
              { name: 'children',   description: '子區塊陣列，例如 paragraph、heading_1 等',                              type: 'array',  items: { type: 'object' }, location: 'body', required: false }
            ],
            ...auth, responseLimit: 2000, enabled: true
          },
          {
            name: 'notion_create_database', method: 'POST', url: `${base}/databases`,
            description: '在指定 Notion 父頁面底下建立資料庫，並可定義自訂 properties schema（不是把既有頁面原地轉成資料庫）',
            parameters: [
              { name: 'parent',     description: 'parent 物件，例如 { "type": "page_id", "page_id": "..." }', type: 'object', location: 'body', required: true },
              { name: 'title',      description: '資料庫標題 rich text 陣列，例如 [{ "type": "text", "text": { "content": "行程資料庫" } }]', type: 'array', items: { type: 'object' }, location: 'body', required: true },
              { name: 'properties', description: '資料庫 properties schema。支援 title、rich_text、number、select、multi_select、status、date、people、files、checkbox、url、email、phone_number、formula、relation、rollup、created_time、created_by、last_edited_time、last_edited_by；可用簡寫如 { "開始時間": "date" }，系統會轉為 { "開始時間": { "date": {} } }', type: 'object', location: 'body', required: true },
              { name: 'is_inline',  description: '是否建立為 inline database', type: 'boolean', location: 'body', required: false }
            ],
            ...auth, responseLimit: 3000, enabled: true
          },
          {
            name: 'notion_update_page', method: 'PATCH', url: `${base}/pages/{page_id}`,
            description: '更新 Notion 頁面屬性；僅在明確需要且頁面不是 workspace level page 時才使用 archived。不能用來移動頁面、轉換頁面類型或封存 workspace level pages',
            parameters: [
              { name: 'page_id',    description: '頁面 ID',          type: 'string',  location: 'path', required: true  },
              { name: 'properties', description: '要更新的 properties 物件', type: 'object',  location: 'body', required: false },
              { name: 'archived',   description: '是否封存（true）或還原（false）；Notion API 不支援封存 workspace level pages，不要用於移動或轉換頁面', type: 'boolean', location: 'body', required: false }
            ],
            ...auth, responseLimit: 2000, enabled: true
          },
          {
            name: 'notion_query_database', method: 'POST', url: `${base}/databases/{database_id}/query`,
            description: '查詢 Notion database 內容，支援過濾條件與排序。只能使用 database_id，不可使用頁面連結取得的 page_id；若只有 page_id，請先用 notion_get_page / notion_get_block_children，或用 notion_create_database 在該頁底下建立 database',
            parameters: [
              { name: 'database_id', description: '資料庫 ID，不是 page ID。不可填入使用者提供的普通頁面連結 ID',                                                                              type: 'string', location: 'path', required: true  },
              { name: 'filter',      description: '過濾物件，遵循 Notion filter 規格',                                                       type: 'object', location: 'body', required: false },
              { name: 'sorts',       description: '排序陣列，例如 [{ "property": "Name", "direction": "ascending" }]',                       type: 'array',  items: { type: 'object' }, location: 'body', required: false },
              { name: 'page_size',   description: '每頁筆數',                                                                                type: 'number', location: 'body', required: false }
            ],
            ...auth, responseLimit: 6000, enabled: true
          }
        ];
      }
    },
    {
      id: 'ga4',
      kind: 'oauth2',
      name: 'Google Analytics 4',
      description: '讓 AI 查詢 GA4 報表（流量、來源、頁面等）',
      icon: ANALYTICS_ICON_SVG,
      toolPrefix: 'ga_',
      oauthProvider: 'google',
      scopeNote: 'analytics.readonly',
      consoleUrl: 'https://console.cloud.google.com/apis/credentials',
      generate: () => {
        const auth = { authType: 'oauth2', oauthPresetId: 'ga4', presetId: 'ga4' };
        return [
          {
            name: 'ga_list_account_summaries', method: 'GET',
            url: 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
            description: '列出可存取的 GA4 帳戶與 property 摘要（取得 propertyId）',
            parameters: [],
            ...auth, responseLimit: 4000, enabled: true
          },
          {
            name: 'ga_run_report', method: 'POST',
            url: 'https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport',
            description: '對指定 GA4 property 執行報表查詢',
            parameters: [
              { name: 'propertyId', description: 'GA4 property ID（純數字，從 ga_list_account_summaries 取得）',                            type: 'string', location: 'path', required: true  },
              { name: 'dateRanges', description: '日期範圍陣列，例如 [{"startDate":"7daysAgo","endDate":"today"}]',                          type: 'array',  items: { type: 'object' }, location: 'body', required: true  },
              { name: 'dimensions', description: '維度陣列，例如 [{"name":"pagePath"},{"name":"country"}]',                                  type: 'array',  items: { type: 'object' }, location: 'body', required: false },
              { name: 'metrics',    description: '指標陣列，例如 [{"name":"activeUsers"},{"name":"screenPageViews"}]',                       type: 'array',  items: { type: 'object' }, location: 'body', required: true  },
              { name: 'limit',      description: '回傳列數上限',                                                                              type: 'number', location: 'body', required: false },
              { name: 'orderBys',   description: '排序陣列，例如 [{"metric":{"metricName":"activeUsers"},"desc":true}]',                     type: 'array',  items: { type: 'object' }, location: 'body', required: false }
            ],
            ...auth, responseLimit: 6000, enabled: true
          }
        ];
      }
    }
  ];

  function renderApiPresets() {
    const container = document.getElementById('apiPresetsList');
    if (!container) return;
    container.innerHTML = '';

    for (const preset of API_PRESETS) {
      if (preset.kind === 'oauth2') {
        container.appendChild(buildOAuthPresetCard(preset));
        continue;
      }
      const imported = apiToolRegistry.filter(t => t.name.startsWith(preset.toolPrefix));
      const isImported = imported.length > 0;
      const enabledCount = imported.filter(t => t.enabled).length;
      const totalCount = preset.generate({ baseUrl: 'https://example.com', username: '', password: '' }).length;
      const sampleTool = imported[0] || {};
      const inferredBaseUrl = sampleTool.url ? sampleTool.url.split('/wp-json/wp/v2')[0] : '';

      const card = document.createElement('div');
      card.className = 'api-preset-card';

      const eyeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

      card.innerHTML = `
        <div class="api-preset-card-header">
          <span class="api-preset-icon">${preset.icon}</span>
          <div class="api-preset-info">
            <div class="api-preset-name">${escapeVal(preset.name)}</div>
            <div class="api-preset-desc">${escapeVal(preset.description)}</div>
          </div>
          ${isImported ? `<span class="api-preset-badge">已啟用 ${enabledCount} / ${totalCount} 個工具</span>` : ''}
          <button type="button" class="api-preset-toggle-btn">${isImported ? '編輯 ▾' : '啟用 ▾'}</button>
        </div>
        <div class="api-preset-body" style="display:none">
          <div class="api-preset-step">
            <span class="api-preset-step-index">1</span>
            <span>啟用與輸入連線資料</span>
          </div>
          ${preset.fields.map(f => `
            <div class="form-group">
              <label>${escapeVal(f.label)}</label>
              ${f.toggle
                ? `<div class="input-wrapper">
                     <input type="password" class="preset-field" data-field="${f.id}" placeholder="${escapeVal(f.placeholder)}" value="${escapeVal(sampleTool.authPassword || '')}" />
                     <button type="button" class="btn-icon preset-pw-toggle">${eyeSvg}</button>
                   </div>`
                : `<input type="${f.type}" class="preset-field" data-field="${f.id}" placeholder="${escapeVal(f.placeholder)}" value="${escapeVal(f.id === 'baseUrl' ? inferredBaseUrl : sampleTool.authUsername || '')}" />`
              }
            </div>
          `).join('')}
          <div class="api-preset-step api-preset-endpoints-title" style="${isImported ? '' : 'display:none'}">
            <span class="api-preset-step-index">2</span>
            <span>設定要啟用的預設端點</span>
          </div>
          <div class="api-preset-endpoints" style="${isImported ? '' : 'display:none'}"></div>
          <div class="api-preset-actions">
            <button type="button" class="btn-primary api-preset-save-btn">
              ${isImported ? '儲存設定' : '儲存連線並顯示端點'}
            </button>
            ${isImported ? `<button type="button" class="btn-secondary danger api-preset-remove-btn">移除所有工具</button>` : ''}
          </div>
        </div>`;

      const readConfig = () => {
        const config = {};
        card.querySelectorAll('.preset-field').forEach(inp => { config[inp.dataset.field] = inp.value.trim(); });
        return config;
      };

      const getWpApiBase = (baseUrl) => `${String(baseUrl || '').replace(/\/+$/, '')}/wp-json/wp/v2`;

      const toRelativeEndpoint = (url, config) => {
        const apiBase = getWpApiBase(config.baseUrl);
        if (!url) return '';
        if (url.startsWith(apiBase)) return url.slice(apiBase.length) || '/';
        try {
          const urlObj = new URL(url);
          return `${urlObj.pathname}${urlObj.search}`;
        } catch {
          return url;
        }
      };

      const toFullEndpointUrl = (endpoint, config) => {
        const value = String(endpoint || '').trim();
        if (/^https?:\/\//i.test(value)) return value;
        return `${getWpApiBase(config.baseUrl)}${value.startsWith('/') ? value : `/${value}`}`;
      };

      const renderPresetParamRow = (param = {}) => `
        <div class="api-preset-param-row">
          <input type="text" class="api-preset-param-name" placeholder="名稱" value="${escapeVal(param.name || '')}" />
          <input type="text" class="api-preset-param-desc" placeholder="說明" value="${escapeVal(param.description || '')}" />
          <select class="api-preset-param-type">
            ${['string', 'number', 'boolean'].map(type => `<option value="${type}" ${param.type === type || (!param.type && type === 'string') ? 'selected' : ''}>${type}</option>`).join('')}
          </select>
          <select class="api-preset-param-location">
            ${['query', 'path', 'body', 'header'].map(location => `<option value="${location}" ${param.location === location || (!param.location && location === 'query') ? 'selected' : ''}>${location}</option>`).join('')}
          </select>
          <label class="api-preset-param-required">
            <input type="checkbox" ${param.required ? 'checked' : ''} /> 必填
          </label>
          <button type="button" class="btn-mode-delete api-preset-param-delete" title="刪除">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>`;

      const buildEndpointRows = (config) => {
        const endpointsEl = card.querySelector('.api-preset-endpoints');
        const generated = preset.generate(config);
        endpointsEl.innerHTML = generated.map(tool => {
          const existing = apiToolRegistry.find(t => t.name === tool.name);
          const viewTool = { ...tool, ...(existing || {}) };
          const endpoint = toRelativeEndpoint(viewTool.url, config);
          const checked = existing ? existing.enabled !== false : true;
          return `
            <div class="api-preset-endpoint-row" data-tool-name="${escapeVal(tool.name)}">
              <label class="api-preset-endpoint-check">
                <input type="checkbox" class="api-preset-endpoint-enabled" ${checked ? 'checked' : ''} />
              </label>
              <span class="api-method-badge api-method-${viewTool.method}">${escapeVal(viewTool.method)}</span>
              <div class="api-preset-endpoint-main">
                <span class="api-preset-endpoint-name">${escapeVal(viewTool.name)}</span>
                <span class="api-preset-endpoint-desc">${escapeVal(viewTool.description)}</span>
                <span class="api-preset-endpoint-auth">連線方式：Basic Auth（帳號 + Application Password）</span>
                <span class="api-preset-endpoint-url">${escapeVal(endpoint)}</span>
              </div>
              <button type="button" class="btn-secondary api-preset-endpoint-edit">編輯</button>
              <div class="api-preset-endpoint-settings" style="display:none">
                <div class="form-group">
                  <label>說明</label>
                  <textarea class="api-preset-tool-description" rows="2">${escapeVal(viewTool.description)}</textarea>
                </div>
                <div class="form-group">
                  <label>端點</label>
                  <input type="text" class="api-preset-tool-endpoint" value="${escapeVal(endpoint)}" />
                  <p class="hint">會自動接在站台網址後方，不需要填完整網址。</p>
                </div>
                <div class="api-preset-settings-row">
                  <div class="form-group">
                    <label>HTTP 方法</label>
                    <select class="api-preset-tool-method">
                      ${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => `<option value="${m}" ${viewTool.method === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>回傳上限</label>
                    <input type="number" class="api-preset-tool-response-limit" value="${viewTool.responseLimit || 2000}" min="100" max="10000" />
                  </div>
                </div>
                <div class="form-group">
                  <label>參數</label>
                  <div class="api-preset-params-list">
                    ${(viewTool.parameters || []).map(renderPresetParamRow).join('')}
                  </div>
                  <button type="button" class="btn-secondary api-preset-add-param">+ 新增參數</button>
                </div>
              </div>
            </div>`;
        }).join('');
        endpointsEl.querySelectorAll('.api-preset-endpoint-edit').forEach(btn => {
          btn.addEventListener('click', () => {
            const row = btn.closest('.api-preset-endpoint-row');
            const settings = row.querySelector('.api-preset-endpoint-settings');
            const open = settings.style.display !== 'none';
            settings.style.display = open ? 'none' : 'block';
            btn.textContent = open ? '編輯' : '收起';
          });
        });
        endpointsEl.querySelectorAll('.api-preset-param-delete').forEach(btn => {
          btn.addEventListener('click', () => btn.closest('.api-preset-param-row')?.remove());
        });
        endpointsEl.querySelectorAll('.api-preset-add-param').forEach(btn => {
          btn.addEventListener('click', () => {
            const list = btn.previousElementSibling;
            list.insertAdjacentHTML('beforeend', renderPresetParamRow());
            list.lastElementChild.querySelector('.api-preset-param-delete').addEventListener('click', (e) => {
              e.currentTarget.closest('.api-preset-param-row')?.remove();
            });
          });
        });
      };

      if (isImported) {
        buildEndpointRows({
          baseUrl: inferredBaseUrl,
          username: sampleTool.authUsername || '',
          password: sampleTool.authPassword || ''
        });
      }

      // 展開/收合
      card.querySelector('.api-preset-toggle-btn').addEventListener('click', () => {
        const body = card.querySelector('.api-preset-body');
        const btn  = card.querySelector('.api-preset-toggle-btn');
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        btn.textContent = open ? (isImported ? '編輯 ▾' : '啟用 ▾') : '收起 ▴';
      });

      // 密碼顯示切換
      card.querySelector('.preset-pw-toggle')?.addEventListener('click', (e) => {
        const inp = e.currentTarget.previousElementSibling;
        inp.type = inp.type === 'password' ? 'text' : 'password';
      });

      // 儲存連線與端點選擇
      card.querySelector('.api-preset-save-btn').addEventListener('click', async () => {
        const config = readConfig();
        if (!config.baseUrl) { showMessage('請輸入站台網址', 'error'); return; }
        if (!config.username) { showMessage('請輸入帳號', 'error'); return; }
        if (!config.password) { showMessage('請輸入 Application Password', 'error'); return; }

        const endpointBlock = card.querySelector('.api-preset-endpoints');
        if (endpointBlock.style.display === 'none') {
          buildEndpointRows(config);
          const defaultTools = preset.generate(config).map(t => ({
            ...t,
            id: apiToolRegistry.find(r => r.name === t.name)?.id || generateToolId(),
            presetId: preset.id,
            enabled: true
          }));
          apiToolRegistry = [
            ...apiToolRegistry.filter(t => !t.name.startsWith(preset.toolPrefix)),
            ...defaultTools
          ];
          await chrome.storage.local.set({ apiToolRegistry });
          renderApiToolRegistry();
          card.querySelector('.api-preset-endpoints-title').style.display = '';
          endpointBlock.style.display = '';
          card.querySelector('.api-preset-save-btn').textContent = '儲存設定';
          showMessage('連線資料已儲存，請勾選要啟用的預設端點', 'success');
          return;
        }

        const enabledByName = new Map();
        card.querySelectorAll('.api-preset-endpoint-enabled').forEach(inp => {
          enabledByName.set(inp.closest('.api-preset-endpoint-row').dataset.toolName, inp.checked);
        });
        const overridesByName = new Map();
        card.querySelectorAll('.api-preset-endpoint-row').forEach(row => {
          const name = row.dataset.toolName;
          const parameters = Array.from(row.querySelectorAll('.api-preset-param-row')).map(paramRow => ({
            name: paramRow.querySelector('.api-preset-param-name').value.trim(),
            description: paramRow.querySelector('.api-preset-param-desc').value.trim(),
            type: paramRow.querySelector('.api-preset-param-type').value,
            location: paramRow.querySelector('.api-preset-param-location').value,
            required: paramRow.querySelector('.api-preset-param-required input').checked
          })).filter(param => param.name);
          overridesByName.set(name, {
            method: row.querySelector('.api-preset-tool-method').value,
            url: toFullEndpointUrl(row.querySelector('.api-preset-tool-endpoint').value, config),
            description: row.querySelector('.api-preset-tool-description').value.trim(),
            responseLimit: parseInt(row.querySelector('.api-preset-tool-response-limit').value) || 2000,
            parameters
          });
        });

        const newTools = preset.generate(config).map(t => ({
          ...t,
          ...(overridesByName.get(t.name) || {}),
          id: apiToolRegistry.find(r => r.name === t.name)?.id || generateToolId(),
          presetId: preset.id,
          enabled: enabledByName.get(t.name) !== false
        }));
        apiToolRegistry = [
          ...apiToolRegistry.filter(t => !t.name.startsWith(preset.toolPrefix)),
          ...newTools
        ];
        await chrome.storage.local.set({ apiToolRegistry });
        renderApiToolRegistry();
        renderApiPresets();
        showMessage(`${preset.name} 設定已儲存`, 'success');
      });

      // 移除
      card.querySelector('.api-preset-remove-btn')?.addEventListener('click', async () => {
        if (!confirm(`確定要移除所有 ${preset.name} 工具嗎？`)) return;
        apiToolRegistry = apiToolRegistry.filter(t => !t.name.startsWith(preset.toolPrefix));
        await chrome.storage.local.set({ apiToolRegistry });
        renderApiToolRegistry();
        renderApiPresets();
        showMessage(`已移除 ${preset.name} 工具`, 'success');
      });

      container.appendChild(card);
    }
  }

  // ── OAuth2 預設工具卡片 ────────────────────────────────────
  function sendOAuthMessage(type, data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type, data }, (resp) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { success: false, error: 'EMPTY_RESPONSE' });
      });
    });
  }

  function buildOAuthPresetCard(preset) {
    const card = document.createElement('div');
    card.className = 'api-preset-card api-preset-oauth';
    card.dataset.presetId = preset.id;

    const totalCount = preset.generate().length;
    const imported = apiToolRegistry.filter(t => t.presetId === preset.id || t.name.startsWith(preset.toolPrefix));
    const isImported = imported.length > 0;
    const enabledCount = imported.filter(t => t.enabled).length;

    card.innerHTML = `
      <div class="api-preset-card-header">
        <span class="api-preset-icon">${preset.icon}</span>
        <div class="api-preset-info">
          <div class="api-preset-name">${escapeVal(preset.name)}</div>
          <div class="api-preset-desc">${escapeVal(preset.description)}</div>
        </div>
        <span class="api-preset-badge oauth-status-badge" data-role="oauth-badge">未授權</span>
        <span class="api-preset-badge" data-role="enabled-count" style="${isImported ? '' : 'display:none'}">已啟用 ${enabledCount} / ${totalCount} 個工具</span>
        <button type="button" class="api-preset-toggle-btn">設定 ▾</button>
      </div>
      <div class="api-preset-body" style="display:none">
        <div class="oauth-setup-info">
          <div class="oauth-setup-row">
            <span class="oauth-setup-label">OAuth 服務商：</span>
            <span>${preset.oauthProvider === 'google' ? 'Google Cloud Console' : 'Notion Developers'}</span>
            <a href="${preset.consoleUrl}" target="_blank" rel="noopener noreferrer" class="oauth-setup-link">前往建立 →</a>
          </div>
          <div class="oauth-setup-row">
            <span class="oauth-setup-label">授權範圍：</span>
            <span>${escapeVal(preset.scopeNote || '')}</span>
          </div>
          <div class="oauth-setup-row">
            <span class="oauth-setup-label">Redirect URI（請複製到 OAuth 設定）：</span>
            <code class="oauth-redirect-uri" data-role="redirect-uri">載入中…</code>
            <button type="button" class="btn-secondary oauth-copy-redirect" data-role="copy-redirect">複製</button>
          </div>
        </div>

        <div class="api-preset-step">
          <span class="api-preset-step-index">1</span>
          <span>輸入 OAuth Client 資訊</span>
        </div>
        <div class="form-group">
          <label>Client ID</label>
          <input type="text" class="oauth-client-id" data-role="client-id" placeholder="OAuth Client ID" />
        </div>
        <div class="form-group">
          <label>Client Secret</label>
          <input type="password" class="oauth-client-secret" data-role="client-secret" placeholder="OAuth Client Secret" />
          <p class="hint">Client Secret 僅儲存於本機，不會傳送給 AI 模型。</p>
        </div>

        <div class="api-preset-step">
          <span class="api-preset-step-index">2</span>
          <span>授權帳號</span>
        </div>
        <div class="oauth-auth-row">
          <button type="button" class="btn-primary oauth-authorize-btn" data-role="authorize-btn">點此授權</button>
          <button type="button" class="btn-secondary oauth-revoke-btn" data-role="revoke-btn" style="display:none">取消授權</button>
          <span class="oauth-account-text" data-role="account-text"></span>
        </div>

        <div class="api-preset-step api-preset-endpoints-title" data-role="endpoints-title" style="display:none">
          <span class="api-preset-step-index">3</span>
          <span>設定要啟用的預設端點</span>
        </div>
        <div class="api-preset-endpoints" data-role="endpoints" style="display:none"></div>

        <div class="api-preset-actions" data-role="actions" style="display:none">
          <button type="button" class="btn-primary api-preset-save-btn" data-role="save-btn">儲存端點設定</button>
          <button type="button" class="btn-secondary danger api-preset-remove-btn" data-role="remove-btn" style="${isImported ? '' : 'display:none'}">移除所有工具</button>
        </div>
      </div>`;

    const $ = (sel) => card.querySelector(sel);
    const badgeEl       = $('[data-role="oauth-badge"]');
    const countBadgeEl  = $('[data-role="enabled-count"]');
    const redirectUriEl = $('[data-role="redirect-uri"]');
    const copyBtn       = $('[data-role="copy-redirect"]');
    const clientIdInput = $('[data-role="client-id"]');
    const clientSecInput= $('[data-role="client-secret"]');
    const authorizeBtn  = $('[data-role="authorize-btn"]');
    const revokeBtn     = $('[data-role="revoke-btn"]');
    const accountTextEl = $('[data-role="account-text"]');
    const endpointsTitle= $('[data-role="endpoints-title"]');
    const endpointsEl   = $('[data-role="endpoints"]');
    const actionsRow    = $('[data-role="actions"]');
    const saveBtn       = $('[data-role="save-btn"]');
    const removeBtn     = $('[data-role="remove-btn"]');

    function refreshCountBadge() {
      const tools = apiToolRegistry.filter(t => t.presetId === preset.id || t.name.startsWith(preset.toolPrefix));
      if (!tools.length) {
        countBadgeEl.style.display = 'none';
        return;
      }
      const total = preset.generate().length;
      const active = tools.filter(t => t.enabled).length;
      countBadgeEl.style.display = '';
      countBadgeEl.textContent = `已啟用 ${active} / ${total} 個工具`;
    }

    const SECRET_MASK = '••••••••••••';
    let cachedClient = { clientId: '', hasClientSecret: false };
    let cachedToken = null;

    function setBadge(authorized, accountLabel) {
      if (authorized) {
        badgeEl.classList.add('authorized');
        badgeEl.textContent = accountLabel ? `已授權：${accountLabel}` : '已授權';
      } else {
        badgeEl.classList.remove('authorized');
        badgeEl.textContent = '未授權';
      }
    }

    function setEndpointsVisible(visible) {
      endpointsTitle.style.display = visible ? '' : 'none';
      endpointsEl.style.display = visible ? '' : 'none';
      actionsRow.style.display = visible ? '' : 'none';
    }

    const renderPresetParamRow = (param = {}) => `
      <div class="api-preset-param-row">
        <input type="text" class="api-preset-param-name" placeholder="名稱" value="${escapeVal(param.name || '')}" />
        <input type="text" class="api-preset-param-desc" placeholder="說明" value="${escapeVal(param.description || '')}" />
        <select class="api-preset-param-type">
          ${['string', 'number', 'boolean', 'object', 'array'].map(type => `<option value="${type}" ${param.type === type || (!param.type && type === 'string') ? 'selected' : ''}>${type}</option>`).join('')}
        </select>
        <select class="api-preset-param-location">
          ${['query', 'path', 'body', 'header'].map(location => `<option value="${location}" ${param.location === location || (!param.location && location === 'query') ? 'selected' : ''}>${location}</option>`).join('')}
        </select>
        <label class="api-preset-param-required">
          <input type="checkbox" ${param.required ? 'checked' : ''} /> 必填
        </label>
        <button type="button" class="btn-mode-delete api-preset-param-delete" title="刪除">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>`;

    const buildEndpointRows = () => {
      const generated = preset.generate();
      endpointsEl.innerHTML = generated.map(tool => {
        const existing = apiToolRegistry.find(t => t.name === tool.name);
        const viewTool = { ...tool, ...(existing || {}) };
        const checked = existing ? existing.enabled !== false : true;
        return `
          <div class="api-preset-endpoint-row" data-tool-name="${escapeVal(tool.name)}">
            <label class="api-preset-endpoint-check">
              <input type="checkbox" class="api-preset-endpoint-enabled" ${checked ? 'checked' : ''} />
            </label>
            <span class="api-method-badge api-method-${viewTool.method}">${escapeVal(viewTool.method)}</span>
            <div class="api-preset-endpoint-main">
              <span class="api-preset-endpoint-name">${escapeVal(viewTool.name)}</span>
              <span class="api-preset-endpoint-desc">${escapeVal(viewTool.description)}</span>
              <span class="api-preset-endpoint-auth">連線方式：OAuth 2.0</span>
              <span class="api-preset-endpoint-url">${escapeVal(viewTool.url || '')}</span>
            </div>
            <button type="button" class="btn-secondary api-preset-endpoint-edit">編輯</button>
            <div class="api-preset-endpoint-settings" style="display:none">
              <div class="form-group">
                <label>說明</label>
                <textarea class="api-preset-tool-description" rows="2">${escapeVal(viewTool.description)}</textarea>
              </div>
              <div class="form-group">
                <label>URL</label>
                <input type="text" class="api-preset-tool-endpoint" value="${escapeVal(viewTool.url || '')}" />
              </div>
              <div class="api-preset-settings-row">
                <div class="form-group">
                  <label>HTTP 方法</label>
                  <select class="api-preset-tool-method">
                    ${['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => `<option value="${m}" ${viewTool.method === m ? 'selected' : ''}>${m}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>回傳上限</label>
                  <input type="number" class="api-preset-tool-response-limit" value="${viewTool.responseLimit || 2000}" min="100" max="20000" />
                </div>
              </div>
              <div class="form-group">
                <label>參數</label>
                <div class="api-preset-params-list">
                  ${(viewTool.parameters || []).map(renderPresetParamRow).join('')}
                </div>
                <button type="button" class="btn-secondary api-preset-add-param">+ 新增參數</button>
              </div>
            </div>
          </div>`;
      }).join('');
      endpointsEl.querySelectorAll('.api-preset-endpoint-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = btn.closest('.api-preset-endpoint-row');
          const settings = row.querySelector('.api-preset-endpoint-settings');
          const open = settings.style.display !== 'none';
          settings.style.display = open ? 'none' : 'block';
          btn.textContent = open ? '編輯' : '收起';
        });
      });
      endpointsEl.querySelectorAll('.api-preset-param-delete').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.api-preset-param-row')?.remove());
      });
      endpointsEl.querySelectorAll('.api-preset-add-param').forEach(btn => {
        btn.addEventListener('click', () => {
          const list = btn.previousElementSibling;
          list.insertAdjacentHTML('beforeend', renderPresetParamRow());
          list.lastElementChild.querySelector('.api-preset-param-delete').addEventListener('click', (e) => {
            e.currentTarget.closest('.api-preset-param-row')?.remove();
          });
        });
      });
    };

    async function refreshOAuthStatus() {
      const resp = await sendOAuthMessage('OAUTH_GET_STATUS', { presetId: preset.id });
      if (!resp.success) return;
      const { clientId = '', hasClientSecret = false, token, redirectUri } = resp.data || {};
      cachedClient = { clientId, hasClientSecret };
      clientIdInput.value = clientId;
      clientSecInput.value = hasClientSecret ? SECRET_MASK : '';
      redirectUriEl.textContent = redirectUri || '';
      cachedToken = token;
      const hasTools = apiToolRegistry.some(t => t.presetId === preset.id || t.name.startsWith(preset.toolPrefix));
      if (token?.hasAccessToken) {
        const accountLabel = token.account?.email || token.account?.name || token.workspaceName || '';
        setBadge(true, accountLabel);
        accountTextEl.textContent = accountLabel ? `已授權：${accountLabel}` : '已授權';
        authorizeBtn.textContent = '重新授權';
        revokeBtn.style.display = '';
        buildEndpointRows();
        setEndpointsVisible(true);
        removeBtn.style.display = hasTools ? '' : 'none';
      } else {
        setBadge(false);
        accountTextEl.textContent = '';
        authorizeBtn.textContent = '點此授權';
        revokeBtn.style.display = 'none';
        setEndpointsVisible(false);
        removeBtn.style.display = 'none';
      }
      refreshCountBadge();
    }

    // 展開 / 收合
    card.querySelector('.api-preset-toggle-btn').addEventListener('click', () => {
      const body = card.querySelector('.api-preset-body');
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      card.querySelector('.api-preset-toggle-btn').textContent = open ? '設定 ▾' : '收起 ▴';
      if (!open) refreshOAuthStatus();
    });

    clientSecInput.addEventListener('focus', () => {
      if (cachedClient.hasClientSecret && clientSecInput.value === SECRET_MASK) {
        clientSecInput.select();
      }
    });

    // 複製 redirect URI
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(redirectUriEl.textContent);
        showMessage('已複製 Redirect URI', 'success');
      } catch {
        showMessage('複製失敗，請手動選取', 'error');
      }
    });

    // 授權
    authorizeBtn.addEventListener('click', async () => {
      const clientId = clientIdInput.value.trim();
      const clientSecret = clientSecInput.value.trim();
      if (!clientId) { showMessage('請輸入 Client ID', 'error'); return; }
      const useStoredSecret = cachedClient.hasClientSecret && clientSecret === SECRET_MASK && clientId === cachedClient.clientId;
      if (!clientSecret || (clientSecret === SECRET_MASK && !useStoredSecret)) {
        showMessage('請輸入 Client Secret', 'error');
        return;
      }
      authorizeBtn.disabled = true;
      authorizeBtn.textContent = '授權中…';
      if (!useStoredSecret) {
        const saveResp = await sendOAuthMessage('OAUTH_SAVE_CLIENT', { presetId: preset.id, clientId, clientSecret });
        if (!saveResp.success) {
          authorizeBtn.disabled = false; authorizeBtn.textContent = '點此授權';
          showMessage(`儲存 Client 失敗：${saveResp.error}`, 'error'); return;
        }
      }
      const authResp = await sendOAuthMessage('OAUTH_AUTHORIZE', { presetId: preset.id });
      authorizeBtn.disabled = false;
      if (!authResp.success) {
        showMessage(`授權失敗：${authResp.error}`, 'error');
        await refreshOAuthStatus();
        return;
      }
      showMessage(`${preset.name} 授權成功`, 'success');
      // 自動寫入預設工具到 registry（保留現有 enabled 狀態）
      const generated = preset.generate();
      const newTools = generated.map(t => {
        const existing = apiToolRegistry.find(r => r.name === t.name);
        return {
          ...t,
          ...(existing ? { enabled: existing.enabled, responseLimit: existing.responseLimit, parameters: existing.parameters || t.parameters, url: existing.url || t.url, method: existing.method || t.method, description: existing.description || t.description } : {}),
          id: existing?.id || generateToolId(),
          presetId: preset.id
        };
      });
      apiToolRegistry = [
        ...apiToolRegistry.filter(t => !(t.presetId === preset.id || t.name.startsWith(preset.toolPrefix))),
        ...newTools
      ];
      await chrome.storage.local.set({ apiToolRegistry });
      renderApiToolRegistry();
      refreshCountBadge();
      await refreshOAuthStatus();
    });

    // 取消授權
    revokeBtn.addEventListener('click', async () => {
      if (!confirm(`確定要取消 ${preset.name} 授權嗎？`)) return;
      const resp = await sendOAuthMessage('OAUTH_REVOKE', { presetId: preset.id });
      if (!resp.success) { showMessage(`取消授權失敗：${resp.error}`, 'error'); return; }
      showMessage(`${preset.name} 已取消授權`, 'success');
      await refreshOAuthStatus();
    });

    // 儲存端點設定
    saveBtn.addEventListener('click', async () => {
      const enabledByName = new Map();
      card.querySelectorAll('.api-preset-endpoint-enabled').forEach(inp => {
        enabledByName.set(inp.closest('.api-preset-endpoint-row').dataset.toolName, inp.checked);
      });
      const overridesByName = new Map();
      card.querySelectorAll('.api-preset-endpoint-row').forEach(row => {
        const name = row.dataset.toolName;
        const parameters = Array.from(row.querySelectorAll('.api-preset-param-row')).map(paramRow => ({
          name: paramRow.querySelector('.api-preset-param-name').value.trim(),
          description: paramRow.querySelector('.api-preset-param-desc').value.trim(),
          type: paramRow.querySelector('.api-preset-param-type').value,
          location: paramRow.querySelector('.api-preset-param-location').value,
          required: paramRow.querySelector('.api-preset-param-required input').checked
        })).filter(param => param.name);
        overridesByName.set(name, {
          method: row.querySelector('.api-preset-tool-method').value,
          url: row.querySelector('.api-preset-tool-endpoint').value.trim(),
          description: row.querySelector('.api-preset-tool-description').value.trim(),
          responseLimit: parseInt(row.querySelector('.api-preset-tool-response-limit').value) || 2000,
          parameters
        });
      });
      const newTools = preset.generate().map(t => ({
        ...t,
        ...(overridesByName.get(t.name) || {}),
        id: apiToolRegistry.find(r => r.name === t.name)?.id || generateToolId(),
        presetId: preset.id,
        enabled: enabledByName.get(t.name) !== false
      }));
      apiToolRegistry = [
        ...apiToolRegistry.filter(t => !(t.presetId === preset.id || t.name.startsWith(preset.toolPrefix))),
        ...newTools
      ];
      await chrome.storage.local.set({ apiToolRegistry });
      renderApiToolRegistry();
      refreshCountBadge();
      showMessage(`${preset.name} 端點設定已儲存`, 'success');
    });

    // 移除所有工具
    removeBtn.addEventListener('click', async () => {
      if (!confirm(`確定要移除所有 ${preset.name} 工具嗎？（不會取消授權）`)) return;
      apiToolRegistry = apiToolRegistry.filter(t => !(t.presetId === preset.id || t.name.startsWith(preset.toolPrefix)));
      await chrome.storage.local.set({ apiToolRegistry });
      renderApiToolRegistry();
      refreshCountBadge();
      removeBtn.style.display = 'none';
      showMessage(`已移除 ${preset.name} 工具`, 'success');
    });

    // 初次載入時同步已儲存的 OAuth 狀態與 redirect URI。
    refreshOAuthStatus().catch(err => console.warn('[OAuth] refresh status failed:', err?.message || err));

    return card;
  }

  // ── API Tool Registry ──────────────────────────────────────
  function generateToolId() {
    return 'tool_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function renderApiToolRegistry() {
    const listEl = document.getElementById('apiToolsList');
    if (!listEl) return;
    const customTools = apiToolRegistry.filter(tool => !tool.presetId && !API_PRESETS.some(preset => tool.name?.startsWith(preset.toolPrefix)));
    if (!customTools.length) {
      listEl.innerHTML = '<p class="hint" style="text-align:center;padding:14px 0">尚未建立任何連接應用程式</p>';
      return;
    }
    listEl.innerHTML = '';
    for (const tool of customTools) {
      const card = document.createElement('div');
      card.className = 'api-tool-card';
      card.dataset.id = tool.id;
      const method = tool.method || 'GET';
      card.innerHTML = `
        <div class="api-tool-card-header">
          <span class="api-tool-name"><span class="api-tool-name-icon">${API_ICON_SVG}</span>${escapeVal(tool.name || '未命名')}</span>
          <span class="api-method-badge api-method-${method}">${escapeVal(method)}</span>
          <label class="api-tool-toggle" title="啟用/停用">
            <input type="checkbox" class="api-tool-enabled" ${tool.enabled ? 'checked' : ''} />
            <span>${tool.enabled ? '啟用' : '停用'}</span>
          </label>
        </div>
        <div class="api-tool-card-body">
          <div class="api-tool-desc">${escapeVal(tool.description || '無說明')}</div>
          <div class="api-tool-url">${escapeVal(tool.url || '')}</div>
        </div>
        <div class="api-tool-card-actions">
          <button class="btn-secondary api-tool-edit">編輯</button>
          <button class="btn-mode-delete api-tool-delete" title="刪除">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`;
      card.querySelector('.api-tool-enabled').addEventListener('change', async (e) => {
        tool.enabled = e.target.checked;
        e.target.nextElementSibling.textContent = tool.enabled ? '啟用' : '停用';
        await chrome.storage.local.set({ apiToolRegistry });
      });
      card.querySelector('.api-tool-edit').addEventListener('click', () => openApiToolForm(tool));
      card.querySelector('.api-tool-delete').addEventListener('click', async () => {
        if (!confirm(`確定要刪除工具「${tool.name}」嗎？`)) return;
        apiToolRegistry = apiToolRegistry.filter(t => t.id !== tool.id);
        await chrome.storage.local.set({ apiToolRegistry });
        renderApiToolRegistry();
      });
      listEl.appendChild(card);
    }
  }

  function openApiToolForm(tool = null) {
    editingToolId = tool?.id || null;
    const form = document.getElementById('apiToolForm');
    form.querySelector('.api-tool-form-title').textContent = tool ? '編輯工具' : '新增工具';
    document.getElementById('atf-name').value = tool?.name || '';
    document.getElementById('atf-method').value = tool?.method || 'GET';
    document.getElementById('atf-url').value = tool?.url || '';
    document.getElementById('atf-description').value = tool?.description || '';
    document.getElementById('atf-auth-type').value = tool?.authType || 'none';
    document.getElementById('atf-auth-keyname').value = tool?.authKeyName || '';
    document.getElementById('atf-auth-secret').value = tool?.authSecret || '';
    document.getElementById('atf-auth-username').value = tool?.authUsername || '';
    document.getElementById('atf-auth-password').value = tool?.authPassword || '';
    document.getElementById('atf-response-limit').value = tool?.responseLimit ?? 2000;
    renderParamRows(tool?.parameters || []);
    updateAtfAuthFields();
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderParamRows(params) {
    const listEl = document.getElementById('atf-params-list');
    listEl.innerHTML = '';
    for (const p of params) addParamRow(p);
  }

  function addParamRow(param = {}) {
    const listEl = document.getElementById('atf-params-list');
    const row = document.createElement('div');
    row.className = 'atf-param-row';
    row.innerHTML = `
      <input type="text" class="atf-p-name" placeholder="名稱" value="${escapeVal(param.name || '')}" />
      <input type="text" class="atf-p-desc" placeholder="說明" value="${escapeVal(param.description || '')}" />
      <select class="atf-p-type">
        <option value="string"  ${(!param.type || param.type === 'string')  ? 'selected' : ''}>字串</option>
        <option value="number"  ${param.type === 'number'  ? 'selected' : ''}>數字</option>
        <option value="boolean" ${param.type === 'boolean' ? 'selected' : ''}>布林</option>
      </select>
      <select class="atf-p-location">
        <option value="query"  ${(!param.location || param.location === 'query')  ? 'selected' : ''}>query</option>
        <option value="path"   ${param.location === 'path'   ? 'selected' : ''}>path</option>
        <option value="body"   ${param.location === 'body'   ? 'selected' : ''}>body</option>
        <option value="header" ${param.location === 'header' ? 'selected' : ''}>header</option>
      </select>
      <label class="atf-p-required-label">
        <input type="checkbox" class="atf-p-required" ${param.required ? 'checked' : ''} /> 必填
      </label>
      <button type="button" class="btn-mode-delete atf-del-param" title="刪除">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>`;
    row.querySelector('.atf-del-param').addEventListener('click', () => row.remove());
    listEl.appendChild(row);
  }

  function collectParamRows() {
    return Array.from(document.querySelectorAll('#atf-params-list .atf-param-row')).map(row => ({
      name:        row.querySelector('.atf-p-name').value.trim(),
      description: row.querySelector('.atf-p-desc').value.trim(),
      type:        row.querySelector('.atf-p-type').value,
      location:    row.querySelector('.atf-p-location').value,
      required:    row.querySelector('.atf-p-required').checked
    })).filter(p => p.name);
  }

  function updateAtfAuthFields() {
    const type = document.getElementById('atf-auth-type').value;
    const fieldsEl     = document.getElementById('atf-auth-fields');
    const tokenRow     = document.getElementById('atf-auth-token-row');
    const keyNameRow   = document.getElementById('atf-auth-keyname-row');
    const keyNameLabel = document.getElementById('atf-auth-keyname-label');
    const basicRow     = document.getElementById('atf-auth-basic-row');
    const isBasic = type === 'basic_auth';
    fieldsEl.style.display   = type === 'none' ? 'none' : 'block';
    tokenRow.style.display   = isBasic ? 'none' : 'block';
    basicRow.style.display   = isBasic ? 'block' : 'none';
    keyNameRow.style.display = (type === 'api_key_header' || type === 'api_key_query') ? 'block' : 'none';
    if (type === 'api_key_header') keyNameLabel.textContent = 'Header 名稱';
    if (type === 'api_key_query')  keyNameLabel.textContent = 'Query 參數名稱';
  }

  async function loadApiToolRegistry() {
    const { apiToolRegistry: stored } = await chrome.storage.local.get('apiToolRegistry');
    apiToolRegistry = stored || [];
    let migrated = false;
    apiToolRegistry = apiToolRegistry.map(tool => {
      if (tool.name === 'wp_get_posts' && tool.url && !tool.url.includes('_fields=')) {
        migrated = true;
        return {
          ...tool,
          url: `${tool.url.replace(/\?.*$/, '')}?per_page=20&_fields=id,date,slug,status,link,title`,
          responseLimit: Math.max(tool.responseLimit || 0, 8000),
          parameters: (tool.parameters || []).map(param => (
            param.name === 'status'
              ? { ...param, description: '狀態：publish。查詢草稿等非公開狀態需要 WordPress 權限，沒有特別指定時請不要帶此參數' }
              : param
          ))
        };
      }
      return tool;
    });
    const hasNotionPreset = apiToolRegistry.some(tool => tool.presetId === 'notion' || tool.name?.startsWith('notion_'));
    if (hasNotionPreset) {
      const generatedNotionTools = API_PRESETS.find(preset => preset.id === 'notion')?.generate() || [];
      for (const toolName of ['notion_append_block_children', 'notion_create_database']) {
        const hasTool = apiToolRegistry.some(tool => tool.name === toolName);
        const generatedTool = generatedNotionTools.find(tool => tool.name === toolName);
        if (!hasTool && generatedTool) {
          apiToolRegistry.push(generatedTool);
          migrated = true;
        }
      }
    }
    if (migrated) await chrome.storage.local.set({ apiToolRegistry });
    renderApiPresets();
    renderApiToolRegistry();
  }

  document.getElementById('addApiToolBtn')?.addEventListener('click', () => openApiToolForm(null));

  document.getElementById('atf-cancel')?.addEventListener('click', () => {
    document.getElementById('apiToolForm').style.display = 'none';
    editingToolId = null;
  });

  document.getElementById('atf-add-param')?.addEventListener('click', () => addParamRow());

  document.getElementById('atf-auth-type')?.addEventListener('change', updateAtfAuthFields);

  document.getElementById('atf-toggle-secret')?.addEventListener('click', () => {
    const input = document.getElementById('atf-auth-secret');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('atf-toggle-password')?.addEventListener('click', () => {
    const input = document.getElementById('atf-auth-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('atf-save')?.addEventListener('click', async () => {
    const name = document.getElementById('atf-name').value.trim();
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
      showMessage('工具名稱只能包含字母、數字與底線', 'error'); return;
    }
    const url = document.getElementById('atf-url').value.trim();
    if (!url) { showMessage('請輸入 URL', 'error'); return; }

    const conflict = apiToolRegistry.find(t => t.name === name && t.id !== editingToolId);
    if (conflict) { showMessage(`工具名稱「${name}」已存在`, 'error'); return; }

    const toolData = {
      id:            editingToolId || generateToolId(),
      name,
      method:        document.getElementById('atf-method').value,
      url,
      description:   document.getElementById('atf-description').value.trim(),
      parameters:    collectParamRows(),
      authType:      document.getElementById('atf-auth-type').value,
      authKeyName:   document.getElementById('atf-auth-keyname').value.trim(),
      authSecret:    document.getElementById('atf-auth-secret').value,
      authUsername:  document.getElementById('atf-auth-username').value,
      authPassword:  document.getElementById('atf-auth-password').value,
      responseLimit: parseInt(document.getElementById('atf-response-limit').value) || 2000,
      enabled:       true
    };

    if (editingToolId) {
      const idx = apiToolRegistry.findIndex(t => t.id === editingToolId);
      if (idx >= 0) { toolData.enabled = apiToolRegistry[idx].enabled; apiToolRegistry[idx] = toolData; }
    } else {
      apiToolRegistry.push(toolData);
    }

    await chrome.storage.local.set({ apiToolRegistry });
    renderApiToolRegistry();
    document.getElementById('apiToolForm').style.display = 'none';
    editingToolId = null;
    showMessage('連接應用程式已儲存', 'success');
  });

  console.log('[Options] All listeners bound, starting data load');
  // ── 資料載入（所有 listener 綁定完成後才執行）──────────────
  Promise.all([
    loadSettings().catch(console.error),
    loadPrompts().catch(console.error),
    loadCustomCommands().catch(console.error),
    loadCustomModels().catch(console.error),
    loadMemorySection().catch(console.error),
    loadSyncSection().catch(console.error),
    renderUsagePage().catch(console.error),
    loadApiToolRegistry().catch(console.error),
  ]);

});
