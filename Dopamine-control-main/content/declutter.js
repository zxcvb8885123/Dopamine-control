(function () {
    'use strict';
  
    window.__ddDeclutter = {
      run: function (settings) {
        if (!settings || settings.declutterEnabled === false) return;
  
        console.log("[Dopamine Detox] 介面極簡化模組已啟動...");
        this.injectStyle();
  
        const observer = new MutationObserver(() => this.applyLegacyFilters());
        observer.observe(document.body, { childList: true, subtree: true });
      },
  
      injectStyle: function () {
        const style = document.createElement('style');
        style.id = 'dd-declutter-style';
        style.textContent = `
          /* YouTube 側邊欄與首頁牆 */
          #secondary, ytd-watch-next-secondary-results-renderer, 
          ytd-browse[page-subtype="home"], #comments { display: none !important; }
  
          /* Facebook 側邊欄與廣告 */
          div[role="complementary"], div[aria-label="贊助"] { display: none !important; }
  
          /* Instagram 強力過濾 (針對右側建議區) */
          main > div > div > section + div,
          div._as9z, 
          aside[role="complementary"],
          div[style*="max-width: 630px"] ~ div {
             display: none !important; 
             visibility: hidden !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      },
  
      applyLegacyFilters: function () {
        const hostname = window.location.hostname;
        if (hostname.includes('instagram.com')) {
          const spans = document.querySelectorAll('span');
          spans.forEach(span => {
            if (span.textContent.includes('為你推薦') || span.textContent.includes('建議追蹤')) {
              const container = span.closest('div[style*="max-width"] ~ div') || span.closest('div._as9z');
              if (container) container.style.setProperty('display', 'none', 'important');
            }
          });
        }
      }
    };
  })();