# OpenRouter Fusion v1 + 免費模型 Fallback 實作計畫

## 概要

為 Open Chat Hub 加入 OpenRouter Fusion v1 入口，並針對偏好免費 OpenRouter 模型的使用者加入「免費優先」fallback，避免一個模型瞬時 429 或暫時不可用就讓對話失敗。

目標版號：**v1.36.0**（MINOR — 新增功能，向下相容）

參考文件：
- https://openrouter.ai/docs/guides/routing/routers/fusion-router
- https://openrouter.ai/docs/guides/features/server-tools/fusion
- https://openrouter.ai/docs/guides/routing/model-fallbacks
- https://openrouter.ai/docs/faq

---

## v1 範圍

### 1. 模型選擇器：加入 Fusion 內建選項
- label：`Fusion`
- modelId：`openrouter/fusion`
- priceText：`多模型審查，成本較高`
- 出現條件：使用者已設定 OpenRouter API Key
- 不寫入 `customModels`（保持為硬編內建選項，避免汙染使用者自訂清單與雲端備份）
- 與 v1.34.0 相容：MiniMax 關閉時 Fusion 仍可作為 OpenRouter section 內的選項

### 2. Fusion metadata 處理
- Fusion 是 router endpoint，**不會出現在 `/api/v1/models`**
  - `pricingMap` 無此條目時，priceText 直接使用硬編字串
  - `contextLength` 使用 `DEFAULT_CONTEXT_TOKENS` 作為保守 fallback（Fusion 實際 context 由底層分析模型決定）
- `getModelContextInfo('openrouter/fusion')` 必須回傳合理值，避免 context 預算面板顯示 NaN

### 3. 請求路徑：複用既有 OpenRouter chat path
- 選擇 Fusion 時 `model: 'openrouter/fusion'`，其餘流程不變
- Fusion **不參與** image / PDF 分流（這兩條路在 v1 直接 fallback 回 Gemini / Image path）

### 4. 免費優先 Fallback（僅作用於 OpenRouter 一般 chat）
- 從 `customModels` 中已啟用的條目挑出「免費模型」
- 判斷規則（任一成立即視為免費）：
  - modelId 包含 `:free` 後綴
  - OpenRouter pricing metadata `prompt === 0 && completion === 0`
- Fallback list 規則：
  - 排除 primary 模型本身
  - **排除 `openrouter/fusion`**（router 不能當 fallback）
  - **排除 MiniMax 與非 OpenRouter 模型**
  - 採陣列順序（之後可考慮 priority 設定，v2 處理）
  - 上限 5 個（避免 request body 過大；OpenRouter 對 fallback list 長度有實務限制）
- 觸發範圍：**僅普通 chat path**
  - 不套用於 OpenRouter Image / OpenRouter PDF Inputs / Agent tool loop（agent 已有自身重試）
- 不在 fallback list 中加入任何付費模型 — v1 不會自動產生付費請求

### 5. OpenRouter 錯誤訊息分類強化
- 偵測下列訊號（status code 或 message 內容）：
  - HTTP `429`
  - `rate limit` / `rate-limited`
  - `temporarily unavailable`
  - `temporarily rate-limited upstream`
  - `insufficient credits`
- 對應使用者文案（繁體中文）：
  - 免費模型可能達速率上限 / 暫時不可用 / 餘額不足
  - 保留原始 modelId 與摘要供除錯
- 全部 fallback 都失敗時：明確說明「已啟用的免費 OpenRouter 模型皆暫不可用」，並提示使用者可考慮：1) 稍後再試 2) 至設定頁啟用付費模型

### 6. 設定頁文案（options.html）
新增 Fusion 與免費 fallback 兩段繁體中文說明：
- Fusion 適用於研究、比對、審查、高風險決策
- Fusion 會同時呼叫多個分析模型 + 一個 judge 模型，**單次成本明顯高於一般 completion**
- 免費模型速率限制較嚴
- v1 採「免費優先」fallback，**不會自動切換到付費模型**

### 7. Agent 模式
- 維持現行：選用的 OpenRouter 模型若 metadata 不支援 `tools`，自動退回普通 chat
- 設定頁 Fusion 說明補一句：**Fusion v1 主要用於普通 chat / 研究審查，不保證 Agent tool calling**

### 8. 不在 v1 範圍
- 自訂 Fusion `analysis_models`、自訂 judge model
- 可調整 panel size（1–8 模型）
- 每次 Fusion 估算成本倍率
- 各 panel model 成功 / 失敗狀態顯示
- 自動切付費 fallback
- 以上全部移至 v2 backlog

---

## 實作步驟

| # | 動作 | 檔案 | 狀態 |
|---|------|------|------|
| 1 | 撰寫 plan.md | `plan.md` | ✅ 已完成 |
| 2 | 在 TODO.md 加入 Fusion v1 Planned section | `TODO.md` | ✅ 已完成 |
| 3 | 模型選擇器加入 Fusion 內建項 + Fusion metadata fallback | `sidepanel/sidepanel.js` | ⏳ 待實作 |
| 4 | OpenRouter chat path 加入 free-fallback 組合邏輯與 `models` 陣列 | `background.js` | ⏳ 待實作 |
| 5 | OpenRouter 錯誤分類與文案強化（含 429 / rate limit / insufficient credits）| `background.js` | ⏳ 待實作 |
| 6 | 設定頁加入 Fusion 與免費 fallback 說明區塊 | `options/options.html` | ⏳ 待實作 |
| 7 | 版號 bump 1.35.0 → 1.36.0 | `manifest.json` / `package.json` / `package-lock.json` / `README.md` 版本欄位 | ⏳ 待實作 |
| 8 | README Changelog 與 TODO Done 區塊更新 | `README.md` / `TODO.md` | ⏳ 待實作 |
| 9 | `npm run build` 驗證 | — | ⏳ 待實作 |

---

## 驗證項目

### 自動驗證
- `npm run build`：無錯誤、無新警告
- manifest / package.json / README 版號一致為 1.36.0

### 手動驗證
1. **未設定 OpenRouter Key**：模型選擇器不顯示 Fusion
2. **已設定 OpenRouter Key**：Fusion 出現於 OpenRouter section
3. **選擇 Fusion 對話**：request body `model === 'openrouter/fusion'`，不附 `models` fallback
4. **選擇一般免費模型對話**：request body 含 `models` 陣列，含其他啟用的免費模型，不含付費 / Fusion / MiniMax
5. **單一啟用免費模型**：request body 不附 `models`（沒有 fallback 候選）
6. **全部 fallback 失敗**：顯示繁體中文「免費模型皆暫不可用」訊息與原 modelId
7. **Context 預算面板**：Fusion 顯示 `DEFAULT_CONTEXT_TOKENS` 對應 char budget，不顯示 NaN
8. **MiniMax 關閉時**：選擇器只顯示 OpenRouter 模型（含 Fusion），不 fallback 回 MiniMax
9. **Image / PDF 分流**：Fusion 不參與圖片或 PDF 路徑（請走 Gemini / OpenRouter PDF Inputs，與現行行為一致）

### 不該發生
- v1 自動切付費模型
- Fusion 進入 fallback list
- Fusion 寫入 `customModels`
- 模型選擇器在開啟 / 切換期間 context 預算顯示 NaN

---

## 假設與限制

- v1 採免費優先 fallback，**絕不**自動建立付費請求
- v1 不新增 permission、API Key、外部服務
- Fusion 計費完全由 OpenRouter 端管理；v1 不嘗試在 client 預估成本
- `recordOpenRouterUsage` 會照常記錄 Fusion 的 usage（含 panel + judge 加總）
- 若需 commit，commit message 使用繁體中文

---

## v2 Backlog（之後評估）

- 自訂 Fusion `analysis_models` 清單
- 自訂 judge model
- 可調整 panel size（1–8 模型）
- 每次 Fusion 估算成本倍率（cost multiplier）
- 各 panel model 成功 / 失敗狀態顯示
- Optional 低成本付費 fallback（與「免費優先」並存的雙層 fallback 策略）
- Priority-based fallback ordering（取代目前的陣列順序）

### 為何 Panel / Judge 客製化留到 v2
- 成本透明度：panel + judge + final 三段呼叫讓成本估算複雜化
- 錯誤狀態：每個 panel call 與 judge call 可獨立失敗，UI 與重試策略需重新設計
- UI / 儲存擴張：排序、刪除、去重、modelId 驗證、備份相容性
- 目前使用者偏好為「免費優先」，v1 應先把 fallback 與錯誤訊息打穩
