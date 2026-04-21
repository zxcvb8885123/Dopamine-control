# 模組一：介面去刺激化 (Visual De-cluttering)

**狀態：實驗中（核心整合完畢）**

## 模組目標

透過主動攔截與隱藏社交平台中高刺激性的誘導式 UI 元素（如演算法推薦、無限捲動牆），減少視覺誘因，幫助使用者奪回注意力的掌控權。

---

## 已完成功能

### 雙軌制隱藏機制

* **靜態 CSS 注入**：利用 `document.createElement('style')` 達成毫秒級隱藏，確保目標元素在渲染前即被攔截，達成「零閃爍」體驗。
* **動態 DOM 監測**：使用 `MutationObserver` 持續監控 SPA（單頁應用）換頁與動態載入行為，確保新內容自動套用過濾規則。

### 多平台規則矩陣 (Rule Matrix)

* **集中定義**：收錄 YouTube、Facebook, Instagram, LinkedIn, Dcard 五大平台之過濾規則。
* **屬性選取技術**：鎖定 `data-pagelet`、`role` 等語義化屬性，繞過平台混淆類名 (Obfuscated Classes) 的干擾。

### 跨頁面路由監聽

* 特別針對 YouTube 實作 `yt-navigate-finish` 監聽，解決 SPA 換頁時腳本不重整導致的失效問題。

### UI/UX 控制整合 (Popup)

* **實作 Popup 設定面板**：支援一鍵切換開關。
* **狀態持久化**：設定同步儲存於 `chrome.storage.local`，跨分頁、重啟瀏覽器依然生效。
* **即時廣播**：透過 `chrome.tabs.sendMessage` 實現 UI 與 Content Script 的非同步指令同步。

---

## 技術接口

### 去刺激化對外接口

`engine.js` 內提供標準化呼叫方式：

* **匯出函式**：`runDecluttering(settings?)` (啟動或關閉過濾引擎)
* **全域接口（規範對齊）**：
    * `window.__ddDeclutter.run(settings)`
    * `window.__ddDeclutter.stop()`

### 訊息格式 (Message Passing)

Popup 或 Background 可送出以下 JSON 指令：

```json
{ "type": "TOGGLE_DECLUTTER", "enabled": boolean }
目的：達成動態開關，不需手動重新整理頁面。

檔案說明
manifest.json：宣告 action (Popup)、web_accessible_resources 以及跨網域 content_scripts 匹配。

content/content.js：主進入點。負責 ESM 模組動態匯入、讀取儲存設定並監聽來自 Popup 的指令。

modules/rules.js：去刺激化規則資料庫。存儲各網域對應的 selectors 與 routeEvent。

modules/engine.js：核心過濾引擎。負責 CSS 規則生成、注入 DOM 以及監控 MutationObserver。

popup/popup.html / .js：使用者控制面板。提供開關介面並處理 storage 讀寫。

Storage Schema
儲存鍵值：chrome.storage.local["enabled"]

型別：boolean

預設值：true

說明：儲存使用者全域開關狀態，模組啟動時自動讀取。

串接備註
本模組採用 ESM (ES Modules) 開發，透過 chrome.runtime.getURL 動態載入，確保模組在同一個運作標準下。

已預留 enabled 參數接口，Background 端若需強制進入「專注模式」時，可直接透過訊息廣播關閉所有受限網站的介面元素。