# 模組一：介面去刺激化 (Visual De-cluttering)

**狀態：已完成 (待整體串接驗收)**

---

###  模組目標
透過精準攔截與隱藏高刺激平台中的誘導性 **UI 元素** (如：演算法推薦、無限捲動牆)，減少視覺誘因，幫助使用者奪回注意力掌控權。

###  已完成功能
* **雙軌制隱藏機制**
    * **靜態 CSS 注入**：利用 `document_start` 注入隱藏規則，目標元素從未出現在視覺上，達成「零閃爍」體驗。
    * **動態 DOM 守護**：使用 `MutationObserver` 監控 SPA 路由變動，確保內容動態更新後規則依然生效。
* **多平台規則引擎**
    * 集中管理 **YouTube, Facebook, Instagram, LinkedIn, Dcard** 等五大平台。
    * 支援語意化與結構性選取器 (Selectors)，確保網站改版後的容錯率。
* **YouTube SPA 深度適配**
    * 監聽 `yt-navigate-finish` 自訂事件，解決 YouTube 在換頁不重整網頁的情境下，功能失效的老問題。

###  效能與優化
* **渲染節流 (Throttle)**：結合 `requestAnimationFrame` 進行渲染節流，確保在大量 DOM 變動時仍維持流暢度。
* **輕量化架構**：模組化規則定義，易於擴充新平台的過濾邏輯。

---