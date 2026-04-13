# MiniMax AI Chat Extension

串接 MiniMax + Gemini Vision API 的 Chrome 擴充功能，支援側邊欄對話、區域截圖、OCR 文字辨識、翻譯、TTS 語音輸出、歷史紀錄管理。

## 版本

**v1.8.1** (2026-04-13)

## 功能特色

### 對話
- 點擊擴充圖示即可開啟側邊欄進行 AI 對話
- **雙引擎架構**：文字對話走 MiniMax（MiniMax-M2.7），圖片分析走 Gemini（gemini-2.5-flash-lite）

### 圖片 / 視覺分析
- **全頁截圖**：一鍵截取目前分頁畫面
- **區域截圖**：拖曳選取範圍，內建 canvas 裁切 modal
- **圖片上傳**：支援上傳本地圖片
- 截圖/上傳均顯示縮圖標籤（全頁截圖 / 區域截圖 / 上傳 / OCR），送出後 Gemini 分析 → MiniMax 整理輸出

### OCR & 翻譯
- **OCR 文字辨識**：Gemini 提取圖片文字 → MiniMax 整理格式化
- **翻譯模式**：切換按鈕開啟雙向翻譯，支援 10 種語言（中文、英文、日文、韓文、法文、德文、西班牙文、葡萄牙文、俄文、阿拉伯文）

### 語音
- **TTS 語音輸出**：每則訊息旁有小喇叭按鈕，使用 Google Translate TTS 高品質朗讀
- **自動語言偵測**：TTS 依訊息內容自動切換語言（中文/英文/日文/韓文等）

### 歷史紀錄
- 對話 Session 自動保存（最多 50 筆）
- **個別刪除**：每筆紀錄旁有垃圾桶按鈕
- **批次刪除**：選取模式可勾選多筆一次刪除，支援全選
- **重新命名**：點擊編輯圖示可 inline 重新命名 Session
- **釘選**：重要對話釘選置頂，顯示紫色左邊框
- **搜尋**：即時搜尋 Session 名稱或訊息內容，關鍵字高亮

### 斜線指令 /Commands
- 輸入框輸入 `/` 即彈出指令選單，支援鍵盤 ↑/↓/Enter/Tab/Esc 導航
- **內建指令**：`/screenshot`、`/region`、`/ocr`、`/page`、`/new`、`/clear`、`/remember`、`/forget`、`/mode`、`/summarize`
- **自訂指令**：在設定頁面新增模板類型指令，`{input}` 替換為 / 後輸入的文字

### 長期記憶
- `/remember <內容>` 新增記憶，AI 在每次對話時都會記住這些資訊
- `/forget` 開啟記憶管理面板，可刪除個別條目或清空全部
- **AI 自動萃取**（選擇性開啟）：每次對話後自動分析並記住重要使用者事實

### 頁面讀取 Skill
- `/page <問題>` 讀取當前分頁標題、描述與正文（前 8000 字），附加至訊息後送出
- 輸入框上方顯示「已附加頁面內容」chip，可點 × 移除

### 模型與回覆模式
- **模型選擇**：⚡ 快速 / 🔵 一般 / 💻 程式碼，可在對話視窗即時切換
- **回覆模式**：💬 標準 / 🔍 討論模式（多角度推理），支援在設定頁面自訂無限模式
- **預設提示詞**：在設定頁面分別設定一般問答、圖像分析、OCR 的 System Prompt

### 其他
- **複製按鈕**：每則訊息旁新增複製圖示，一鍵複製訊息內容
- API Key 安全儲存在本機（chrome.storage.sync）
- 深色主題 UI 設計

## 安裝方式

1. 開啟 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇 `minimax-chat-extension` 資料夾

## 使用方式

1. 點擊擴充圖示，進入設定頁面
2. 輸入 **MiniMax API Key**（文字對話必填）
3. 輸入 **Gemini API Key**（截圖 / 圖片分析 / OCR / 翻譯必填）
4. 點擊對應的「測試連線」確認 API 可用
5. 儲存設定後即可開始使用

## API Key 取得

- **MiniMax API Key**：至 [MiniMax Platform](https://platform.minimax.chat/) 取得
- **Gemini API Key**：至 [Google AI Studio](https://aistudio.google.com/) 取得

## 開發

```bash
# 安裝依賴
npm install

# 編譯樣式
npm run build:css
```

## 技術架構

- **Manifest V3**：最新 Chrome 擴充功能格式
- **Service Worker**：背景處理 API 請求（MiniMax 文字 / Gemini 圖片分流）
- **Side Panel**：側邊欄 UI
- **Google Translate TTS**：高品質多語言語音輸出，失敗時 fallback 至 Web Speech API
- **TailwindCSS + SCSS**：樣式設計

## Changelog

## [1.8.1] - 2026-04-13
### Fixed
- 新增 `.think-box.hidden { display: none; }` CSS 規則（根本原因：CSS 從未定義此規則，導致 `hidden` class 無效，think-box 始終可見）

## [1.7.9] - 2026-04-13
### Fixed
- 翻譯模式下 `finalizeLiveMessage` 強制隱藏 `.think-box`，確保思考過程不殘留
- 翻譯模式分界線改用 `chatMessages.children.length` 判斷是否有訊息，修正切換時提早 return 的問題

## [1.7.8] - 2026-04-13
### Fixed
- 翻譯模式下串流時 `<think>` 標籤不再顯示在回覆內容（`else` 分支補上 `<think>` 濾除）

## [1.7.7] - 2026-04-13
### Added
- 切換翻譯模式時，聊天區插入分界線（`── 啟動翻譯模式 ──` / `── 關閉翻譯模式 ──`）；空對話不插入

## [1.7.6] - 2026-04-13
### Fixed
- 翻譯模式下不顯示思考過程（串流中 / 完成後均隱藏，也不存入 session）

## [1.7.5] - 2026-04-13
### Fixed
- 翻譯模式下不再觸發自動搜尋「分析問題...」

## [1.7.4] - 2026-04-13
### Fixed
- **`/search` 直接輸入失效**：`handleSend()` 新增指令路由，使用者直接在輸入框打 `/search <關鍵字>` 按 Enter，現在會正確觸發搜尋流程，而非把指令當普通訊息送給 AI

## [1.7.3] - 2026-04-13
### Fixed
- `/search` 搜尋失敗時顯示具體原因（Brave API Key 無效、429 超量、空結果等），不再靜默失敗
- Brave API 非 ok 狀態碼（401/403/429）現在正確回報錯誤，而非誤判為「NO_KEY」
- 搜尋成功但結果為空時回傳 `success: false`，避免 AI 拿到空 context 後誤說「沒有搜尋功能」
- 搜尋成功後顯示「找到 N 筆結果，分析中...」，確認搜尋有效觸發

## [1.7.2] - 2026-04-12
### Added
- **訊息連結可點擊**：AI 回覆中的 bare URL（`https://...`）與 Markdown 連結（`[文字](url)`）自動轉為可點擊的 `<a>` 標籤，點擊在新分頁開啟
- 連結樣式：紫色底線，hover 降低透明度

## [1.7.1] - 2026-04-12
### Fixed
- **思考過程持久化**：`thinkContent` 現在會隨 session message 一起存入 storage；從歷史紀錄載入 session 時，有思考過程的訊息會顯示可折疊的「思考過程」區塊（預設收合）
- **思考過程 scrollbar 置底**：串流進行中，think-body 內容增加時自動捲到底部

## [1.7.0] - 2026-04-12
### Fixed
- **搜尋關鍵字精修升級**：`refineQuery` 現在會將使用者完整原始訊息作為上下文傳入，幫助 AI 正確辨識品牌/平台名稱的拼字錯誤（如 `zerbur` → `Zeabur`）；prompt 也加入品牌辨識指引

## [1.6.9] - 2026-04-12
### Added
- **搜尋關鍵字精修**：搜尋前額外呼叫一次 AI 修正錯字、補全縮寫、優化為 Google 搜尋格式（如 `gemm4` → `Gemma 4 Google AI`）
- 狀態列顯示修正前後對比（如「🔍 已搜尋：gemm4 → Gemma 4 Google AI`）；若關鍵字未變動則只顯示最終關鍵字

## [1.6.8] - 2026-04-12
### Fixed
- 自動搜尋分類呼叫加入 `globalPrompt`，確保分類器遵循使用者的語言設定（如繁體中文）
- 新增明確搜尋意圖偵測：訊息以「搜尋」「搜索」「查詢」「search」等開頭時直接跳過分類、強制執行搜尋
- 改善 NO 判斷：支援「不需要」「不用」「否」等中文回覆，不再只依賴英文 NO

## [1.6.7] - 2026-04-12
### Added
- **AI 自主搜尋**：有設定 Brave/Exa API Key 時，每次送出訊息前自動判斷是否需要即時網路資訊；需要時自動搜尋並將結果注入 context，狀態列顯示「🔍 分析問題...」→「🔍 已搜尋：xxx」
- 一次 API 呼叫同時完成「判斷需不需要搜尋」+「萃取搜尋關鍵字」，最大化效率；純文字訊息且有 Search Key 才觸發，截圖/圖片問答不觸發
### Fixed
- 中文輸入法（IME）組字期間按 Enter 誤送訊息：加入 `e.isComposing` 判斷，第一次 Enter 確定選字，第二次 Enter 才送出

## [1.6.6] - 2026-04-12
### Fixed
- 指令選單 Tab 補全行為：有參數的指令（`/search`、`/remember`）按 Tab 只補全 trigger 並保留游標，讓使用者繼續輸入參數；無參數的指令（`/page`、`/clear`、`/new`）Tab 仍直接執行

## [1.6.5] - 2026-04-12
### Fixed
- 停止按鈕點擊後游標持續閃爍、icon 未復原：根本原因是 Chrome Extension 中自己呼叫 `port.disconnect()` 不會觸發自己的 `port.onDisconnect`（只觸發對方的），導致 `resetLoading()` 永遠不執行
- 改為在 click handler 中直接清理狀態（`setStreamingMode(false)`、移除游標、保留已生成內容）
- `onDisconnect` 改為只處理意外斷線錯誤，不再負責主動停止的清理

## [1.6.4] - 2026-04-12
### Fixed
- 停止按鈕圖示錯亂：SVG 使用 CSS `.hidden` class 無效（sidepanel 未定義全域規則），改用 `style.display` 控制顯示/隱藏
- 停止按鈕無法點擊：`handleSend` 開頭設了 `sendBtn.disabled = true`，在 `setStreamingMode(true)` 之前就鎖住按鈕，移除該行改由 `setStreamingMode` 統一管理
- 新增 `if (isLoading) return` guard 防止串流中重複送出

## [1.6.3] - 2026-04-12
### Added
- **停止按鈕**：串流回覆中 Send 按鈕變為停止按鈕（■），點擊可中止生成；已輸出的內容保留為完整訊息存入歷史
- **Web 搜尋 `/search`**：輸入 `/search 關鍵字` 即時搜尋網路並由 AI 整合分析回覆；Brave Search 優先，Exa 備用
- 設定頁新增 Brave Search API Key 與 Exa Search API Key 欄位
- manifest host_permissions 新增 `api.search.brave.com` 與 `api.exa.ai`
### Changed
- 預設 `/` 指令精簡為 `/page`、`/clear`、`/new`、`/remember`、`/search`，移除 `/screenshot`、`/region`、`/ocr`、`/forget`、`/mode`、`/summarize`

## [1.6.2] - 2026-04-12
### Changed
- **設定頁長期記憶區塊簡化**：移除「管理記憶條目」按鈕、「清空全部記憶」按鈕及內嵌記憶清單，改由側邊欄資料庫統一管理；設定頁僅保留「AI 自動萃取記憶」開關

## [1.6.1] - 2026-04-12
### Changed
- **長期記憶跨裝置同步**：`memories` 改存 `chrome.storage.sync`，登入相同 Google 帳號即可跨裝置同步；長期記憶上限從 50 筆調整為 30 筆（符合 sync 8KB/key 限制）
- **分類跨裝置同步**：`categories`（長期記憶 / 知識庫 / 單字簿三資料庫的分類）改存 `chrome.storage.sync`
- **storage.onChanged 加入 area 篩選**：sync area 處理長期記憶與設定，local area 處理知識庫、單字簿、總結，避免跨 area 誤觸發
- 首次啟動自動遷移：原本存於 `local` 的 `memories` / `categories` 自動搬至 `sync` 並清除 `local` 舊資料

## [1.6.0] - 2026-04-12
### Added
- **立即翻譯**：反白文字 → 右鍵「立即翻譯」，Shadow DOM 懸浮視窗顯示原文 / 譯文，含複製按鈕；中文 → 英文，其他語言 → 繁體中文；Esc / 點擊外部關閉
- **右側工具列**：Chatbox 右側新增垂直工具列，包含「立即總結」與「管理總結」按鈕
- **立即總結**：點擊後 AI 串流生成當前對話摘要（不加入對話歷史），結果在聊天區顯示並儲存至 `sessionSummaries`
- **管理總結 Modal**：列出當前 Session 所有總結；每筆可「加入長期記憶」或刪除
- 總結 Modal：折疊預覽（3行截斷）+ 點擊展開完整摘要，展開/折疊動畫
- 總結 Modal：每筆總結均有「加入長期記憶」與「加入知識庫」按鈕（折疊/展開皆顯示）
- 加入知識庫：總結直接以 `status: 'ready'` 存入，無需 AI 分析
- Storage 新增 `sessionSummaries` 欄位（`{ [sessionId]: [{ id, text, createdAt, addedToMemory, addedToKb }] }`）
- `storage.onChanged` 監聽 `sessionSummaries`，Modal 開著時自動同步
- **翻譯懸浮視窗**新增 TTS 朗讀按鈕，播放目標語言語音；再次點擊停止；關閉視窗自動停止
- **content/translate-popup.js**：新增 `content_scripts` 宣告；動態注入 fallback（`executeScript`）確保既有分頁也能顯示翻譯視窗
### Fixed
- 翻譯懸浮視窗定位錯誤：`getBoundingClientRect()` 已是 viewport 座標，移除多餘的 `scrollY/scrollX` offset，修復捲動後視窗跑到螢幕外的問題
- 長期記憶 / 知識庫 / 單字簿刪除後資料重複顯示：async render 函式因 `storage.onChanged` 與 delete handler 同時觸發導致 `appendChild` 競爭；加入版本計數器 guard，stale render 直接 abort

## [1.5.9] - 2026-04-11
### Added
- Header 新增「長期記憶」(腦圖示) 與「單字簿」(書圖示) 快速開啟按鈕
- 右鍵選單新增四個項目：「加入長期記憶」「加入單字簿」「加入知識庫」「立即翻譯」（知識庫 / 翻譯待後續批次）
- 長期記憶：顯示加入日期；點擊文字可 inline 編輯（Enter 儲存 / Esc 取消）
- 單字簿 Modal：顯示語言 badge（EN / 中 / 日）、加入日期、朗讀按鈕、複製按鈕；點擊單字可 inline 編輯
- **分類管理**：長期記憶與單字簿均可自訂分類；每個條目可指派分類；Modal 頂部支援分類篩選；分類可新增 / 刪除，刪除時自動清除條目的分類指派
- **知識庫**：Header 新增資料庫圖示按鈕；右鍵「加入知識庫」支援選取文字或整頁擷取；背景 AI 自動生成 summary + tags（status: processing → ready）；Modal 支援標題編輯、分類管理、刪除；輸入 `@` 呼叫 @ palette 搜尋知識庫，選取後注入 `【知識庫參考】` 前置區塊至 AI 訊息；每次送出後 chips 自動清除
- 長期記憶 badge 新增「右鍵」「總結」來源顯示
- `contextMenus` 權限；`vocabulary` 與 `categories` storage 預設值
- `storage.onChanged` 監聽 `memories` / `vocabulary` 變更，右鍵加入後 sidepanel 即時同步

## [1.5.9] - 2026-04-10
### Changed
- 設定頁面：input / textarea / select / 訊息提示框 border-radius 統一加大至 12px，背景改為透明白色 alpha，focus 改為玫紅邊框
- 設定頁面：回覆模式 mode-name / mode-prompt 同步套用一致樣式
- 歷史紀錄：btn-text 加入邊框與 hover 效果，搜尋框 / rename input 改為透明底 + 圓角 10px
- 歷史紀錄：批次刪除按鈕邊框改為透明紅色 alpha

## [1.5.8] - 2026-04-10
### Changed
- UI Phase 3：精緻化
  - Empty State 改為 Greeting Card 風格：玫紅圖示框、大標題、4 個建議 chip（點擊自動填入輸入框）
  - Header 與 Input Area 加入 `backdrop-filter: blur(12px)` 半透明效果
  - Suggestion chip hover 呈現玫紅色調

## [1.5.7] - 2026-04-10
### Changed
- UI Phase 2：HTML 結構重構
  - 工具列與輸入框合併為單一 `input-container`（`border-radius: 20px` 大圓角容器）
  - 工具按鈕移至輸入框底部左側，Send button 移至右下角
  - Send button 改為圓形（`border-radius: 50%`），disabled 時改為淡白色
  - 訊息泡泡 border-radius 加大至 24px
  - 訊息操作按鈕（TTS / Copy）改為 hover 才顯示

## [1.5.6] - 2026-04-10
### Changed
- 整體主色由紫色（#8B5CF6）改為玫紅色（#EC2970），暗色版 #d01f62
- 同步替換所有硬碼的紫色 rgba 值（sidepanel.css + options.css 共 12 處）

## [1.5.5] - 2026-04-10
### Changed
- UI Phase 1：整體色彩系統對標 Open WebUI 風格
  - 背景色更偏中性黑（`#171717` / `#212121` / `#2a2a2a`）
  - 文字色柔化（`#eeeeee` / `#757575`）
  - 邊框改為極淡透明（`rgba(255,255,255,0.08)`），增強無框感
- User 訊息泡泡改為深灰背景（移除紫色），Assistant 訊息改為透明無背景
- 所有泡泡 border-radius 加大至 20px，視覺更圓潤
- 按鈕 border-radius 統一加大（8→10px / 6→8px）
- Header 加入 box-shadow，border-bottom 改為更淡的透明邊框
- History item hover 改為 `rgba(255,255,255,0.04)` 極淡反白
- 工具列按鈕改為透明背景 + 白色 alpha hover
- Scrollbar 改為更細（5px）、更淡的中性灰
- Command Palette border-radius 加大至 12px，修復 `var(--border)` 未定義 bug
- Memory Modal 修復 `var(--bg-secondary)` / `var(--border)` 未定義 bug，border-radius 改 16px

## [1.5.4] - 2026-04-10
### Changed
- `/page` 指令流程優化：Enter 後指令轉為頁面 chip，再按一次 Enter 可直接送出（無需附帶文字，問題為選填）
- 送出按鈕在 pageContext chip 存在時自動啟用（即使輸入框為空）
- 空訊息使用 /page 時，對話氣泡顯示頁面標題；API 請求省略「使用者問題」欄位

## [1.5.3] - 2026-04-10
### Changed
- 狀態訊息移入聊天對話區底部顯示，不再出現在輸入欄下方（移除 statusText 元素）

## [1.5.2] - 2026-04-10
### Added
- 串流輸出：回覆即時逐字顯示，不再等到完成才出現（Port 長連線 + MiniMax stream:true）
- 思考過程顯示：模型輸出的 `<think>` 內容即時呈現在可折疊的「思考過程」區塊（紫色邊框）
- 多步驟狀態提示：圖片分析、檔案分批處理時，底部顯示「分析圖片中...」等進度文字

## [1.5.1] - 2026-04-10
### Added
- 多格式檔案上傳：除圖片外，新增支援 PDF（→ Gemini 分析）與文字類檔案（.txt/.md/.csv/.json/.js/.ts/.py/.html/.css 等，→ MiniMax 直接分析）
- 混合上傳：可同時上傳圖片/PDF 與文字檔，文字檔內容自動附加至 Gemini 分析提示
- 非圖片檔案顯示專屬圖示縮圖（PDF 紅色、文字類藍色），僅圖片顯示預覽縮圖

## [1.5.0] - 2026-04-09
### Added
- 斜線指令 /Commands：輸入 / 彈出選單，支援內建 10 個指令與使用者自訂模板指令
- 長期記憶：/remember 新增、/forget 管理，跨對話注入 system prompt（優先於全局提示詞）
- AI 自動萃取記憶：可選功能（設定頁開關），對話後自動分析並記住重要事實
- 頁面讀取 Skill：/page 讀取當前分頁內容（8000字）附加至訊息，輸入框顯示 chip 指示
### Changed
- background.js：memory context 作為最高優先注入，優先序 memory > globalPrompt > replyMode > defaultPrompts
- manifest.json：新增 scripting 權限（頁面讀取所需）

## [1.4.7] - 2026-04-08
### Changed
- 翻譯模式語言選擇器中間的箭頭圖示改為水平雙向箭頭（⇄）

## [1.4.6] - 2026-04-08
### Fixed
- 跨分頁截圖失敗：直接從 Side Panel 呼叫 captureVisibleTab，不再透過 Service Worker，解決 activeTab 失效問題
- Markdown 程式碼區塊（`<pre>`）溢出導致 UI 跑版：新增 `overflow-x: auto` 與 `max-width: 100%`
- `.message-content` 改用 `max-width: 100%` 確保訊息區塊不超出容器

## [1.4.5] - 2026-04-08
### Added
- 圖片 Lightbox：點擊訊息中的圖片可全螢幕預覽（Esc / 點遮罩關閉）
- 多圖上傳：截圖/上傳/OCR 均可累積多張圖片一次送出
- Ctrl+V 貼上：可直接在輸入欄貼上剪貼簿圖片
### Changed
- 圖片預覽區改為多縮圖列，每張可獨立移除

## [1.4.4] - 2026-04-08
### Added
- Assistant 訊息支援 Markdown 渲染（標題、粗體、斜體、刪除線、列表、程式碼區塊、表格、分隔線）

## [1.4.3] - 2026-04-08
### Added
- 設定頁面「預設提示詞」新增「全局提示詞」欄位，無論任何回覆模式均最優先套用（含翻譯模式）

## [1.4.2] - 2026-04-08
### Added
- Header 新增「新對話」按鈕（歷史紀錄按鈕左側），點擊即開啟空白對話

## [1.4.1] - 2026-04-08
### Changed
- 設定頁面回覆模式移除 emoji 圖示欄位

## [1.4.0] - 2026-04-08
### Added
- 設定頁面新增「預設提示詞」區塊，可分別設定一般問答、圖像分析、OCR 的 System Prompt
- 設定頁面新增「回覆模式」管理，支援新增/編輯/刪除自訂模式（無上限）
- 對話視窗新增模型選擇器（⚡ 快速 / 🔵 一般 / 💻 程式碼）
- 對話視窗新增回覆模式選擇器（💬 標準 / 🔍 討論模式 / 自訂模式）
- Session 釘選功能：點擊 📌 圖示固定對話在歷史紀錄最上方
- 歷史紀錄搜尋：即時搜尋 Session 名稱或訊息內容，搜尋結果關鍵字高亮
- 訊息複製按鈕：每則訊息新增複製圖示，點擊複製純文字內容

## [1.3.1] - 2026-04-06
### Fixed
- 標記工具列文字工具：輸入框改為白底黑框，取消灰底
- 文字確認後 canvas 上不再繪製灰色背景矩形，直接以選取顏色渲染文字

## [1.3.0] - 2026-04-06
### Added
- Session 批次刪除：選取模式、全選/取消全選、一次刪除多筆
- OCR 支援全頁截圖與區域截圖（原本只限上傳圖片）
### Changed
- TTS 改用 Google Translate TTS endpoint，音質與瀏覽器版 Google 翻譯一致
- TTS 語言自動偵測：依訊息內容（Unicode 字元範圍）切換語言，不再固定使用英文
### Fixed
- AI 回覆 TTS 語言錯誤：翻譯關閉時改用 sourceLang，不再固定為 targetLang
- 歷史 Session 載入時 TTS 語言改用 detectLang() 自動偵測

## [1.2.0] - 2026-04-06
### Added
- 區域截圖：拖曳選取範圍 + canvas 裁切 modal
- OCR 文字辨識：Gemini 提取 → MiniMax 整理格式化
- 翻譯模式：支援 10 種語言雙向翻譯
- TTS 語音輸出：每則訊息旁新增小喇叭按鈕（Web Speech API）
- Session 個別刪除與 inline 重新命名
- 圖片模式縮圖標籤（全頁截圖 / 區域截圖 / 上傳 / OCR）
### Fixed
- Sidebar 跨頁面錯誤：改用 windowId + setOptions 確保每次開啟正確綁定

## [1.1.0] - 2026-04-06
### Added
- Gemini Vision 雙引擎架構（文字 MiniMax / 圖片 Gemini）
- 全頁截圖與圖片上傳功能
- 雙 API Key 設定（MiniMax + Gemini）

## [1.0.0] - 2026-04-06
### Added
- 初始版本：MiniMax AI Chat Chrome Extension

## License

MIT
