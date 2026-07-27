# Open Chat Hub

Open Chat Hub 是一個多模型 AI 側邊欄工作台，讓你在瀏覽器內直接聊天、讀網頁、分析截圖與檔案、整理知識庫、累積單字與同步設定。

它採用 BYOK（bring your own key）模式：你可以使用自己的 MiniMax、Gemini、OpenRouter、Brave Search、Exa Search API Key。API Key 儲存在 Chrome 本機/同步儲存區，AI 請求會直接送往你設定的第三方 provider。

## 版本

**v1.41.0** (2026-06-17)

## 功能特色

### 對話
- 點擊擴充圖示即可開啟側邊欄進行 AI 對話。
- 預設支援 MiniMax-M2.7，並可透過 OpenRouter 自訂 Claude、GPT、Gemini、Llama、DeepSeek、Mistral 等模型。
- 側邊欄模型選擇器會顯示模型價格、context 與用途資訊。

### 截圖 / 圖片 / 檔案分析
- 全頁截圖、區域截圖與圖片上傳。
- OCR 文字辨識與圖片內容分析。
- 支援 PDF、圖片、文字、Markdown、CSV、JSON、程式碼等檔案輸入。
- 文字型 PDF 優先使用 OpenRouter PDF Inputs，圖片型或掃描型 PDF 維持 Gemini 視覺分析。

### OCR & 翻譯
- OCR 可擷取圖片文字並交由 AI 整理格式。
- 翻譯模式支援中文、英文、日文、韓文、法文、德文、西班牙文、葡萄牙文、俄文、阿拉伯文。
- TTS 可朗讀訊息，預設使用 Google Translate TTS，失敗時 fallback 至 Web Speech API。

### Agent 搜尋
- AI Agent 可自行決定是否呼叫 `web_search` 或 `deep_search`。
- Brave Search 與 Exa Search 可互為 fallback。
- 回答完成後保留可展開的搜尋歷程與來源連結。

### 知識與學習
- 長期記憶：用 `/remember` 儲存重要資訊，也可開啟 AI 自動萃取。
- Knowledge Base：保存網頁、摘要、標籤與分類，支援搜尋與重新分析。
- Vocabulary：從對話萃取單字，支援分類、語言篩選與翻譯補齊。

### 對話工作流
- 對話 Session 自動保存，支援搜尋、釘選、重新命名、個別刪除與批次刪除。
- 輸入列支援訊息 queue，串流中仍可繼續排入下一則訊息。
- 對話內搜尋、TOC 目錄、圖片 lightbox 導航、Markdown 強化渲染。

### 斜線指令
- 輸入 `/` 開啟指令選單，支援鍵盤導覽。
- 內建指令包含 `/screenshot`、`/region`、`/ocr`、`/page`、`/new`、`/clear`、`/remember`、`/forget`、`/summarize`。
- 可在設定頁建立自訂模板指令，使用 `{input}` 插入使用者文字。

### 同步與備份
- 本機 JSON 匯出/匯入。
- Open Chat Hub Sync Bridge 可備份設定、提示詞、記憶、知識庫、Vocabulary、分類、自訂指令與 provider 設定。
- 對話紀錄與 session summaries 因資料量大，目前不納入雲端備份。

### 使用量與費用
- OpenRouter token usage ledger。
- 依模型統計 input/output tokens、請求數與估算費用。
- OpenRouter 模型費用表可搜尋、排序與依用途篩選。

## 安裝方式

1. 開啟 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇此專案資料夾

## 使用方式

1. 點擊擴充圖示，進入設定頁面
2. 輸入 MiniMax API Key，或設定 OpenRouter API Key 與自訂模型
3. 如需截圖、圖片、OCR 或掃描型 PDF 分析，輸入 Gemini API Key
4. 如需 Agent 搜尋，輸入 Brave Search 或 Exa Search API Key
5. 點擊對應的「測試連線」確認 API 可用
6. 儲存設定後即可開始使用

## API Key 取得

- **MiniMax API Key**：至 [MiniMax Platform](https://platform.minimax.chat/) 取得
- **Gemini API Key**：至 [Google AI Studio](https://aistudio.google.com/) 取得
- **OpenRouter API Key**：至 [OpenRouter Keys](https://openrouter.ai/keys) 取得
- **Brave Search API Key**：至 [Brave Search API](https://brave.com/search/api/) 取得
- **Exa Search API Key**：至 [Exa](https://exa.ai/) 取得

## API 工具 OAuth 設定（Gmail / Google 日曆 / Notion / GA4）

設定頁「API 工具」區塊有四組預設工具，需要先在對應服務商建立 OAuth Client，再將 Client ID/Secret 貼回設定頁。每個預設**獨立一組** OAuth Client（不共用）。

### 共通：取得 Redirect URI

1. 開啟設定頁 → API 工具 → 點擊任一預設（如 Gmail）的「設定」按鈕
2. 卡片會顯示 Redirect URI（格式：`https://<extension-id>.chromiumapp.org/<path>`），點擊「複製」
3. 將此 URI 加入下面對應的 OAuth Console「已授權的重新導向 URI」欄位

### Google 三服務（Gmail / Google 日曆 / Google Analytics 4）

每項服務都需要獨立建立 OAuth Client：

1. 進入 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 建立新專案（或選現有專案），啟用對應 API：
   - **Gmail**：搜尋「Gmail API」→ 啟用
   - **Google 日曆**：搜尋「Google Calendar API」→ 啟用
   - **GA4**：同時啟用「Google Analytics Data API」與「Google Analytics Admin API」
3. 「OAuth 同意畫面」設定為「外部」（個人 Google 帳號可用）；測試使用者加入自己的帳號
4. 點「建立憑證」→「OAuth 用戶端 ID」→ 應用程式類型選「**網頁應用程式**」
5. 「已授權的重新導向 URI」貼上設定頁顯示的 Redirect URI（每組 Client 對應一個）
6. 建立後複製 Client ID 與 Client Secret 貼回設定頁
7. 點擊「點此授權」→ 跳出 Google 同意畫面 → 同意後即完成

### Notion

1. 進入 [Notion Developers](https://www.notion.so/profile/integrations/public) → 「Create new connection」
2. 建立「**Public connection**」（OAuth 必須是 public 類型）
3. 「Redirect URIs」貼上設定頁顯示的 Notion Redirect URI
4. 在 Capabilities 勾選需要的權限（Read/Update/Insert content）
5. 取得 OAuth client ID 與 OAuth client secret，貼回設定頁
6. 點擊「點此授權」→ 跳出 Notion 同意畫面 → 選擇要授權的頁面/資料庫 → 完成
7. **重要**：Notion 預設只能存取「明確分享給此 integration」的頁面。請至要使用的頁面 → 右上角「⋯」 → 「Connect to」 → 選擇你的 integration

### Token 行為

- Google access token 有效期約 1 小時，背景會在過期前用 refresh_token 自動續發
- Notion access token 永久有效（除非使用者在 Notion 撤銷授權）
- Client Secret 與 token 僅儲存於 `chrome.storage.local`，**不會傳送給 AI 模型**
- 點擊「取消授權」會清除本機 token；Google 會額外呼叫 revoke endpoint

## 隱私與資料

Open Chat Hub 不會自行販售或分享使用者資料。你輸入的訊息、頁面內容、截圖、檔案與搜尋查詢，只有在你主動使用對應功能時才會送往你設定的第三方 provider。

詳細資料處理範圍請見 [PRIVACY.md](PRIVACY.md)。

## 開發

```bash
# 安裝依賴
npm install

# 編譯樣式
npm run build:css
```

## 技術架構

- **Manifest V3**：最新 Chrome 擴充功能格式
- **Service Worker**：背景處理 MiniMax、OpenRouter、Gemini、Brave Search、Exa Search 等 provider 請求
- **Side Panel**：側邊欄 UI
- **Google Translate TTS**：高品質多語言語音輸出，失敗時 fallback 至 Web Speech API
- **TailwindCSS + SCSS**：樣式設計

## Changelog

## [1.41.0] - 2026-06-17
### Added
- **LaTeX 符號 → Unicode**：`renderMarkdown` 新增 `LATEX_SYMBOL_MAP` 與 `replaceLatexSymbols`，把模型回覆中常見 `$\rightarrow$`、`$\downarrow$`、`$\uparrow$`、`$\to$`、`$\pm$`、`$\le$`、`$\alpha$` 等 LaTeX 命令轉成對應 Unicode 字元（→ ↓ ↑ ± ≤ α …），避免畫面出現 `$\rightarrow$` 原文。
- **比較模式存入對話歷史**：`handleCompareSend` 全部 card 完成後，把各模型回覆寫入 `currentSession.messages`（新增 `role: 'compare'` 訊息與 `entries` 陣列），呼叫 `saveCurrentSession + loadHistory`；`loadSession` 偵測到 `role === 'compare'` 會以 `renderSavedCompareMessage` 重建比較 card 結構（含 model 名稱、status、回覆內容、agent 通知、搜尋紀錄）。
- **比較模式 TOC 顯示 model 名稱**：`buildCompareCard` 把 model 名稱從 `<span>` 改為 `<h1 class="compare-card-name">`，自然進入 `buildToc('h1,h2,h3,h4')` 結果並以 toc-h1 顯示為最頂層；同時 `buildToc` 對 `.compare-card-body` 內部的 AI 標題自動 `+1` 階（上限 h4），讓 model 名稱成為父節點、AI 標題作為子節點，避免兩者擠在同層。
- **比較模式支援 Tool Use / Agent Loop**：每張 compare card 各自跑 agent loop，依當前思考深度設定執行 `maxAgentIterations` 輪。`handleCompareSend` 的 per-card port listener 新增 `status` / `agent_thinking` / `tool_start` / `tool_done` / `agent_notice` 處理；card header status span 即時顯示「第 N/M 輪 · 搜尋網路：query」；完成時把每張 card 各自的 `searchLog` / `notices` 渲染為 `buildSearchHistoryEl` / `buildAgentNoticeEl`，並寫入 entry，重新載入 session 時也能重建。
### Changed
- 比較模式提示文字由「比較模式（純文字，N 個模型）— 回覆僅顯示，不會存入此對話歷史」改為「比較模式（N 個模型）」，因為現在已存入歷史。
- `historyForApi` 建構時新增 `filter(m => m.role === 'user' || m.role === 'assistant')`，避免 `role: 'compare'` 被當成有效 API 角色送出。
- `.compare-card-name` CSS 補上 `margin/padding/font-size/line-height/border` 覆寫，讓 `<h1>` 標籤視覺仍與原本 `<span>` 一致。
- 比較模式 `sessionId` 附加 `__cmp__<modelId>` 後綴，避免多個 card 共用同一個 `agentBrowserSessions` 條目（會搶同一個瀏覽器分頁）。plan 模式在 compare 內維持關閉，避免每個 card 都跳出計畫批准。
- `#modelPickerBtn` 改為彈性寬度：`#modelPickerLabel` 加 `overflow:hidden; text-overflow:ellipsis`，`.input-right-group` / `.picker-group` / `.picker-zone-normal` 全部補上 `min-width:0; flex:0 1 auto`，讓底部 picker 在模型名稱過長時可省略截斷，發送按鈕（`.btn-send` 維持 `flex-shrink:0`）不會被擠出輸入框。

## [1.40.1] - 2026-06-15
### Changed
- Picker-group 右側「Fusion / 比較」兩顆 toggle 按鈕**合併為單一 mode dropdown**（`模式選擇`），按鈕 label 顯示當前模式（`默認` / `Fusion 💰` / `比較 N/3`），節省側邊欄底部水平空間。
- Dropdown 內含三個 radio 選項；選擇「比較」時模型多選清單**在同一個 dropdown 內嵌**展開，不再需要二次 popover。
- 修正前一版思考按鈕與模型按鈕高度不一致的問題（`.picker-zone-normal` 改回 `align-items: stretch`）。

## [1.40.0] - 2026-06-15
### Changed
- 重新設計 picker-group：把「標準 / Fusion / 比較」三顆視覺等同的按鈕，重新組織為**三種互斥模式**（一般 / Fusion / 比較）
  - **一般模式**（預設）：思考深度 + Model picker 可用
  - **Fusion 模式**：點 Fusion toggle 進入；思考 + Model picker 禁用變灰，hover tooltip「Fusion 模式啟用中，model / agent depth 不生效」；按鈕 active 時加 💰 提示
  - **比較模式**：思考 + Model picker 禁用變灰；比較 toggle 顯示「比較 N/3」
- Picker-group 內部切成左右 zone：左側為一般模式控制（思考、Model），右側為特殊模式 toggle（Fusion、比較），中間以 divider 分隔
- 模式互斥：點 Fusion / 比較 toggle 會自動切換模式並清掉另一邊的狀態
- `currentMode` 為 in-memory state，sidepanel 重開後重置為一般模式（避免忘了 Fusion 還開著而誤觸發付費）

### Removed
- Model picker dropdown 內的 Fusion 條目（v1.36.0 加入）。Fusion 改由 picker-group 右側獨立 toggle 進入。

### Notes
- 設定頁的 `fusionEnabled` switch 不變，關閉後 Fusion toggle 按鈕完全隱藏。
- Fusion 模式強制 `skipTools: true` 且 agent iterations = 0，回到單模型純文字流程。

## [1.39.1] - 2026-06-15
### Added
- 設定頁 OpenRouter 區塊新增「顯示 Fusion 模型選項」開關（`fusionEnabled`，預設啟用）。關閉後側邊欄模型選擇器不再列出 `openrouter/fusion`，避免誤選付費 router。
- 修正側邊欄「比較」按鈕 dropdown 因缺少 `position: relative` 飄到上方的位置問題。

### Notes
- `fusionEnabled` 已納入雲端備份範圍。
- 若關閉 Fusion 且沒有任何自訂 OpenRouter 模型，OpenRouter section 整段不顯示。

## [1.39.0] - 2026-06-15
### Added
- 多模型並排比較（MVP / 純文字）：
  - 輸入列新增「比較」按鈕，點開後可勾選 2–3 個模型（MiniMax + 已啟用的 OpenRouter 自訂模型）
  - 送出後並行 spawn 多個 chat-stream port，每個模型獨立顯示一張卡片（卡片內含模型名、串流狀態、耗時、token 用量或錯誤訊息）
  - 比較卡片強制 `skipTools: true`，純文字模式，不觸發 Agent tools、圖片、PDF、檔案分析
  - 比較結果僅顯示於畫面，不會寫入 session 對話歷史，避免污染後續上下文
  - 比較模式偵測有圖片 / 翻譯 / 頁面 context 時自動退回單模型 chat

### Notes
- 「比較」按鈕在已選 ≥2 個模型時會以玫紅 active 樣式顯示，並標出 `比較 N`
- 「清除選取」可一鍵歸零，回到單模型模式

## [1.38.0] - 2026-06-15
### Added
- AI 設定與記憶工具：Agent loop 可呼叫三個受控工具
  - `get_setting(key)`：讀取白名單設定（globalPrompt、defaultPrompts.chat、settings.language、settings.model、settings.agentDepth、settings.planMode、autoMemoryEnabled）
  - `set_setting(key, value)`：以相同白名單寫入，含型別與 enum 驗證
  - `save_memory(title, summary, tags)`：寫入長期記憶（最多 30 條），同標題自動去重
- 操作歷程面板新增三個工具的圖示與中文標籤（讀取設定 / 更新設定 / 寫入長期記憶）

### Security
- 白名單外的 key 一律拒絕；同時以正則阻擋 `apiKey` / `token` / `secret` / `password` / `clientId` / `refreshToken` / `syncAuth` / `credential` 等敏感欄位，即便透過巢狀路徑也不可讀寫
- 寫入值會經過 maxLength 與 enum 驗證，避免 AI 寫入過大或無效內容

## [1.37.0] - 2026-06-15
### Added
- System Prompt 自動壓縮：當 `memoryContext + globalPrompt + defaultPrompt + 模式 prompt` 合計超過 context budget 30% 時，背景以 MiniMax / OpenRouter 壓縮為精簡版（保留指令本意，刪除冗詞），結果快取 14 天，下次相同內容直接複用。
- 壓縮通知：觸發 system prompt 壓縮時，側邊欄狀態列顯示「System prompt 已自動壓縮（原字數 → 壓縮字數）」。
- 設定頁「提示詞」區塊新增 `System Prompt 用量估算` 卡片：顯示 globalPrompt / chat prompt / 長期記憶各自字數、總計佔 budget 比例與是否觸發壓縮，並列出目前壓縮 cache 條目數。

### Notes
- 壓縮以原文字數的 85% 為下限，若壓縮結果未顯著縮短則沿用原文。
- Cache 採 hash 對映，最多保留 20 條最近條目；過期條目自動清理。
- 不影響 OpenRouter Image / PDF 路徑，這兩條維持原 system prompt 組合方式。

## [1.36.0] - 2026-06-15
### Added
- 模型選擇器新增 OpenRouter Fusion 內建選項（`openrouter/fusion`），在 OpenRouter section 釘選於首位，priceText 為「多模型審查，成本較高」，contextLength 採 `DEFAULT_CONTEXT_TOKENS` 作 fallback。Fusion 不寫入 `customModels`。
- OpenRouter 一般 chat path 新增免費優先 fallback：自動將其他已啟用的免費 OpenRouter 模型（`:free` 後綴或 input/output 價格皆為 0）加入 `models` 陣列，最多 5 個。Fusion、MiniMax、付費模型一律不進入 fallback list。
- OpenRouter 錯誤分類強化：偵測 HTTP 429 / rate limit / temporarily unavailable / insufficient credits 並輸出繁體中文文案，保留原始 modelId、fallback 列表與原始訊息供除錯。
- 設定頁 OpenRouter 區塊新增 Fusion 成本與免費 fallback 行為說明。

### Notes
- Fallback 僅作用於 OpenRouter 一般 chat path；image / PDF / agent tool loop 路徑維持原行為，不受影響。
- v1 不會自動切換至付費模型；全部免費 fallback 都失敗時，會明確顯示「免費模型皆暫不可用」的提示。

## [1.35.0] - 2026-06-04
### Added
- OpenRouter 模型費用表新增「上架日」欄位，顯示 `/api/v1/models` 的 `created` 上架時間。
- OpenRouter 模型費用表支援依上架日排序，首次點擊預設由新到舊。

### Changed
- OpenRouter 模型快取會保留 `created` metadata；舊快取缺少上架日時會自動重新整理模型資料。

## [1.34.1] - 2026-06-04
### Changed
- MiniMax 啟用開關改為純 switch 呈現，移除 True/False 文字標籤，並將控制區固定靠右。
- MiniMax 啟用開關調整灰色/綠色狀態色與尺寸，`provider-toggle-visual` 高度改為 25px。

## [1.34.0] - 2026-06-04
### Added
- Agent 設定新增 MiniMax 啟用開關；關閉時側邊欄會改以 OpenRouter 已啟用模型作為預設，且不再顯示 MiniMax。

### Changed
- Context window 使用量面板改為點擊後才展開，避免滑鼠 hover 時頻繁顯示。
- 模型選擇器在沒有可用模型時顯示空狀態並阻止送出，避免關閉 MiniMax 後又 fallback 回 MiniMax。

## [1.33.1] - 2026-06-04
### Fixed
- 修正網頁選取翻譯 popup 的原文與譯文操作列，兩側皆提供朗讀與複製 icon。
- 翻譯 popup 的 TTS 改用 Google TTS + Web Audio 播放流程，並保留 Web Speech fallback，避免譯文喇叭點擊後無聲。
- 選取翻譯 content script 改為版本化初始化與 cleanup，避免 extension reload 後舊注入狀態造成翻譯失效。

## [1.33.0] - 2026-05-13
### Added
- 新增課程錄音麥克風獨立授權視窗，避免 Chrome side panel 內權限提示被直接 dismiss。
- 錄音浮動控制列新增即時音量波浪指示，支援 offscreen 錄音與 fallback 錄音模式。

### Fixed
- 修正課程錄音播放在 Chrome 阻擋非同步 `audio.play()` 時沒有可操作播放器的問題，改為在課程卡片內載入原生音訊播放器。
- 課程錄音保存後會驗證本機音檔是否可讀，若音檔缺失會直接顯示提示。
- 改善分頁音訊擷取失敗時的回退流程與提示，避免 `activeTab` 或 Chrome 內建頁限制讓錄音完全無法啟動。

## [1.32.0] - 2026-05-12
### Added
- 新增英文課錄音流程：單字簿 Modal 內加入「錄音」分頁，支援 tab audio + microphone 錄製、提醒確認、暫停/停止浮動控制與本機課程紀錄列表。
- 新增 offscreen lesson recorder，透過 Chrome `offscreen`、`tabCapture` 與 `audioCapture` 權限保存課程音訊，並保留逐字稿草稿與課後整理入口。
- 新增金融市場儀表板入口，支援台股/美股市場切換、族群 heatmap、熱門標的、新聞雷達、個股詳情與「深入分析 / 新聞 / 加入對話」快速操作。

### Changed
- 金融工具補強 dashboard 共用資料層與 timestamp 標示，FinMind request 改為可帶 token header，並改善台股報價的前收與漲跌資料整理。
- 課程錄音權限提示與說明樣式補齊，避免使用者在未授權麥克風或尚未重載 extension 時卡住。

## [1.31.4] - 2026-05-11
### Fixed
- Agent 在工具已執行後遇到模型分析逾時時，不再直接輸出 raw 工具摘要作為停止結果。
- 模型分析請求逾時會安全重試；已連接工具任務會改為自動接續下一個最小批次，達上限後再用精簡工具結果做恢復整理。

## [1.31.3] - 2026-05-11
### Added
- Agent 在已連接工具任務完成前會執行自我驗收，根據原始任務、實際工具結果與候選最終回答判斷是否真的完成。
- 自我驗收未通過時，Agent 會自動續跑下一個最小批次，直到完成或達到安全上限。

### Fixed
- 純查詢型 Notion/Gmail/GA4 等 API 任務不再被誤判為必須有寫入類 API 才能完成。

## [1.31.2] - 2026-05-08
### Fixed
- 修正圖片型 / 掃描型 PDF 被 raw stream 內容誤判為文字型 PDF，避免錯誤優先走 OpenRouter PDF Inputs
- 修正上傳 PDF 的對話 session 標題顯示為 `[圖]` 的問題，依附件類型顯示 `[PDF]`、`[圖]`、`[文字]` 或 `[檔]`

## [1.31.1] - 2026-05-07
### Fixed
- 補強 Agent tool schema 的 object / array JSON 傳參提示，降低模型把結構化參數包成字串的機率
- Notion 預設工具新增 `notion_get_database` / `notion_update_database`，支援讀取與更新 database schema
- 設定頁載入時會對所有 OAuth2 預設工具庫自動補齊新增端點，避免舊 registry 看不到新工具
- background Agent 載入舊 Notion registry 時會自動補齊 database schema 讀取 / 更新工具

## [1.31.0] - 2026-05-07
### Added
- Notion 工具庫新增 `notion_append_block_children`（追加內容區塊）與 `notion_create_database`（建立資料庫）兩項工具
- Agent 新增請求重試機制（`AGENT_REQUEST_RETRY_COUNT`）與自動分段繼續（`AGENT_AUTO_CONTINUE_SEGMENTS`）
- API 工具參數型別自動轉換：model 接收到字串時可自動轉為 object / array / boolean / number
- Notion database properties schema 新增簡寫別名（如 `"date"` → `{ "date": {} }`）
- `notion_create_database` 支援預設 property schema 正規化
- background 層內建 Notion preset 工具定義，無需從 options 匯入即可在 Agent 中使用

### Changed
- Agent 請求逾時從 45s 延長至 120s，提升長任務穩定性
- 設定頁側邊欄標籤更名：「API 設定」→「Agent 設定」、「API 工具」→「連接應用程式」、「使用量與費用」→「OpenRouter 設定」
- OAuth Client Secret 欄位改為遮罩顯示（`••••••••••••`），點擊輸入框自動全選以便重新輸入，移除顯示/隱藏切換按鈕
- Notion console URL 更新為 Public connection 連結
- `notion_create_page`、`notion_update_page`、`notion_query_database` 工具描述更精確，避免誤用

## [1.30.0] - 2026-05-06
### Added
- API 工具新增四組 OAuth2 預設工具庫：Gmail、Google 日曆、Notion、Google Analytics 4
- 授權方式採用 `chrome.identity.launchWebAuthFlow`：點擊「授權」即跳出 OAuth 同意視窗，授權成功後 access token 存於 `chrome.storage.local`，AI 工具呼叫時自動帶入 `Authorization: Bearer …`
- Google 三項服務分別獨立的 OAuth Client（不共用 scope）：
  - Gmail：`gmail.readonly` + `gmail.send` + `gmail.modify`
  - Google 日曆：`calendar`（讀寫）
  - GA4：`analytics.readonly`
- Notion 採 authorization code flow；自動附加 `Notion-Version: 2022-06-28` header
- Google access token 過期自動以 refresh_token 續發；Notion token 不過期
- 設定頁顯示每個預設的 Redirect URI 並提供複製按鈕，方便貼回 OAuth Console
- API Tool 參數新增 `array` / `object` 型別支援，可讓 AI 傳遞結構化參數（如 GA4 dateRanges、Notion filter）
- `manifest.json` 新增 `gmail.googleapis.com`、`analyticsdata.googleapis.com`、`analyticsadmin.googleapis.com`、`api.notion.com` host_permissions

### 預設端點
- **Gmail**：`gmail_list_messages`、`gmail_get_message`、`gmail_list_threads`、`gmail_get_thread`、`gmail_list_labels`
- **Google 日曆**：`gcal_list_calendars`、`gcal_list_events`、`gcal_get_event`、`gcal_create_event`、`gcal_update_event`、`gcal_delete_event`
- **Notion**：`notion_search`、`notion_get_page`、`notion_get_block_children`、`notion_append_block_children`、`notion_create_page`、`notion_create_database`、`notion_get_database`、`notion_update_database`、`notion_update_page`、`notion_query_database`
- **Google Analytics 4**：`ga_list_account_summaries`、`ga_run_report`

## [1.29.0] - 2026-05-06
### Added
- Session 空間管理：每筆歷史紀錄可指定所屬空間，點擊空間 tag 開啟 popover 切換
- 當前對話 bar 顯示所屬空間 tag，點擊可直接切換
- 預設空間概念：spaceId 為 null 的 session 顯示為「預設」，新對話自動歸入
### Changed
- 歷史紀錄 panel 移至 `.main-area` 直接子層，覆蓋範圍含 `.input-area`
- 新對話按鈕改用 `closeAllPanels()`，確保關閉所有覆蓋頁
- `loadSpaces()` 提前到 `loadHistory()` 之前執行，避免空間 tag 顯示時序問題

## [1.28.2] - 2026-05-06
### Fixed
- 知識庫/單字簿/長期記憶 panel 移入 `.main-area`，修正 `position: absolute; inset: 0` 覆蓋 header 的問題
- `.history-header` padding/font-size 與空間、知識庫等 panel header 統一
- 移除 `.history-panel` 多餘的 `border-right`

## [1.28.1] - 2026-05-06
### Fixed
- Header 按鈕互斥切換：點擊任一 header 按鈕時，自動關閉其他已開啟的 panel
- 歷史紀錄 panel 新增關閉按鈕（×）
- 修正歷史紀錄被空間 panel 遮擋（z-index 衝突）問題
### Changed
- 知識庫、單字簿、長期記憶改為全覆蓋 panel 樣式（比照空間功能，移除浮動卡片 + 遮罩）
- 所有 panel 按鈕統一加入 active 高亮狀態

## [1.28.0] - 2026-05-06
### Added
- 多空間（Spaces）功能：可建立獨立工作空間，每個空間有獨立對話記錄
- 空間列表支援搜尋，並附引導頁面（功能說明 + 範例空間快速新增）
- 空間設定 Drawer：可設定空間指示（自動注入 AI system prompt）、參考連結
- 空間詳情頁上方顯示空間指示預覽（可展開/收合）與連結 chip
- 空間圖示選取器：30 個 SVG icon 以 Grid 排列，取代 emoji
- 空間底部輸入框：直接輸入即建立新 Session 並進入對話
- Header 新增「空間」按鈕（⊞ 圖示）作為功能入口

### Changed
- 空間 `icon` 欄位改用 SVG icon ID（向下相容舊有 emoji 空間）

## [1.27.0] - 2026-05-05
### Added
- WordPress REST API 預設工具庫改為啟用、連線設定、端點勾選與端點內編輯流程
- 預設端點支援卡片內編輯說明、端點、HTTP 方法、回傳上限與參數，不再混入自訂工具清單

### Changed
- WordPress 預設端點以相對端點顯示與編輯，站台基本網址由連線設定統一管理
- API 工具與 Agent 工具歷程改用 SVG icon，等待狀態文案改為「思考中」與「分析結果中」

### Fixed
- `wp_get_posts` 改用精簡欄位列表查詢並提高回傳上限，避免完整文章內容截斷導致 AI 只看到第一篇
- API 工具執行會正確合併既有 URL query，並讀取 WordPress `X-WP-Total` / `X-WP-TotalPages`
- `wp_get_posts` 會忽略 `any/all/全部/所有/不限` 等受限 status 查詢，避免 WordPress 回傳 `rest_forbidden_status`

## [1.26.0] - 2026-05-04
### Added
- API Tool Registry：使用者可在設定頁新增自訂 HTTP API 工具（GET/POST/PUT/PATCH/DELETE）
- 工具支援 query / path / body / header 參數，AI Agent 可在對話中自行判斷並呼叫
- Auth 支援 Bearer Token、API Key（Header/Query），Secret 僅存本機不傳送給模型
- 工具啟用/停用切換、回傳長度上限設定
- 操作歷程面板使用 API 圖示標示 API 工具呼叫

## [1.25.1] - 2026-05-04
### Changed
- 模型費用表推薦用途 badges 前新增「適合」label，提升視覺可讀性

## [1.25.0] - 2026-05-03
### Added
- 計畫模式設定（off / auto / always）：可在對話設定頁選擇關閉、自動（僅 /plan 觸發）或強制（每次發送前均需批准計畫）
- 工具風險分級：計畫批准卡顯示低/中/高風險標示，依 AI 回傳的 risk 欄位自動判斷
- 計畫卡持久化：計畫批准/取消狀態寫入 session，重新載入對話時顯示靜態計畫歷程卡
- 計畫修正流程：點擊「Make changes」後自動將原始任務帶回輸入框並恢復 /plan chip

## [1.24.3] - 2026-05-03
### Changed
- Agent 深度選擇器與模型選擇器以 flex 容器對齊，兩個按鈕高度一致，間距調整為 6px

## [1.24.2] - 2026-05-03
### Fixed
- TOC 目錄面板現在使用 MutationObserver 監聽聊天區域變動，AI 回應串流時即時自動更新目錄，不再需要關閉再重新開啟

## [1.24.1] - 2026-05-03
### Fixed
- TOC 目錄面板現在使用 MutationObserver 監聽聊天區域變動，AI 回應串流時會即時自動更新目錄，不再需要關閉再重新開啟

## [1.24.0] - 2026-05-03
### Added
- 瀏覽器自動化 Phase 1：新增 8 個 browser_* Agent Tools（`browser_click`、`browser_fill`、`browser_select`、`browser_get_text`、`browser_get_html`、`browser_scroll`、`browser_wait_for`、`browser_navigate`）
- 透過 `chrome.scripting.executeScript` 直接執行 DOM 操作，無需額外 content script，相容 React / Vue 應用（native value setter + 事件觸發）
- `browser_wait_for` 採輪詢機制，支援動態渲染頁面，逾時上限 15 秒
- `browser_navigate` 使用 `chrome.tabs.update`，整合 `browser_wait_for` 可等待頁面載入
- Agent 狀態列與操作歷程面板支援瀏覽器工具圖示（🖱 ✏️ 🌐 等）與動作標籤
- 瀏覽器工具永遠可用，不依賴搜尋 API Key

## [1.23.1] - 2026-05-03
### Added
- 新增 `/plan` 自然語言意圖偵測：「幫我計畫/規劃/制定計畫 + 任務」等自然句型自動進入計畫模式，無需輸入 `/plan`
- 支援句型：幫我計畫、幫我規劃、幫我制定計畫、幫我擬定計畫、計畫：XXX、規劃以下/XXX

## [1.23.0] - 2026-05-03
### Added
- 新增自然語言意圖偵測系統：輸入類似指令語意的句子時，自動對應並執行對應指令，無需手動輸入 `/指令`
- `/page`：偵測「分析/總結/摘要 + 當前/這個頁面」等句式，自動讀取頁面內容後帶入問題送出
- `/page-code`：偵測「原始碼/代碼/HTML/CSS」相關意圖，自動讀取頁面原始碼
- `/remember`：偵測「記住/幫我記住 + 內容」前綴，直接執行記憶儲存
- `/search`、`/deep-search`：偵測「搜尋/查一下」、「深度搜尋」前綴，直接觸發對應搜尋
- 自訂 template 指令：訊息以指令名稱開頭時自動套用 template 展開後送出

## [1.22.0] - 2026-05-01
### Added
- 新增 OpenRouter PDF 分流：文字型 PDF 優先使用 OpenRouter PDF Inputs（Cloudflare AI parser），圖片型／掃描型 PDF 維持 Gemini 視覺分析。
- 新增聊天附件相容層，保留舊 `images` / `fileInfos` 資料並支援統一 `attachments` 渲染。
- 新增 OpenRouter image output 擷取與聊天內圖片顯示，支援模型回傳圖片附件與常見 image content 格式。
- OpenRouter 費用表新增 Input / Output modalities 標示與 Output 類型篩選。
### Changed
- 上傳工具列按鈕由「上傳圖片」改為「上傳檔案」，反映目前支援圖片、PDF 與文字／程式碼檔。
- 檔案分析流程會顯示使用的分析方式，並在 OpenRouter / Gemini 失敗時提供模型、parser、檔名與錯誤細節。

## [1.21.0] - 2026-04-30
### Added
- 側邊欄輸入列新增模型選擇器（pill button）：點擊切換 MiniMax 或任意自訂 OpenRouter 模型
- 設定頁面 OpenRouter 自訂模型清單：可無限新增（顯示名稱 + 模型 ID），取代原本的下拉選單
### Changed
- 設定頁面 TOC 改為多頁切換（fade in/out 動畫），不再用錨點捲動
- 設定儲存成功／失敗訊息改為右下角浮動 Toast，不再 scroll 頂部
- background.js 路由邏輯改為依 model ID 判斷 provider，不再讀 openrouterModel 設定

## [1.20.0] - 2026-04-30
### Added
- 設定頁面新增 OpenRouter 整合：API Key 輸入、模型選擇（Claude、GPT-4o、Gemini、Llama、DeepSeek、Mistral）、自訂模型 ID、測試連線按鈕
- 設定 OpenRouter 後，文字對話（含 Agent 搜尋模式）自動切換至 OpenRouter，取代 MiniMax
- OpenRouter 設定加入自動備份範圍

## [1.19.1] - 2026-04-29
### Fixed
- Agent Loop 改為全程非串流，防止最終回答在 streaming 中再次觸發 `<minimax:tool_call>` 導致 XML 原文顯示並停止回覆
- 新增 `parseXmlToolCalls()`：正確解析 MiniMax M2.7 的 XML 格式工具呼叫（`<minimax:tool_call><invoke>`），不再依賴 OpenAI `tool_calls` JSON 格式
- 搜尋來源強制附 Markdown 超連結，修正 AI 只列來源名稱不附 URL 的問題
### Added
- Agent system prompt 注入當前日期，搜尋時優先取得近期資訊；工具描述要求關鍵字帶入年份

## [1.19.0] - 2026-04-29
### Added
- AI Agent Tool Use Phase 1：AI 可自主決定是否呼叫搜尋工具
  - `streamAgentChat()` agent loop：非串流偵測 tool_calls → 執行工具 → 串流最終回答
  - 工具定義：`web_search`（Brave 主 / Exa 備）、`deep_search`（Exa 主 / Brave 備）
  - `handleToolCall()` 統一工具執行路由，含自動 fallback
  - sidepanel 工具執行狀態：`🔍 搜尋網路：query` / `🔎 深度搜尋：query`
### Changed
- 移除 sidepanel AUTO_SEARCH 前置判斷，改由 AI Agent 在 background 自行決策
- 有圖片、翻譯模式、頁面 context 時自動 skipTools，回退正常 streaming

## [1.18.1] - 2026-04-27
### Changed
- 知識庫摘要改為可展開/收合：預設顯示 2 行截斷，點擊摘要或 chevron 按鈕展開完整內容，展開後箭頭旋轉 180° 指示狀態

## [1.18.0] - 2026-04-27
### Added
- **本機備份（匯出/匯入 JSON）**：設定頁新增「本機備份」區塊，可將所有設定（含提示詞）匯出為 JSON 檔，或從本機 JSON 檔還原，無需雲端帳號
### Fixed
- **備份還原防呆**：`restoreSettingsBackupPayload` 新增多種 response 結構支援（標準格式、WP plugin 包一層、舊格式頂層），避免提示詞因結構不符而被靜默覆蓋成空字串
- **options.js 改為 ES module**：改用 `import` 直接引用 `settings-backup.js`，移除對 background message 的依賴

## [1.17.1] - 2026-04-27
### Changed
- 優化 queue panel 視覺樣式：加入左右邊框、上方圓角（15px）、最大寬度 92%、水平置中

## [1.17.0] - 2026-04-27
### Added
- **TOC（目錄）面板**：右側工具列新增 TOC 按鈕，點擊或使用 `Ctrl+Alt+T` 開啟/收合，自動掃描對話中的 h1-h4 標題並生成可點擊目錄，點擊後平滑捲動至對應標題（留 20px 間距）
- **燈箱左右導航**：開啟圖片燈箱時，可點擊左右箭頭按鈕或按鍵盤方向鍵切換 session 內所有圖片，顯示當前圖片計數（X / Y）
- **Quiz 選項渲染**：Markdown 清單中格式為 `a) ... b) ... c) ...` 的選項自動渲染為橫排 badge 樣式，ABCDE 各有對應顏色標記
- **Grammar 標籤渲染**：`**Faulty:**` / `**Correct:**` 及其中文變體自動渲染為對應顏色標籤（紅/綠），`問題：` / `說明：` 標籤單獨高亮
- **填空底線樣式**：`___` 渲染為視覺化底線空格；中文括號翻譯 `（...）` 以較淡顏色顯示
- **鍵盤快捷鍵設定頁**：設定介面新增「鍵盤快捷鍵」區塊，列出所有快捷鍵對照表（含 `kbd` 樣式）

### Changed
- Markdown 清單項目移除多餘的 `>` 引用符號前綴
- 有序清單跨空行後使用 `start` 屬性維持正確序號（避免全部重置為 1）
- TOC 快捷鍵改為 `Ctrl+Alt+T`（避免 Chrome 攔截 `Ctrl+T`）

### Fixed
- 備份範圍新增 `customCommands`（改從 `local` 存取）、`vocabulary`，移除對話紀錄以避免 payload 過大

## [1.16.3] - 2026-04-25
### Fixed
- WordPress 備份失敗（payload too large）：移除 `chatSessions`、`sessionSummaries` 出備份範圍（對話紀錄不需雲端備份）
- 備份時 `customCommands` 從 `sync`（空）改讀 `local`，還原時寫入 `local`

## [1.16.2] - 2026-04-25
### Fixed
- 自訂指令模板過長時儲存失敗且無錯誤提示：將 `customCommands` 從 `chrome.storage.sync`（8KB 限制）遷移至 `chrome.storage.local`（10MB），並加上 try-catch 顯示明確錯誤訊息

## [1.16.1] - 2026-04-25
### Changed
- 自訂指令移除無效的「動作」類型下拉選單，`type` 固定為 `template`
- 觸發詞（Trigger）輸入框：固定寬度 110px，外框統一使用明顯樣式
- 顯示名稱（Name）輸入框：與觸發詞輸入框同樣明顯外框（`border: 1px solid rgba(255,255,255,0.25)`，背景 `rgba(255,255,255,0.07)`）
- 模板 textarea：`min-height: 100px`，外框樣式同步更新
- 模板 textarea placeholder 更新為具體使用範例，說明 `{input}` 佔位符用途

## [1.16.0] - 2026-04-24
### Added
- **對話內搜尋功能**：在右側工具列新增搜尋 icon，點擊或使用 `Ctrl+F` / `Cmd+F` 開啟搜尋列
- 搜尋列包含輸入框、上/下一個導覽按鈕、匹配計數（X/Y）、關閉按鈕
- 搜尋結果以文字層級 `<mark>` 標記精確 highlight，並自動 scroll 聚焦至關鍵字所在位置
- 支援 `Enter` / `Shift+Enter` 逐一跳轉，`Esc` 關閉搜尋並還原原始內容

## [1.15.5] - 2026-04-24
### Changed
- **佇列面板重新設計**：移至輸入框上方，做成可展開/收合的面板；展開後顯示每則排隊訊息預覽，每則有刪除按鈕；標題列顯示數量，點擊展開/收合 chevron 動畫

## [1.15.4] - 2026-04-24
### Added
- **訊息佇列**：串流進行中可繼續輸入並送出，訊息自動排入等待佇列；前一則回覆完成後立即送出下一則，依序執行
- **佇列 badge**：`input-bottom-bar` 顯示「N 則排隊中」指示器，停止按鈕或新建 session 時自動清空佇列
### Changed
- 主聊天串流期間 `messageInput` 不再被 disabled，使用者可自由輸入下一則訊息

## [1.15.3] - 2026-04-24
### Removed
- **模型選擇下拉**：移除 sidepanel 輸入列的模型 select（MiniMax-M2.7-highspeed / M2.5 選項），固定使用 MiniMax-M2.7
- **設定頁「預設模型」**：移除 options.html 對話設定中的 `defaultModel` select 及提示文字，`options.js` 對應的 DOM ref、存取與讀取邏輯一併移除
- **相關 CSS**：移除 `.chat-options-bar-wrapper`、`.chat-options-bar`、`.chat-select` 及 media query 樣式

## [1.15.2] - 2026-04-24
### Fixed
- **`/page` 自動搜尋干擾**：短頁面（< 6000 字）使用 `/page` 後發問，自動搜尋誤觸並將不相關的外部結果混入 context，導致 AI 解讀錯誤（如問 GitHub token 設定卻回答區塊鏈）；現在有頁面內容時一律跳過自動搜尋

## [1.15.1] - 2026-04-24
### Added
- **AI 建議選項可點擊**：AI 回覆中 Markdown blockquote 格式（`> - 選項`）自動渲染為可點擊的 suggestion chip 按鈕，點擊後直接送出該選項至 chatbox

### Changed
- `renderMarkdown` 加入 blockquote 解析：`> text` 顯示為提示文字，`> - item` 渲染為帶粉紅左框線的互動 chip 卡片

## [1.15.0] - 2026-04-24
### Added
- **輸入字數計數器**：輸入框超過 1000 字顯示計數，超過 3000 字橙色警示，超過 5000 字紅色閃爍警示
- **自動對話壓縮**：歷史訊息超出 token budget 時，自動呼叫 MiniMax 生成 200 字繁體中文摘要，注入 system prompt 保留語意；壓縮結果存入 `sessionSummaries`（`auto: true`），下次同 session 發送可直接複用，不重複壓縮
- **壓縮通知**：觸發壓縮時在狀態列顯示「歷史對話已自動壓縮，保留最近輪次」

### Changed
- `streamMiniMaxChat` / `handleMiniMaxChat` 接受 `sessionId` 並傳入壓縮函式
- 主送出 `STREAM_MESSAGE` 帶入 `sessionId: currentSession?.id`

## [1.14.6] - 2026-04-24
### Fixed
- **Context window 超限錯誤**：輸入或歷史累積過長時，API 回傳 `invalid params, context window exceeds limit` 導致 chatbox 顯示原始英文錯誤
- 在 `buildMessages` 加入 `trimHistoryForContext`：自動從最舊端裁切歷史訊息，確保 token 預算（`MAX_CONTEXT_CHARS = 40000` 字元）不超限
- 將 context window 相關 API 錯誤改為友善中文提示：「對話內容或歷史過長，已超出模型限制。請試著縮短輸入，或點擊「+」開啟新對話。」

## [1.14.5] - 2026-04-23
### Fixed
- **API Key 重載後消失**：`geminiApiKey`、`braveApiKey`、`exaApiKey` 未加入 `AUTO_BACKUP_KEYS_SYNC`，導致儲存後不觸發即時備份；開啟時自動同步用舊備份覆蓋，三組 Key 全部遺失
- 移除 `sanitizeSyncSettingsForBackup` 中 `autoBackupEnabled`/`autoBackupTime` 殘留欄位

## [1.14.4] - 2026-04-23
### Removed
- **每日定時備份**：移除 `chrome.alarms` 定時備份機制（`WORDPRESS_AUTO_BACKUP_ALARM`、`refreshWordPressAutoBackupAlarm`、`getNextAlarmTimestamp`），改以即時備份（storage.onChanged + 5s debounce）為唯一自動備份方式
- 移除 manifest.json 的 `alarms` 權限
- 移除設定頁「啟用每日自動備份」與「自動備份時間」UI 欄位
- 移除 `DEFAULT_SYNC_SETTINGS` 中的 `autoBackupEnabled` / `autoBackupTime` 欄位

## [1.14.3] - 2026-04-23
### Fixed
- **設定頁 API Key 全部消失**：options.js 中 `wpBaseUrlInput` 重複 `const` 宣告（第 32、39 行）導致 `SyntaxError`，整個設定頁腳本無法執行；移除多餘宣告，並補上兩處 null 保護

## [1.14.2] - 2026-04-23
### Fixed
- **按鈕無反應**：移除 `loadReplyModes()` 殘留呼叫（函式已刪除但呼叫未清除），導致 `DOMContentLoaded` 初始化中斷，所有 icon 按鈕（header 及 chatbox）均無法點擊

## [1.14.1] - 2026-04-23
### Added
- **Session 自動備份**：新增/更新 session 時同樣觸發即時備份（`chatSessions` 加入監聽清單）
- **開啟時自動同步**：設定頁新增「開啟時自動同步」選項，啟用後在其他裝置開啟 extension 時自動從 WordPress 還原最新備份

## [1.14.0] - 2026-04-23
### Changed
- **移除回覆模式**：移除設定頁「回覆模式」區塊及側邊欄切換選單，簡化 UI
- **WordPress URL 硬編碼**：移除設定頁 WordPress 站點網址輸入欄位，固定為 `jasonsbase.com`
- **長期記憶結構化**：記憶萃取改為 `{ title, summary, tags }` 物件格式，UI 顯示摘要與標籤；向下相容舊字串格式
### Added
- **資料變動即時備份**：長期記憶、單字簿、知識庫、設定有任何異動時，自動 debounce 5 秒觸發 WordPress 備份

## [1.13.0] - 2026-04-21
### Added
- **當前對話整理為單字簿**：側邊工具列新增按鈕，會從當前 Session 萃取單字清單、去重後存入單字簿
- **流程完成訊息寫入聊天區**：整理單字與立即總結完成後，會在 chat 末端保留狀態訊息（不只底部短暫提示）

### Changed
- **刪除當前對話按鈕位置**：`deleteCurrentSessionBtn` 移到右側工具列最後一個
- **記憶/知識庫 Modal 欄位順序**：`modal-search-bar` 與 `modal-filter-bar` 位置對調（搜尋列在上）
- **Assistant 訊息寬度**：`.message.message-assistant` 改為 `max-width: 100%`

## [1.12.0] - 2026-04-14
### Added
- **WordPress 自動備份時間**：同步設定新增每日自動備份與時間欄位，背景以 alarm 排程執行
- **備份範圍擴大**：納入長期記憶（memories）、知識庫（knowledgeBase）、單字簿（vocabulary）、Session（chatSessions / sessionSummaries）
- **外掛除錯強化**：外掛後台新增「顯示日誌」彈窗，並支援 log fallback 到 uploads 目錄

### Changed
- **設定頁導覽改版**：頂部導覽改為左側 Sidebar，並支援固定置頂與長內容獨立滾動
- **同步入口調整**：Google Drive 同步 UI 暫時隱藏，WordPress 作為主要同步路徑

## [1.11.4] - 2026-04-13
### Fixed
- **TTS 語音前段被截斷**：改用共用 `AudioContext`（`sharedAudioCtx`），播放前確保狀態為 `running`（`resume()` await），避免每次重建硬體初始化延遲

## [1.11.3] - 2026-04-13
### Fixed
- **TTS 語音前段被截斷**：改用 Web Audio API（`decodeAudioData` + `BufferSource.start(0)`）取代 HTML Audio 元素

## [1.11.2] - 2026-04-13
### Fixed
- **TTS 語言錯亂**：翻譯模式下 AI 回覆的 TTS 語言固定取 `targetLangSelect` 值，導致中文回覆用英文語音播放；改為用 `detectLang()` 偵測實際內容語言
- **TTS 語音前段被截斷**（部分修復）：改用 Blob URL 取代 data URI，搭配 `canplaythrough` 事件

## [1.11.0] - 2026-04-13
### Changed
- **搜尋指令分離**：`/search` 使用 Brave Search API（一般搜尋）；新增 `/deep-search` 使用 Exa Search API（深度搜尋）
- `webSearch()` 拆為獨立的 `braveSearch()` 和 `exaSearch()`，不再互為 fallback
- 自動搜尋（AUTO_SEARCH）改用 Brave Search

## [1.10.1] - 2026-04-13
### Fixed
- **翻譯模式 TTS 語言錯誤**：修正翻譯模式下 TTS 語言反轉問題（英文訊息用中文口音、中文訊息用英文口音）。翻譯模式現在用 `detectLang()` 依訊息內容自動偵測語言

## [1.10.0] - 2026-04-13
### Added
- **單字簿中文翻譯**：非中文單字旁顯示「中」icon，hover 時透過 Google Translate 取得中文翻譯並快取至 storage，下次直接顯示

## [1.9.0] - 2026-04-13
### Added
- **輸入歷史**：方向鍵 ↑/↓ 瀏覽最近 10 則輸入，方便重送失敗的訊息；重複輸入自動去重；多行文字時僅在首行/末行觸發

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
- 初始版本：AI Chat Chrome Extension，後續公開產品名調整為 Open Chat Hub。

## License

MIT
