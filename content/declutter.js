/**
 * content/declutter.js - 終極介面極簡化模組
 * 採用 CSS 注入技術，確保在 DOM 加載前就鎖定元素。
 */

(function () {
  'use strict';

  window.__ddDeclutter = {
    run: function (settings) {
      if (!settings || settings.declutterEnabled === false) return;

      console.log("[Dopamine Detox] 終極極簡化模組已啟動...");

      // 1. 直接注入全局 CSS (最暴力也最有效的方法)
      this.injectStyle();

      // 2. 依然保留 MutationObserver 做雙重保險
      const observer = new MutationObserver(() => this.applyLegacyFilters());
      observer.observe(document.body, { childList: true, subtree: true });
    },

    injectStyle: function () {
      const style = document.createElement('style');
      style.id = 'dd-declutter-style';
      style.textContent = `
        /* YouTube 側邊欄與首頁牆 */
        #secondary, ytd-browse[page-subtype="home"], #comments { display: none !important; }

        /* Facebook 側邊欄與廣告[cite: 3] */
        div[role="complementary"], .x9f619.x1n2onr6.x1ja2u2z[aria-label="贊助"] { display: none !important; }

        /* Instagram 側邊欄建議 (針對文彥截圖中的結構)[cite: 3] */
        /* 抓取 IG 右側所有內容：主內容區後的兄弟節點 */
        main > div > div > section + div,
        div._as9z, 
        aside[role="complementary"],
        /* 隱藏包含特定關鍵字的區塊 */
        div:has(> span:empty) + div[style*="max-width: 630px"] ~ div {
           display: none !important; 
           visibility: hidden !important;
           width: 0 !important;
           flex-basis: 0 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    },

    applyLegacyFilters: function () {
      // 針對無法透過 CSS 選擇器精確抓取的動態內容進行補強
      const hostname = window.location.hostname;
      if (hostname.includes('instagram.com')) {
        // 尋找包含「為你推薦」文字的容器並強制隱藏
        const spans = document.querySelectorAll('span');
        spans.forEach(span => {
          if (span.textContent.includes('為你推薦') || span.textContent.includes('建議追蹤')) {
            const container = span.closest('div._as9z') || span.closest('div[style*="max-width"] ~ div');
            if (container) container.style.setProperty('display', 'none', 'important');
          }
        });
      }
    }
  };
})();