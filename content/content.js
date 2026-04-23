/**
 * content/content.js — Content Script 主入口
 *
 * 目前負責：
 *   1. 強制冷卻（cooldown.js）
 *   2. 每日限時使用量回報（每 30 秒送一次 REPORT_USAGE 給 background）
 *
 * 其他模組（declutter、timer）將由其他人補充。
 */

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
    let pendingSeconds = 0;
    let lastVisibleAt = document.visibilityState === 'visible' ? Date.now() : null;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (lastVisibleAt !== null) {
          pendingSeconds += (Date.now() - lastVisibleAt) / 1000;
          lastVisibleAt = null;
        }
      } else {
        lastVisibleAt = Date.now();
      }
    });

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

    const timer = setInterval(() => {
      let seconds = pendingSeconds;
      if (lastVisibleAt !== null) {
        seconds += (Date.now() - lastVisibleAt) / 1000;
        lastVisibleAt = Date.now();
      }
      pendingSeconds = 0;
      const rounded = Math.round(seconds);
      if (rounded > 0) report(rounded);
    }, INTERVAL * 1000);
  }

})();
