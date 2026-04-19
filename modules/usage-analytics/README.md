# Usage Analytics Module

模組三負責行為追蹤與數據化，實作位置為 `modules/usage-analytics/`。

## 功能清單

1. 浮動計時器顯示  
   在頁面右下角顯示 `TIME mm:ss`，每秒更新。

2. 前景頁面才累計  
   分頁隱藏時不累加，避免背景頁面誤算時間。

3. 每 30 秒上報使用時間  
   透過 `chrome.runtime.sendMessage` 發送：
   - `type: "CHECK_LIMIT"`
   - `domain`
   - `seconds`

4. 本地統計儲存  
   同步寫入 `chrome.storage.local["usageAnalytics"]`，依日期與網域累積秒數。

5. 離頁補寫機制  
   `pagehide` 時 flush 未滿 30 秒的剩餘秒數，降低資料遺失。

6. 啟停控制  
   - `startTimer(options?)`：啟動計時器（重複呼叫不會重開 interval）
   - `stopTimer()`：停止計時並做最後一次 flush

7. 統計查詢 API  
   - `getTodayUsage()`：今日總秒數、網域分佈
   - `getLastNDaysUsage(days?)`：近 N 日總量、日均、Top domains

8. 時長格式化工具  
   `formatSeconds(totalSeconds)` 將秒數轉為可讀字串（如 `1h 2m 3s`）。

## 檔案說明

- `timer.js`
  - 追蹤使用秒數
  - 更新浮動計時器
  - 定期上報與離頁補寫

- `storage.js`
  - 提供 `usageAnalytics` 儲存讀寫
  - 提供 `recordUsageChunk` 寫入統計

- `summary.js`
  - 提供今日與近 N 日彙總資料

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
        "reddit.com": 2400
      }
    }
  }
}
```

## 串接重點

- Content 端在適當時機呼叫 `startTimer()`。
- 若背景端尚未接好 `CHECK_LIMIT`，本地統計仍可正常保存。
- Popup/Report 可直接使用 `summary.js` 取得彙總資料。
