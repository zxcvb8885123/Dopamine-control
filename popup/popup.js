/**
 * FocusFlow Pro - 核心邏輯
 * 整合組長的動態限額與時段管理系統
 */

let state = {
    blockedDomains: [],
    dailyLimits: {},
    dailyUsage: {},
    cooldownDomains: []
  };
  
  document.addEventListener('DOMContentLoaded', async () => {
    // 1. 從 Chrome Storage 初始化載入
    const data = await chrome.storage.local.get([
      'enabled', 'workStart', 'workEnd', 'blockedDomains', 
      'dailyLimits', 'dailyUsage', 'cooldownSeconds'
    ]);
  
    // 2. 介面與資料同步
    document.getElementById('enabled').checked = data.enabled ?? true;
    document.getElementById('workStart').value = data.workStart ?? '09:00';
    document.getElementById('workEnd').value = data.workEnd ?? '18:00';
    document.getElementById('cooldownSeconds').value = data.cooldownSeconds ?? 20;
  
    state.dailyLimits = data.dailyLimits ?? {};
    state.dailyUsage = data.dailyUsage ?? {};
    state.blockedDomains = data.blockedDomains ?? [];
  
    // 3. 啟動分頁與清單渲染
    initTabs();
    renderLimitList();
  
    // 4. 事件綁定：新增限時網站
    document.getElementById('limit-add').addEventListener('click', () => {
      const domain = normalizeDomain(document.getElementById('limit-domain').value);
      const mins = parseInt(document.getElementById('limit-min').value, 10);
      
      if (domain && !isNaN(mins)) {
        state.dailyLimits[domain] = mins * 60;
        renderLimitList();
        document.getElementById('limit-domain').value = '';
        document.getElementById('limit-min').value = '';
      }
    });
  
    // 5. 儲存設定
    document.getElementById('save-settings').addEventListener('click', saveSettings);
  });
  
  // --- 功能：分頁切換 ---
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn, .tab-pane').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });
  }
  
  // --- 功能：渲染組長的進度條清單 ---
  function renderLimitList() {
    const list = document.getElementById('limit-list');
    list.innerHTML = '';
    
    Object.entries(state.dailyLimits).forEach(([domain, limitSec]) => {
      const usedSec = state.dailyUsage[domain] ?? 0;
      const pct = Math.min(100, Math.round((usedSec / limitSec) * 100));
      
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `
        <div class="item-row">
          <span style="font-size:12px">${domain}</span>
          <span style="font-size:11px; color:#888">${Math.round(usedSec/60)} / ${limitSec/60} 分鐘</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" style="width:${pct}%; background:${pct >= 100 ? '#e57373' : '#3a8cff'}"></div>
        </div>
      `;
      list.appendChild(item);
    });
  }
  
  // --- 功能：網域正規化 (組長的精華邏輯) ---
  function normalizeDomain(url) {
    return url.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  }
  
  // --- 功能：儲存設定並通知背景 ---
  async function saveSettings() {
    const saveBtn = document.getElementById('save-settings');
    const settings = {
      enabled: document.getElementById('enabled').checked,
      workStart: document.getElementById('workStart').value,
      workEnd: document.getElementById('workEnd').value,
      cooldownSeconds: parseInt(document.getElementById('cooldownSeconds').value, 10) || 20,
      dailyLimits: state.dailyLimits,
      blockedDomains: state.blockedDomains
    };
  
    await chrome.storage.local.set(settings);
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
  
    // 視覺回饋
    saveBtn.textContent = "已更新 ✓";
    saveBtn.style.background = "#2e7d32";
    setTimeout(() => {
      saveBtn.textContent = "保存所有設定";
      saveBtn.style.background = "";
    }, 1500);
  }