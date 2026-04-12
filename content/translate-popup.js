// content/translate-popup.js
// Shadow DOM 隔離翻譯懸浮視窗，避免頁面 CSS 污染

// 防止 executeScript 重複注入時初始化兩次
if (window.__minimaxTranslateLoaded) {
  // 已有 listener，不重複初始化
} else {
window.__minimaxTranslateLoaded = true;

(function () {
  let popupHost = null;
  let shadowRoot = null;
  let currentAudio = null;
  let ttsBtn = null;

  // ── 語言顯示名稱 ──────────────────────────────────────────
  const LANG_NAMES = {
    'zh-TW': '繁體中文',
    'zh-CN': '簡體中文',
    'en': '英文',
    'ja': '日文',
    'ko': '韓文',
    'fr': '法文',
    'de': '德文',
    'es': '西班牙文',
    'auto': '自動偵測'
  };

  function getLangName(code) {
    return LANG_NAMES[code] || code;
  }

  // ── 取得選取文字的螢幕位置 ────────────────────────────────
  function getSelectionRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    return sel.getRangeAt(0).getBoundingClientRect();
  }

  // ── 建立 Shadow DOM 容器 ──────────────────────────────────
  function createHost() {
    const host = document.createElement('div');
    host.id = 'minimax-translate-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;top:0;left:0;';
    document.body.appendChild(host);
    return host;
  }

  // ── CSS 樣式（Shadow DOM 內） ──────────────────────────────
  const STYLES = `
    :host { all: initial; }

    .popup {
      position: fixed;
      z-index: 2147483647;
      pointer-events: all;
      background: #1e1e1e;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3);
      min-width: 240px;
      max-width: 360px;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      color: #eeeeee;
      overflow: hidden;
      animation: popup-in 0.15s ease;
    }

    @keyframes popup-in {
      from { opacity: 0; transform: translateY(-6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 6px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    .popup-langs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #757575;
    }

    .popup-lang-badge {
      background: rgba(255,255,255,0.06);
      border-radius: 4px;
      padding: 2px 7px;
      color: #aaaaaa;
      font-weight: 500;
    }

    .popup-lang-arrow {
      color: #555;
    }

    .popup-close {
      background: transparent;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 2px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      transition: color 0.15s, background 0.15s;
      line-height: 1;
    }
    .popup-close:hover { color: #eee; background: rgba(255,255,255,0.07); }

    .popup-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }

    .popup-original {
      font-size: 12px;
      color: #888;
      line-height: 1.5;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .popup-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.06);
      margin: 0;
    }

    .popup-translated {
      font-size: 13px;
      color: #eeeeee;
      line-height: 1.6;
      word-break: break-word;
      font-weight: 400;
    }

    .popup-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      padding: 0 12px 10px;
    }

    .popup-btn {
      font-size: 11px;
      border-radius: 6px;
      padding: 3px 10px;
      cursor: pointer;
      transition: background 0.15s;
      white-space: nowrap;
      border: 1px solid;
    }
    .popup-btn-copy {
      color: #aaa;
      background: rgba(255,255,255,0.04);
      border-color: rgba(255,255,255,0.1);
    }
    .popup-btn-copy:hover { background: rgba(255,255,255,0.09); color: #eee; }
    .popup-btn-copy.copied { color: #10b981; border-color: rgba(16,185,129,0.35); background: rgba(16,185,129,0.08); }

    .popup-btn-tts {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      color: #aaa;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
      flex-shrink: 0;
    }
    .popup-btn-tts:hover { background: rgba(255,255,255,0.09); color: #eee; }
    .popup-btn-tts.speaking {
      color: #EC2970;
      border-color: rgba(236,41,112,0.4);
      background: rgba(236,41,112,0.08);
    }
    @keyframes pulse-tts {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .popup-btn-tts.speaking svg { animation: pulse-tts 1.2s ease infinite; }

    .popup-loading {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #666;
      font-size: 12px;
      padding: 8px 0;
    }
    .popup-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.1);
      border-top-color: #EC2970;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  // ── 計算 popup 位置（選取範圍正下方，不超出視窗） ──────────
  // getBoundingClientRect() 已是 viewport 座標，position:fixed 直接使用，不加 scroll offset
  function calcPosition(rect) {
    const GAP = 8;
    const POP_W = 360;
    const POP_H = 170;

    let top = rect.bottom + GAP;
    let left = rect.left;

    // 右側超出視窗
    if (left + POP_W > window.innerWidth - 12) {
      left = window.innerWidth - POP_W - 12;
    }
    left = Math.max(left, 8);

    // 下方空間不足時改顯示在選取範圍上方
    if (top + POP_H > window.innerHeight - 8) {
      top = rect.top - POP_H - GAP;
      if (top < 8) top = 8; // 上方也不夠就貼頂
    }

    return { top, left };
  }

  // ── 顯示 popup ─────────────────────────────────────────────
  function showPopup(data) {
    removePopup();

    const rect = getSelectionRect();
    const pos = rect ? calcPosition(rect) : { top: 100, left: Math.max((window.innerWidth - 360) / 2, 8) };

    // 建立 Shadow DOM host
    popupHost = createHost();
    shadowRoot = popupHost.attachShadow({ mode: 'closed' });

    // 注入樣式
    const style = document.createElement('style');
    style.textContent = STYLES;
    shadowRoot.appendChild(style);

    // 建立 popup 元素
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.style.cssText = `top:${pos.top}px;left:${pos.left}px;`;

    const fromName = getLangName(data.from);
    const toName = getLangName(data.to);

    popup.innerHTML = `
      <div class="popup-header">
        <div class="popup-langs">
          <span class="popup-lang-badge">${fromName}</span>
          <span class="popup-lang-arrow">→</span>
          <span class="popup-lang-badge">${toName}</span>
        </div>
        <button class="popup-close" title="關閉 (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="popup-body">
        <div class="popup-original">${escapeHtml(data.original)}</div>
        <hr class="popup-divider">
        <div class="popup-translated">${escapeHtml(data.translated)}</div>
      </div>
      <div class="popup-footer">
        <button class="popup-btn-tts" id="ttsBtn" title="朗讀譯文" data-text="${escapeAttr(data.translated)}" data-lang="${data.to}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
        <button class="popup-btn popup-btn-copy" data-text="${escapeAttr(data.translated)}">複製譯文</button>
      </div>
    `;

    // 關閉按鈕
    popup.querySelector('.popup-close').addEventListener('click', removePopup);

    // TTS 按鈕
    ttsBtn = popup.querySelector('#ttsBtn');
    ttsBtn.addEventListener('click', async () => {
      // 再次點擊 → 停止
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        ttsBtn.classList.remove('speaking');
        return;
      }
      const text = ttsBtn.dataset.text;
      const lang = ttsBtn.dataset.lang || 'zh-TW';
      if (!text) return;

      ttsBtn.classList.add('speaking');
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TTS_FETCH',
          data: { text, lang }
        });
        if (!response?.success) throw new Error(response?.error || 'TTS 失敗');

        const audio = new Audio(`data:audio/mpeg;base64,${response.base64}`);
        currentAudio = audio;
        audio.onended = () => {
          currentAudio = null;
          ttsBtn?.classList.remove('speaking');
        };
        audio.onerror = () => {
          currentAudio = null;
          ttsBtn?.classList.remove('speaking');
        };
        await audio.play();
      } catch {
        currentAudio = null;
        ttsBtn.classList.remove('speaking');
      }
    });

    // 複製按鈕
    popup.querySelector('.popup-btn-copy').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(btn.dataset.text);
        btn.textContent = '已複製';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = '複製譯文';
          btn.classList.remove('copied');
        }, 1800);
      } catch {}
    });

    shadowRoot.appendChild(popup);
  }

  // ── 移除 popup ─────────────────────────────────────────────
  function removePopup() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    ttsBtn = null;
    if (popupHost) {
      popupHost.remove();
      popupHost = null;
      shadowRoot = null;
    }
  }

  // ── 工具函式 ──────────────────────────────────────────────
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(text) {
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── 監聽來自 background 的訊息 ────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SHOW_TRANSLATE_POPUP') {
      showPopup(message.data);
    }
  });

  // ── 點擊外部關閉 ──────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (popupHost && !popupHost.contains(e.target)) {
      removePopup();
    }
  }, true);

  // ── Esc 關閉 ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popupHost) {
      removePopup();
    }
  });
})();

} // end if (!window.__minimaxTranslateLoaded)
