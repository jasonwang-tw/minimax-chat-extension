# MiniMax Chat Extension — TODO

## Done

- Installed `wordpress/minimax-sync` on `https://jasonsbase.com`
- Activated the `MiniMax Sync Bridge` plugin
- Confirmed WordPress registration flow for self-service signup
- Reloaded Chrome extension on branch `codex/plan-synchronization-for-settings-and-data`
- Verified `設定 > 同步` WordPress login flow (`使用 WordPress 登入`)
- Verified manual backup flow (`立即備份設定`)
- Verified restore flow (`從雲端還原`) after local settings changes
- Verified admin page `Settings > MiniMax Sync`:
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

---

## 開發優先度總覽

| 優先度 | 功能 | 說明 |
|--------|------|------|
| 🔴 P0 | AI Agent Loop 基礎建設 | 其他 Agent 功能的前提 |
| 🔴 P0 | MiniMax 圖像生成 | 高價值、差異化功能 |
| 🟠 P1 | AI 設定 & 記憶工具 | 搭配 Agent Loop |
| 🟠 P1 | MiniMax TTS 升級 | 現有 Google TTS 直接替換 |
| 🟠 P1 | System Prompt 壓縮 | M2.7 200k token 充分利用 |
| 🟡 P2 | AI 搜尋工具整合 | autoSearch 改由 AI 自行決策 |
| 🟡 P2 | 任務腳本（Task Script） | 長任務腳本化，搭配 Agent |
| 🟡 P2 | 筆記工具（MD Notes） | write/read/list note |
| 🟡 P2 | Spaces 多空間 | tab-based 切換，搭配多窗口策略 |
| 🟡 P2 | 部落格助手 | jasonsbase-blog 實裝 |
| 🟢 P3 | MiniMax 影片生成 | 非同步任務，複雜度高 |
| 🟢 P3 | Skill 執行工具 | run_skill，搭配任務腳本 |
| 🟢 P3 | 財經功能 | /stock、/twstock、/news |
| 🔵 P4 | MiniMax 音樂生成 | 較小眾 |
| 🔵 P4 | 自動化 Gmail Digest | chrome.alarms + chrome.identity |
| 🔵 P4 | Token lifecycle policy | expiration / rotation / cleanup |
| 🔵 P4 | Encrypted backup | 設定備份加密 |
| 🔵 P4 | Backup version history | 備份版本記錄 |
| 🔵 P4 | PHP lint/test | 需有 php 環境的機器執行 |

---

## 🔴 P0 — AI Agent Tool Use（AI 自主工具調用）

讓 AI 能在對話中自行決定調用工具，實現真正的 Agent 行為。其他 Agent 功能均依賴此基礎。

### 架構

```
使用者輸入 → [Agent Loop] → MiniMax API（附 tools 定義）
   ├─ 有 tool_calls → 執行工具 → 結果送回 → 繼續 loop
   └─ 無 tool_calls → 串流最終回答
```

### Phase 1 — Agent Loop 基礎建設（P0）

- [ ] **`agentLoop()`**：取代現有直接 API 呼叫，支援多輪 tool call → execute → 回傳循環
- [ ] **`handleToolCall(name, args)`**：統一工具執行入口，依 name 路由到對應 handler
- [ ] **Streaming 分離**：有 tool_calls 時暫停 stream，顯示「工具執行中...」，最終回答再恢復串流
- [ ] **sidepanel.js UI**：工具執行狀態標示（顯示正在調用哪個工具名稱）

### Phase 2 — 設定與記憶工具（P1）

- [ ] **`set_setting(key, value)`**：AI 修改白名單設定（model、language 等，排除 apiKey/syncAuth）
- [ ] **`get_setting(key)`**：AI 讀取當前設定值
- [ ] **`save_memory(title, summary, tags)`**：AI 主動寫入長期記憶
- [ ] **白名單管理**：AI 可寫設定限定為 `settings.model`、`globalPrompt`、`defaultPrompts`

### Phase 3 — 搜尋工具整合（P2）

- [ ] **`web_search(query)`**：整合現有 Brave 搜尋，改由 AI 自行判斷何時觸發
- [ ] **`deep_search(query)`**：整合現有 Exa 搜尋
- [ ] 移除舊的 `autoSearch` 前置判斷，改由 AI agent 決策

### Phase 4 — 筆記工具（MD 筆記管理，P2）

- [ ] **`write_note(filename, content)`**：儲存 Markdown 筆記到 chrome.storage
- [ ] **`read_note(filename)`**：讀取指定筆記
- [ ] **`list_notes()`**：列出所有筆記
- [ ] **筆記 UI**：側邊欄筆記列表與預覽

### Phase 5 — Skill 執行工具（P3，選做）

- [ ] **`run_skill(name, params)`**：AI 調用預定義 skill（流程化任務）
- [ ] **Skill 定義格式**：JSON 結構定義每個 skill 的步驟與工具調用序列
- [ ] **內建 Skill**：`blog_write`、`summarize_page`、`translate_and_save` 等

### 技術備註

- MiniMax M2.7 API 相容 OpenAI function calling 格式（需實測 tool call 品質）
- Tool use 期間不能 stream；需在 agent loop 最後一輪才切換回 stream 模式
- 白名單：AI 可寫設定限定為 `settings.model`、`settings.language`、`globalPrompt`、`defaultPrompts`

---

## 🔴 P0 — MiniMax API 擴充整合

> **前提**：以下圖像 / 影片 / 音樂 / TTS 功能需要 **Token Plan 訂閱**，與現有文字 API Key 不同。

### 圖像生成（P0）

- [ ] **文字生成圖片**：呼叫 MiniMax Image API，使用者輸入描述 → 圖片顯示在聊天視窗
- [ ] **寬高比選擇**：支援 1:1、16:9、9:16 等常用比例
- [ ] **觸發方式**：`/image <描述>` 指令 或 AI 自行調用 `generate_image` tool

### TTS 升級（P1）

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

- [ ] 評估 MiniMax 內建搜尋品質 vs Brave，決定是否切換或並存
- [ ] MiniMax `understand_image` 作為 Gemini 視覺理解的備援選項

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
