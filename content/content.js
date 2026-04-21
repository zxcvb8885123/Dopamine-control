(async () => {
  'use strict';
  try {
    const engineUrl = chrome.runtime.getURL('modules/engine.js');
    const { runDecluttering } = await import(engineUrl);

    // 1. 啟動時檢查儲存的狀態
    const data = await chrome.storage.local.get('enabled');
    const isEnabled = data.enabled !== false; // 預設為開啟
    
    runDecluttering({ enabled: isEnabled });
    console.log(`%c[DopamineControl] 引擎啟動狀態: ${isEnabled}`, 'color: #2ecc71; font-weight: bold;');

    // 2. 監聽來自 Popup 的即時切換指令
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'TOGGLE_DECLUTTER') {
        sendResponse({ status: "ok" });
        location.reload(); // 切換設定後重新整理網頁套用規則
      }
    });

  } catch (error) {
    console.error('[DopamineControl] 核心載入失敗:', error);
  }
})();