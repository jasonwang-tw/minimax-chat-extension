# WordPress Sync TODO

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

## Next Phase

- Final E2E regression pass on production-like setup (login -> backup -> restore -> token cleanup)
- PHP lint/test on machine with `php` installed
- Define token lifecycle policy:
  - expiration / rotation
  - retention cleanup rules
- Optional encrypted payload support for settings backup
- Optional backup version history
- Spaces feature (Phase 1: tab-based space switching)
- 財經功能：/stock、/twstock、/news slash commands
- 自動化功能：daily Gmail digest via chrome.alarms + chrome.identity

---

## 部落格助手（jasonsbase-blog 實裝計畫）

### 目標

將 `jasonsbase-blog` skill 的工作流程實裝到 APP 內，讓使用者在側邊欄直接完成文章創作到發布的完整流程。

### 範圍說明

- **可實裝（~70%）**：搜尋研究、Q&A 問答、文章生成、WP 發布、REST 可寫的 SEO meta
- **不可實裝**：WP-CLI/SSH 操作（SEOPress focus keyword、快取強制修復）→ 改為**產生 WP-CLI 指令**讓使用者手動貼上終端機執行

---

### Phase 1 — 核心入口與模式選擇

- [ ] **自訂指令 `/blog`**：觸發部落格助手，顯示模式選單（A/B/C/D/E/T + 文章優化）
- [ ] **模式 Router**：解析使用者輸入，判斷 A/B/C/D/E/T 或文章優化流程，設定對應 system prompt
- [ ] **Q&A 問答流程**：以多輪對話形式提出 5 題，收集回答後進入生成階段

### Phase 2 — WP 文章 CRUD API

- [ ] **background.js 新增 `WP_POST_CREATE` handler**：`POST /wp-json/wp/v2/posts`（含 title、content、status、meta）
- [ ] **background.js 新增 `WP_POST_READ` handler**：`GET /wp-json/wp/v2/posts/{id}?context=edit` 取得文章原始內容
- [ ] **background.js 新增 `WP_POST_UPDATE` handler**：`PUT /wp-json/wp/v2/posts/{id}`（更新 content + meta）
- [ ] **WP Auth 複用**：直接使用現有 `syncAuth.wordpress.apiToken` + `baseUrl`，不需重新登入
- [ ] **分類/標籤 API**：`GET /wp-json/wp/v2/categories`、`/tags`，供發布時選擇或建立

### Phase 3 — 文章生成邏輯

- [ ] **各模式 system prompt**：A/B/C 技術文、D 雜談、E 經驗分享、T 旅遊記，各模式文章結構、SEO 規格、語氣規定注入 system prompt
- [ ] **文章預覽**：生成後在聊天介面顯示 Markdown 預覽，確認後再發布
- [ ] **SEOPress meta 寫入**（REST 可存取欄位）：發布時同步寫入 `_seopress_titles_title`、`_seopress_titles_desc`
- [ ] **WP-CLI 指令產生**（不可 SSH 的欄位）：發布後自動產生 `_seopress_analysis_target_kw` 設定指令，供使用者手動執行

### Phase 4 — 既有文章優化流程

- [ ] **URL/PostID 解析**：偵測輸入為 URL 或數字 → 走「既有文章優化」分支
- [ ] **缺口分析**：讀取文章內容後，逐項檢查 FAQ、實作章節、SEO 標題、內部連結、目錄完整性
- [ ] **選擇性更新**：列出分析結果供使用者確認，勾選要補充的項目後執行更新

### Phase 5 — 圖片生成（選做）

- [ ] **精選圖片生成**：整合 Gemini Flash Image（Nano Banana 2），依文章主題生成封面圖
- [ ] **圖片上傳 WP Media**：`POST /wp-json/wp/v2/media`，上傳後設定為文章 `featured_media`
- [ ] **alt text 自動填入**：上傳時自動設定 alt text（含 SEO 關鍵字）

---

### 技術備註

- WP auth token 來源：`chrome.storage.local` 的 `syncAuth.wordpress`（現有）
- 文章搜尋依賴：Brave API（快訊/新聞）+ Exa API（深度技術文）→ 均已整合
- 發布後 SEOPress 需在 WordPress 後台重新整理編輯頁讓其重新分析（無法自動觸發）
- WP-CLI 指令應以 code block 格式顯示在聊天視窗，方便複製
