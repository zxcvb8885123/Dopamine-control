/**
 * blocked.js — 封鎖頁邏輯
 *
 * 解析 URL 參數 ?reason=workhours|limit&end=18&domain=youtube.com
 * 並呈現對應的封鎖原因與資訊。
 */

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const reason = params.get('reason');   // 'workhours' | 'limit'
  const workEnd = params.get('end');     // '18'
  const domain  = params.get('domain'); // 'youtube.com'

  const iconEl       = document.getElementById('icon');
  const iconWrapEl   = document.getElementById('icon-wrap');

  const SVG_WORK = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
  const SVG_LIMIT = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const SVG_BLOCK = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  const titleEl      = document.getElementById('title');
  const domainTagEl  = document.getElementById('domain-tag');
  const reasonTextEl = document.getElementById('reason-text');
  const infoBoxEl    = document.getElementById('info-box');
  const infoLabelEl  = document.getElementById('info-label');
  const infoValueEl  = document.getElementById('info-value');
  const btnSettings  = document.getElementById('btn-settings');

  // domain 參數優先；沒有時從 referrer 解析
  const blockedHost = domain || (() => {
    try { return new URL(document.referrer).hostname.replace('www.', ''); }
    catch { return ''; }
  })();

  if (blockedHost) {
    domainTagEl.textContent = blockedHost;
  } else {
    domainTagEl.style.display = 'none';
  }

  // 根據封鎖原因顯示不同內容
  if (reason === 'workhours') {
    iconEl.innerHTML = SVG_WORK;
    titleEl.textContent = '工作時段封鎖中';
    reasonTextEl.textContent =
      '你設定了在工作時段內封鎖這個網站。\n完成工作後再來吧！';

    if (workEnd) {
      const [endH, endM] = workEnd.split(':').map(Number);
      const releaseTime  = new Date();
      releaseTime.setHours(endH, endM || 0, 0, 0);

      infoBoxEl.style.display = 'block';
      infoLabelEl.textContent = '封鎖解除時間';
      infoValueEl.textContent = `今天 ${workEnd}`;

      const now = new Date();
      if (releaseTime > now) {
        const diffMs = releaseTime - now;
        const diffH  = Math.floor(diffMs / 3600000);
        const diffM  = Math.floor((diffMs % 3600000) / 60000);
        const parts  = [];
        if (diffH > 0) parts.push(`${diffH} 小時`);
        if (diffM > 0 || diffH === 0) parts.push(`${diffM} 分鐘`);
        infoValueEl.textContent = `今天 ${workEnd}（還有 ${parts.join(' ')}）`;
      }
    }
  } else if (reason === 'limit') {
    iconEl.innerHTML = SVG_LIMIT;
    iconEl.classList.add('is-limit');
    iconWrapEl.classList.add('is-limit');
    titleEl.textContent = '今日使用時間已到';
    reasonTextEl.textContent =
      '你設定的每日使用上限已達到。\n明天重置後才能繼續使用。';

    infoBoxEl.style.display = 'block';
    infoLabelEl.textContent = '重置時間';
    infoValueEl.textContent = '明天 00:00';

    // 計算距明天還有多久
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const diffMs = tomorrow - now;
    const diffH  = Math.floor(diffMs / 3600000);
    const diffM  = Math.floor((diffMs % 3600000) / 60000);
    const parts  = [];
    if (diffH > 0) parts.push(`${diffH} 小時`);
    if (diffM > 0 || diffH === 0) parts.push(`${diffM} 分鐘`);
    infoValueEl.textContent = `明天 00:00（還有 ${parts.join(' ')}）`;
  } else {
    iconEl.innerHTML = SVG_BLOCK;
    iconEl.classList.add('is-blocked');
    iconWrapEl.classList.add('is-blocked');
    titleEl.textContent = '此網站已被封鎖';
    reasonTextEl.textContent = '你已透過 Dopamine Detox 封鎖了這個網站。';
  }

  // 重置今日使用量（僅 reason=limit 時顯示）
  const btnReset = document.getElementById('btn-reset');
  if (reason === 'limit' && blockedHost) {
    btnReset.style.display = 'block';
    btnReset.addEventListener('click', async () => {
      const data = await chrome.storage.local.get('dailyUsage');
      const usage = data.dailyUsage ?? {};
      usage[blockedHost] = 0;
      await chrome.storage.local.set({ dailyUsage: usage });

      // 先 await 移除 DNR 規則，再導航，避免規則還在時又被攔截
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const toRemove = rules
        .filter(r => r.condition?.urlFilter === `||${blockedHost}/`)
        .map(r => r.id);
      if (toRemove.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toRemove });
      }

      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
      location.href = 'https://' + blockedHost;
    });
  }

  // 開啟 Popup 設定頁
  btnSettings.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    window.close();
  });

})();
