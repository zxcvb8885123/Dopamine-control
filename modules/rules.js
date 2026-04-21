/**
 * @file rules.js
 * 各大平台去刺激化規則清單 - 2026 強化版
 */
export const RULES = {
  // YouTube 已經好的，保持原樣或微調
  'youtube.com': {
    description: 'YouTube',
    routeEvent: 'yt-navigate-finish',
    selectors: [
      'ytd-rich-grid-renderer',       // 首頁影片牆
      '#secondary',                   // 右側推薦欄
      '#comments',                    // 評論區
      'ytd-reel-shelf-renderer'       // Shorts 區塊
    ]
  },

  // Facebook：鎖定 data-pagelet 與 role 屬性
  'facebook.com': {
    description: 'Facebook',
    selectors: [
      '[role="main"] div[data-pagelet="FeedUnit"]', // 動態牆貼文
      '[data-pagelet="Stories"]',                  // 限時動態
      '[role="complementary"]',                    // 右側側欄
      'div[aria-label="Reels"]',                    // Reels 區塊
      '#ssrb_feed_start + div',                    // 整個動態牆容器
      '[role="main"] div:has(> [aria-label="建立貼文"]) + div' // 貼文輸入框下方的所有內容
    ]
  },

  // Instagram：鎖定 main 內部的文章結構
  'instagram.com': {
    description: 'Instagram',
    selectors: [
      'main article',                               // 動態牆上的單篇貼文
      'main > section > div > div > div',           // 推薦貼文容器
      'div._aaoz',                                  // 限時動態容器
      'div._as9n',                                  // 右側「為你推薦」
      'a[href="/explore/"]',                        // 探索頁入口
      'a[href="/reels/"]',                          // Reels 入口
      'div[style*="max-width: 630px"]'               // 鎖定 IG 動態牆主要內容寬度
    ]
  },

  // Dcard：鎖定角色與特定結構
  'dcard.tw': {
    description: 'Dcard',
    selectors: [
      'div[role="main"] > div:nth-child(2)',        // 首頁熱門牆
      'div[role="main"] article',                   // 所有的文章條目
      'nav + div > aside',                          // 右側熱門話題
      'section:has(h2:contains("熱門看板"))'         // 熱門看板區塊
    ]
  },

'linkedin.com': {
    description: 'LinkedIn',
    selectors: [
      // 1. 鎖定中間所有動態內容 (包含精選內容、貼文)
      '.scaffold-layout__main > div:nth-child(2)', 
      '.scaffold-layout__main > div:nth-child(3)',
      'div[data-view-name="feed-full-update"]',
      
      // 2. 鎖定右側新聞與資訊欄
      'aside.scaffold-layout__aside', 
      
      // 3. 鎖定中間上方的「歡迎/引導」區塊
      '.artdeco-card:has(img[src*="illustration"])', 
      
      // 4. 鎖定所有貼文文章
      'article', 
      
      // 5. 鎖定廣告與促銷
      '.ad-banner-container'
    ]
  }
};