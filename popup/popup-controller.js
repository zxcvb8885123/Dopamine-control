let state = { dailyLimits: {}, blockedDomains: [], dailyUsage: {} };

document.addEventListener('DOMContentLoaded', async () => {
  // --- 1. 分頁邏輯 ---
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.tab-btn, .pane').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
      document.getElementById('pane-' + b.dataset.pane).classList.add('active');
    };
  });

  // --- 2. 載入資料 (全防錯機制) ---
  const data = await chrome.storage.local.get(null);
  document.getElementById('master-enabled').checked = data.enabled !== false;
  document.getElementById('w-start').value = data.workStart || '09:00';
  document.getElementById('w-end').value = data.workEnd || '18:00';
  
  const fs = data.filterSettings || { yt: true, fb: true, ig: true, dc: true };
  document.getElementById('f-yt').checked = fs.yt !== false;
  document.getElementById('f-fb').checked = fs.fb !== false;
  document.getElementById('f-ig').checked = fs.ig !== false;
  document.getElementById('f-dc').checked = fs.dc !== false;

  state.dailyLimits = data.dailyLimits || {};
  state.blockedDomains = data.blockedDomains || [];
  state.dailyUsage = data.dailyUsage || {};
  render();

  // --- 3. 互動：新增限時與封鎖 ---
  document.getElementById('b-add').onclick = () => {
    const v = document.getElementById('b-input').value.trim().toLowerCase();
    if (v && !state.blockedDomains.includes(v)) {
      state.blockedDomains.push(v);
      document.getElementById('b-input').value = '';
      render();
    }
  };

  document.getElementById('l-add').onclick = () => {
    const d = document.getElementById('l-dom').value.trim().toLowerCase();
    const m = parseInt(document.getElementById('l-min').value);
    if (d && !isNaN(m)) {
      state.dailyLimits[d] = m * 60;
      document.getElementById('l-dom').value = '';
      document.getElementById('l-min').value = '';
      render();
    }
  };

  // --- 4. 儲存與重置 ---
  document.getElementById('save-btn').onclick = async () => {
    const s = {
      enabled: document.getElementById('master-enabled').checked,
      workStart: document.getElementById('w-start').value,
      workEnd: document.getElementById('w-end').value,
      dailyLimits: state.dailyLimits,
      blockedDomains: state.blockedDomains,
      filterSettings: {
        yt: document.getElementById('f-yt').checked,
        fb: document.getElementById('f-fb').checked,
        ig: document.getElementById('f-ig').checked,
        dc: document.getElementById('f-dc').checked
      }
    };
    await chrome.storage.local.set(s);
    chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
    alert('✅ 設定已成功同步並存入雲端！');
  };

  document.getElementById('reset-btn').onclick = async () => {
    if (confirm('⚠️ 確定要解除並重置所有設定嗎？這將還原所有網站訪問權限。')) {
      await chrome.storage.local.clear();
      location.reload();
    }
  };
});

function render() {
  document.getElementById('limit-list').innerHTML = Object.entries(state.dailyLimits).map(([d, s]) => {
    const u = state.dailyUsage[d] || 0;
    const p = Math.min(100, Math.round(u/s*100));
    return `<div class="card" style="font-size:12px; display:flex; justify-content:space-between">
      <span>${d}</span><strong>${p}% 消耗</strong></div>`;
  }).join('') || '<p style="font-size:11px;color:#444;text-align:center">目前無限時網站</p>';

  document.getElementById('b-tags').innerHTML = state.blockedDomains.map((d, i) => 
    `<span class="tag">${d}<span class="tag-del" onclick="removeDomain(${i})">×</span></span>`
  ).join('');
}

window.removeDomain = (i) => {
  state.blockedDomains.splice(i, 1);
  render();
};