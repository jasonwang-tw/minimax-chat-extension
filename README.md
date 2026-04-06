# MiniMax AI Chat Extension

串接 MiniMax + Gemini Vision API 的 Chrome 擴充功能，支援側邊欄對話、圖片分析、歷史紀錄功能。

## 版本

**v1.1.0**

## 功能特色

- 點擊擴充圖示即可開啟側邊欄進行 AI 對話
- **雙引擎架構**：文字對話走 MiniMax（MiniMax-M2.7 模型），圖片分析走 Gemini（gemini-2.5-flash-lite 模型）
- **截圖分析**：一鍵截取目前頁面並發送給 AI 分析
- **圖片上傳**：支援上傳本地圖片進行視覺分析
- 對話歷史自動保存（最多 50 筆），可切換歷史對話
- API Key 安全儲存在本機（chrome.storage.sync）
- 深色主題 UI 設計

## 安裝方式

1. 開啟 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇 `minimax-chat-extension` 資料夾

## 使用方式

1. 點擊擴充圖示，進入設定頁面
2. 輸入您的 **MiniMax API Key**（文字對話必填）
3. 輸入您的 **Gemini API Key**（截圖/圖片分析必填）
4. 點擊對應的「測試連線」確認 API 可用
5. 儲存設定後即可開始對話
6. 側邊欄中可使用截圖按鈕或上傳圖片，搭配文字提問進行圖片分析

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

- **Manifest V3**：使用最新的 Chrome 擴充功能格式
- **Service Worker**：背景處理 API 請求（MiniMax 文字 / Gemini 圖片分流）
- **Side Panel**：側邊欄 UI
- **TailwindCSS + SCSS**：樣式設計

## Changelog

## [1.1.0] - 2026-04-06
### Changed
- 更新 README，補充 Gemini Vision 雙引擎架構、截圖/圖片上傳功能、雙 API Key 設定說明

## [1.0.0] - 2026-04-06
### Added
- 初始版本：MiniMax AI Chat Chrome Extension

## License

MIT
