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
    * **實作：** Content script 頁面開啟時立即查詢是否已超額（`seconds=0`），並每 30 秒送出 `REPORT_USAGE`；`background.js` 累積秒數超額後將分頁導向 `blocked.html?reason=limit`，並於午夜自動重置。
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
**狀態：待開發**

**核心目標：** 透過數據可視化，讓使用者察覺成癮行為並建立自覺。

* **實時計時器 (Real-time Timer)**
    * **說明：** 在網頁角落顯示微小的浮動計時器，即時呈現當前網頁已耗費的時間。
    * **效益：** 打破「時間流逝錯覺」，讓使用者對耗費的時間產生即時痛感。
* **成癮報告 (Addiction Report)**
    * **說明：** 每週彙整各類網站的使用時數與頻率。
    * **效益：** 分析哪些平台分泌了過多不必要的多巴胺，作為調整下週封鎖策略的依據。

**技術接口：**
- 實作於 `content/timer.js`，對外暴露 `window.__ddTimer.run(settings)`
- 每 30 秒送出 `{ type: 'REPORT_USAGE', domain, seconds: 30 }` 給 `background.js`，同時驅動模組二的每日限時計數器
- 週報告頁面實作於 `popup/report.html` / `popup/report.js`

---

## 其他功能

### Ko-fi 贊助 Widget
- **Popup** 底部：☕ 請我喝杯咖啡 按鈕，點擊開新分頁至 Ko-fi
- **封鎖頁** 右下角：Ko-fi floating chat widget（`vendor/kofi-overlay-widget.js` 本地副本）
- Ko-fi 頁面：https://ko-fi.com/K3K21Y3P17

---

## 開發順序建議

```
Phase 1  介面去刺激化     content/declutter.js    — 純 CSS+DOM，最快見效        ← 待開發
Phase 2  浮動計時器       content/timer.js        — Content Script 基礎          ← 待開發
Phase 3  每日限時封鎖     background.js           — 已完成
Phase 4  工作時段排程     background.js           — 已完成
Phase 5  強制冷卻畫面     content/cooldown.js     — 已完成
Phase 6  Popup 設定介面   popup/                  — 已完成（動態域名管理）
Phase 7  週報告頁面       popup/report.html/js    — 待開發
```
