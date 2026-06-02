/**
 * content/content.js - Content script entry
 *
 * Responsibilities:
 *   1. Run cooldown overlay logic.
 *   2. Track foreground usage for analytics.
 *   3. Report usage only for domains with daily limits.
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
    applySettings(settings);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'APPLY_SETTINGS') {
      applySettings(msg.settings);
    }
  });

  function applySettings(settings) {
    if (!settings?.enabled) {
      window.__ddUsageTracker?.stop?.();
      return;
    }

    if (window.__ddCooldown) {
      window.__ddCooldown.run(settings);
    }

    startUsageTracking(settings);

    // Other modules can be enabled here when integrated.
    // if (window.__ddDeclutter) window.__ddDeclutter.run(settings);
    // if (window.__ddTimer)     window.__ddTimer.run(settings);
  }

  function startUsageTracking(settings) {
    const { dailyLimits = {} } = settings;

    const hostname = location.hostname.replace(/^www\./, '');
    if (!hostname) return;

    // matchedDomain is only for daily-limit reports; analytics tracks all sites.
    const matchedDomain = Object.keys(dailyLimits).find(
      d => hostname === d || hostname.endsWith('.' + d)
    );

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
      if (!seconds || !isContextValid()) return;
      chrome.storage.local.get(['usageAnalytics'], (result) => {
        try {
          if (chrome.runtime.lastError) return;

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

          const cutoff = getDateKey(Date.now() - 30 * 86400 * 1000);
          for (const key of Object.keys(store.days)) {
            if (key < cutoff) delete store.days[key];
          }

          chrome.storage.local.set({ usageAnalytics: store });
        } catch {
          // Ignore when the extension context is no longer available.
        }
      });
    };

    const reportDailyLimit = (seconds) => {
      if (!matchedDomain || blocked) return;
      if (!isContextValid()) { stopTracking(true); return; }
      if (seconds <= 0) return;
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

    // Screen-time style tracking: if the tab is visible and focused, count it.
    const isActive = () =>
      document.visibilityState === 'visible' &&
      document.hasFocus();

    const flushUsage = () => {
      if (pendingSeconds <= 0) return;
      const seconds = pendingSeconds;
      pendingSeconds = 0;
      persistUsageAnalytics(hostname, seconds);
      reportDailyLimit(seconds);
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
      if (!isContextValid()) { stopTracking(false); return; }
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
