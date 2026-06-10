(function () {
    'use strict';

    /**
     * 工具函式：注入 CSS
     */
    function injectStyle(id, css) {
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    /**
     * 工具函式：移除 CSS
     */
    function removeStyle(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    const host = window.location.hostname;

    // 從 Storage 讀取開關狀態，決定是否執行封鎖
    chrome.storage.local.get('declutterEnabled', (data) => {
        const isEnabled = data.declutterEnabled ?? true; // 預設為開啟

        // 1. YouTube：穩定保護 (完全不影響搜尋結果與影片播放功能)
        if (host.includes('youtube.com')) {
            const styleId = 'dd-yt';
            if (isEnabled) {
                injectStyle(styleId, `
                    /* 隱藏推薦影片、留言、Shorts 與首頁瀑布流，保留搜尋與播放器 */
                    #related, #comments, ytd-reel-shelf-renderer, #shorts-container, 
                    ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { 
                        display: none !important; 
                    }
                `);
            } else {
                removeStyle(styleId);
            }
        }

        // 2. Instagram：動態保護
        else if (host.includes('instagram.com')) {
            const styleId = 'dd-ig';
            if (isEnabled) {
                injectStyle(styleId, `
                    div[role="presentation"], article, aside[role="complementary"] { 
                        display: none !important; 
                    }
                `);
            } else {
                removeStyle(styleId);
            }
        }

        // 3. LinkedIn：文字特徵狙擊 (保持監控，不影響個人頁面導航)
        else if (host.includes('linkedin.com')) {
            function hideDistractionsByText() {
                const allElements = document.querySelectorAll('div, aside, section');
                allElements.forEach(el => {
                    const text = el.innerText || "";
                    if (text.includes('熱門新聞') || text.includes('本日解謎遊戲') || text.includes('推廣')) {
                        el.style.display = 'none';
                    }
                });
            }
            const observer = new MutationObserver(hideDistractionsByText);
            observer.observe(document.body, { childList: true, subtree: true });
            hideDistractionsByText();
        }
    });

    console.log("[DD] 引擎已啟動：偵測到狀態為 " + (window.isEnabled ? "開啟" : "關閉"));
})();