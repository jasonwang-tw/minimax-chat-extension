const DEFAULT_REPLY_MODES = [
  { id: 'standard', name: '標準', prompt: '' },
  { id: 'discuss', name: '討論', prompt: '請先分析需求、列出重點，再給出清楚可執行的答案。' }
];

const MINIMAX_API_URL = 'https://api.minimax.io/v1/chat/completions';
const TEST_MODEL = 'MiniMax-M2.7';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent';
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
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const testGeminiBtn = document.getElementById('testGeminiBtn');
  const maxHistorySelect = document.getElementById('maxHistory');
  const defaultModelSelect = document.getElementById('defaultModel');
  const saveConversationBtn = document.getElementById('saveConversationBtn');
  const globalPromptInput = document.getElementById('globalPrompt');
  const promptChatInput = document.getElementById('promptChat');
  const promptImageAnalysisInput = document.getElementById('promptImageAnalysis');
  const promptOcrInput = document.getElementById('promptOcr');
  const savePromptsBtn = document.getElementById('savePromptsBtn');
  const replyModesList = document.getElementById('replyModesList');
  const addModeBtn = document.getElementById('addModeBtn');
  const saveModesBtn = document.getElementById('saveModesBtn');
  const customCommandsList = document.getElementById('customCommandsList');
  const addCommandBtn = document.getElementById('addCommandBtn');
  const saveCommandsBtn = document.getElementById('saveCommandsBtn');
  const autoMemoryEnabledChk = document.getElementById('autoMemoryEnabled');
  const syncProviderSelect = document.getElementById('syncProvider');
  const googleDriveClientIdInput = document.getElementById('googleDriveClientId');
  const wpBaseUrlInput = document.getElementById('wpBaseUrl');
  const syncAutoEnabledChk = document.getElementById('syncAutoEnabled');
  const autoBackupTimeInput = document.getElementById('autoBackupTime');
  const saveSyncSettingsBtn = document.getElementById('saveSyncSettingsBtn');
  const connectGoogleDriveBtn = document.getElementById('connectGoogleDriveBtn');
  const disconnectGoogleDriveBtn = document.getElementById('disconnectGoogleDriveBtn');
  const connectWordPressBtn = document.getElementById('connectWordPressBtn');
  const backupWordPressBtn = document.getElementById('backupWordPressBtn');
  const restoreWordPressBtn = document.getElementById('restoreWordPressBtn');
  const disconnectWordPressBtn = document.getElementById('disconnectWordPressBtn');
  const syncStatusText = document.getElementById('syncStatusText');
  const googleDriveStatusText = document.getElementById('googleDriveStatusText');
  const wordpressStatusText = document.getElementById('wordpressStatusText');
  const googleRedirectUriEl = document.getElementById('googleRedirectUri');

  let replyModes = [];
  let customCommands = [];
  let messageTimer = null;

  await loadSettings();
  await loadPrompts();
  await loadReplyModes();
  await loadCustomCommands();
  await loadMemorySection();
  await loadSyncSection();

  bindPasswordToggle(toggleKeyBtn, apiKeyInput);
  bindPasswordToggle(toggleGeminiKeyBtn, geminiApiKeyInput);
  bindPasswordToggle(toggleBraveKeyBtn, braveApiKeyInput);
  bindPasswordToggle(toggleExaKeyBtn, exaApiKeyInput);

  saveBtn?.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showMessage('請先輸入 MiniMax API Key', 'error');
      return;
    }

    await chrome.storage.sync.set({
      apiKey,
      geminiApiKey: geminiApiKeyInput.value.trim(),
      braveApiKey: braveApiKeyInput.value.trim(),
      exaApiKey: exaApiKeyInput.value.trim()
    });
    showMessage('API 設定已儲存', 'success');
  });

  saveConversationBtn?.addEventListener('click', async () => {
    await chrome.storage.sync.set({
      settings: {
        maxHistory: parseInt(maxHistorySelect.value, 10),
        defaultModel: defaultModelSelect.value
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

  addModeBtn?.addEventListener('click', () => {
    replyModes.push({ id: `mode_${Date.now()}`, name: '新模式', prompt: '' });
    renderReplyModes();
  });

  saveModesBtn?.addEventListener('click', async () => {
    replyModes = collectReplyModesFromDom(replyModesList);
    await chrome.storage.sync.set({ replyModes });
    showMessage('回覆模式已儲存', 'success');
  });

  addCommandBtn?.addEventListener('click', () => {
    customCommands.push({
      id: `cmd_${Date.now()}`,
      trigger: '/cmd',
      name: '新指令',
      type: 'template',
      template: '{input}'
    });
    renderCustomCommands();
  });

  saveCommandsBtn?.addEventListener('click', async () => {
    customCommands = collectCommandsFromDom(customCommandsList);
    await chrome.storage.sync.set({ customCommands });
    showMessage('自訂指令已儲存', 'success');
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

  async function loadSettings() {
    const { apiKey, geminiApiKey, braveApiKey, exaApiKey, settings } = await chrome.storage.sync.get([
      'apiKey',
      'geminiApiKey',
      'braveApiKey',
      'exaApiKey',
      'settings'
    ]);

    apiKeyInput.value = apiKey || '';
    geminiApiKeyInput.value = geminiApiKey || '';
    braveApiKeyInput.value = braveApiKey || '';
    exaApiKeyInput.value = exaApiKey || '';
    maxHistorySelect.value = String(settings?.maxHistory || 50);
    defaultModelSelect.value = settings?.defaultModel || 'MiniMax-M2.7';
  }

  async function loadPrompts() {
    const { globalPrompt, defaultPrompts } = await chrome.storage.sync.get(['globalPrompt', 'defaultPrompts']);
    globalPromptInput.value = globalPrompt || '';
    promptChatInput.value = defaultPrompts?.chat || '';
    promptImageAnalysisInput.value = defaultPrompts?.imageAnalysis || '';
    promptOcrInput.value = defaultPrompts?.ocr || '';
  }

  async function loadReplyModes() {
    const { replyModes: stored } = await chrome.storage.sync.get(['replyModes']);
    replyModes = Array.isArray(stored) && stored.length > 0 ? stored : [...DEFAULT_REPLY_MODES];
    renderReplyModes();
  }

  async function loadCustomCommands() {
    const { customCommands: stored } = await chrome.storage.sync.get(['customCommands']);
    customCommands = Array.isArray(stored) ? stored : [];
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
      wpBaseUrlInput.value = settings.wpBaseUrl || DEFAULT_WORDPRESS_BASE_URL;
      syncAutoEnabledChk.checked = !!(settings.autoBackupEnabled || settings.autoSync);
      autoBackupTimeInput.value = settings.autoBackupTime || '03:00';
      autoBackupTimeInput.disabled = !syncAutoEnabledChk.checked;
    } else {
      wpBaseUrlInput.value = DEFAULT_WORDPRESS_BASE_URL;
      autoBackupTimeInput.value = '03:00';
      autoBackupTimeInput.disabled = !syncAutoEnabledChk.checked;
    }

    await refreshSyncStatus();
  }

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

  syncAutoEnabledChk?.addEventListener('change', () => {
    autoBackupTimeInput.disabled = !syncAutoEnabledChk.checked;
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
    if (!wpBaseUrlInput.value.trim()) {
      showMessage('請先輸入 WordPress 站點網址', 'error');
      return;
    }

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
      await loadReplyModes();
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

    const autoBackupText = status.autoBackupEnabled
      ? `每日 ${status.autoBackupTime || '03:00'} 自動備份`
      : '未啟用自動備份';
    syncStatusText.textContent = `目前供應商：${status.provider || 'none'}｜Google Drive：${googleDrive.connected ? '已連線' : '未連線'}｜WordPress：${wordpressAuthorized ? (wordpress.connected ? '已登入' : '已授權（狀態檢查失敗）') : '未登入'}｜${autoBackupText}`;

    backupWordPressBtn.disabled = !wordpressAuthorized;
    restoreWordPressBtn.disabled = !wordpressAuthorized;
    disconnectWordPressBtn.disabled = !wordpressAuthorized;
  }

  function buildSyncSettingsPayload() {
    return {
      provider: syncProviderSelect.value,
      googleDriveClientId: googleDriveClientIdInput.value.trim(),
      wpBaseUrl: wpBaseUrlInput.value.trim() || DEFAULT_WORDPRESS_BASE_URL,
      autoSync: !!syncAutoEnabledChk.checked,
      autoBackupEnabled: !!syncAutoEnabledChk.checked,
      autoBackupTime: autoBackupTimeInput.value || '03:00'
    };
  }

  function renderReplyModes() {
    replyModesList.innerHTML = '';
    replyModes.forEach((mode, index) => {
      const item = document.createElement('div');
      item.className = 'reply-mode-item';
      item.dataset.id = mode.id;
      item.innerHTML = `
        <div class="reply-mode-header">
          <input type="text" class="mode-name" value="${escapeVal(mode.name)}" placeholder="模式名稱">
          <button class="btn-mode-delete" data-index="${index}" title="刪除模式" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <textarea class="mode-prompt" rows="2" placeholder="此模式的系統提示詞">${escapeVal(mode.prompt)}</textarea>
      `;
      item.querySelector('.btn-mode-delete').addEventListener('click', () => {
        replyModes.splice(index, 1);
        renderReplyModes();
      });
      replyModesList.appendChild(item);
    });
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
            <input type="text" class="cmd-trigger mode-name" value="${escapeVal((command.trigger || '/').replace(/^\/+/, ''))}" placeholder="指令名稱" style="max-width:100px">
            <input type="text" class="cmd-name mode-name" value="${escapeVal(command.name || '')}" placeholder="顯示名稱">
            <select class="cmd-type" style="font-size:12px;padding:2px 4px;background:var(--bg-card,#2d2d2d);color:var(--text-primary,#fff);border:1px solid var(--border,#444);border-radius:4px">
              <option value="template" ${command.type === 'template' ? 'selected' : ''}>模板</option>
              <option value="action" ${command.type === 'action' ? 'selected' : ''}>動作</option>
            </select>
          </div>
          <button class="btn-mode-delete" data-index="${index}" title="刪除指令" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <textarea class="cmd-template mode-prompt" rows="2" placeholder="輸入模板內容，可使用 {input} 佔位">${escapeVal(command.template || '')}</textarea>
      `;
      item.querySelector('.btn-mode-delete').addEventListener('click', () => {
        customCommands.splice(index, 1);
        renderCustomCommands();
      });
      customCommandsList.appendChild(item);
    });
  }

  function collectReplyModesFromDom(container) {
    return Array.from(container.querySelectorAll('.reply-mode-item')).map((item) => ({
      id: item.dataset.id,
      name: item.querySelector('.mode-name').value.trim() || '未命名模式',
      prompt: item.querySelector('.mode-prompt').value.trim()
    }));
  }

  function collectCommandsFromDom(container) {
    return Array.from(container.querySelectorAll('.reply-mode-item')).map((item) => ({
      id: item.dataset.id,
      trigger: `/${(item.querySelector('.cmd-trigger').value || 'cmd').replace(/^\/+/, '').trim() || 'cmd'}`,
      name: item.querySelector('.cmd-name').value.trim() || '未命名指令',
      type: item.querySelector('.cmd-type').value,
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
    if (messageTimer) clearTimeout(messageTimer);

    const existing = document.getElementById('inlineMsg');
    if (existing) existing.remove();

    const targetSection = document.querySelector('.section');
    const banner = document.createElement('div');
    banner.id = 'inlineMsg';
    banner.style.cssText =
      'padding:12px 16px;border-radius:8px;font-size:14px;text-align:center;' +
      'margin-bottom:16px;width:100%;box-sizing:border-box;' +
      (type === 'success'
        ? 'background:rgba(16,185,129,0.15);color:#10B981;border:1px solid #10B981;'
        : 'background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid #EF4444;');
    banner.textContent = text;
    targetSection.prepend(banner);
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    messageTimer = setTimeout(() => banner.remove(), 3000);
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

  const tocLinks = document.querySelectorAll('.toc a');
  const sections = document.querySelectorAll('.section[id]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      tocLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
      });
    });
  }, { rootMargin: '-40px 0px -60% 0px', threshold: 0 });

  sections.forEach((section) => observer.observe(section));
});
