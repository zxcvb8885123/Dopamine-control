import { getTodayUsage, getLastNDaysUsage } from "../modules/usage-analytics/summary.js";
import {
  getAiSettings,
  saveAiSettings,
  generateAiAnalysis,
  PROVIDER_DEFAULTS,
} from "../modules/usage-analytics/ai.js";

const REPORT_REFRESH_INTERVAL_MS = 5000;

const TEXT = {
  pageTitle: "\u4f7f\u7528\u5831\u544a",
  loading: "\u8f09\u5165\u4e2d...",
  groupLabel: "\u5831\u8868\u5340\u9593",
  btnDaily: "\u6bcf\u65e5",
  btnWeekly: "\u6bcf\u9031",
  btnMonthly: "\u6bcf\u6708",
  rangeToday: "\u4eca\u65e5",
  range7: "\u8fd1 7 \u5929",
  range30: "\u8fd1 30 \u5929",
  total: "\u7e3d\u8a08",
  avgPerDay: "\u65e5\u5747",
  top1: "\u7b2c\u4e00\u540d",
  noData: "\u6b64\u5340\u9593\u6c92\u6709\u4f7f\u7528\u8cc7\u6599\u3002",
  loadFailed: "\u8f09\u5165\u5931\u6557",
  aiSaved: "AI \u8a2d\u5b9a\u5df2\u5132\u5b58\u3002",
  aiAnalyzing: "AI \u5206\u6790\u7522\u751f\u4e2d...",
  aiReady: "AI \u5206\u6790\u5df2\u5b8c\u6210\u3002",
  aiKeyRequired: "\u8acb\u5148\u8f38\u5165 API Key \u5f8c\u518d\u4f7f\u7528 AI \u5206\u6790\u529f\u80fd\u3002",
};

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  if (safe < 60) return "< 1 分";
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h} 時 ${m} 分`;
  return `${m} 分鐘`;
}

function getRangeTitle(range) {
  if (range === "daily") return TEXT.rangeToday;
  if (range === "weekly") return TEXT.range7;
  return TEXT.range30;
}

function getAverageLabel(range) {
  if (range === "daily") return TEXT.rangeToday;
  return TEXT.avgPerDay;
}

function renderEmptyState() {
  const list = document.getElementById("usage-list");
  const emptyTip = document.getElementById("empty-tip");
  const topDomain = document.getElementById("top-domain");

  list.innerHTML = "";
  emptyTip.hidden = false;
  topDomain.textContent = `${TEXT.top1}: --`;
}

function renderTopDomain(domains) {
  const topDomain = document.getElementById("top-domain");
  if (!domains.length) {
    topDomain.textContent = `${TEXT.top1}: --`;
    return;
  }

  const first = domains[0];
  topDomain.textContent = `${TEXT.top1}: ${first.domain} (${formatDuration(first.seconds)})`;
}

function renderDomainList(domains) {
  const list = document.getElementById("usage-list");
  const emptyTip = document.getElementById("empty-tip");

  list.innerHTML = "";
  emptyTip.hidden = domains.length > 0;
  if (!domains.length) return;

  const totalSeconds = domains.reduce((sum, item) => sum + (item.seconds || 0), 0);

  domains.forEach((item, index) => {
    const li = document.createElement("li");
    const domainRow = document.createElement("div");
    domainRow.className = "domain-row";
    const domainLabel = document.createElement("div");
    domainLabel.className = "domain-label";

    const rankEl = document.createElement("span");
    rankEl.className = "rank-badge";
    rankEl.textContent = `#${index + 1}`;

    const domainEl = document.createElement("span");
    domainEl.className = "domain";
    domainEl.textContent = item.domain;

    const timeEl = document.createElement("span");
    timeEl.className = "time";
    timeEl.textContent = formatDuration(item.seconds);

    domainLabel.appendChild(rankEl);
    domainLabel.appendChild(domainEl);
    domainRow.appendChild(domainLabel);
    domainRow.appendChild(timeEl);

    const percentage = Math.round(((item.seconds || 0) / Math.max(1, totalSeconds)) * 100);

    const meta = document.createElement("div");
    meta.className = "domain-meta";
    meta.textContent = `${percentage}%`;

    const progressTrack = document.createElement("div");
    progressTrack.className = "progress-track";
    const progressFill = document.createElement("div");
    progressFill.className = "progress-fill";
    progressTrack.appendChild(progressFill);

    li.style.animation = `li-in 200ms ease-out ${index * 50}ms both`;
    li.appendChild(domainRow);
    li.appendChild(meta);
    li.appendChild(progressTrack);
    list.appendChild(li);

    requestAnimationFrame(() => { progressFill.style.width = `${percentage}%`; });
  });
}

async function getReportData(range) {
  if (range === "daily") {
    const daily = await getTodayUsage();
    return {
      range,
      title: getRangeTitle(range),
      totalSeconds: daily.totalSeconds,
      avgSeconds: daily.totalSeconds,
      domains: daily.domains || [],
    };
  }

  const days = range === "weekly" ? 7 : 30;
  const report = await getLastNDaysUsage(days);
  return {
    range,
    title: getRangeTitle(range),
    totalSeconds: report.totalSeconds,
    avgSeconds: report.avgSecondsPerDay,
    domains: report.topDomains || [],
    days: report.days || [],
  };
}

function setActiveRange(range) {
  document.querySelectorAll("[data-range]").forEach((btn) => {
    const isActive = btn.dataset.range === range;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

let currentRange = "daily";
let refreshIntervalId = null;
let latestReport = null;

async function renderReport(range) {
  currentRange = range;
  const rangeEl = document.getElementById("report-range");
  const totalEl = document.getElementById("period-total");
  const avgEl = document.getElementById("period-avg");

  setActiveRange(range);

  try {
    const report = await getReportData(range);
    latestReport = report;

    rangeEl.textContent = report.title;
    totalEl.textContent = `${TEXT.total}: ${formatDuration(report.totalSeconds)}`;
    avgEl.textContent = `${getAverageLabel(range)}: ${formatDuration(report.avgSeconds)}`;

    const domains = [...report.domains].sort((a, b) => b.seconds - a.seconds);
    if (!domains.length) {
      renderEmptyState();
      return;
    }

    renderTopDomain(domains);
    renderDomainList(domains);
  } catch {
    rangeEl.textContent = TEXT.loadFailed;
    totalEl.textContent = `${TEXT.total}: --`;
    avgEl.textContent = `${TEXT.avgPerDay}: --`;
    latestReport = null;
    renderEmptyState();
  }
}

function getAiFormValues() {
  return {
    enabled: document.getElementById("ai-enabled").checked,
    provider: document.getElementById("ai-provider").value,
    apiKey: document.getElementById("ai-api-key").value.trim(),
    endpoint: document.getElementById("ai-endpoint").value.trim(),
  };
}

async function getAiAnalysisData() {
  const selectedReport = await getReportData(currentRange);
  const weekly = await getLastNDaysUsage(7);
  const periodDays = currentRange === "monthly" ? 30 : currentRange === "weekly" ? 7 : 1;
  const periodReport = currentRange === "monthly" ? await getLastNDaysUsage(30) : weekly;
  const yd = new Date(Date.now() - 86400000);
  const yesterdayKey = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
  const yesterdayEntry = weekly.days?.find(d => d.date === yesterdayKey);
  const yesterday = yesterdayEntry?.totalSeconds || 0;

  return {
    ...selectedReport,
    history: {
      selectedRange: currentRange,
      selectedPeriodDays: periodDays,
      selectedPeriodDailyTotals: periodReport.days || [],
      last7DaysTotalSeconds: weekly.totalSeconds,
      last7DaysAvgSeconds: weekly.avgSecondsPerDay,
      yesterdaySeconds: yesterday,
    },
  };
}

function setAiStatus(message, type = "") {
  const status = document.getElementById("ai-status");
  status.textContent = message;
  status.classList.toggle("is-error", type === "error");
  status.classList.toggle("is-ok", type === "ok");
}

function applyProviderDefaults(provider) {
  const endpointInput = document.getElementById("ai-endpoint");
  const customFields = document.getElementById("ai-custom-fields");
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openai;

  customFields.hidden = provider !== "custom";
  if (provider !== "custom") {
    endpointInput.value = defaults.endpoint;
  }
}

function validateAiSettings(settings) {
  if (settings.enabled && !settings.apiKey) {
    return TEXT.aiKeyRequired;
  }
  if (settings.enabled && settings.provider === "custom" && !settings.endpoint) {
    return "請先輸入 Custom API Endpoint。";
  }
  return "";
}

async function loadAiSettings() {
  const settings = await getAiSettings();
  document.getElementById("ai-enabled").checked = settings.enabled;
  document.getElementById("ai-provider").value = settings.provider;
  document.getElementById("ai-api-key").value = settings.apiKey;
  document.getElementById("ai-endpoint").value = settings.endpoint;
  applyProviderDefaults(settings.provider);
}

async function handleSaveAiSettings() {
  const settings = getAiFormValues();
  const error = validateAiSettings(settings);
  if (error) {
    setAiStatus(error, "error");
    return null;
  }

  const saved = await saveAiSettings(settings);
  setAiStatus(TEXT.aiSaved, "ok");
  return saved;
}

function renderAiAnalysis(analysis) {
  document.getElementById("ai-summary").textContent = analysis.todaySummary;
  document.getElementById("ai-anomaly").textContent = analysis.anomalyAlert;
  document.getElementById("ai-suggestion").textContent = analysis.tomorrowSuggestion;
  document.getElementById("ai-result").hidden = false;
}

async function handleGenerateAiAnalysis() {
  let settings = await handleSaveAiSettings();
  if (!settings) return;

  const generateBtn = document.getElementById("ai-generate");
  generateBtn.disabled = true;
  setAiStatus(TEXT.aiAnalyzing);

  try {
    const analysisData = await getAiAnalysisData();
    const analysis = await generateAiAnalysis(settings, analysisData);
    renderAiAnalysis(analysis);
    setAiStatus(TEXT.aiReady, "ok");
  } catch (error) {
    setAiStatus(error?.message || "AI 分析失敗，請稍後再試。", "error");
  } finally {
    generateBtn.disabled = false;
  }
}

function initAiControls() {
  const providerSelect = document.getElementById("ai-provider");
  if (!providerSelect) return;

  providerSelect.addEventListener("change", () => {
    applyProviderDefaults(providerSelect.value);
  });
  document.getElementById("ai-save").addEventListener("click", handleSaveAiSettings);
  document.getElementById("ai-generate").addEventListener("click", handleGenerateAiAnalysis);
  loadAiSettings().catch((error) => {
    setAiStatus(error?.message || "AI 設定載入失敗。", "error");
  });
}

function localizeStaticText() {
  document.title = TEXT.pageTitle;
  document.getElementById("report-title").textContent = TEXT.pageTitle;
  document.getElementById("report-range").textContent = TEXT.loading;
  document.getElementById("range-group").setAttribute("aria-label", TEXT.groupLabel);
  document.querySelector("[data-range='daily']").textContent = TEXT.btnDaily;
  document.querySelector("[data-range='weekly']").textContent = TEXT.btnWeekly;
  document.querySelector("[data-range='monthly']").textContent = TEXT.btnMonthly;
  document.getElementById("period-total").textContent = `${TEXT.total}: --`;
  document.getElementById("period-avg").textContent = `${TEXT.avgPerDay}: --`;
  document.getElementById("top-domain").textContent = `${TEXT.top1}: --`;
  document.getElementById("empty-tip").textContent = TEXT.noData;
}

function startAutoRefresh() {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(() => {
    renderReport(currentRange);
  }, REPORT_REFRESH_INTERVAL_MS);
}

function initReport() {
  localizeStaticText();
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderReport(btn.dataset.range);
    });
  });

  renderReport(currentRange);
  initAiControls();
  startAutoRefresh();
}

try {
  initReport();
} catch (error) {
  const rangeEl = document.getElementById("report-range");
  if (rangeEl) rangeEl.textContent = TEXT.loadFailed;
  console.error("Report init failed", error);
}
