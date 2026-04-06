// options.js - 設定頁面邏輯

document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("apiKey");
  const toggleKeyBtn = document.getElementById("toggleKey");
  const geminiApiKeyInput = document.getElementById("geminiApiKey");
  const toggleGeminiKeyBtn = document.getElementById("toggleGeminiKey");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");
  const testGeminiBtn = document.getElementById("testGeminiBtn");
  const maxHistorySelect = document.getElementById("maxHistory");
  const messageDiv = document.getElementById("message");

  const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
  const TEST_MODEL = "MiniMax-M2.7";
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent";

  // 載入現有設定
  await loadSettings();

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

  // 儲存設定（兩個 key 都要儲存）
  saveBtn.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const geminiApiKey = geminiApiKeyInput.value.trim();
    const maxHistory = parseInt(maxHistorySelect.value, 10);

    if (!apiKey) {
      showMessage("請輸入 MiniMax API Key", "error");
      return;
    }

    await chrome.storage.sync.set({
      apiKey,
      geminiApiKey,
      settings: { maxHistory },
    });

    showMessage("設定已儲存", "success");
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
    const { apiKey, geminiApiKey, settings } = await chrome.storage.sync.get([
      "apiKey",
      "geminiApiKey",
      "settings",
    ]);
    if (apiKey) apiKeyInput.value = apiKey;
    if (geminiApiKey) geminiApiKeyInput.value = geminiApiKey;
    if (settings?.maxHistory) maxHistorySelect.value = settings.maxHistory;
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
});
