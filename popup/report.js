import { getTodayUsage, getLastNDaysUsage } from "../modules/usage-analytics/summary.js";

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
};

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
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

    const meta = document.createElement("div");
    meta.className = "domain-meta";
    const percentage = Math.round(((item.seconds || 0) / Math.max(1, totalSeconds)) * 100);
    meta.textContent = `${percentage}%`;

    li.appendChild(domainRow);
    li.appendChild(meta);
    list.appendChild(li);
  });
}

async function getReportData(range) {
  if (range === "daily") {
    const daily = await getTodayUsage();
    return {
      title: getRangeTitle(range),
      totalSeconds: daily.totalSeconds,
      avgSeconds: daily.totalSeconds,
      domains: daily.domains || [],
    };
  }

  const days = range === "weekly" ? 7 : 30;
  const report = await getLastNDaysUsage(days);
  return {
    title: getRangeTitle(range),
    totalSeconds: report.totalSeconds,
    avgSeconds: report.avgSecondsPerDay,
    domains: report.topDomains || [],
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

async function renderReport(range) {
  currentRange = range;
  const rangeEl = document.getElementById("report-range");
  const totalEl = document.getElementById("period-total");
  const avgEl = document.getElementById("period-avg");

  setActiveRange(range);

  try {
    const report = await getReportData(range);

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
    renderEmptyState();
  }
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
  startAutoRefresh();
}

initReport();
