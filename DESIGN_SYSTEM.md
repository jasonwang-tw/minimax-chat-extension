# Open Chat Hub 系統設計規範

## 表單控制

- 二元狀態控制使用 iOS-style switch，不使用文字型「啟用 / 停用」按鈕。
- Switch 必須使用 `role="switch"` 與 `aria-checked` 表示狀態，並提供 `aria-label` 或等效輔助文字。
- Switch on 狀態使用 iOS green `#34c759`，off 狀態使用中性灰 `rgba(120, 120, 128, 0.34)`。
- 緊湊列表中的 Switch 尺寸固定為 `25px × 14px`，knob 為 `10px` 圓形，移動距離固定，避免文字或狀態切換造成版面位移。
- 設定頁列表項目停用時可降低卡片透明度，但欄位仍需可讀，避免把停用狀態誤認為不可編輯。
- 設定頁表單欄位必須有可見 label，不可以只依賴 placeholder 表示欄位用途。
- 自訂指令這類列表表單中，啟用/停用 switch 必須獨立成狀態列，不與文字輸入欄位混在同一列。
