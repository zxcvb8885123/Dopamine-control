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
    iconEl.textContent = '🧠';
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
    iconEl.textContent = '⏱';
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
    // 未知原因
    iconEl.textContent = '🚫';
    titleEl.textContent = '此網站已被封鎖';
    reasonTextEl.textContent = '你已透過 Dopamine Detox 封鎖了這個網站。';
  }

  // 開啟 Popup 設定頁
  btnSettings.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    window.close();
  });

})();
