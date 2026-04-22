(function () {
  'use strict';

  const RULES = {
    'youtube.com': [
      '#secondary', 'ytd-rich-grid-renderer', 'ytd-reel-shelf-renderer',
      '#shorts-container', 'ytd-mini-guide-entry-renderer[aria-label="Shorts"]', '#comments'
    ],
    'facebook.com': [
      '[role="main"]', '[role="feed"]', '[data-pagelet="Stories"]',
      '[data-pagelet="FeedUnit"]', '#ssrb_feed_start', '[aria-label="限時動態"]'
    ],
    'instagram.com': [
      'main > div > div:first-child', '._aa63', '._aabd', '._aade'
    ],
    'dcard.tw': [
      '.PostList_container_2S', '.PostItem_container_27'
    ]
  };

  window.__ddDeclutter = {
    run(settings) {
      // 讀取妳 popup 裡的開關設定 (filterSettings)
      const fs = settings.filterSettings || { yt: true, fb: true, ig: true, dc: true };
      const hostname = location.hostname.replace(/^www\./, '');
      const matchedKey = Object.keys(RULES).find(k => hostname.includes(k));
      
      if (!settings.enabled || !matchedKey) return;

      const keyMap = { 'youtube.com':'yt', 'facebook.com':'fb', 'instagram.com':'ig', 'dcard.tw':'dc' };
      if (fs[keyMap[matchedKey]] === false) return;

      const selectors = RULES[matchedKey];

      // 1. 注入 CSS 排版引擎 (解決網頁閃爍)
      const styleId = 'ff-declutter-v2';
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = selectors.map(s => `${s} { display: none !important; visibility: hidden !important; }`).join('\n');

      // 2. MutationObserver 監控動態載入 (針對 FB, IG 這種無限捲動網頁)
      const observer = new MutationObserver(() => {
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => {
            if (el.style.display !== 'none') {
              el.style.setProperty('display', 'none', 'important');
            }
          });
        });
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });
      console.log(`[FocusFlow Pro] 已啟動 ${matchedKey} 去刺激化優化。`);
    }
  };
})();