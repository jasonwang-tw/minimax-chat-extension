import { collectSettingsBackupPayload, restoreSettingsBackupPayload } from '../sync/settings-backup.js';

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const TEST_MODEL = 'MiniMax-M2.7';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_WORDPRESS_BASE_URL = 'https://jasonsbase.com';

document.addEventListener('DOMContentLoaded', async () => {
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
  const saveConversationBtn = document.getElementById('saveConversationBtn');
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
  }

  tocLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchPage(link.dataset.page);
    });
  });

  await loadSettings();
  await loadPrompts();
  await loadCustomCommands();
  await loadCustomModels();
  await loadMemorySection();
  await loadSyncSection();

  bindPasswordToggle(toggleKeyBtn, apiKeyInput);
  bindPasswordToggle(toggleGeminiKeyBtn, geminiApiKeyInput);
  bindPasswordToggle(toggleBraveKeyBtn, braveApiKeyInput);
  bindPasswordToggle(toggleExaKeyBtn, exaApiKeyInput);
  bindPasswordToggle(toggleOpenrouterKeyBtn, openrouterApiKeyInput);

  addCustomModelBtn?.addEventListener('click', () => {
    customModels.push({ id: `model_${Date.now()}`, label: '', modelId: '' });
    renderCustomModels();
  });

  saveBtn?.addEventListener('click', async () => {
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
      showMessage(`API 設定已儲存（模型清單：${customModels.length} 筆）`, 'success');
    } catch (err) {
      showMessage(`儲存失敗：${err.message}`, 'error');
    }
  });

  saveConversationBtn?.addEventListener('click', async () => {
    await chrome.storage.sync.set({
      settings: {
        maxHistory: parseInt(maxHistorySelect.value, 10)
      }
    });
    showMessage('對話設定已儲存', 'success');
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
          'X-Title': 'MiniMax AI Chat'
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
    openrouterApiKeyInput.value = openrouterApiKey || '';
  }

  async function loadCustomModels() {
    const { customModels: stored, openrouterModel } = await chrome.storage.sync.get(['customModels', 'openrouterModel']);

    if (Array.isArray(stored) && stored.length > 0) {
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
    googleRedirectUriEl.textContent = chrome.identity.getRedirectURL('google-drive-sync');

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
        await loadMemorySection();
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

});
