// content/declutter.js (Phase 1 核心進入點)
(async () => {
  'use strict';
  try {
    // 從 modules 載入核心引擎
    const engineUrl = chrome.runtime.getURL('modules/engine.js');
    const { runDecluttering } = await import(engineUrl);

    // 1. 啟動時檢查 storage 設定
    const data = await chrome.storage.local.get('enabled');
    const isEnabled = data.enabled !== false; // 預設開啟
    
    // 執行 Phase 1：介面去刺激化
    runDecluttering({ enabled: isEnabled });

    // 2. 監聽來自 Popup 的控制指令 (保持通訊接口一致)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TOGGLE_DECLUTTER') {
        sendResponse({ status: "Phase 1: Config Updated" });
        location.reload(); // 重整以確保規則即時套用
      }
    });
  } catch (error) {
    console.error('[Phase 1] 引擎加載異常:', error);
  }
})();