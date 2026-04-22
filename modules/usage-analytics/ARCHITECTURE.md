# Usage Analytics Architecture

## Overview
Usage Analytics 由三層組成：
1. `content/content.js`：定時回報使用秒數
2. `modules/usage-analytics/storage.js`：寫入 `usageAnalytics`
3. `modules/usage-analytics/summary.js` + `popup/report.js`：聚合並渲染報表

## Data Flow
1. 使用者停留在目標網站時，content script 每隔一段時間累計秒數。
2. 將秒數寫入 `chrome.storage.local["usageAnalytics"]`。
3. 同步送出 `REPORT_USAGE` 給 background（與既有限時邏輯相容）。
4. 報表頁讀取 `usageAnalytics`，計算今日 / 近 7 天 / 近 30 天統計。

## Storage Schema
```json
{
  "version": 1,
  "updatedAt": 1760000000000,
  "days": {
    "2026-04-19": {
      "totalSeconds": 5400,
      "domains": {
        "youtube.com": 3000,
        "facebook.com": 1200,
        "reddit.com": 1200
      }
    }
  }
}
```

## Key APIs
- `recordUsageChunk({ domain, seconds, timestamp })`
- `getTodayUsage()`
- `getLastNDaysUsage(days)`

## UI Entry
- `popup/popup.html` + `popup/popup.js` 提供「查看數據報表」按鈕
- 點擊後開啟 `popup/report.html`

## Notes
- 報表顯示更新取決於回報頻率與 flush 時機（例如 `pagehide`）。
- 若要更即時，可縮短回報間隔，但會增加 storage 寫入頻率。
