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

    // 3. 去介面刺激化
      if (window.__ddDeclutter) {
          window.__ddDeclutter.run();
      }
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

    if (window.__ddUsageTracker?.stop) {
      window.__ddUsageTracker.stop();
    }

    const REPORT_INTERVAL = 5;
    const TICK_INTERVAL_MS = 1000;
    let blocked = false;
    let timer = null;
    let pendingSeconds = 0;

    const getDateKey = (timestamp = Date.now()) => {
      const d = new Date(timestamp);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const persistUsageAnalytics = (domain, seconds) => {
      if (!seconds) return;
      chrome.storage.local.get(['usageAnalytics'], (result) => {
        const current = result.usageAnalytics;
        const store = (current && typeof current === 'object' && current.days && typeof current.days === 'object')
          ? { version: Number(current.version) || 1, updatedAt: Number(current.updatedAt) || Date.now(), days: current.days }
          : { version: 1, updatedAt: Date.now(), days: {} };

        const dateKey = getDateKey();
        const dayRecord = store.days[dateKey] || { totalSeconds: 0, domains: {} };
        dayRecord.totalSeconds += seconds;
        dayRecord.domains[domain] = (dayRecord.domains[domain] || 0) + seconds;
        store.days[dateKey] = dayRecord;
        store.updatedAt = Date.now();

        chrome.storage.local.set({ usageAnalytics: store });
      });
    };

    const report = (seconds) => {
      if (blocked) return;
      if (!isContextValid()) {
        stopTracking(false);
        return;
      }
      if (seconds <= 0) return;
      persistUsageAnalytics(matchedDomain, seconds);
      try {
        chrome.runtime.sendMessage(
          { type: 'REPORT_USAGE', domain: matchedDomain, seconds },
          (res) => {
            if (chrome.runtime.lastError) return;
            if (res?.action === 'blocked') {
              blocked = true;
              stopTracking(false);
            }
          }
        );
      } catch {
        stopTracking(false);
      }
    };

    const isActive = () => document.visibilityState === 'visible' && document.hasFocus();

    const flushUsage = () => {
      if (pendingSeconds <= 0) return;
      const seconds = pendingSeconds;
      pendingSeconds = 0;
      report(seconds);
    };

    const visibilityHandler = () => {
      if (!isActive()) flushUsage();
    };

    const stopTracking = (flush = true) => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('blur', flushUsage);
      window.removeEventListener('pagehide', flushUsage);
      window.removeEventListener('beforeunload', flushUsage);
      if (flush) flushUsage();
      if (window.__ddUsageTracker?.stop === stopTracking) {
        delete window.__ddUsageTracker;
      }
    };

    window.__ddUsageTracker = { stop: stopTracking };

    timer = setInterval(() => {
      if (!isActive()) return;
      pendingSeconds++;
      if (pendingSeconds >= REPORT_INTERVAL) {
        flushUsage();
      }
    }, TICK_INTERVAL_MS);

    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('blur', flushUsage);
    window.addEventListener('pagehide', flushUsage);
    window.addEventListener('beforeunload', flushUsage);
  }

})();
