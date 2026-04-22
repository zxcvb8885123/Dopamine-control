# Usage Analytics Module

模組三負責「使用時長追蹤」與「數據報表」，讓使用者能清楚看到自己在各網站的時間分布。

## Overview

Usage Analytics 由三層組成：

### Content Layer
- `content/content.js`
- 負責即時追蹤使用時間並定時回報

### Storage Layer
- `modules/usage-analytics/storage.js`
- 負責資料寫入與讀取（`chrome.storage.local`）

### Analytics & UI Layer
- `modules/usage-analytics/summary.js`
- `popup/report.js`
- 負責統計與報表渲染

## Core Features
- 即時累計網站使用秒數
- 前景頁面才計算（避免背景誤算）
- 自動儲存至 `chrome.storage.local`
- 提供：
  - 今日使用量
  - 近 7 天統計
  - 近 30 天統計
- 報表 UI 顯示各網站使用時間分布

## Data Flow
1. 使用者停留在網站時，content script 持續累計秒數
2. 定時呼叫 `recordUsageChunk()`
3. 資料寫入 `usageAnalytics`
4. 同時送出：
   - `REPORT_USAGE`（給 background）
   - `CHECK_LIMIT`（相容既有邏輯）
5. 報表頁讀取資料並進行統計顯示

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

## File Structure
```text
modules/usage-analytics/
├── timer.js        # 計時與回報
├── storage.js      # 資料儲存
├── summary.js      # 統計邏輯

popup/
├── report.html     # 報表 UI
├── report.js       # 報表渲染
```

## UI Entry
- `popup/popup.html` 提供「查看數據報表」按鈕
- 點擊後開啟：`popup/report.html`

## Notes
- 計算僅在 `document.visibilityState !== "hidden"` 時進行
- 回報頻率會影響報表即時性
- 建議在 `pagehide` 時 flush 最後一次資料

## Summary

此模組將「使用行為」轉換為可視化數據，幫助使用者：
- 提升自覺
- 辨識高成癮網站
- 作為後續限制策略依據