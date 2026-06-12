/**
 * popup/popup.js — 設定介面邏輯
 *
 * 管理三個可編輯清單：
 *   blockedDomains   — 工作時段封鎖的網域
 *   dailyLimits      — 每日限時（domain → 秒）
 *   cooldownDomains  — 強制冷卻覆蓋的網域
 */

// ── 狀態 ─────────────────────────────────────────────────────

let blockedDomains  = [];
let dailyLimits     = {};   // { 'youtube.com': 1800 }
let cooldownDomains = [];
let dailyUsage      = {};   // { 'youtube.com': 450 }

// ── 初始化 ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get([
    'enabled', 'declutterEnabled', 'workStart', 'workEnd',
    'blockedDomains', 'dailyLimits', 'cooldownDomains', 'cooldownSeconds',
    'dailyUsage'
  ]);

  // 基本設定
  const enabledEl = document.getElementById('enabled');
  enabledEl.checked = data.enabled ?? true;
  updateEnabledLabel(enabledEl.checked);
  enabledEl.addEventListener('change', () => updateEnabledLabel(enabledEl.checked));

  // --- 去介面刺激化開關連動邏輯 ---
  const declutterToggle = document.getElementById('declutter-toggle');
  if (declutterToggle) {
    // 讀取儲存的狀態，預設開啟
    declutterToggle.checked = data.declutterEnabled ?? true; 
  }
  
  document.getElementById('workStart').value = data.workStart ?? '09:00';
  document.getElementById('workEnd').value   = data.workEnd   ?? '18:00';
  document.getElementById('cooldownSeconds').value = data.cooldownSeconds ?? 20;

  // 清單資料
  blockedDomains  = data.blockedDomains  ?? ['tiktok.com','twitter.com','x.com','reddit.com','dcard.tw'];
  dailyLimits     = data.dailyLimits     ?? { 'youtube.com': 1800, 'instagram.com': 1800, 'facebook.com': 1800 };
  cooldownDomains = data.cooldownDomains ?? ['youtube.com','instagram.com','facebook.com','twitter.com','x.com'];
  dailyUsage      = data.dailyUsage      ?? {};

  renderBlockedList();
  renderLimitList();
  renderCooldownList();

  // 新增按鈕
  document.getElementById('blocked-add').addEventListener('click', () => {
    addDomain('blocked-input', blockedDomains, renderBlockedList);
  });
  document.getElementById('blocked-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain('blocked-input', blockedDomains, renderBlockedList);
  });

  document.getElementById('limit-add').addEventListener('click', addLimit);
  document.getElementById('limit-domain-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addLimit();
  });

  document.getElementById('cooldown-add').addEventListener('click', () => {
    addDomain('cooldown-input', cooldownDomains, renderCooldownList);
  });
  document.getElementById('cooldown-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain('cooldown-input', cooldownDomains, renderCooldownList);
  });

  // 儲存
  document.getElementById('save').addEventListener('click', saveSettings);
  const openReportBtn = document.getElementById('open-report');
  if (openReportBtn) {
    openReportBtn.addEventListener('click', openReportPage);
  }

});

// ── 輔助：正規化域名 ─────────────────────────────────────────

function normalizeDomain(raw) {
  return raw.trim().toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0];
}

function isValidDomain(d) {
  // 每段只允許字母數字和連字號，不允許連續點號或開頭/結尾連字號
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
}

// ── Enabled 標籤 ──────────────────────────────────────────────

function updateEnabledLabel(checked) {
  document.getElementById('enabled-label').textContent = checked ? '啟用中' : '已停用';
}

// ── 封鎖清單（標籤式） ────────────────────────────────────────

function renderTagList(containerId, arr, onDelete) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (arr.length === 0) {
    container.innerHTML = '<span class="tag-empty">尚未新增任何網站</span>';
    return;
  }

  arr.forEach((domain, i) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${domain}<button class="tag-del" title="移除">×</button>`;
    tag.querySelector('.tag-del').addEventListener('click', () => {
      arr.splice(i, 1);
      onDelete();
    });
    container.appendChild(tag);
  });
}

function renderBlockedList() {
  renderTagList('blocked-list', blockedDomains, renderBlockedList);
}

function renderCooldownList() {
  renderTagList('cooldown-list', cooldownDomains, renderCooldownList);
}

function addDomain(inputId, arr, renderFn) {
  const input = document.getElementById(inputId);
  const domain = normalizeDomain(input.value);
  if (!domain) return;
  if (!isValidDomain(domain)) { flashInput(input); return; }
  if (arr.includes(domain)) { flashInput(input); return; }
  arr.push(domain);
  input.value = '';
  renderFn();
}

// ── 每日限時清單 ──────────────────────────────────────────────

function fmtTime(sec) {
  if (sec < 60) return '< 1 分鐘';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h} 時 ${m} 分`;
  return `${m} 分鐘`;
}

function renderLimitList() {
  const container = document.getElementById('limit-list');
  container.innerHTML = '';

  const entries = Object.entries(dailyLimits);
  if (entries.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-dim);padding:4px 0">尚未設定任何限時</div>';
    return;
  }

  entries.forEach(([domain, seconds]) => {
    const row = document.createElement('div');
    row.className = 'limit-row';

    const minutes = seconds > 0 ? Math.round(seconds / 60) : 0;
    const usedSec = dailyUsage[domain] ?? 0;
    const remainSec = seconds > 0 ? Math.max(0, seconds - usedSec) : null;

    const usedStr   = fmtTime(usedSec);
    const remainStr = remainSec !== null ? fmtTime(remainSec) : '不限';
    const pct       = (seconds > 0 && usedSec > 0) ? Math.min(100, Math.round(usedSec / seconds * 100)) : 0;
    const barColor  = pct >= 100 ? '#e57373' : pct >= 75 ? '#ffb74d' : '#3a8cff';

    const exhausted = remainSec === 0;

    row.innerHTML = `
      <div class="limit-row-top">
        <span class="limit-domain">${domain}</span>
        <div style="display:flex;align-items:center;gap:6px">
          ${exhausted ? `<button class="btn-reset-usage" title="重置今日使用量">重置今日</button>` : ''}
          <button class="tag-del" title="移除" style="font-size:16px">×</button>
        </div>
      </div>
      <div class="limit-usage-info">
        <span class="usage-used">今日已用 ${usedStr}</span>
        <span class="usage-remain ${exhausted ? 'usage-exhausted' : ''}">剩餘 ${remainStr}</span>
      </div>
      ${seconds > 0 ? `<div class="usage-bar-bg"><div class="usage-bar" style="width:${pct}%;background:${barColor}"></div></div>` : ''}
      <div class="limit-row-bottom">
        <label>每日上限</label>
        <input type="number" class="limit-min" value="${minutes}" min="0">
        <span class="limit-unit">分鐘（0 = 不限）</span>
      </div>
    `;

    row.querySelector('.limit-min').addEventListener('change', async (e) => {
      const min = Math.max(0, parseInt(e.target.value, 10) || 0);
      dailyLimits[domain] = min * 60;
      // 上限改動後立即通知 background 重新計算封鎖規則
      await chrome.storage.local.set({ dailyLimits: { ...dailyLimits } });
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
      const data = await chrome.storage.local.get('dailyUsage');
      dailyUsage = data.dailyUsage ?? {};
      renderLimitList();
    });

    if (exhausted) {
      row.querySelector('.btn-reset-usage').addEventListener('click', async () => {
        const data = await chrome.storage.local.get('dailyUsage');
        const usage = data.dailyUsage ?? {};
        usage[domain] = 0;
        dailyUsage[domain] = 0;
        await chrome.storage.local.set({ dailyUsage: usage });
        chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
        renderLimitList();
      });
    }

    row.querySelector('.tag-del').addEventListener('click', () => {
      delete dailyLimits[domain];
      renderLimitList();
    });

    container.appendChild(row);
  });
}

function addLimit() {
  const domainInput = document.getElementById('limit-domain-input');
  const minInput    = document.getElementById('limit-min-input');
  const domain = normalizeDomain(domainInput.value);
  if (!domain) return;
  if (!isValidDomain(domain)) { flashInput(domainInput); return; }

  const min = Math.max(0, parseInt(minInput.value, 10) || 0);
  dailyLimits[domain] = min * 60;

  domainInput.value = '';
  minInput.value    = '';
  renderLimitList();
}

// ── 輸入錯誤提示 ──────────────────────────────────────────────

function flashInput(input) {
  input.style.borderColor = '#e57373';
  setTimeout(() => { input.style.borderColor = ''; }, 1200);
  input.focus();
}

function openReportPage() {
  const reportUrl = chrome.runtime.getURL('popup/report.html');
  chrome.tabs.create({ url: reportUrl });
}

// ── 儲存 ──────────────────────────────────────────────────────

async function saveSettings() {
  const workStart = document.getElementById('workStart').value || '09:00';
  const workEnd   = document.getElementById('workEnd').value   || '18:00';

  if (workStart >= workEnd) {
    showStatus('⚠ 開始時間必須早於結束時間', '#e57373');
    return;
  }

  const rawCooldownSeconds = parseInt(document.getElementById('cooldownSeconds').value, 10);
  const cooldownSeconds = Number.isFinite(rawCooldownSeconds)
    ? Math.min(300, Math.max(1, rawCooldownSeconds))
    : 20;
  
  // 去刺激化開關狀態 (增加這一行)
  const declutterToggle = document.getElementById('declutter-toggle');
  
  await chrome.storage.local.set({
    enabled:         document.getElementById('enabled').checked,
    declutterEnabled: declutterToggle ? declutterToggle.checked : true, // 存入開關狀態
    workStart,
    workEnd,
    blockedDomains:  [...blockedDomains],
    dailyLimits:     { ...dailyLimits },
    cooldownDomains: [...cooldownDomains],
    cooldownSeconds
  });

  chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
  showStatus('✓ 已儲存', '#4caf50');
}

function showStatus(msg, color) {
  const el = document.getElementById('status');
  el.textContent  = msg;
  el.style.color  = color;
  setTimeout(() => { el.textContent = ''; }, 2000);
}

