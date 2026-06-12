/**
 * content/cooldown.js — 強制冷卻覆蓋層
 *
 * 當使用者進入「冷卻清單」中的網站時，顯示 N 秒的空白畫面＋呼吸引導。
 * 倒數結束後自動移除覆蓋層，使用者才能看到頁面。
 *
 * 每個域名的冷卻狀態透過 sessionStorage 保存，確保同一瀏覽器 session
 * 內每個域名只觸發一次（重新開分頁則重新觸發）。
 *
 * 所有 CSS ID / class 均使用 __dd- 前綴，避免與目標頁面樣式衝突。
 */

(function () {
  'use strict';

  const STORAGE_KEY = '__dd_cooldown_shown__';
  let activeInterval = null;
  let activeTimeout = null;

  function stopCooldown() {
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
    if (activeTimeout) {
      clearTimeout(activeTimeout);
      activeTimeout = null;
    }
    document.getElementById('__dd-overlay')?.remove();
    document.getElementById('__dd-style')?.remove();
  }

  function createOverlay(totalSeconds, onComplete) {
    stopCooldown();

    const style = document.createElement('style');
    style.id = '__dd-style';
    style.textContent = `
      #__dd-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: #0d0d0d;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      #__dd-overlay .__dd-box {
        text-align: center;
        color: #e8e8e8;
        max-width: 360px;
        padding: 0 24px;
      }

      #__dd-overlay .__dd-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 8px;
        letter-spacing: -0.3px;
      }

      #__dd-overlay .__dd-subtitle {
        font-size: 14px;
        color: #888;
        margin: 0 0 36px;
        line-height: 1.6;
      }

      #__dd-overlay .__dd-circle-wrap {
        position: relative;
        width: 120px;
        height: 120px;
        margin: 0 auto 28px;
      }

      #__dd-overlay .__dd-circle {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: radial-gradient(circle, #3a8cff 0%, #1a5cbf 60%, #0d3a8c 100%);
        animation: __dd-breathe 4s ease-in-out infinite;
        box-shadow: 0 0 40px rgba(58, 140, 255, 0.3);
      }

      #__dd-overlay .__dd-countdown {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: 700;
        color: #fff;
        line-height: 1;
      }

      #__dd-overlay .__dd-countdown-label {
        font-size: 10px;
        font-weight: 400;
        color: rgba(255,255,255,0.6);
        letter-spacing: 1px;
        text-transform: uppercase;
        margin-top: 4px;
      }

      #__dd-overlay .__dd-breathe-hint {
        font-size: 13px;
        color: #555;
        margin-bottom: 32px;
        animation: __dd-fade-hint 4s ease-in-out infinite;
      }

      #__dd-overlay .__dd-progress {
        width: 100%;
        height: 3px;
        background: #1e1e1e;
        border-radius: 2px;
        overflow: hidden;
      }

      #__dd-overlay .__dd-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #3a8cff, #5ba4ff);
        border-radius: 2px;
        transition: width 1s linear;
      }

      @keyframes __dd-breathe {
        0%, 100% { transform: scale(0.85); opacity: 0.7; }
        50%       { transform: scale(1.1);  opacity: 1;   }
      }

      @keyframes __dd-fade-hint {
        0%, 100% { opacity: 0.3; }
        50%       { opacity: 0.8; }
      }
    `;

    (document.head || document.documentElement).appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = '__dd-overlay';
    overlay.innerHTML = `
      <div class="__dd-box">
        <p class="__dd-title">先等一下</p>
        <p class="__dd-subtitle">
          你是出於目的打開這個網站的嗎？<br>
          給自己 ${totalSeconds} 秒思考一下。
        </p>
        <div class="__dd-circle-wrap">
          <div class="__dd-circle"></div>
          <div class="__dd-countdown">
            <span id="__dd-time">${totalSeconds}</span>
            <span class="__dd-countdown-label">秒</span>
          </div>
        </div>
        <p class="__dd-breathe-hint">跟著圓形節奏深呼吸</p>
        <div class="__dd-progress">
          <div class="__dd-progress-bar" id="__dd-bar" style="width:100%"></div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    const timeEl = document.getElementById('__dd-time');
    const barEl  = document.getElementById('__dd-bar');

    let remaining = totalSeconds;

    activeInterval = setInterval(() => {
      remaining--;
      if (timeEl) timeEl.textContent = remaining;
      if (barEl)  barEl.style.width = ((remaining / totalSeconds) * 100) + '%';

      if (remaining <= 0) {
        clearInterval(activeInterval);
        activeInterval = null;
        overlay.style.transition = 'opacity 0.4s';
        overlay.style.opacity = '0';
        activeTimeout = setTimeout(() => {
          overlay.remove();
          style.remove();
          activeTimeout = null;
          onComplete?.();
        }, 400);
      }
    }, 1000);
  }

  window.__ddCooldown = {
    run(settings) {
      const {
        enabled = true,
        cooldownDomains = [],
        cooldownSeconds = 20
      } = settings;

      if (!enabled) {
        stopCooldown();
        return;
      }

      const hostname = location.hostname.replace(/^www\./, '');
      const matched = cooldownDomains.find(d => hostname === d || hostname.endsWith('.' + d));
      if (!matched) {
        stopCooldown();
        return;
      }

      const sessionKey = STORAGE_KEY + matched;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');

      createOverlay(cooldownSeconds, () => {});
    },
    stop: stopCooldown
  };
})();
