(function() {
  // 監聽儲存設定並執行
  chrome.storage.local.get(null, (settings) => {
    // 預設為啟用，方便妳開發測試
    const finalSettings = {
      enabled: settings.enabled !== false,
      filterSettings: settings.filterSettings || { yt: true, fb: true, ig: true, dc: true }
    };

    // 唯讀取妳負責的模組
    if (window.__ddDeclutter) {
      window.__ddDeclutter.run(finalSettings);
    }
  });
})();