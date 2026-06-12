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

  const TIMER_ELEMENT_ID = 'dd-usage-timer';

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
      window.__ddCooldown?.stop?.();
      window.__ddDeclutter?.stop?.();
      document.getElementById(TIMER_ELEMENT_ID)?.remove();
      return;
    }

    if (window.__ddCooldown) {
      window.__ddCooldown.run(settings);
    }

    startUsageTracking(settings);

    // 去介面刺激化模組
    if (window.__ddDeclutter) {
      window.__ddDeclutter.run(settings);
    }
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
    const IDLE_THRESHOLD_MS = 2 * 60 * 1000;
    let blocked = false;
    let timer = null;
    let pendingSeconds = 0;
    let elapsedSeconds = 0;
    let lastInteraction = Date.now();
    const onInteraction = () => { lastInteraction = Date.now(); };
    const INTERACTION_EVENTS = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    INTERACTION_EVENTS.forEach(e => document.addEventListener(e, onInteraction, { passive: true }));

    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      return hours > 0
        ? [hours, minutes, remainingSeconds].map(value => String(value).padStart(2, '0')).join(':')
        : [minutes, remainingSeconds].map(value => String(value).padStart(2, '0')).join(':');
    };

    const ensureTimerElement = () => {
      let element = document.getElementById(TIMER_ELEMENT_ID);
      if (element) return element;

      element = document.createElement('div');
      element.id = TIMER_ELEMENT_ID;
      element.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:16px',
        'z-index:2147483647',
        'padding:7px 11px',
        'border:1px solid rgba(255,255,255,.16)',
        'border-radius:999px',
        'background:rgba(20,20,24,.78)',
        'backdrop-filter:blur(8px)',
        '-webkit-backdrop-filter:blur(8px)',
        'box-shadow:0 4px 16px rgba(0,0,0,.24)',
        'color:#fff',
        'font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
        'letter-spacing:.02em',
        'pointer-events:none'
      ].join(';');
      (document.body || document.documentElement).appendChild(element);
      return element;
    };

    const updateTimerDisplay = () => {
      ensureTimerElement().textContent = `${hostname}  ${formatDuration(elapsedSeconds)}`;
    };

    updateTimerDisplay();

    const persistUsageAnalytics = (domain, seconds) => {
      if (!seconds || !isContextValid()) return;
      try {
        // Module 3 writes are serialized by the background worker to prevent
        // concurrent tabs from overwriting the same usageAnalytics snapshot.
        chrome.runtime.sendMessage(
          {
            type: 'REPORT_ANALYTICS_USAGE',
            domain,
            seconds,
            timestamp: Date.now()
          },
          () => {
            if (chrome.runtime.lastError) {
              // Ignore when the extension context is no longer available.
            }
          }
        );
      } catch {
        // Ignore when the extension context is no longer available.
      }
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

    const hasActiveMedia = () =>
      Array.from(document.querySelectorAll('video, audio'))
        .some(el => !el.paused && !el.ended && el.readyState > 2);

    const isActive = () => {
      if (document.visibilityState !== 'visible') return false;
      if (hasActiveMedia()) return true;
      return document.hasFocus() && Date.now() - lastInteraction < IDLE_THRESHOLD_MS;
    };

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
      INTERACTION_EVENTS.forEach(e => document.removeEventListener(e, onInteraction));
      if (flush) flushUsage();
      document.getElementById(TIMER_ELEMENT_ID)?.remove();
      if (window.__ddUsageTracker?.stop === stopTracking) {
        delete window.__ddUsageTracker;
      }
    };

    window.__ddUsageTracker = { stop: stopTracking };

    timer = setInterval(() => {
      if (!isContextValid()) { stopTracking(false); return; }
      if (!isActive()) return;
      elapsedSeconds++;
      pendingSeconds++;
      updateTimerDisplay();
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
