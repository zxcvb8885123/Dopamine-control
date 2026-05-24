/**
 * background.js — Service Worker
 * 模組二：強制阻斷與排程
 *
 * 職責：
 *   1. 分段封鎖 — 每分鐘檢查工作時段，動態新增/移除 declarativeNetRequest 規則
 *   2. 每日限時 — 接收 content 回報的使用秒數，超額時導向封鎖頁
 *   3. 每日重置 — 午夜重置 dailyUsage
 *   4. 安裝初始化 — 寫入預設設定值
 */

// ── 預設設定 ──────────────────────────────────────────────────

const DEFAULTS = {
  enabled: true,
  declutterEnabled: true,
  workStart: '09:00',    // HH:MM
  workEnd: '18:00',
  workDays: [1, 2, 3, 4, 5],  // 0=Sun … 6=Sat
  blockedDomains: [
    'tiktok.com',
    'twitter.com',
    'x.com',
    'reddit.com',
    'dcard.tw'
  ],
  dailyLimits: {         // 秒數；0 = 不限
    'youtube.com': 1800,
    'instagram.com': 1800,
    'facebook.com': 1800
  },
  cooldownDomains: [     // 進入時顯示強制冷卻的網域
    'youtube.com',
    'instagram.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'tiktok.com',
    'reddit.com',
    'dcard.tw'
  ],
  cooldownSeconds: 20,
  dailyUsage: {},
  lastResetDate: ''
};

// declarativeNetRequest 動態規則 ID 區段
const DYNAMIC_RULE_ID_BASE       = 1000; // 1000–1999：工作時段封鎖
const DAILY_LIMIT_RULE_ID_BASE   = 2000; // 2000–2999：每日限時超額封鎖

// HH:MM → 午夜起算的分鐘數
function parseHHMM(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

// ── 安裝時初始化 ──────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(null);
  const toSet = {};

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!(key in existing)) {
      toSet[key] = value;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  await scheduleAlarms();
  await updateWorkHoursBlock();
  await checkDailyReset();
  await updateDailyLimitRules();
});

// Service Worker 重啟後重新掛載排程
chrome.runtime.onStartup.addListener(async () => {
  await scheduleAlarms();
  await updateWorkHoursBlock();
  await checkDailyReset();
  await updateDailyLimitRules();
});

// ── Alarm 排程 ────────────────────────────────────────────────

async function scheduleAlarms() {
  // 每分鐘檢查工作時段
  await chrome.alarms.create('checkWorkHours', { periodInMinutes: 1 });

  // 每天午夜重置使用量
  await chrome.alarms.create('dailyReset', {
    when: getNextMidnight(),
    periodInMinutes: 60 * 24
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case 'checkWorkHours':
      await updateWorkHoursBlock();
      break;
    case 'dailyReset':
      await resetDailyUsage();
      break;
  }
});

function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

// ── 分段封鎖：工作時段動態規則 ───────────────────────────────

async function updateWorkHoursBlock() {
  const data = await chrome.storage.local.get([
    'enabled', 'workStart', 'workEnd', 'workDays', 'blockedDomains'
  ]);

  const {
    enabled = true,
    workStart = '09:00',
    workEnd = '18:00',
    workDays = [1, 2, 3, 4, 5],
    blockedDomains = DEFAULTS.blockedDomains
  } = data;

  // 只移除工作時段區段的規則（1000–1999），不動每日限時規則
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .filter(r => r.id >= DYNAMIC_RULE_ID_BASE && r.id < DAILY_LIMIT_RULE_ID_BASE)
    .map(r => r.id);

  if (!enabled) {
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const now = new Date();
  const currentDay = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const startMin = parseHHMM(workStart);
  const endMin   = parseHHMM(workEnd);

  const isWorkDay  = workDays.includes(currentDay);
  // startMin >= endMin（如跨夜或設定錯誤）時視為無效時段，不封鎖
  const isWorkHour = startMin < endMin && nowMinutes >= startMin && nowMinutes < endMin;
  const isWorkTime = isWorkDay && isWorkHour;

  if (isWorkTime) {
    const blockedUrl = chrome.runtime.getURL('blocked.html') +
      '?reason=workhours&end=' + encodeURIComponent(workEnd);

    const addRules = blockedDomains.map((domain, i) => ({
      id: DYNAMIC_RULE_ID_BASE + i,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: { url: blockedUrl }
      },
      condition: {
        urlFilter: `||${domain}/`,
        resourceTypes: ['main_frame']
      }
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    });
  } else {
    // 非工作時段：移除所有動態封鎖規則
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
  }
}

// ── 每日限時：DNR 規則（超額後網路層直接封鎖）────────────────

async function updateDailyLimitRules() {
  const { dailyUsage = {}, dailyLimits = {}, enabled = true } =
    await chrome.storage.local.get(['dailyUsage', 'dailyLimits', 'enabled']);

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .filter(r => r.id >= DAILY_LIMIT_RULE_ID_BASE && r.id < DAILY_LIMIT_RULE_ID_BASE + 1000)
    .map(r => r.id);

  if (!enabled) {
    if (removeRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    }
    return;
  }

  const exceededDomains = Object.entries(dailyLimits)
    .filter(([domain, limitSec]) => limitSec > 0 && (dailyUsage[domain] || 0) >= limitSec)
    .map(([domain]) => domain);

  const addRules = exceededDomains.map((domain, i) => ({
    id: DAILY_LIMIT_RULE_ID_BASE + i,
    priority: 3, // 高於工作時段規則（priority 2）
    action: {
      type: 'redirect',
      redirect: {
        url: chrome.runtime.getURL('blocked.html') +
          '?reason=limit&domain=' + encodeURIComponent(domain)
      }
    },
    condition: {
      urlFilter: `||${domain}/`,
      resourceTypes: ['main_frame']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

// ── 每日限時：接收 content script 回報 ───────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'REPORT_USAGE') {
    handleUsageReport(msg, sender).then(sendResponse);
    return true; // 非同步回應
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get([
      'enabled', 'dailyLimits', 'cooldownDomains', 'cooldownSeconds', 'dailyUsage'
    ]).then(sendResponse);
    return true;
  }

  if (msg.type === 'SETTINGS_UPDATED') {
    updateWorkHoursBlock();
    updateDailyLimitRules();
    return false;
  }

  if (msg.type === 'OPEN_POPUP') {
    chrome.action.openPopup?.();
    return false;
  }
});

async function handleUsageReport({ domain, seconds }, sender) {
  if (!sender?.tab?.id) return { ok: false };

  const data = await chrome.storage.local.get(['dailyUsage', 'dailyLimits', 'enabled']);
  const { enabled = true, dailyLimits = {}, dailyUsage = {} } = data;

  if (!enabled) return { ok: true, action: 'none' };

  const prevSeconds = dailyUsage[domain] || 0;
  const limitSec    = dailyLimits[domain] || 0;

  // seconds=0 是頁面開啟時的純查詢，不累加
  const newSeconds = prevSeconds + seconds;
  if (seconds > 0) {
    dailyUsage[domain] = newSeconds;
    await chrome.storage.local.set({ dailyUsage });
  }

  const usedSeconds = seconds > 0 ? newSeconds : prevSeconds;

  if (limitSec > 0 && usedSeconds >= limitSec) {
    // 加 DNR 規則，讓後續所有導航也被網路層攔截
    await updateDailyLimitRules();

    const blockedUrl = chrome.runtime.getURL('blocked.html') +
      '?reason=limit&domain=' + encodeURIComponent(domain);
    try {
      await chrome.tabs.update(sender.tab.id, { url: blockedUrl });
    } catch (e) {
      console.error('[DD] tabs.update failed:', e);
    }
    return { ok: true, action: 'blocked' };
  }

  const remaining = limitSec > 0 ? limitSec - usedSeconds : -1;
  return { ok: true, action: 'none', remaining };
}

// ── 每日重置 ──────────────────────────────────────────────────

async function checkDailyReset() {
  const { lastResetDate } = await chrome.storage.local.get('lastResetDate');
  const today = getTodayString();

  if (lastResetDate !== today) {
    await resetDailyUsage();
  }
}

async function resetDailyUsage() {
  const today = getTodayString();
  await chrome.storage.local.set({
    dailyUsage: {},
    lastResetDate: today
  });
  await updateDailyLimitRules(); // 重置後清除所有超額封鎖規則
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
