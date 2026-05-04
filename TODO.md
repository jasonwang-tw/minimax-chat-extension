# Open Chat Hub — TODO

## Done

- Installed `wordpress/minimax-sync` on `https://jasonsbase.com`
- Activated the `Open Chat Hub Sync Bridge` plugin
- Confirmed WordPress registration flow for self-service signup
- Reloaded Chrome extension on branch `codex/plan-synchronization-for-settings-and-data`
- Verified `設定 > 同步` WordPress login flow (`使用 WordPress 登入`)
- Verified manual backup flow (`立即備份設定`)
- Verified restore flow (`從雲端還原`) after local settings changes
- Verified admin page `Settings > Open Chat Hub Sync`:
  - recent backups
  - active tokens
  - revoke action
- Completed hardening/fixes during validation:
  - token header fallback support (`Authorization` + `X-Minimax-Token`)
  - fallback backup method (`POST` with `PUT` fallback)
  - plugin-local debug log (`wp-content/plugins/minimax-sync/minimax-sync-debug.log`)
  - WordPress compatibility fix (remove dependency on `WP_REST_Request::set_attribute`)
  - admin time display in `Asia/Taipei`
  - token management cleanup UI (`Delete` revoked token / bulk cleanup revoked tokens)

## Done (v1.14.x)

- Improved sync section UI: hide login button after login, show backup/restore/logout only when authorized
- Removed daily scheduled backup (replaced by instant backup on storage change with 5s debounce)
- Fixed geminiApiKey / braveApiKey / exaApiKey missing from auto-backup watch list
- Removed reply modes feature
- Structured long-term memory format (title / summary / tags)
- Added chatSessions to instant backup scope
- Added "auto-restore on startup" option

## Done (v1.15.0)

- Input char counter: show count at 1000+, orange warning at 3000+, red pulse at 5000+
- Auto history compression: when history exceeds token budget, summarize oldest turns via MiniMax (200-char summary in zh-TW), inject into system prompt
- Compression result cached in sessionSummaries (auto: true, coveredUpTo index) to avoid re-summarizing on next turn
- Compression notification shown in status bar when triggered
- Context window API error now shows friendly Chinese message

## Done (v1.16.x)

- Added in-chat search (`Ctrl/Cmd+F`) with highlight, match count, next/previous navigation, and Esc close
- Added message queue while streaming: users can keep typing, queued messages run sequentially after the current response
- Redesigned queue panel as a collapsible panel above the input area with per-item delete controls
- Added local JSON backup export/import for settings and prompts
- Migrated `customCommands` from `chrome.storage.sync` to `chrome.storage.local` to avoid the 8KB sync limit
- Fixed backup restore compatibility for wrapped WordPress payloads and older top-level payload formats
- Removed `chatSessions` and `sessionSummaries` from cloud backup payload scope to avoid WordPress payload-too-large failures

## Done (v1.17.x)

- Added side-panel TOC button and `Ctrl+Alt+T` shortcut; scans assistant headings and smooth-scrolls to h1-h4 sections
- Added image lightbox left/right navigation with keyboard arrow support and image counter
- Improved Markdown rendering for quiz choices, grammar labels, fill-in blanks, and ordered-list continuation
- Added keyboard shortcuts section in settings page
- Polished queue panel visual style

## Done (v1.18.x)

- Knowledge Base summaries are expandable/collapsible with 2-line default truncation and chevron state

## Done (v1.19.x)

- Completed AI Agent Tool Use Phase 1:
  - non-streaming agent loop with final streaming answer
  - MiniMax XML tool-call parser
  - `web_search` / `deep_search` tool routing
  - Brave/Exa fallback behavior
  - current-date injection in agent system prompt
- Removed old sidepanel `AUTO_SEARCH` pre-check from the main path; search is now decided by the agent loop in `background.js`
- Added Agent status UI:
  - live status row with current tool action
  - persistent collapsible search history block above final answer
  - result counts from `tool_done`
- Fixed search history persistence when switching sessions

## Done (v1.20.x)

- Added OpenRouter integration:
  - API key setting
  - OpenRouter host permission
  - chat and agent routing through OpenRouter when a non-MiniMax model is selected
  - OpenRouter usage/cost tracking from model pricing metadata
- Added OpenRouter settings to backup scope

## Done (v1.21.x)

- Added side-panel model picker pill:
  - MiniMax default option
  - custom OpenRouter model list
  - model pricing/context metadata display
  - sorting controls in picker
- Added settings-page custom OpenRouter model management with unlimited entries
- Added hardcoded popular OpenRouter presets including Grok 3 / Grok 3 Mini
- Changed settings page from anchor-scroll TOC to multi-page section switching with fade animation
- Changed settings save feedback to bottom-right floating toast
- Changed background provider routing to use selected model ID rather than legacy `openrouterModel`
- Fixed model picker refresh behavior and removed unnecessary OpenRouter key requirement for displaying custom models

## Done (v1.22.x)

- Added a unified chat attachment model while preserving legacy `images` / `fileInfos` compatibility.
- Added OpenRouter image output attachment extraction and chat rendering.

## Done (v1.23.x)

- Added dynamic Context window UI:
  - model-aware `contextLength` display from OpenRouter metadata
  - MiniMax M2.7 fallback at 200k tokens
  - send-time `contextCharBudget` propagation to background history trimming
- Added Claude-style page context workflow:
  - `/page` attaches current page context immediately
  - `/page-code` attaches HTML/CSS/style context as a page chip with `分析程式碼與樣式`
  - new conversations can auto-attach current page context
- Added unified context chip styling:
  - action/page chips share one `context-chip-row`
  - knowledge chips share height/spacing with action chips
  - knowledge chip color tokens promoted to global CSS variables
  - knowledge palette spacing adjusted (`bottom: calc(100% + 10px)`, `margin: 0 10px`)
- Added slash command matching in the middle of text:
  - triggers only after start/whitespace
  - ignores URLs and path-like text
  - replaces only the active slash token
- Added Plan Mode v1:
  - `/plan <task>` command
  - plan generation before tool execution
  - approval card with steps/tools/sites
  - `Approve plan` continues through existing Agent/tool flow
  - high-risk API/SSH tools intentionally not enabled yet

## Done (v1.25.0)

- Plan Approval 計畫模式補完：
  - 新增計畫模式設定（off / auto / always），在設定頁「對話設定」區塊可配置
  - 計畫卡顯示工具風險分級（低/中/高，綠/橘/紅色標示）
  - 計畫卡狀態（pending / approved / cancelled）寫入 session，切換對話後可追蹤歷程
  - `Make changes` 按鈕改為把原始任務帶回輸入框並恢復 `/plan` chip，而非單純取消

## Done (v1.24.x)

- 瀏覽器自動化 Phase 1：8 個 browser_* Agent Tools（click / fill / select / get_text / get_html / scroll / wait_for / navigate）
- `executeBrowserTool()` 使用 `chrome.scripting.executeScript` 直接執行 DOM 操作，相容 React/Vue
- `AGENT_TOOLS_BROWSER` 永遠加入 Agent tools 清單，不依賴搜尋 API Key
- Agent 狀態列與操作歷程面板新增瀏覽器工具圖示（🖱 ✏️ 🌐 等）
- `toolDisplayQuery()` helper 讓 tool_start 顯示有意義的 selector / URL / 方向資訊

---

## 待議事項

- [x] **品牌名稱重新評估**：採用 `Open Chat Hub` 作為公開產品名，保留 MiniMax 作為預設模型/provider 名稱。
- [x] **版本資訊整理**：README、manifest、package.json、package-lock.json 統一為 `1.22.0`。
- [x] **備份範圍文件一致性**：README 改寫為目前實作狀態，雲端備份不再宣稱包含 `chatSessions/sessionSummaries`。

---

## 開發優先度總覽

| 優先度 | 功能 | 說明 |
|--------|------|------|
| ✅ Done | AI Agent Loop 基礎建設 | 完成於 v1.19.x |
| 🔵 P4 | MiniMax 圖像生成 | 需 Plus 方案（$20/月）；升級方案後再實作 |
| 🟠 P1 | AI 設定 & 記憶工具 | 搭配 Agent Loop |
| ✅ Done | Plan Approval / 計畫模式 | 完成於 v1.25.0（含 off/auto/always 設定、風險分級、持久化、Make changes 回填） |
| ✅ Done | 瀏覽器自動化 Phase 1 | 完成於 v1.24.x |
| ✅ Done | API Tool Registry | 完成於 v1.26.0 |
| 🟠 P1 | SSH / Server Tool | Native Messaging 或後端 proxy，強制 Plan Approval |
| 🔵 P4 | MiniMax TTS 升級 | 需 Plus 方案（$20/月）；升級方案後再實作 |
| 🟠 P1 | System Prompt 壓縮 | M2.7 200k token 充分利用 |
| 🟡 P2 | 瀏覽器自動化 Phase 2 | chrome.debugger CDP（截圖、JS 執行、網路攔截） |
| 🟡 P2 | 任務腳本（Task Script） | 長任務腳本化，搭配 Agent |
| 🟡 P2 | 筆記工具（MD Notes） | write/read/list note |
| 🟡 P2 | 多模型並排比較 | 同一 prompt 同時送到 2-3 個模型，並排比較回覆品質、速度與成本 |
| 🟡 P2 | Spaces 多空間 | tab-based 切換，搭配多窗口策略 |
| 🟡 P2 | 部落格助手 | jasonsbase-blog 實裝 |
| 🟢 P3 | 瀏覽器自動化 Phase 3 | Native Messaging + Playwright（完整多 tab 自動化） |
| 🟢 P3 | MiniMax 影片生成 | 需 Max 方案（$50/月）；非同步任務，複雜度高 |
| 🔵 P4 | Skill 執行工具 | run_skill；Agent Loop + API Tool 已夠用，只有需要「保證固定步驟的可重複流程」時才有額外價值 |
| 🟢 P3 | 財經功能 | /stock、/twstock、/news |
| 🔵 P4 | MiniMax 音樂生成 | 需 Max 方案（$50/月）；較小眾 |
| 🔵 P4 | 自動化 Gmail Digest | chrome.alarms + chrome.identity |
| 🔵 P4 | Token lifecycle policy | expiration / rotation / cleanup |
| 🔵 P4 | Encrypted backup | 設定備份加密 |
| 🔵 P4 | Backup version history | 備份版本記錄 |
| 🔵 P4 | PHP lint/test | 需有 php 環境的機器執行 |

---

## 開發優先度項目詳細說明

### 🔴 P0 — AI Agent Loop 基礎建設

讓模型不只是一次性回答，而是可以在回答前自行判斷是否需要使用工具、呼叫工具、讀取工具結果，再整合成最終答案。

主要工作：
- 維護 `streamAgentChat()` 的多輪 tool loop。
- 統一 `tool_start` / `tool_done` / `agent_notice` 前後端事件格式。
- 支援 OpenRouter tool calling 與 MiniMax XML tool call 兩種格式。
- 確保 tool use 失敗時能 fallback 到一般 streaming。

完成標準：
- AI 可以穩定自行調用 `web_search` / `deep_search`。
- 搜尋歷程可在 UI 中追蹤。
- 工具失敗不會中斷整個對話。

### 🔵 P4 — MiniMax 圖像生成

把 MiniMax Image API 接進聊天側邊欄，讓使用者可以用文字直接生成圖片，或讓 AI 在合適場景自行調用圖片生成 tool。

主要工作：
- 新增 `/image <描述>` 指令。
- 建立 `generate_image` tool。
- 支援尺寸、比例、張數等參數。
- 將生成結果以附件形式顯示在聊天訊息中。

完成標準：
- 使用者能在側邊欄輸入 prompt 並取得圖片。
- 圖片可預覽、放大、下載或複製。
- API 錯誤有清楚提示。

### 🟠 P1 — AI 設定 & 記憶工具

讓 AI 可以在受控白名單內讀取或修改使用者設定，並主動儲存長期記憶。這不是讓 AI 任意修改所有設定，而是只開放低風險、可回復的項目。

主要工作：
- 新增 `get_setting(key)` tool。
- 新增 `set_setting(key, value)` tool。
- 新增 `save_memory(title, summary, tags)` tool。
- 建立設定白名單，例如模型、語言、global prompt、default prompts。
- 禁止 AI 讀取或修改 API key、同步 token、授權資訊。

完成標準：
- AI 可以根據對話幫使用者調整非敏感設定。
- AI 可以把明確偏好保存成長期記憶。
- 所有設定修改都有 UI 提示或確認流程。

### 🟠 P1 — Plan Approval / 計畫模式

在 AI 執行工具前先產生計畫，讓使用者確認工具、站點、步驟與風險後才允許執行。這是 API/SSH 等高風險工具的前置安全機制。

主要工作：
- 完善 `/plan <task>`。
- 新增 `off / auto / always` 計畫模式設定。
- Plan card 顯示工具、站點、步驟、風險、批准/取消狀態。
- `Make changes` 支援把計畫帶回輸入框修改。
- 將批准紀錄寫入 session，方便回溯。

完成標準：
- 使用者可以在執行前看懂 AI 準備做什麼。
- 未批准前不會執行高風險工具。
- 批准後能沿用同一份原始 request 繼續執行。

### ✅ Done — API Tool Registry（v1.26.0）

建立一套可管理的 HTTP API 工具系統，讓 AI 能在受控條件下呼叫外部 API。這會作為 WordPress、第三方 SaaS、內部服務整合的基礎。

主要工作：
- 定義 tool registry schema：name、description、parameters、risk、auth、host allowlist。
- 支援 read-only API tool，例如 GET 查詢資料。
- 支援 write API tool，但必須強制 Plan Approval。
- 管理 API key / Bearer token / custom headers。
- 限制 response 大小，避免 context 爆量。

完成標準：
- 可以新增一個 API tool 並讓 AI 調用。
- secret 不會暴露給模型。
- API 寫入類操作一定需要使用者批准。

### 🟠 P1 — SSH / Server Tool

讓 AI 可以透過受控橋接方式操作伺服器任務，例如清快取、查容量、列排程。Chrome extension 不能直接 SSH，所以需要 Native Messaging 或後端 proxy。

主要工作：
- 評估 Native Messaging host 與 server-side proxy。
- 定義 SSH command template，而不是讓模型輸入任意 shell。
- 建立 host allowlist 與命令白名單。
- 所有 SSH tool 強制走 Plan Approval。
- 記錄執行審計：主機、工具、參數、時間、結果摘要。

完成標準：
- AI 只能執行預先允許的伺服器任務。
- 使用者能在執行前看到目標主機與操作內容。
- 任務執行結果會回傳到聊天並留存摘要。

### 🔵 P4 — MiniMax TTS 升級

用 MiniMax TTS 取代目前 Google TTS fallback，提供更自然的語音與更多聲音設定。

主要工作：
- 新增 MiniMax TTS API 設定。
- 建立聲音選擇 UI。
- 支援訊息朗讀、語言判斷、錯誤 fallback。
- 評估串流 TTS 以降低首字延遲。

完成標準：
- 使用者可以選擇聲音。
- 點訊息朗讀可使用 MiniMax TTS。
- API 不可用時仍有合理 fallback。

### 🟠 P1 — System Prompt 壓縮

避免 global prompt、default prompts、memory context 過長，佔用模型 context window，導致對話歷史或使用者輸入被過早裁切。

主要工作：
- 監控 system prompt / memory context 長度。
- 超過門檻時進行摘要壓縮。
- 顯示目前 system prompt 佔用量。
- 讓壓縮結果可檢視或重建。

完成標準：
- 長期使用後不會因 system prompt 膨脹導致 context 不足。
- 使用者能知道 context 主要被哪些區塊佔用。

### 🟡 P2 — 任務腳本（Task Script）

讓使用者預先定義多步驟任務流程，AI 可按步驟執行，適合長任務、固定 SOP、內容生產流程。

主要工作：
- 定義 script schema：name、steps、tools、success criteria。
- 新增 `run_script(name)` tool。
- 建立腳本管理 UI。
- 內建常用模板，例如文章生成、頁面分析、code review。

完成標準：
- 使用者可以建立、編輯、執行一個多步驟腳本。
- AI 能逐步回報進度與結果。

### 🟡 P2 — 筆記工具（MD Notes）

提供簡單 Markdown 筆記系統，讓 AI 和使用者可以寫入、讀取、列出筆記，作為長任務的中間成果保存。

主要工作：
- 新增 `write_note(filename, content)`。
- 新增 `read_note(filename)`。
- 新增 `list_notes()`。
- 建立筆記列表與預覽 UI。

完成標準：
- AI 可以把研究結果或草稿保存成 Markdown。
- 使用者可以在側邊欄檢視與複用筆記。

### 🟡 P2 — Spaces 多空間

建立多個獨立工作空間，讓不同任務有不同對話 context，例如規劃、執行、筆記分開管理。

主要工作：
- tab-based space 切換。
- 每個 space 有獨立 session/context。
- 長期記憶可跨 space 共用。
- 支援 space 命名、刪除、排序。

完成標準：
- 使用者可以把不同任務隔離在不同 space。
- 切換 space 不會混用聊天歷史。

### 🟡 P2 — 部落格助手

把 jasonsbase-blog 的文章工作流實裝到側邊欄，支援選題、研究、問答、生成、預覽與 WordPress 發布。

主要工作：
- 新增 `/blog` 入口。
- 支援多種文章模式。
- 接 WordPress REST API 建立/讀取/更新文章。
- 產生 Markdown 或 HTML 預覽。
- 發布前使用者確認。

完成標準：
- 可以從側邊欄完成一篇文章從規劃到發布的流程。
- WordPress API 寫入前有明確確認。

### 🟢 P3 — MiniMax 影片生成

接入 MiniMax Video API，支援文字生成影片。因為影片通常是非同步任務，所以優先度低於圖片。

主要工作：
- `/video <描述>` 指令。
- 任務建立、狀態輪詢、完成通知。
- 顯示影片預覽或下載連結。

完成標準：
- 使用者能建立影片任務並看到完成結果。

### 🟢 P3 — Skill 執行工具

讓 AI 可以調用預先定義的技能流程，例如部落格寫作、頁面分析、翻譯保存等。

主要工作：
- 定義 skill schema。
- 新增 `run_skill(name, params)` tool。
- 建立內建 skill 清單。
- 與 Task Script 或 Plan Approval 整合。

完成標準：
- AI 能根據任務選擇合適 skill。
- skill 執行過程可追蹤與取消。

### 🟢 P3 — 財經功能

提供股票、台股、新聞等查詢能力，可能接 API 或搜尋工具。

主要工作：
- `/stock`、`/twstock`、`/news` 指令。
- 接資料來源 API 或搜尋 fallback。
- 顯示報價、新聞、摘要與來源。

完成標準：
- 使用者可以查詢基本財經資訊。
- 回答包含資料來源與時間。

### 🔵 P4 — MiniMax 音樂生成

接入 MiniMax Music API，支援文字生成音樂或歌詞音樂。使用頻率較低，放在後期。

主要工作：
- `/music <描述>` 指令。
- 支援純音樂與含歌詞模式。
- 任務狀態追蹤與結果播放。

完成標準：
- 使用者能從 prompt 生成可播放音訊。

### 🔵 P4 — 自動化 Gmail Digest

定時整理 Gmail 摘要，例如每日摘要、重要郵件提醒。需要處理 Google OAuth 與排程。

主要工作：
- chrome.identity OAuth。
- chrome.alarms 排程。
- 郵件摘要與分類。
- 使用者確認後才執行標記、封存等動作。

完成標準：
- 使用者能定時收到 Gmail 摘要。
- 不會在未確認下改動郵件狀態。

### 🔵 P4 — Token lifecycle policy

定義 WordPress sync token 的生命週期，包括過期、輪替、撤銷與清理。

主要工作：
- token expiration。
- token rotation。
- revoked token cleanup。
- admin UI 顯示狀態。

完成標準：
- token 不會永久有效。
- 管理員可檢視與清除舊 token。

### 🔵 P4 — Encrypted backup

讓備份資料在上傳 WordPress 或雲端前加密，降低資料外洩風險。

主要工作：
- 設計加密 key 來源。
- 加密/解密備份 payload。
- 錯誤恢復與 key 遺失提示。

完成標準：
- 伺服器端不能直接讀取備份內容。
- 使用者仍能可靠還原。

### 🔵 P4 — Backup version history

保留多個備份版本，讓使用者可以回復到較早狀態。

主要工作：
- WordPress sync 儲存多版本紀錄。
- 前端顯示版本列表。
- 支援選擇版本還原。
- 設定保留數量與自動清理。

完成標準：
- 使用者可以看到歷史備份並指定版本還原。

### 🔵 P4 — PHP lint/test

補上 WordPress sync plugin 的 PHP 語法與基礎測試流程。

主要工作：
- PHP lint。
- WordPress coding/security 檢查。
- REST endpoint smoke test。
- CI 或本機測試指令文件化。

完成標準：
- 修改 WordPress plugin 後能快速驗證語法與主要 REST 流程。

---

## 🔴 P0 — AI Agent Tool Use（AI 自主工具調用）

讓 AI 能在對話中自行決定調用工具，實現真正的 Agent 行為。其他 Agent 功能均依賴此基礎。

### 架構

```
使用者輸入 → [Agent Loop] → MiniMax API（附 tools 定義）
   ├─ 有 tool_calls → 執行工具 → 結果送回 → 繼續 loop
   └─ 無 tool_calls → 串流最終回答
```

### Phase 1 — Agent Loop 基礎建設（P0）✅ 已完成 v1.19.1

- [x] **`agentLoop()`**：`streamAgentChat()` 全程非串流 loop，支援多輪 tool call → execute → 回傳
- [x] **`handleToolCall(name, args)`**：統一工具執行入口，Brave/Exa 互為 fallback
- [x] **`parseXmlToolCalls()`**：解析 MiniMax M2.7 XML 格式工具呼叫（`<minimax:tool_call>`）
- [x] **sidepanel.js UI**：`tool_start`/`tool_done` 狀態標示（🔍 搜尋網路 / 🔎 深度搜尋）
- [x] **skipTools 機制**：圖片、翻譯模式、頁面 context 自動回退正常 streaming
- [x] **當前日期注入**：system prompt 注入日期，搜尋優先取得近期資訊
- [x] **Agent 即時狀態列（方案 A）**：等待期間顯示輪次 + 當前動作 + 秒數計時器（v1.19.2）

### Agent 狀態 UI — 方案 B ✅ 已完成

可展開的搜尋歷程記錄，類似 ChatGPT tool call 展示：

```
▶ 已執行 3 次搜尋   ← 點擊展開/收合
  ├ 🔍 搜尋：「台灣房價 2025」（3 筆結果）
  ├ 🔎 深度搜尋：「台北信義區成交價」（5 筆結果）
  └ 🔍 搜尋：「2025 Q1 房市報告」（2 筆結果）
💭 整理回答中...
```

實作要點：
- background.js 在 `tool_done` 時附帶搜尋結果筆數（`result.results?.length`）
- sidepanel.js 在最終回答上方插入一個可折疊的 `<details>` 元素
- 每輪搜尋累積一筆記錄，收合狀態顯示「已執行 N 次搜尋」摘要
- 方案 A 的即時狀態列保留，方案 B 的記錄在回答完成後留存（不自動消失）

### Phase 2 — 設定與記憶工具（P1）

- [ ] **`set_setting(key, value)`**：AI 修改白名單設定（model、language 等，排除 apiKey/syncAuth）
- [ ] **`get_setting(key)`**：AI 讀取當前設定值
- [ ] **`save_memory(title, summary, tags)`**：AI 主動寫入長期記憶
- [ ] **白名單管理**：AI 可寫設定限定為 `settings.model`、`globalPrompt`、`defaultPrompts`

### Phase 2.5 — Plan Approval / 計畫模式（P1）

- [x] **`/plan <task>` 指令**：先產生計畫卡，不直接執行工具
- [x] **Plan card UI**：顯示可用工具、允許站點、執行步驟、批准/取消操作
- [x] **批准後執行**：`Approve plan` 將原始 request 交回既有 Agent/tool 流程
- [x] **已批准計畫注入**：background 將 approved plan 合入 system prompt，約束後續執行
- [x] **計畫模式設定**：新增 `off / auto / always`，讓使用者決定是否強制先批准計畫
- [x] **工具風險分級**：計畫卡顯示低/中/高風險標示，以顏色區分（綠/橘/紅）
- [x] **計畫卡持久化**：批准/取消狀態寫入 session，切換對話後可追蹤歷程
- [x] **計畫修正流程**：`Make changes` 把計畫帶回輸入框並恢復 /plan chip 供修改

### Phase 3 — 搜尋工具整合（P2）✅ 已完成 v1.19.x

- [x] **`web_search(query)`**：整合現有 Brave 搜尋，改由 AI 自行判斷何時觸發
- [x] **`deep_search(query)`**：整合現有 Exa 搜尋
- [x] 移除舊的 `autoSearch` 前置判斷，改由 AI agent 決策
- [x] 搜尋歷程 UI：每次 tool call 記錄工具類型、query、結果筆數，回答完成後保留可折疊區塊

### Phase 4 — 筆記工具（MD 筆記管理，P2）

- [ ] **`write_note(filename, content)`**：儲存 Markdown 筆記到 chrome.storage
- [ ] **`read_note(filename)`**：讀取指定筆記
- [ ] **`list_notes()`**：列出所有筆記
- [ ] **筆記 UI**：側邊欄筆記列表與預覽

### Phase 5 — Skill 執行工具（P4，選做）

> **優先度降級（2025-05-03）**：Agent Loop 已可動態決定工具調用順序；API write tool 搭配 Plan Approval 即可安全執行寫入操作，不需要 Skill 工具作為前置。Skill 工具唯一的額外價值是「使用者自訂的保證固定步驟流程」，屬於錦上添花，待 API Tool Registry 完成後再評估是否實作。

- [ ] **`run_skill(name, params)`**：AI 調用預定義 skill（流程化任務）
- [ ] **Skill 定義格式**：JSON 結構定義每個 skill 的步驟與工具調用序列
- [ ] **內建 Skill**：`blog_write`、`summarize_page`、`translate_and_save` 等

### Phase 6 — API Tool Registry（P1/P2）

- [ ] **Tool Registry schema**：統一定義 tool name、description、JSON schema、risk level、auth requirements
- [ ] **HTTP API read tool**：支援 GET/POST read-only API，回傳 JSON/text 摘要給 Agent
- [ ] **HTTP API write tool**：支援 POST/PUT/PATCH/DELETE，但強制 Plan Approval + 使用者確認
- [ ] **Auth 管理**：支援 API key / Bearer token / header mapping，避免模型直接讀取 secret
- [ ] **Host allowlist**：每個 API tool 必須設定允許 domain，防止任意外連
- [ ] **Result limiter**：限制回傳長度、清理敏感資訊、避免 context 爆量

### Phase 7 — SSH / Server Tool（P1/P2，需橋接）

- [ ] **SSH tool 方案評估**：Chrome extension 不能直接 SSH，需 Native Messaging host 或後端 proxy
- [ ] **Native Messaging bridge**：本機執行器負責 SSH，extension 只送受限命令 schema
- [ ] **Server-side proxy**：以自有 API 代為執行 SSH，集中管理金鑰與審計
- [ ] **命令白名單**：只允許預先定義任務（cache clear、disk usage、script list 等）
- [ ] **強制 Plan Approval**：所有 SSH tool 都必須先顯示計畫與目標主機
- [ ] **審計紀錄**：記錄 tool、host、command template、時間、結果摘要

### 技術備註

- MiniMax M2.7 API 相容 OpenAI function calling 格式（需實測 tool call 品質）
- Tool use 期間不能 stream；需在 agent loop 最後一輪才切換回 stream 模式
- 白名單：AI 可寫設定限定為 `settings.model`、`settings.language`、`globalPrompt`、`defaultPrompts`

---

## 🔴 P0 — MiniMax API 擴充整合

> **方案需求確認（2025-05-03）**：
> - 圖像生成 / TTS：需 **Plus 方案（$20/月）** 以上
> - 影片生成 / 音樂生成：需 **Max 方案（$50/月）**
> - Starter（$10/月）只提供文字 API + 圖片理解（understand_image）
> - Starter 的「image understanding and web search MCP」是給 Claude Code / Cursor 等 IDE 使用的 MCP server，**不是給 Extension 直接呼叫的 API**

### 圖像生成（P4）

- [ ] **文字生成圖片**：呼叫 MiniMax Image API，使用者輸入描述 → 圖片顯示在聊天視窗
- [ ] **寬高比選擇**：支援 1:1、16:9、9:16 等常用比例
- [ ] **觸發方式**：`/image <描述>` 指令 或 AI 自行調用 `generate_image` tool

### TTS 升級（P4）

- [ ] **替換 Google TTS**：改用 MiniMax TTS API，支援更多聲音選項與更自然語音
- [ ] **聲音選擇**：在設定頁面提供可選聲音清單
- [ ] **串流 TTS**：支援串流輸出，縮短首字發音延遲

### 影片生成（P3）

- [ ] **文字生成影片**：呼叫 MiniMax Video API，非同步任務
- [ ] **任務狀態追蹤**：輪詢生成進度，完成後顯示下載連結
- [ ] **觸發方式**：`/video <描述>` 指令

### 音樂生成（P4）

- [ ] **文字生成音樂**：支援含歌詞版與純樂版
- [ ] **觸發方式**：`/music <描述>` 指令

### MiniMax Web Search（替代/補充 Brave，評估中）

> **注意（2025-05-03）**：Starter 方案的「web search & image understanding MCP」是透過 `minimax-coding-plan-mcp` 套件，專供 Claude Code / Cursor / OpenCode 等 IDE 使用，**並非可供 Extension 直接呼叫的 REST API**。Extension 目前已用 Brave/Exa 搜尋，MiniMax 搜尋 API 需另行評估是否開放給一般 Token Plan。

- [ ] 確認 MiniMax 是否提供獨立的 `/v1/search` REST endpoint（非 MCP 形式）
- [ ] 若有，評估 MiniMax 內建搜尋品質 vs Brave，決定是否切換或並存
- [ ] MiniMax `understand_image` 作為 Gemini 視覺理解的備援選項（Starter 方案已有視覺理解能力，透過 M2.7 chat API 傳入圖片即可）

---

## 🟠 P1 — System Prompt 壓縮 & Context 優化

> 來源：MiniMax M2.7 最佳實踐 — 充分利用 200k token 容量

- [ ] **System prompt 長度監控**：超過閾值時自動摘要壓縮，避免佔用過多 context
- [ ] **`MAX_CONTEXT_CHARS` 審查**：確認目前設定是否合理利用 M2.7 的 200k 容量
- [ ] **壓縮策略文件化**：在設定頁面顯示目前 context 使用量

---

## 🟡 P2 — 任務腳本（Task Script）

> 來源：MiniMax 最佳實踐 — 長任務建立 `init.sh` / `tests.json` 腳本化

讓使用者預先定義多步驟任務流程，存於 chrome.storage，AI 執行時按步驟推進。

```json
{
  "name": "build-site",
  "steps": [
    { "prompt": "整理需求，輸出規格清單", "tools": [] },
    { "prompt": "建立架構與檔案結構", "tools": ["write_note"] },
    { "prompt": "逐一實作各模組", "tools": ["web_search", "write_note"] }
  ]
}
```

- [ ] **腳本定義格式**：JSON 結構（name / steps / tools / success_criteria）
- [ ] **`run_script(name)`** tool：AI 可調用，按步驟執行並回報進度
- [ ] **腳本管理 UI**：側邊欄列表、新增、編輯、刪除腳本
- [ ] **內建腳本範本**：`blog-article`、`page-analysis`、`code-review` 等

---

## 🟡 P2 — 多模型並排比較

同一個 prompt 可同時送到 2-3 個模型，讓使用者在同一個 session 中並排比較回覆品質、速度與成本。此功能聚焦「同一任務內比較答案」，不同於 Spaces 多空間的「不同任務脈絡隔離」。

MVP：
- [ ] **比較模式入口**：輸入區新增 Compare / 比較模式，可選 2-3 個模型。
- [ ] **多回覆卡片**：同一則 user message 下顯示多個 assistant response card。
- [ ] **並行串流狀態**：每張卡顯示模型名、串流狀態、耗時、錯誤與 usage/cost。
- [ ] **純文字優先**：第一版先限制一般文字聊天，不納入 Agent tools、圖片、PDF、檔案分析。

後續擴充：
- [ ] **裁判模型**：加入一個總結模型，比較各模型優缺點並整理建議答案。
- [ ] **最佳回覆採用**：可將指定模型回覆標記為最佳，或加入原 session 作為後續上下文。
- [ ] **比較紀錄回溯**：支援從 session 搜尋與回顧多模型比較結果。

---

## 🟡 P2 — Spaces 多空間

> 來源：MiniMax 最佳實踐 — 多窗口策略（第一窗口建框架、第二窗口迭代）

- [ ] **Phase 1**：tab-based space 切換（獨立對話 context）
- [ ] **Space 用途標示**：規劃 Space / 執行 Space / 筆記 Space
- [ ] **跨 Space 共享記憶**：長期記憶在所有 Space 共用

---

## 🟡 P2 — 部落格助手（jasonsbase-blog 實裝計畫）

將 `jasonsbase-blog` skill 的工作流程實裝到 APP 內，讓使用者在側邊欄直接完成文章創作到發布的完整流程。

**範圍說明**
- **可實裝（~70%）**：搜尋研究、Q&A 問答、文章生成、WP 發布、REST 可寫的 SEO meta
- **不可實裝**：WP-CLI/SSH 操作 → 改為產生 WP-CLI 指令讓使用者手動貼上執行

### Phase 1 — 核心入口與模式選擇

- [ ] **自訂指令 `/blog`**：觸發部落格助手，顯示模式選單（A/B/C/D/E/T + 文章優化）
- [ ] **模式 Router**：解析使用者輸入，判斷 A/B/C/D/E/T 或文章優化流程，設定對應 system prompt
- [ ] **Q&A 問答流程**：以多輪對話形式提出 5 題，收集回答後進入生成階段

### Phase 2 — WP 文章 CRUD API

- [ ] **`WP_POST_CREATE` handler**：`POST /wp-json/wp/v2/posts`（含 title、content、status、meta）
- [ ] **`WP_POST_READ` handler**：`GET /wp-json/wp/v2/posts/{id}?context=edit`
- [ ] **`WP_POST_UPDATE` handler**：`PUT /wp-json/wp/v2/posts/{id}`
- [ ] **WP Auth 複用**：直接使用現有 `syncAuth.wordpress.apiToken` + `baseUrl`
- [ ] **分類/標籤 API**：`GET /wp-json/wp/v2/categories`、`/tags`

### Phase 3 — 文章生成邏輯

- [ ] **各模式 system prompt**：A/B/C 技術文、D 雜談、E 經驗分享、T 旅遊記
- [ ] **文章預覽**：生成後在聊天介面顯示 Markdown 預覽，確認後再發布
- [ ] **SEOPress meta 寫入**：發布時同步寫入 `_seopress_titles_title`、`_seopress_titles_desc`
- [ ] **WP-CLI 指令產生**：發布後自動產生 `_seopress_analysis_target_kw` 設定指令

### Phase 4 — 既有文章優化流程

- [ ] **URL/PostID 解析**：偵測輸入為 URL 或數字 → 走「既有文章優化」分支
- [ ] **缺口分析**：逐項檢查 FAQ、實作章節、SEO 標題、內部連結、目錄完整性
- [ ] **選擇性更新**：列出分析結果供使用者確認，勾選要補充的項目後執行更新

### Phase 5 — 圖片生成（選做）

- [ ] **精選圖片生成**：整合 MiniMax Image API（或 Gemini Flash Image），依文章主題生成封面圖
- [ ] **圖片上傳 WP Media**：`POST /wp-json/wp/v2/media`，設定為文章 `featured_media`
- [ ] **alt text 自動填入**：含 SEO 關鍵字

---

## 🟠 P1 / 🟡 P2 / 🟢 P3 — 瀏覽器自動化（Browser Automation）

讓 AI Agent 能直接操控瀏覽器，實現「點擊、填表、擷取、截圖、腳本化流程」等自動化行為。  
架構採三階段漸進，無需外部工具即可覆蓋 80% 使用情境。

> **技術選型說明**：`browser-use`、`Playwright MCP` 等開源工具均為 Python/Node.js Server，無法直接整合進 Chrome Extension。Extension 本身即在瀏覽器環境內，使用原生 API 是最低成本且最穩定的路徑。

---

### Phase 1 — Content Script 基礎工具（P1）✅ 已完成 v1.24.0

透過 `chrome.scripting.executeScript` 在當前 tab 執行 DOM 操作，整合進現有 `handleToolCall()`。

**新增 Agent Tools**

- [x] **`browser_click(selector)`**：點擊指定 CSS selector 元素
- [x] **`browser_fill(selector, value)`**：填入表單欄位（React/Vue native setter 相容）
- [x] **`browser_select(selector, value)`**：選擇 `<select>` 下拉選項（value / text 雙模式）
- [x] **`browser_get_text(selector?)`**：擷取元素或整頁文字（截斷 8000 字元）
- [x] **`browser_get_html(selector?)`**：擷取元素 HTML 結構（截斷 5000 字元）
- [x] **`browser_scroll(direction, amount?)`**：捲動頁面（up / down / top / bottom）
- [x] **`browser_wait_for(selector, timeout?)`**：輪詢等待元素出現（上限 15 秒）
- [x] **`browser_navigate(url)`**：使用 `chrome.tabs.update` 導航至指定 URL

**實作細節**

- `chrome.scripting.executeScript` 內聯函式，無需獨立 content script
- background.js `handleToolCall()` 新增 `browser_*` 分支，路由至 `executeBrowserTool()`
- 瀏覽器工具永遠加入 Agent tools 清單，不依賴 API Key
- sidepanel.js 新增 `getBrowserToolIcon/Label`、`getAgentToolLabel` helper
- 操作歷程面板支援瀏覽器工具圖示與標籤，summary 改為「已執行 N 次操作」

---

### Phase 2 — chrome.debugger CDP 工具（P2）

使用 `chrome.debugger` API 存取 Chrome DevTools Protocol，提供截圖、JS 執行、網路攔截等進階能力。

> **UX 注意**：附加 debugger 時頁面頂部會出現黃色「正在偵錯此標籤頁」警告條，需於 UI 明確告知使用者。

**新增 Agent Tools**

- [ ] **`browser_screenshot()`**：截取當前 tab 畫面，以 base64 image 回傳給 AI 視覺分析
- [ ] **`browser_eval(script)`**：在頁面執行任意 JS，回傳結果（需 Plan Approval）
- [ ] **`browser_get_network_log()`**：擷取頁面最近 N 筆網路請求（URL、status、body 摘要）
- [ ] **`browser_block_request(urlPattern)`**：封鎖特定資源請求（廣告/tracker 過濾場景）
- [ ] **`browser_emulate_device(device)`**：切換 viewport/UA 至手機/平板模擬

**實作細節**

- 需在 manifest.json 新增 `"debugger"` permission
- background.js 管理 debugger 附加/分離生命週期（對話結束後自動 detach）
- `browser_eval` 強制要求 Plan Approval，且結果長度超過 2000 字元自動截斷
- 截圖結果以 attachment 形式顯示在聊天視窗（複用現有圖片渲染邏輯）

---

### Phase 3 — Native Messaging + Playwright（P3）

透過 Native Messaging 橋接本地 Node.js 執行器，運行 Playwright 實現完整多 tab 自動化。

> **安裝門檻**：使用者需執行一次安裝腳本（`install-host.sh`），設定 Native Messaging host。適合進階使用者或企業場景。

**架構**

```
Extension (background.js)
  │  chrome.runtime.sendNativeMessage
  ▼
Native Host (Node.js / minimax-browser-host)
  │  Playwright API
  ▼
Chromium / Chrome
```

**功能範圍**

- [ ] **Native Messaging host**：Node.js 執行器，接收 JSON 指令、回傳結果
- [ ] **多 tab 自動化**：開啟新 tab、切換、關閉，跨頁面操作序列
- [ ] **`browser_run_script(steps[])`**：執行多步驟自動化腳本（支援 loop / condition）
- [ ] **`browser_extract_structured(schema)`**：依 JSON schema 擷取結構化資料（價格、列表、表格等）
- [ ] **無頭截圖 / PDF 輸出**：背景截圖不影響使用者操作中的頁面
- [ ] **安裝流程 UI**：設定頁面偵測 native host 是否已安裝，引導使用者執行安裝腳本
- [ ] **Host 版本管理**：extension 與 native host 版本不符時提示升級

**安全限制**

- 所有 Playwright 操作強制經過 Plan Approval
- host allowlist：只允許連線至使用者預先設定的網域
- 命令白名單模式（可選）：限制只能執行預定義腳本，不允許任意 JS

---

### 跨 Phase 共用設計

- **selector 策略**：優先 `data-testid` > `aria-label` > CSS selector > XPath，AI 生成時依此順序嘗試
- **錯誤處理**：操作失敗回傳結構化 error（`{ error, selector, suggestion }`），AI 可自動重試或修正 selector
- **操作紀錄 UI**：Agent 搜尋歷程區塊擴充支援瀏覽器操作記錄（圖示 + 操作摘要 + 結果狀態）
- **隱私保護**：不在 `chatSessions` 或雲端備份中記錄頁面內容，操作記錄僅存於當前 session

---

## 🟢 P3 — 財經功能

- [ ] `/stock`：查詢美股即時資訊
- [ ] `/twstock`：查詢台股即時資訊
- [ ] `/news`：財經新聞摘要

---

## 🔵 P4 — 維護與其他

- Final E2E regression pass on production-like setup (login -> backup -> restore -> token cleanup)
- PHP lint/test（需有 `php` 環境的機器）
- Define token lifecycle policy（expiration / rotation / retention cleanup）
- Optional encrypted payload support for settings backup
- Optional backup version history
- 自動化功能：daily Gmail digest via chrome.alarms + chrome.identity
