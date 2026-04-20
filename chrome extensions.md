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
8. [Ko-fi 贊助 Widget](#ko-fi-贊助-widget)
9. [載入與測試](#載入與測試)
10. [建議開發順序](#建議開發順序)

---

## 架構概覽

Chrome 插件（Manifest V3）由三個主要執行環境組成：

| 環境 | 檔案 | 職責 |
|------|------|------|
| **Content Script** | `content/*.js` | 注入目標頁面，顯示冷卻覆蓋層、回報使用量 |
| **Service Worker** | `background.js` | 背景執行，管理封鎖排程、每日限時、儲存統計 |
| **Popup UI** | `popup/*.html/js` | 使用者設定介面 |
| **Extension Page** | `blocked.html/js` | 封鎖導向頁，顯示原因與剩餘時間 |

三個環境之間透過 `chrome.runtime.sendMessage` 通訊，共用資料存於 `chrome.storage.local`。

> **注意：** Content scripts 不支援 ES modules（無 bundler 情況下）。每個檔案採用 IIFE + `window.__ddXxx` 全域物件，manifest 的 `content_scripts` 陣列決定載入順序。

---

## 檔案結構

```
dopamine-detox/
├── manifest.json
├── background.js
├── blocked.html
├── blocked.js
├── content/
│   ├── content.js        主入口：協調各模組
│   └── cooldown.js       強制冷卻覆蓋層（已完成）
│   ├── declutter.js      隱藏 Feed、YouTube 推薦（待開發）
│   └── timer.js          浮動計時器（待開發）
├── popup/
│   ├── popup.html
│   └── popup.js
├── rules/
│   └── block_rules.json  靜態規則（目前為空，動態規則由 background 管理）
├── vendor/
│   └── kofi-overlay-widget.js  Ko-fi widget 本地副本
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Manifest 設定

```json
{
  "manifest_version": 3,
  "name": "Dopamine Detox",
  "version": "0.1.0",
  "description": "減少數位刺激，奪回注意力掌控權",
  "permissions": [
    "storage",
    "tabs",
    "declarativeNetRequest",
    "alarms"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/cooldown.js", "content/content.js"],
      "run_at": "document_end"
    }
  ],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "block_rules",
      "enabled": true,
      "path": "rules/block_rules.json"
    }]
  },
  "web_accessible_resources": [
    {
      "resources": ["blocked.html"],
      "matches": ["<all_urls>"]
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 關鍵 Permissions 說明

- `storage` — 儲存封鎖規則與使用時數
- `declarativeNetRequest` — 網路層封鎖（不需攔截所有請求，效能好、隱私佳）
- `alarms` — 定時任務（每日重置限時計數、每分鐘觸發工作時段檢查）
- `tabs` — 每日超額時導向封鎖頁

---

## 模組一：介面去刺激化
**狀態：待開發**

**原理**：在目標頁面注入 CSS，用 `display: none` 隱藏特定 DOM 元素；對 SPA 頁面用 `MutationObserver` 監聽動態載入的內容。

### `content/declutter.js`（待實作）

```js
(function () {
  'use strict';

  const RULES = {
    'youtube.com': [
      '#secondary',                // 側邊推薦欄
      '#shorts-container',         // Shorts 區域
      'ytd-rich-grid-renderer',    // 首頁影片牆
      '#comments',                 // 評論區
    ],
    'facebook.com': [
      '[data-pagelet="FeedUnit"]',
      '[data-pagelet="Stories"]',
      '[role="feed"]',
    ],
    'instagram.com': [
      'main > div > div:first-child',
    ],
    'linkedin.com': [
      '.feed-shared-update-v2',
      '.news-module',
    ],
  };

  window.__ddDeclutter = {
    run(settings) {
      if (!settings.enabled) return;
      const hostname = location.hostname.replace(/^www\./, '');
      const matchedKey = Object.keys(RULES).find(k => hostname.includes(k));
      if (!matchedKey) return;

      const selectors = RULES[matchedKey];
      const style = document.createElement('style');
      style.textContent = selectors.map(s => `${s}{display:none!important}`).join('\n');
      document.head.appendChild(style);

      new MutationObserver(() => {
        selectors.forEach(sel =>
          document.querySelectorAll(sel).forEach(el => { el.style.display = 'none'; })
        );
      }).observe(document.body, { childList: true, subtree: true });
    }
  };
})();
```

在 `content/content.js` 的 TODO 處取消註解，並將 `declutter.js` 加入 manifest 的 `content_scripts` 陣列（放在 `cooldown.js` 之後）。

---

## 模組二：強制阻斷與排程
**狀態：已完成**

### 2-1 Service Worker `background.js`（核心邏輯摘要）

```js
// 工作時段格式：'HH:MM' 字串（精確到分鐘）
const DEFAULTS = {
  workStart: '09:00',
  workEnd: '18:00',
  workDays: [1, 2, 3, 4, 5],
  blockedDomains: ['tiktok.com', 'twitter.com', 'x.com', 'reddit.com', 'dcard.tw'],
  dailyLimits: { 'youtube.com': 1800, 'instagram.com': 1800, 'facebook.com': 1800 },
  cooldownSeconds: 20,
};

// HH:MM → 午夜起算分鐘數（模組頂層，供多處呼叫）
function parseHHMM(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

// 每分鐘由 chrome.alarms 觸發，動態建立/移除 declarativeNetRequest 規則
async function updateWorkHoursBlock() {
  const startMin = parseHHMM(workStart);
  const endMin   = parseHHMM(workEnd);
  // startMin >= endMin 時視為無效時段，不封鎖
  const isWorkHour = startMin < endMin && nowMinutes >= startMin && nowMinutes < endMin;

  if (isWorkTime) {
    // redirect 到 blocked.html?reason=workhours&end=HH:MM
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  }
}

// REPORT_USAGE 處理：seconds=0 為純查詢不累加，seconds=30 為正常回報
async function handleUsageReport({ domain, seconds }, sender) {
  const usedSeconds = seconds > 0 ? (prevSeconds + seconds) : prevSeconds;
  if (limitSec > 0 && usedSeconds >= limitSec) {
    await chrome.tabs.update(sender.tab.id, { url: blockedUrl });  // redirect
  }
}
```

### 2-2 強制冷卻 `content/cooldown.js`

- IIFE 封裝，對外暴露 `window.__ddCooldown.run(settings)`
- 全螢幕覆蓋層 + 呼吸動畫 + 倒數進度條
- 所有 CSS ID / class 加 `__dd-` 前綴，並用 `#__dd-overlay` 作 scope，避免與目標頁面衝突
- `sessionStorage` 確保同一 session 每個域名只觸發一次

### 2-3 封鎖頁 `blocked.html` / `blocked.js`

URL 參數格式：
- `?reason=workhours&end=18:30` — 顯示工作時段封鎖與解除時間
- `?reason=limit&domain=youtube.com` — 顯示每日限時到期與重置倒數

---

## 模組三：行為追蹤與數據化
**狀態：待開發**

### `content/timer.js`（待實作）

```js
(function () {
  'use strict';

  window.__ddTimer = {
    run(settings) {
      if (!settings.enabled) return;

      // 顯示浮動計時器（左下角）
      const el = document.createElement('div');
      el.id = '__dd-timer';
      el.style.cssText = `
        position:fixed; bottom:16px; right:16px;
        background:rgba(0,0,0,0.7); color:#fff;
        font-size:12px; padding:4px 10px;
        border-radius:12px; z-index:99999;
        font-family:monospace; pointer-events:none;
      `;
      document.body.appendChild(el);

      const start = Date.now();
      setInterval(() => {
        const s = Math.floor((Date.now() - start) / 1000);
        el.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
      }, 1000);
    }
  };
})();
```

每 30 秒的 `REPORT_USAGE` 訊息由 `content/content.js` 的 `startUsageTracking()` 負責送出（已完成），timer.js 只需處理視覺顯示。

---

## Popup 設定介面
**狀態：已完成**

### 功能

| 區塊 | 說明 |
|---|---|
| 啟用切換 | iOS 風格 toggle，停用時所有封鎖暫停 |
| 工作時段 | `<input type="time">` 選擇器，精確到分鐘；存檔時驗證開始 < 結束 |
| 工作時段封鎖清單 | 標籤式清單，可新增/刪除任意域名 |
| 每日限時 | 每個域名獨立卡片，可修改分鐘數（0 = 不限） |
| 強制冷卻清單 | 標籤式清單，可新增/刪除任意域名 |
| 冷卻秒數 | 全域設定，套用至所有冷卻域名 |

### 域名輸入規則

- 自動去除 `https://`、`www.` 前綴與路徑
- 輸入格式驗證：每段只允許字母數字與連字號，不允許連續點號

---

## Ko-fi 贊助 Widget

### Popup（按鈕）

```js
document.getElementById('btn-kofi').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ko-fi.com/K3K21Y3P17' });
});
```

### 封鎖頁（Floating Chat Widget）

```html
<script src='../vendor/kofi-overlay-widget.js'></script>
<script>
  kofiWidgetOverlay.draw('apollo888', {
    'type': 'floating-chat',
    'floating-chat.donateButton.text': 'Support me',
    'floating-chat.donateButton.background-color': '#00b9fe',
    'floating-chat.donateButton.text-color': '#fff'
  });
</script>
```

`vendor/kofi-overlay-widget.js` 是從 `https://storage.ko-fi.com/cdn/scripts/overlay-widget.js` 下載的本地副本。若 Ko-fi 更新腳本，重新下載覆蓋即可：

```bash
curl -s https://storage.ko-fi.com/cdn/scripts/overlay-widget.js -o vendor/kofi-overlay-widget.js
```

---

## 載入與測試

1. 打開 `chrome://extensions`
2. 右上角開啟 **Developer mode**
3. 點 **Load unpacked** → 選擇 `dopamine-detox/` 資料夾
4. 修改程式碼後，點插件卡片的重新整理按鈕（↺）

### 常用 Debug 指令

```js
// 查看所有 storage
chrome.storage.local.get(null, console.log);

// 查看現行動態封鎖規則
chrome.declarativeNetRequest.getDynamicRules().then(console.log);

// 快速測試每日限時（設成 10 秒）
chrome.storage.local.set({ dailyLimits: { 'youtube.com': 10 }, dailyUsage: {} });

// 快速測試工作時段封鎖（設成現在起 5 分鐘）
const h = new Date().getHours(), m = new Date().getMinutes();
const pad = n => String(n).padStart(2,'0');
chrome.storage.local.set({ workStart: `${pad(h)}:${pad(m)}`, workEnd: `${pad(h)}:${pad(m+5)}` });
chrome.alarms.create('checkWorkHours', { when: Date.now() + 500 });

// 重置測試資料
chrome.storage.local.set({ dailyUsage: {}, workStart: '09:00', workEnd: '18:00' });
```

---

## 建議開發順序

```
Phase 1  介面去刺激化     content/declutter.js    — 純 CSS+DOM，最快見效        ← 待開發
Phase 2  浮動計時器       content/timer.js        — 視覺顯示（REPORT_USAGE 已就緒）← 待開發
Phase 3  每日限時封鎖     background.js           — 已完成
Phase 4  工作時段排程     background.js           — 已完成
Phase 5  強制冷卻畫面     content/cooldown.js     — 已完成
Phase 6  Popup 設定介面   popup/                  — 已完成（動態域名管理）
Phase 7  週報告頁面       popup/report.html/js    — 待開發
```
