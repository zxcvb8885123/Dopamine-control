(function () {
    'use strict';

    function injectStyle(id, css) {
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    const host = window.location.hostname;

    // 1. YouTube：穩定保護
    if (host.includes('youtube.com')) {
        injectStyle('dd-yt', `
            #related, #comments, ytd-reel-shelf-renderer, #shorts-container, 
            ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { display: none !important; }
        `);
    }

    // 2. Instagram：穩定保護
    else if (host.includes('instagram.com')) {
        injectStyle('dd-ig', `
            div[role="presentation"], article, aside[role="complementary"] { display: none !important; }
        `);
    }

    // 3. LinkedIn：採用「文字特徵 + 結構」雙重狙擊
    else if (host.includes('linkedin.com')) {
        // 核心邏輯：偵測網頁文字特徵並隱藏容器
        function hideDistractionsByText() {
            const allElements = document.querySelectorAll('div, aside, section');
            allElements.forEach(el => {
                const text = el.innerText || "";
                // 如果區塊內包含「熱門新聞」、「本日解謎遊戲」或「推廣」字樣，直接隱藏
                if (text.includes('熱門新聞') || text.includes('本日解謎遊戲') || text.includes('推廣')) {
                    el.style.display = 'none';
                }
            });
        }

        // 啟動監控
        const observer = new MutationObserver(hideDistractionsByText);
        observer.observe(document.body, { childList: true, subtree: true });
        hideDistractionsByText();
    }

    console.log("[DD] 引擎已啟動：已融合最新文字識別技術。");
})();