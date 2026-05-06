/**
 * content/content.js — Content Script 主入口
 *
 * 目前負責：
 *   1. 強制冷卻（cooldown.js）
 *   2. 每日限時使用量回報（每 30 秒送一次 REPORT_USAGE 給 background）
 *
 * 其他模組（declutter、timer）將由其他人補充。
 */

// 監聽並啟動介面去刺激化功能
chrome.storage.local.get(['declutterEnabled'], (data) => {
  if (data.declutterEnabled) {
    // 確保 declutter.js 已經載入，然後執行它
    if (window.__ddDeclutter) {
      window.__ddDeclutter.run({ declutterEnabled: true });
    }
  }
});

// 監聽來自 popup 的即時更新訊息
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'SETTINGS_UPDATED') {
    location.reload(); // 當按下儲存時，自動重新整理網頁以套用過濾
  }
});
(function () {
  'use strict';

  function isContextValid() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  if (!isContextValid()) return;

  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
    if (chrome.runtime.lastError || !settings) return;
    if (!settings.enabled) return;

    // 1. 強制冷卻
    if (window.__ddCooldown) {
      window.__ddCooldown.run(settings);
    }

    // 2. 每日限時 usage tracking
    startUsageTracking(settings);

    // TODO: 其他模組在此呼叫
    // if (window.__ddDeclutter) window.__ddDeclutter.run(settings);
    // if (window.__ddTimer)     window.__ddTimer.run(settings);
  });

  // ── 每日限時使用量回報 ───────────────────────────────────────

  function startUsageTracking(settings) {
    const { dailyLimits = {} } = settings;

    const hostname = location.hostname.replace(/^www\./, '');

    const matchedDomain = Object.keys(dailyLimits).find(
      d => hostname === d || hostname.endsWith('.' + d)
    );

    if (!matchedDomain) return;

    const INTERVAL = 30;
    let blocked = false;

    const report = (seconds) => {
      if (blocked) return;
      if (!isContextValid()) { clearInterval(timer); return; }
      try {
        chrome.runtime.sendMessage(
          { type: 'REPORT_USAGE', domain: matchedDomain, seconds },
          (res) => {
            if (chrome.runtime.lastError) return;
            if (res?.action === 'blocked') {
              blocked = true;
              clearInterval(timer);
            }
          }
        );
      } catch {
        clearInterval(timer);
      }
    };

    report(0);

    const timer = setInterval(() => report(INTERVAL), INTERVAL * 1000);
  }

})();
