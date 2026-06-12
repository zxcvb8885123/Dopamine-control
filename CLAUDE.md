# CLAUDE.md

## 載入與重新整理

無需建置步驟，直接在 Chrome 載入：

1. 開啟 `chrome://extensions`，啟用右上角的**開發人員模式**
2. 點擊**載入未封裝項目** → 選擇 `dopamine-detox/` 資料夾
3. 修改任何檔案後，點擊插件卡片上的 ↺ 重新整理按鈕
4. Content script 的變更還需要重新整理目標分頁才會生效

圖示檔案（`icons/icon16.png`、`icons/icon48.png`、`icons/icon128.png`）必須存在，否則載入時會報錯。

### 除錯入口

| 對象 | 開啟方式 |
|---|---|
| Content scripts | 目標網頁 → F12 → Console |
| Service Worker | `chrome://extensions` → 插件的「Service Worker」連結 |
| Popup | 右鍵點擊插件圖示 → 「檢查彈出視窗」 |
| Storage 內容 | Service Worker Console → `chrome.storage.local.get(null, console.log)` |
| 現行動態規則 | Service Worker Console → `chrome.declarativeNetRequest.getDynamicRules().then(console.log)` |

## 架構概覽

三個互相隔離的執行環境，透過 `chrome.runtime.sendMessage` 通訊：

```
Service Worker (background.js)
  └─ 管理 declarativeNetRequest 動態規則、alarms、dailyUsage 儲存

Content Scripts (content/*.js)  ← 注入到每個頁面
  ├─ cooldown.js   定義 window.__ddCooldown（優先載入）
  └─ content.js    送出 GET_SETTINGS → background，再依序啟動各模組

Modules (modules/usage-analytics/*.js)  ← ES module，供 popup 頁面 import
  ├─ storage.js    讀寫 usageAnalytics（chrome.storage.local）
  ├─ summary.js    統計邏輯（今日 / 近 7 天 / 近 30 天）
  └─ ai.js         AI API 設定、Prompt 建立、API 呼叫

Extension Pages
  ├─ popup/popup.html   設定介面，讀寫 storage；內嵌 report.html（iframe）
  ├─ popup/report.html  使用量報表頁（含 AI 分析）
  └─ blocked.html       硬封鎖規則的導向目標頁
```

## 檔案結構

```
dopamine-detox/
├── manifest.json
├── background.js
├── blocked.html / blocked.js
├── content/
│   ├── content.js        主入口，協調各模組；內建 usage tracking（每 5 秒回報）
│   └── cooldown.js       強制冷卻覆蓋層
├── modules/
│   └── usage-analytics/
│       ├── storage.js    讀寫 usageAnalytics storage key
│       ├── summary.js    統計邏輯
│       ├── ai.js         AI API 設定與呼叫
│       └── timer.js      （供 report 頁使用的計時顯示）
├── popup/
│   ├── popup.html / popup.js
│   └── report.html / report.js   使用量報表頁
├── rules/
│   └── block_rules.json  靜態規則（目前為空，動態規則由 background 管理）
├── vendor/
│   └── kofi-overlay-widget.js  （未使用，保留備用）
└── icons/
    ├── icon16.png / icon48.png / icon128.png
```

## Storage 資料結構（`chrome.storage.local`）

```js
{
  enabled: true,
  workStart: '09:00',      // HH:MM 字串（非整數）
  workEnd: '18:00',
  workDays: [1,2,3,4,5],  // 0=週日 … 6=週六
  blockedDomains: [...],   // 工作時段內完全封鎖的域名（使用者可自訂）
  dailyLimits: {           // 每日上限（秒）；0 = 不限（使用者可自訂）
    'youtube.com': 1800
  },
  cooldownDomains: [...],  // 進入時顯示強制冷卻覆蓋層的域名（使用者可自訂）
  cooldownSeconds: 20,
  dailyUsage: {            // 今日已使用秒數；午夜重置
    'youtube.com': 450
  },
  lastResetDate: 'YYYY-MM-DD',
  usageAnalytics: {        // 模組三使用量歷史（content.js 寫入，report.js 讀取）
    version: 1,
    updatedAt: 1760000000000,
    days: {
      'YYYY-MM-DD': {
        totalSeconds: 5400,
        domains: { 'youtube.com': 3000 }
      }
    }
  }
}
```

## 訊息協定

| `type` | 方向 | Payload | 回應 |
|---|---|---|---|
| `GET_SETTINGS` | content → bg | — | storage 子集 |
| `REPORT_USAGE` | content → bg | `{ domain, seconds }` | `{ ok, action, remaining }` |
| `SETTINGS_UPDATED` | popup → bg | — | 立即重新計算封鎖規則 |
| `OPEN_POPUP` | blocked.js → bg | — | — |

`REPORT_USAGE` 的 `seconds=0` 是純查詢（頁面開啟時立即檢查是否已超額），不累加 dailyUsage。

## 模組狀態與接口

**已完成（模組二：強制阻斷與排程）：**
- `background.js` — 工作時段封鎖、每日限時強制、午夜重置
- `content/cooldown.js` — 對外暴露 `window.__ddCooldown.run(settings)`
- `blocked.html` / `blocked.js` — 封鎖導向頁，顯示封鎖原因與剩餘時間
- `popup/popup.html` / `popup.js` — 完整設定介面，支援動態新增/刪除域名清單

**已在 `content/content.js` 內建的行為：**

- Usage tracking — `startUsageTracking()` 追蹤**所有網站**（不限 dailyLimits）；每 1 秒 tick，每 5 秒批次寫入 `usageAnalytics`；`REPORT_USAGE` 只送有設限時的網域
- 活躍判斷（`isActive()`）：頁面可見 + 視窗聚焦 + （2 分鐘內有操作 OR 有影片/音訊播放中）
- 閒置 2 分鐘自動暫停計時；extension context 失效時自動停止 interval
- 暴露 `window.__ddUsageTracker.stop()` 防止重複初始化

**已完成（模組三：行為追蹤與數據化）：**
- `modules/usage-analytics/storage.js` — 讀寫 `usageAnalytics`，含錯誤處理
- `modules/usage-analytics/summary.js` — 統計今日 / 近 7 天 / 近 30 天
- `modules/usage-analytics/ai.js` — 支援 OpenAI、Gemini、Custom Endpoint；管理 API 設定儲存；產生使用行為分析報告
- `popup/report.html` / `popup/report.js` — 使用量報表 UI，含 AI 分析區塊

**待接入的模組（`content/content.js` 內有對應的 TODO hook）：**
- 模組一（去刺激化）：實作於 `content/declutter.js`，暴露 `window.__ddDeclutter.run(settings)`

## 重要限制

- **Content scripts 不能使用 ES modules** — 每個檔案採用 IIFE + `window.__ddXxx` 全域物件的寫法，manifest 的 `content_scripts` 陣列決定載入順序。
- **動態規則 ID 分兩段**：1000–1999（`DYNAMIC_RULE_ID_BASE`）為工作時段封鎖；2000–2999（`DAILY_LIMIT_RULE_ID_BASE`）為每日限時超額封鎖，priority 3 高於工作時段規則（priority 2）。兩段互不干擾，避免與 `rules/block_rules.json` 靜態規則衝突。
- **工作時段每分鐘檢查一次**（`chrome.alarms` 最小間隔），時間邊界最多延遲 60 秒生效。
- **workStart 必須早於 workEnd** — 不支援跨夜時段；background 若偵測到 `startMin >= endMin` 會視為無效直接跳過封鎖。
- **冷卻覆蓋層每 session 只觸發一次** — `sessionStorage` 鍵 `__dd_cooldown_shown__<domain>`；重開分頁重新觸發。
- **CSS 採 `__dd-` 前綴** — cooldown.js 的所有 class / id 均加上 `__dd-` 前綴，並以 `#__dd-overlay` 作為 CSS scope，避免與目標頁面衝突。
- **`blocked.html` 是唯一的 web-accessible resource** — `declarativeNetRequest` redirect 規則才能指向它。
- **`popup/report.html` 以 iframe 內嵌於 popup** — 「查看數據報表」按鈕不會開新分頁，而是在 popup 內切換 view；`#report-view.is-open` 控制顯示；`#back-btn` 返回設定。
