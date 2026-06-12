# Dopamine Detox — Chrome 插件開發指南

> 透過減少數位刺激、物理阻斷及數據化監控，協助使用者奪回注意力的掌控權。

---

## 目錄

1. [架構概覽](#架構概覽)
2. [檔案結構](#檔案結構)
3. [Manifest 設定](#manifest-設定)
4. [模組一：介面去刺激化](#模組一介面去刺激化)
5. [模組二：強制阻斷與排程](#模組二強制阻斷與排程)
6. [模組三：行為追蹤與數據化](#模組三行為追蹤與數據化)
7. [Popup 設定介面](#popup-設定介面)
8. [載入與測試](#載入與測試)
9. [開發進度](#開發進度)

---

## 架構概覽

Chrome 插件（Manifest V3）由三個主要執行環境組成：

| 環境 | 檔案 | 職責 |
|------|------|------|
| **Content Script** | `content/*.js` | 注入目標頁面，顯示冷卻覆蓋層、回報使用量 |
| **Service Worker** | `background.js` | 背景執行，管理封鎖排程、每日限時、儲存統計 |
| **Popup UI** | `popup/*.html/js` | 使用者設定介面；內嵌 report.html（iframe） |
| **Extension Page** | `blocked.html/js` | 封鎖導向頁，顯示原因與剩餘時間 |

三個環境之間透過 `chrome.runtime.sendMessage` 通訊，共用資料存於 `chrome.storage.local`。

> **注意：** Content scripts 不支援 ES modules（無 bundler 情況下）。每個檔案採用 IIFE + `window.__ddXxx` 全域物件，manifest 的 `content_scripts` 陣列決定載入順序。

---

## 檔案結構

```
dopamine-detox/
├── manifest.json
├── background.js
├── blocked.html / blocked.js
├── content/
│   ├── content.js        主入口：usage tracking + 協調各模組
│   └── cooldown.js       強制冷卻覆蓋層
├── modules/
│   └── usage-analytics/
│       ├── storage.js    讀寫 usageAnalytics storage key
│       ├── summary.js    統計邏輯（今日 / 近 N 天）
│       └── ai.js         AI API 設定與呼叫
├── popup/
│   ├── popup.html / popup.js     設定介面
│   └── report.html / report.js  使用量報表頁
├── rules/
│   └── block_rules.json  靜態規則（目前為空，動態規則由 background 管理）
├── design.md             設計系統 token 規範
├── issues/               GitHub issue 草稿
├── vendor/
│   └── kofi-overlay-widget.js  （未使用，保留備用）
└── icons/
    ├── icon16.png / icon48.png / icon128.png
    ├── taiwan-icon-wiki.svg    header 小圖示
    └── taiwan-simplemaps.svg  背景水印
```

---

## Manifest 設定

```json
{
  "manifest_version": 3,
  "name": "Dopamine Detox",
  "version": "0.1.0",
  "permissions": ["storage", "tabs", "declarativeNetRequest", "alarms"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/cooldown.js", "content/content.js"],
    "run_at": "document_end"
  }],
  "declarative_net_request": {
    "rule_resources": [{ "id": "block_rules", "enabled": true, "path": "rules/block_rules.json" }]
  },
  "web_accessible_resources": [{ "resources": ["blocked.html"], "matches": ["<all_urls>"] }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
  }
}
```

---

## 模組一：介面去刺激化
**狀態：待開發**

在目標頁面注入 CSS，用 `display: none` 隱藏特定 DOM 元素；對 SPA 頁面用 `MutationObserver` 監聽動態載入的內容。

實作於 `content/declutter.js`，暴露 `window.__ddDeclutter.run(settings)`，在 `content/content.js` TODO 區塊呼叫。

---

## 模組二：強制阻斷與排程
**狀態：已完成**

### 2-1 Service Worker `background.js`

- 每分鐘透過 `chrome.alarms` 觸發 `updateWorkHoursBlock()`，動態建立/移除 `declarativeNetRequest` 規則
- `REPORT_USAGE` 累積超額後將分頁導向 `blocked.html?reason=limit`
- 每日重置使用**本地時區**午夜，非 UTC

```js
// 每日重置使用本地時區，避免非 UTC 時區在錯誤時間重置
function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

### 2-2 強制冷卻 `content/cooldown.js`

- 全螢幕覆蓋層 + 倒數進度條，所有 CSS 加 `__dd-` 前綴
- `sessionStorage` 確保同一 session 每個域名只觸發一次

### 2-3 封鎖頁 `blocked.html` / `blocked.js`

URL 參數格式：
- `?reason=workhours&end=18:30` — 工作時段封鎖，顯示解除時間
- `?reason=limit&domain=youtube.com` — 每日限時到期，顯示重置倒數

圖示依封鎖原因切換：工作時段（藍色盾牌）、每日限時（琥珀色時鐘）、一般封鎖（紅色 X）。

---

## 模組三：行為追蹤與數據化
**狀態：已完成**

### 3-1 Usage Tracking（`content/content.js`）

追蹤**所有網站**，不限 `dailyLimits` 名單：

```
isActive() 判斷：
  頁面可見（visibilityState === 'visible'）
  AND 視窗有 focus（document.hasFocus()）
  AND（最近 2 分鐘內有操作 OR 有影片/音訊正在播放）
```

- 每秒 tick，每 5 秒批次寫入 `usageAnalytics`
- `REPORT_USAGE` 只送有設每日上限的網域（觸發封鎖判斷）
- 閒置 2 分鐘自動暫停；extension context 失效時自動清除 interval
- 自動清理 30 天以前的 analytics 資料

### 3-2 報表頁（`popup/report.html`）

- 從 popup 點「查看數據報表」在 popup 內以 iframe 切換，不另開分頁
- 今日 / 近 7 天 / 近 30 天切換，含各網站進度條與百分比
- 日均計算除以「實際有資料的天數」，新使用者不會看到被稀釋的數字
- 5 秒自動重整

### 3-3 AI 分析（`modules/usage-analytics/ai.js`）

支援 OpenAI、Gemini、Custom Endpoint；產生使用摘要、分心風險分級、異常提醒、明日建議。

---

## Popup 設定介面
**狀態：已完成**

| 區塊 | 說明 |
|---|---|
| 啟用切換 | iOS 風格 toggle |
| 工作時段 | `<input type="time">` 選擇器，存檔時驗證開始 < 結束 |
| 工作時段封鎖清單 | 標籤式清單，可新增/刪除 |
| 每日限時 | 每個域名獨立卡片，顯示今日已用時間與進度條 |
| 強制冷卻清單 | 標籤式清單，可新增/刪除 |
| 查看數據報表 | popup 內切換至 report view（iframe） |

---

## 載入與測試

1. 打開 `chrome://extensions`，右上角開啟 **Developer mode**
2. 點 **Load unpacked** → 選擇 `dopamine-detox/` 資料夾
3. 修改程式碼後，點插件卡片的 ↺ 重新整理
4. Content script 變更需額外重新整理目標分頁

### 常用 Debug 指令（Service Worker Console）

```js
// 查看所有 storage
chrome.storage.local.get(null, console.log);

// 查看現行動態封鎖規則
chrome.declarativeNetRequest.getDynamicRules().then(console.log);

// 快速測試每日限時（設成 10 秒）
chrome.storage.local.set({ dailyLimits: { 'youtube.com': 10 }, dailyUsage: {} });

// 重置測試資料
chrome.storage.local.set({ dailyUsage: {}, usageAnalytics: null });
```

---

## 開發進度

| Phase | 功能 | 檔案 | 狀態 |
|---|---|---|---|
| 1 | 介面去刺激化 | `content/declutter.js` | ⬜ 待開發 |
| 2 | 強制阻斷與排程 | `background.js` | ✅ 已完成 |
| 3 | 強制冷卻畫面 | `content/cooldown.js` | ✅ 已完成 |
| 4 | Popup 設定介面 | `popup/popup.html/js` | ✅ 已完成 |
| 5 | 行為追蹤與數據化 | `content/content.js` + `modules/` | ✅ 已完成 |
| 6 | 使用量報表頁 | `popup/report.html/js` | ✅ 已完成 |
| 7 | AI 分析 | `modules/usage-analytics/ai.js` | ✅ 已完成 |
