# MiniMax AI Chat Extension

串接 MiniMax + Gemini Vision API 的 Chrome 擴充功能，支援側邊欄對話、區域截圖、OCR 文字辨識、翻譯、TTS 語音輸出、歷史紀錄管理。

## 版本

**v1.3.0**

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

### 其他
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
