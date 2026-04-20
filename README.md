# Dopamine-control

Chrome Extension（Manifest V3）專案，目標是協助使用者降低高刺激平台造成的注意力流失。

## 我負責的部分（模組三：Usage Tracking）

模組三：行為追蹤與數據化（Usage Tracking）  
狀態：已完成（待整體串接驗收）

## 模組三已完成重點

1. 實時計時器（顯示 `domain + mm:ss`）
2. 每 30 秒回報 `REPORT_USAGE`（並保留相容訊息）
3. 本地儲存 `usageAnalytics`（含離頁補寫）
4. 週報告頁 `popup/report.html`、`popup/report.js`（Top domain + 排序）
