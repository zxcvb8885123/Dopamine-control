# 多巴胺控制插件：功能設計需求文件

本文件摘要了「多巴胺控制（Dopamine Detox）」插件的三大核心功能模組，旨在透過減少數位刺激、物理阻斷及數據化監控，協助使用者奪回注意力的掌控權。

---

## 模組一：介面去刺激化 (Visual De-cluttering)
**狀態：待開發**

**核心目標：** 移除網頁中誘發「無意識滑動」的設計元素，讓使用者保持任務導向。

* **隱藏動態牆 (Feed Eradicator)**
    * **說明：** 強制封鎖 Facebook、Instagram 或 LinkedIn 的新聞動態（News Feed）。
    * **效益：** 確保使用者打開社群媒體是為了特定的通訊或發文需求，而非陷入無止盡的捲動。
* **移除 YouTube 推薦欄位 (Unhook)**
    * **說明：** 隱藏側邊欄推薦影片、首頁影片牆、評論區及通知紅點。
    * **效益：** 防止使用者從觀看教學或工作相關影片，被演算法引導至短影音（Shorts）或無關的娛樂黑洞。

**技術接口：**
- 實作於 `content/declutter.js`，對外暴露 `window.__ddDeclutter.run(settings)`
- 在 `content/content.js` 的 TODO 區塊呼叫，並加入 `manifest.json` 的 `content_scripts`

---

## 模組二：強制阻斷與排程 (Hard Blocking & Scheduling)
**狀態：已完成**

**核心目標：** 從時間維度建立「物理摩擦力」，在理性斷線時由系統強制介入。

* **分段封鎖 (Segmented Blocking)**
    * **說明：** 自定義工作時段（預設 09:00–18:00，週一至週五），在此期間完全禁止訪問 `blockedDomains` 清單內的網站。時段以 HH:MM 格式儲存，精確到分鐘。
    * **實作：** `background.js` 透過 `chrome.alarms` 每分鐘執行 `updateWorkHoursBlock()`，動態更新 `declarativeNetRequest` 規則，將請求導向 `blocked.html?reason=workhours`。
* **每日限時 (Daily Limit)**
    * **說明：** 為特定平台設定每日累計使用上限。使用者可在 Popup 自訂任意網域與分鐘數。
    * **實作：** Content script 頁面開啟時立即查詢是否已超額（`seconds=0`），並每 5 秒送出 `REPORT_USAGE`；`background.js` 累積秒數超額後將分頁導向 `blocked.html?reason=limit`，並於本地午夜自動重置。
* **強制冷卻 (Forced Cooldown)**
    * **說明：** 當使用者進入 `cooldownDomains` 清單中的網站時，系統強制顯示 N 秒（預設 20 秒）的全螢幕呼吸練習引導。
    * **實作：** `content/cooldown.js` 注入覆蓋層（所有 CSS 以 `__dd-` 前綴隔離）；以 `sessionStorage` 確保每個 session 每個域名只觸發一次；倒數結束後覆蓋層自動消失。

**設定儲存（`chrome.storage.local`）：**

```js
{
  enabled: true,
  workStart: '09:00',      // HH:MM 字串
  workEnd: '18:00',
  workDays: [1,2,3,4,5],  // 0=週日 … 6=週六
  blockedDomains: ['tiktok.com', 'twitter.com', 'x.com', 'reddit.com', 'dcard.tw'],
  dailyLimits: { 'youtube.com': 1800, 'instagram.com': 1800, 'facebook.com': 1800 },
  cooldownDomains: ['youtube.com', 'instagram.com', ...],
  cooldownSeconds: 20,
  dailyUsage: { 'youtube.com': 450 },  // 秒；午夜重置
  lastResetDate: 'YYYY-MM-DD'
}
```

**Popup 設定介面（已完成）：**
- 工作時段使用時間選擇器（`<input type="time">`），精確到分鐘
- 三個可動態編輯的域名清單：封鎖清單、每日限時、冷卻清單
- 可新增任意網域、刪除個別項目、即時修改分鐘數

---

## 模組三：行為追蹤與數據化 (Usage Tracking)
**狀態：已完成**

**核心目標：** 透過數據可視化，讓使用者察覺成癮行為並建立自覺。

* **使用量追蹤**
    * **說明：** `content.js` 追蹤所有網站，每秒計算、每 5 秒批次寫入 `usageAnalytics`；頁面可見 + 視窗聚焦 + 2 分鐘內有操作（或影片播放中）才計時，閒置自動暫停。
    * **效益：** 精準記錄真實使用時間，避免背景分頁或放著不動誤算。
* **數據報表 (Usage Report)**
    * **說明：** Popup 內建「查看數據報表」，點擊後在 popup 內直接切換至報表 view（iframe 內嵌，不另開分頁），顯示今日 / 近 7 天 / 近 30 天各網站使用時間分布與進度條。
    * **效益：** 讓使用者清楚看見自己的成癮模式。
* **AI 使用行為分析**
    * **說明：** 支援 OpenAI、Gemini 或 Custom Endpoint；使用者填入 API Key 後，報表頁可一鍵產生摘要、分心風險分級、異常提醒與明日改善建議。
    * **效益：** 將數據轉化為可執行的行動建議。

**技術接口：**
- 計時邏輯內建於 `content/content.js`（`startUsageTracking()`），寫入 `usageAnalytics` storage key
- 統計與 AI 邏輯位於 `modules/usage-analytics/`（storage.js、summary.js、ai.js）
- 報表頁實作於 `popup/report.html` / `popup/report.js`

---


