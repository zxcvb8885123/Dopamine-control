# 模組三：行為追蹤與數據化 (Usage Tracking)

狀態：已完成（待整體串接驗收）


## 模組目標

透過使用時間追蹤與數據呈現，幫助使用者察覺高刺激平台的使用模式，建立自覺並調整後續封鎖策略。

## 已完成功能

1. 實時計時器（浮動顯示）
- 在頁面右下角顯示：`domain + mm:ss`
- 例如：`youtube.com  01:25`
- 採低干擾 UI（半透明、模糊背景、小字體）

2. 前景頁面才累計
- 僅在 `document.visibilityState !== "hidden"` 時累計
- 避免背景分頁誤算

3. 每 30 秒回報使用時間
- 送出：
  - `{ type: "REPORT_USAGE", domain, seconds }`
- 並保留：
  - `{ type: "CHECK_LIMIT", domain, seconds }`
- 目的：整合期間與既有流程相容

4. 本地儲存 usageAnalytics
- 寫入 `chrome.storage.local["usageAnalytics"]`
- 依「日期 / 網域」累積秒數

5. 離頁補寫
- `pagehide` 時會 flush 尚未回報的秒數
- 降低資料遺失風險

6. 統計 API
- `getTodayUsage()`
- `getLastNDaysUsage(days = 7)`
- 支援排序後的網域使用量資料

7. 週報告頁（popup）
- `popup/report.html`
- `popup/report.js`
- 顯示近 7 天：
  - Total Usage
  - Avg/day
  - Top 1 Domain
  - 網域使用排行（由大到小）

## 技術接口

### 計時器對外接口

`timer.js` 內提供兩種呼叫方式：

- 匯出函式：
  - `startTimer(settings?)`
  - `stopTimer()`

- 全域接口（規範對齊）：
  - `window.__ddTimer.run(settings)`
  - `window.__ddTimer.stop()`

### 訊息格式

每 30 秒送出：

```js
{ type: "REPORT_USAGE", domain, seconds: 30 }
```

## 檔案說明

- `modules/usage-analytics/timer.js`
  - 計時、浮動 UI、上報訊息、離頁補寫、全域接口

- `modules/usage-analytics/storage.js`
  - usageAnalytics 讀寫與 chunk 累計

- `modules/usage-analytics/summary.js`
  - 今日與近 N 日彙整、Top domains

- `popup/report.html`
  - 週報告頁面結構與樣式

- `popup/report.js`
  - 讀取 `getLastNDaysUsage(7)` 並渲染資料

## Storage Schema

儲存鍵值：`chrome.storage.local["usageAnalytics"]`

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

## 串接備註

- 本模組不修改 `manifest.json`、`background.js`、`content.js`
- 若主入口尚未接上，可先透過 `window.__ddTimer.run()` 驗證計時功能
- background 端接上 `REPORT_USAGE` 後，可直接串接模組二每日限時計數
