# Usage Analytics Module

模組三負責「使用時長追蹤」與「數據報表」。

## Scope
- 即時累計網站使用秒數
- 儲存到 `chrome.storage.local["usageAnalytics"]`
- 提供每日 / 近 7 天 / 近 30 天統計
- 提供 `popup/report.html` 報表頁

## Files
- `modules/usage-analytics/timer.js`: 計時與回報流程
- `modules/usage-analytics/storage.js`: usageAnalytics 讀寫
- `modules/usage-analytics/summary.js`: 報表聚合邏輯
- `popup/report.html`: 報表頁 UI
- `popup/report.js`: 報表頁渲染邏輯

## Integration Notes
- popup 設定頁新增「查看數據報表」按鈕，開啟 `popup/report.html`
- 使用量資料由 content script 回寫並同步通知 background（`REPORT_USAGE`）

## More
詳細設計與資料流請看：
- `modules/usage-analytics/ARCHITECTURE.md`
