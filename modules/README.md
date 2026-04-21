模組一：介面去刺激化 (Visual De-cluttering)
狀態：已完成（待整體串接驗收）

模組目標
透過精準攔截與隱藏高刺激平台中的誘導性 UI 元素（如演算法推薦、無限捲動牆），減少視覺誘因，幫助使用者奪回注意力的掌控權。

已完成功能
雙軌制隱藏機制

靜態 CSS 注入：利用 document_start 注入隱藏規則，目標元素從未出現在視覺上，達成「零閃爍」體驗。

動態 DOM 守護：使用 MutationObserver 監控 SPA 路由變動，確保內容動態更新後規則依然生效。

多平台規則引擎

集中管理 YouTube, Facebook, Instagram, LinkedIn, Dcard 等五大平台。

支援語意化與結構性選擇器（Selectors），確保改版後的容錯率。

YouTube SPA 深度適配

監聽 yt-navigate-finish 自訂事件。

解決 YouTube 在換頁不重整網頁的情境下，功能失效的老問題。

效能優化 (Throttle)

結合 requestAnimationFrame 進行渲染節流。

透過 data-dd-hidden 標記位避免重複計算。

技術接口
去刺激化對外接口

engine.js 內提供全域接口（規範對齊）：

window.__ddDeclutter.run(settings)：啟動模組並帶入開關設定。

window.__ddDeclutter.destroy()：完整卸載樣式與觀察器，還原頁面。

檔案說明
modules/decluttering/rules.js

定義各平台需屏蔽的 CSS Selector 矩陣。

modules/decluttering/engine.js

負責 CSS 注入、MutationObserver 監控、SPA 事件綁定與全域接口。

modules/decluttering/README.md

模組開發進度與技術細節說明。