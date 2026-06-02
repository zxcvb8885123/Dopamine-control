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
- `modules/usage-analytics/ai.js`
- `popup/report.js`
- 負責統計與報表渲染

## Core Features
- 即時累計網站使用秒數
- 前景且目前聚焦的頁面才計算（避免背景分頁或失焦視窗誤算）
- 自動儲存至 `chrome.storage.local`
- 提供：
  - 今日使用量
  - 近 7 天統計
  - 近 30 天統計
- 報表 UI 顯示各網站使用時間分布
- AI 使用行為分析，提供摘要、異常提醒與明日改善建議

## Newly Added Features

本次模組三主要新增與強化以下功能：

### 1. 更精準的計時機制
- 將使用時間改為每秒累計，並每 5 秒批次回報一次。
- 只有在頁面可見且瀏覽器視窗聚焦時才計算使用時間。
- 使用者切換分頁、視窗失焦、離開頁面或關閉頁面時，會先回報尚未送出的秒數，降低漏算機率。
- 新增 `window.__ddUsageTracker.stop()`，避免 content script 重複初始化時產生多組計時器。

### 2. AI API 使用行為分析
- 新增 `modules/usage-analytics/ai.js`，集中處理 AI 設定、Prompt 建立、API 呼叫與分析結果整理。
- 報表頁新增「AI 使用行為分析」區塊。
- 支援 OpenAI、Gemini 與 Custom API Endpoint。
- 可儲存 API Provider、API Key、Endpoint 等設定到 `chrome.storage.local`。
- 產生分析時會結合今日使用量、近 7 天平均與昨日使用量，輸出：
  - 今日使用摘要
  - 使用時間異常提醒
  - 明日改善建議

### 3. 報表頁互動強化
- 新增「儲存設定」與「產生 AI 分析」按鈕。
- 新增分析中、完成、錯誤與缺少 API Key 的狀態提示。
- 選擇 Custom Provider 時會顯示自訂 API Endpoint 欄位。
- 選擇 OpenAI 或 Gemini 時會自動套用預設 API Endpoint。

### 4. 儲存層錯誤處理
- `storage.js` 在讀取與寫入 `chrome.storage.local` 後會檢查 `chrome.runtime.lastError`。
- 若 Chrome storage 發生錯誤，會明確丟出錯誤，方便報表頁或後續邏輯顯示失敗原因。

## Data Flow
1. 使用者停留在網站時，content script 持續累計秒數
2. 每 5 秒批次回報一次使用秒數
3. 資料寫入 `usageAnalytics`
4. 同時送出 `REPORT_USAGE` 給 background，用於每日限時判斷
5. 報表頁讀取資料並進行統計顯示
6. 若使用者啟用 AI 分析，報表頁會整理使用資料並呼叫指定的 AI API 產生建議

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
- `getAiSettings()`
- `saveAiSettings(settings)`
- `generateAiAnalysis(settings, report)`

## File Structure
```text
modules/usage-analytics/
├── timer.js        # 計時與回報
├── storage.js      # 資料儲存
├── summary.js      # 統計邏輯
├── ai.js           # AI 分析與 API 設定

popup/
├── report.html     # 報表 UI
├── report.js       # 報表渲染
```

## UI Entry
- `popup/popup.html` 提供「查看數據報表」按鈕
- 點擊後開啟：`popup/report.html`

## Notes
- 計算僅在 `document.visibilityState === "visible"` 且 `document.hasFocus()` 時進行
- 回報頻率目前為每 5 秒一次，兼顧即時性與寫入次數
- 建議在 `pagehide` 時 flush 最後一次資料
- AI 分析需要使用者自行提供 API Key；若未啟用或未填 Key，系統不會呼叫外部 API

## Summary

此模組將「使用行為」轉換為可視化數據，幫助使用者：
- 提升自覺
- 辨識高成癮網站
- 作為後續限制策略依據
