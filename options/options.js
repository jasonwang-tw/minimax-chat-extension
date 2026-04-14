// options.js - 設定頁面邏輯

const DEFAULT_REPLY_MODES = [
  { id: 'standard', name: '標準', prompt: '' },
  { id: 'discuss', name: '討論模式', prompt: '請針對問題進行多角度分析，引用可靠資訊，交互比對後給出結論，並附上推理過程。' }
];

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("apiKey");
  const toggleKeyBtn = document.getElementById("toggleKey");
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const toggleGeminiKeyBtn = document.getElementById("toggleGeminiKey");
  const braveApiKeyInput = document.getElementById("braveApiKey");
  const toggleBraveKeyBtn = document.getElementById("toggleBraveKey");
  const exaApiKeyInput = document.getElementById("exaApiKey");
  const toggleExaKeyBtn = document.getElementById("toggleExaKey");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const testGeminiBtn = document.getElementById("testGeminiBtn");
  const maxHistorySelect = document.getElementById("maxHistory");
  const defaultModelSelect = document.getElementById("defaultModel");
  const saveConversationBtn = document.getElementById("saveConversationBtn");
  const globalPromptInput = document.getElementById("globalPrompt");
  const promptChatInput = document.getElementById("promptChat");
  const promptImageAnalysisInput = document.getElementById("promptImageAnalysis");
  const promptOcrInput = document.getElementById("promptOcr");
  const savePromptsBtn = document.getElementById("savePromptsBtn");
  const replyModesList = document.getElementById("replyModesList");
  const addModeBtn = document.getElementById("addModeBtn");
  const saveModesBtn = document.getElementById("saveModesBtn");
  const messageDiv = document.getElementById("message");
  const customCommandsList = document.getElementById("customCommandsList");
  const addCommandBtn = document.getElementById("addCommandBtn");
  const saveCommandsBtn = document.getElementById("saveCommandsBtn");
  const autoMemoryEnabledChk = document.getElementById("autoMemoryEnabled");

  let replyModes = [];
  let customCommands = [];

  const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
  const TEST_MODEL = "MiniMax-M2.7";
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent";

  // 載入現有設定
  await loadSettings();
  await loadPrompts();
  await loadReplyModes();
  await loadCustomCommands();
  await loadMemorySection();

  // 切換 MiniMax 密碼可見性
  toggleKeyBtn.addEventListener("click", () => {
    const isPassword = apiKeyInput.type === "password";
    apiKeyInput.type = isPassword ? "text" : "password";
    toggleKeyBtn.innerHTML = isPassword
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });

  // 切換 Gemini 密碼可見性
  toggleGeminiKeyBtn.addEventListener("click", () => {
    const isPassword = geminiApiKeyInput.type === "password";
    geminiApiKeyInput.type = isPassword ? "text" : "password";
    toggleGeminiKeyBtn.innerHTML = isPassword
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });

  // 切換 Brave 密碼可見性
  toggleBraveKeyBtn?.addEventListener("click", () => {
    const isPassword = braveApiKeyInput.type === "password";
    braveApiKeyInput.type = isPassword ? "text" : "password";
    toggleBraveKeyBtn.innerHTML = isPassword
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });

  // 切換 Exa 密碼可見性
  toggleExaKeyBtn?.addEventListener("click", () => {
    const isPassword = exaApiKeyInput.type === "password";
    exaApiKeyInput.type = isPassword ? "text" : "password";
    toggleExaKeyBtn.innerHTML = isPassword
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  });

  // 儲存 API 設定
  saveBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const braveApiKey = braveApiKeyInput.value.trim();
    const exaApiKey = exaApiKeyInput.value.trim();

    if (!apiKey) {
      showMessage("請輸入 MiniMax API Key", "error");
      return;
    }

    await chrome.storage.sync.set({ apiKey, geminiApiKey, braveApiKey, exaApiKey });
    showMessage("API 設定已儲存", "success");
  });

  // 儲存對話設定
  saveConversationBtn.addEventListener("click", async () => {
    const maxHistory = parseInt(maxHistorySelect.value, 10);
    const defaultModel = defaultModelSelect.value;
    await chrome.storage.sync.set({ settings: { maxHistory, defaultModel } });
    showMessage("對話設定已儲存", "success");
  });

  // 儲存提示詞
  savePromptsBtn.addEventListener("click", async () => {
    await chrome.storage.sync.set({
      globalPrompt: globalPromptInput.value.trim(),
      defaultPrompts: {
        chat: promptChatInput.value.trim(),
        imageAnalysis: promptImageAnalysisInput.value.trim(),
        ocr: promptOcrInput.value.trim()
      }
    });
    showMessage("提示詞已儲存", "success");
  });

  // 新增回覆模式
  addModeBtn.addEventListener("click", () => {
    replyModes.push({ id: `mode_${Date.now()}`, name: '新模式', prompt: '' });
    renderReplyModes();
  });

  // 儲存回覆模式
  saveModesBtn.addEventListener("click", async () => {
    // 從 DOM 收集最新資料
    const items = replyModesList.querySelectorAll('.reply-mode-item');
    const updated = Array.from(items).map(item => ({
      id: item.dataset.id,
      name: item.querySelector('.mode-name').value.trim() || '未命名',
      prompt: item.querySelector('.mode-prompt').value.trim()
    }));
    replyModes = updated;
    await chrome.storage.sync.set({ replyModes });
    showMessage("回覆模式已儲存", "success");
  });

  // 測試 MiniMax 連線（使用 chat/completions 端點 + Bearer）
  testBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showMessage("請先輸入 MiniMax API Key", "error");
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = "測試中...";

    try {
      const response = await fetch(MINIMAX_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TEST_MODEL,
          max_tokens: 100,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });

      if (response.ok) {
        showMessage("MiniMax 連線測試成功！", "success");
      } else {
        const error = await response.json().catch(() => ({}));
        showMessage(
          `連線失敗: ${error.error?.message || error.message || response.status}`,
          "error",
        );
      }
    } catch (error) {
      showMessage(`連線失敗: ${error.message}`, "error");
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = "測試 MiniMax 連線";
    }
  });

  // 測試 Gemini 連線
  testGeminiBtn.addEventListener("click", async () => {
    const geminiApiKey = geminiApiKeyInput.value.trim();

    if (!geminiApiKey) {
      showMessage("請先輸入 Gemini API Key", "error");
      return;
    }

    testGeminiBtn.disabled = true;
    testGeminiBtn.textContent = "測試中...";

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hi" }] }],
        }),
      });

      if (response.ok) {
        showMessage("Gemini 連線測試成功！", "success");
      } else {
        const error = await response.json().catch(() => ({}));
        showMessage(
          `Gemini 連線失敗: ${error.error?.message || response.status}`,
          "error",
        );
      }
    } catch (error) {
      showMessage(`Gemini 連線失敗: ${error.message}`, "error");
    } finally {
      testGeminiBtn.disabled = false;
      testGeminiBtn.textContent = "測試 Gemini 連線";
    }
  });

  async function loadSettings() {
    const { apiKey, geminiApiKey, braveApiKey, exaApiKey, settings } = await chrome.storage.sync.get([
      "apiKey", "geminiApiKey", "braveApiKey", "exaApiKey", "settings"
    ]);
    if (apiKey) apiKeyInput.value = apiKey;
    if (geminiApiKey) geminiApiKeyInput.value = geminiApiKey;
    if (braveApiKey) braveApiKeyInput.value = braveApiKey;
    if (exaApiKey) exaApiKeyInput.value = exaApiKey;
    if (settings?.maxHistory) maxHistorySelect.value = settings.maxHistory;
    if (settings?.defaultModel) defaultModelSelect.value = settings.defaultModel;
  }

  async function loadPrompts() {
    const { globalPrompt, defaultPrompts } = await chrome.storage.sync.get(['globalPrompt', 'defaultPrompts']);
    globalPromptInput.value = globalPrompt || '';
    if (defaultPrompts) {
      promptChatInput.value = defaultPrompts.chat || '';
      promptImageAnalysisInput.value = defaultPrompts.imageAnalysis || '';
      promptOcrInput.value = defaultPrompts.ocr || '';
    }
  }

  async function loadReplyModes() {
    const { replyModes: stored } = await chrome.storage.sync.get(['replyModes']);
    replyModes = (stored && stored.length > 0) ? stored : [...DEFAULT_REPLY_MODES];
    renderReplyModes();
  }

  // ── 自訂指令 ──────────────────────────────────────────────

  addCommandBtn.addEventListener("click", () => {
    customCommands.push({ id: `cmd_${Date.now()}`, trigger: '/', name: '新指令', type: 'template', template: '{input}' });
    renderCustomCommands();
  });

  saveCommandsBtn.addEventListener("click", async () => {
    const items = customCommandsList.querySelectorAll('.reply-mode-item');
    const updated = Array.from(items).map(item => ({
      id: item.dataset.id,
      trigger: ('/' + (item.querySelector('.cmd-trigger').value.replace(/^\/+/, '').trim() || 'cmd')),
      name: item.querySelector('.cmd-name').value.trim() || '未命名',
      type: item.querySelector('.cmd-type').value,
      template: item.querySelector('.cmd-template').value.trim()
    }));
    customCommands = updated;
    await chrome.storage.sync.set({ customCommands });
    showMessage("自訂指令已儲存", "success");
  });

  async function loadCustomCommands() {
    const { customCommands: stored } = await chrome.storage.sync.get(['customCommands']);
    customCommands = stored || [];
    renderCustomCommands();
  }

  function renderCustomCommands() {
    customCommandsList.innerHTML = '';
    customCommands.forEach((cmd, idx) => {
      const div = document.createElement('div');
      div.className = 'reply-mode-item';
      div.dataset.id = cmd.id;
      div.innerHTML = `
        <div class="reply-mode-header">
          <div style="display:flex;gap:6px;flex:1;align-items:center">
            <span style="color:#aaa;font-size:12px">/</span>
            <input type="text" class="cmd-trigger mode-name" value="${escapeVal((cmd.trigger || '/').replace(/^\//, ''))}" placeholder="觸發詞" style="max-width:90px">
            <input type="text" class="cmd-name mode-name" value="${escapeVal(cmd.name)}" placeholder="指令名稱">
            <select class="cmd-type" style="font-size:12px;padding:2px 4px;background:var(--bg-card,#2d2d2d);color:var(--text-primary,#fff);border:1px solid var(--border,#444);border-radius:4px">
              <option value="template" ${cmd.type === 'template' ? 'selected' : ''}>模板</option>
              <option value="action" ${cmd.type === 'action' ? 'selected' : ''}>動作</option>
            </select>
          </div>
          <button class="btn-mode-delete" data-idx="${idx}" title="刪除">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <textarea class="cmd-template mode-prompt" rows="2" placeholder="模板內容（{input} 會被替換為 / 後輸入的文字），動作類型可留空">${escapeVal(cmd.template || '')}</textarea>
      `;
      div.querySelector('.btn-mode-delete').addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        customCommands.splice(i, 1);
        renderCustomCommands();
      });
      customCommandsList.appendChild(div);
    });
  }

  // ── 長期記憶 ──────────────────────────────────────────────

  async function loadMemorySection() {
    const { autoMemoryEnabled } = await chrome.storage.sync.get(['autoMemoryEnabled']);
    if (autoMemoryEnabledChk) autoMemoryEnabledChk.checked = !!autoMemoryEnabled;

    autoMemoryEnabledChk?.addEventListener('change', async () => {
      await chrome.storage.sync.set({ autoMemoryEnabled: autoMemoryEnabledChk.checked });
    });

  }

  function renderReplyModes() {
    replyModesList.innerHTML = '';
    replyModes.forEach((mode, idx) => {
      const div = document.createElement('div');
      div.className = 'reply-mode-item';
      div.dataset.id = mode.id;
      div.innerHTML = `
        <div class="reply-mode-header">
          <input type="text" class="mode-name" value="${escapeVal(mode.name)}" placeholder="模式名稱">
          <button class="btn-mode-delete" data-idx="${idx}" title="刪除此模式">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <textarea class="mode-prompt" rows="2" placeholder="回覆指令（留空則使用預設行為）">${escapeVal(mode.prompt)}</textarea>
      `;
      div.querySelector('.btn-mode-delete').addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        replyModes.splice(i, 1);
        renderReplyModes();
      });
      replyModesList.appendChild(div);
    });
  }

  function escapeVal(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let msgTimer = null;
  function showMessage(text, type) {
    if (msgTimer) clearTimeout(msgTimer);

    // 清除舊的 inline 訊息
    const old = document.getElementById("inlineMsg");
    if (old) old.remove();

    // 建立新訊息，inject 到第一個 section 最上方
    const firstSection = document.querySelector(".section");
    const div = document.createElement("div");
    div.id = "inlineMsg";
    div.style.cssText =
      "padding:12px 16px;border-radius:8px;font-size:14px;text-align:center;" +
      "margin-bottom:16px;width:100%;box-sizing:border-box;" +
      (type === "success"
        ? "background:rgba(16,185,129,0.15);color:#10B981;border:1px solid #10B981;"
        : "background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid #EF4444;");
    div.textContent = text;
    firstSection.prepend(div);
    div.scrollIntoView({ behavior: "smooth", block: "nearest" });

    msgTimer = setTimeout(() => div.remove(), 3000);
  }

  // ── TOC 高亮（IntersectionObserver） ──────────────────────
  const tocLinks = document.querySelectorAll('.toc a');
  const sections = document.querySelectorAll('.section[id]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40px 0px -60% 0px', threshold: 0 });

  sections.forEach(sec => observer.observe(sec));
});
