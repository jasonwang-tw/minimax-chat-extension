# MiniMax AI Chat Extension

串接 MiniMax API 的 Chrome 擴充功能，支援側邊欄對話、歷史紀錄功能。

## 功能特色

- 點擊擴充圖示即可開啟側邊欄進行 AI 對話
- 對話歷史自動保存（最多 50 筆）
- API Key 安全儲存在本機
- 深色主題 UI 設計

## 安裝方式

1. 開啟 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點擊「載入未封裝項目」
4. 選擇 `minimax-chat-extension` 資料夾

## 使用方式

1. 點擊擴充圖示，進入設定頁面
2. 輸入您的 MiniMax API Key
3. 點擊「測試連線」確認 API 可用
4. 儲存設定後即可開始對話

## API Key

請至 [MiniMax Platform](https://platform.minimax.chat/) 取得 API Key。

## 開發

```bash
# 安裝依賴
npm install

# 編譯樣式
npm run build:css
```

## 技術架構

- **Manifest V3**: 使用最新的 Chrome 擴充功能格式
- **Service Worker**: 背景處理 API 請求
- **Side Panel**: 側邊欄 UI
- **TailwindCSS + SCSS**: 樣式設計

## License

MIT
