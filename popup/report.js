import { getTodayUsage, getLastNDaysUsage } from "../modules/usage-analytics/summary.js";
import {
  getAiSettings,
  saveAiSettings,
  generateAiAnalysis,
  PROVIDER_DEFAULTS,
} from "../modules/usage-analytics/ai.js";

const REPORT_REFRESH_INTERVAL_MS = 5000;
const DOMAIN_CATEGORY_OVERRIDES_KEY = "usageAnalyticsDomainCategories";

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
  categoryTitle: "\u5206\u985e\u5206\u5e03",
  noData: "\u6b64\u5340\u9593\u6c92\u6709\u4f7f\u7528\u8cc7\u6599\u3002",
  loadFailed: "\u8f09\u5165\u5931\u6557",
  aiSaved: "AI \u8a2d\u5b9a\u5df2\u5132\u5b58\u3002",
  aiAnalyzing: "AI \u5206\u6790\u7522\u751f\u4e2d...",
  aiReady: "AI \u5206\u6790\u5df2\u5b8c\u6210\u3002",
  aiKeyRequired: "\u8acb\u5148\u8f38\u5165 API Key \u5f8c\u518d\u4f7f\u7528 AI \u5206\u6790\u529f\u80fd\u3002",
};

const CATEGORY_DEFINITIONS = [
  {
    id: "social",
    label: "\u793e\u7fa4\u4e92\u52d5",
    color: "#5ba4ff",
    domains: [
      "facebook.com",
      "instagram.com",
      "threads.net",
      "x.com",
      "twitter.com",
      "reddit.com",
      "dcard.tw",
      "ptt.cc",
      "linkedin.com",
      "discord.com",
      "telegram.org",
    ],
  },
  {
    id: "shopping",
    label: "\u8cfc\u7269\u6d88\u8cbb",
    color: "#f5c96a",
    domains: [
      "amazon.com",
      "shopee.tw",
      "shopee.com",
      "momo.com.tw",
      "momoshop.com.tw",
      "pchome.com.tw",
      "24h.pchome.com.tw",
      "shopping.pchome.com.tw",
      "rakuten.com",
      "rakuten.com.tw",
      "taobao.com",
      "tmall.com",
      "ebay.com",
      "costco.com",
      "costco.com.tw",
      "books.com.tw",
      "pxgo.com.tw",
      "shop.pxgo.com.tw",
      "carrefour.com.tw",
      "feebee.com.tw",
      "etmall.com.tw",
      "friiday.tw",
      "ruten.com.tw",
      "shopping.friday.tw",
      "i3fresh.tw",
      "fitnessfactoryshop.com.tw",
      "rhinoshield.tw",
    ],
  },
  {
    id: "entertainment",
    label: "\u5f71\u97f3\u5a1b\u6a02",
    color: "#9ee6b4",
    domains: [
      "youtube.com",
      "youtu.be",
      "netflix.com",
      "twitch.tv",
      "tiktok.com",
      "spotify.com",
      "disneyplus.com",
      "primevideo.com",
      "bilibili.com",
      "bahamut.com.tw",
      "gamer.com.tw",
    ],
  },
  {
    id: "info",
    label: "\u641c\u5c0b\u8207\u8cc7\u8a0a",
    color: "#c7a4ff",
    domains: [
      "google.com",
      "google.com.tw",
      "bing.com",
      "yahoo.com",
      "yahoo.com.tw",
      "wikipedia.org",
      "medium.com",
      "news.google.com",
      "udn.com",
      "chinatimes.com",
      "ltn.com.tw",
      "ettoday.net",
      "cna.com.tw",
      "thenewslens.com",
    ],
  },
  {
    id: "work-learning",
    label: "\u5de5\u4f5c\u8207\u5b78\u7fd2",
    color: "#7dd3fc",
    domains: [
      "github.com",
      "gist.github.com",
      "github.io",
      "githubusercontent.com",
      "gitlab.com",
      "stackoverflow.com",
      "chatgpt.com",
      "openai.com",
      "notion.so",
      "docs.google.com",
      "drive.google.com",
      "classroom.google.com",
      "coursera.org",
      "edx.org",
      "hahow.in",
      "udemy.com",
      "khanacademy.org",
    ],
  },
  {
    id: "other",
    label: "\u5176\u4ed6",
    color: "#96a2bd",
    domains: [],
  },
];

let domainCategoryOverrides = {};

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

function normalizeDomain(domain = "") {
  return String(domain).trim().toLowerCase().replace(/^www\./, "");
}

async function loadDomainCategoryOverrides() {
  const data = await chrome.storage.local.get([DOMAIN_CATEGORY_OVERRIDES_KEY]);
  domainCategoryOverrides = data[DOMAIN_CATEGORY_OVERRIDES_KEY] || {};
}

async function saveDomainCategoryOverride(domain, categoryId) {
  const normalized = normalizeDomain(domain);
  if (!normalized) return;

  domainCategoryOverrides = {
    ...domainCategoryOverrides,
    [normalized]: categoryId,
  };
  await chrome.storage.local.set({
    [DOMAIN_CATEGORY_OVERRIDES_KEY]: domainCategoryOverrides,
  });
}

function renderEmptyState() {
  const list = document.getElementById("usage-list");
  const categoryList = document.getElementById("category-list");
  const emptyTip = document.getElementById("empty-tip");
  const topDomain = document.getElementById("top-domain");

  list.innerHTML = "";
  list.dataset.signature = "";
  categoryList.innerHTML = "";
  categoryList.dataset.signature = "";
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

function getDomainSignature(domains) {
  return buildDomainGroups(domains)
    .map((group) => `${group.id}:${group.domains.map((item) => item.domain).join(",")}`)
    .join("|");
}

function domainMatches(domain, ruleDomain) {
  return domain === ruleDomain || domain.endsWith(`.${ruleDomain}`);
}

function looksLikeShoppingDomain(domain) {
  const shoppingKeywords = ["shop", "store", "mall", "market", "mart"];
  const falsePositiveKeywords = ["workshop", "photoshop"];
  if (falsePositiveKeywords.some((keyword) => domain.includes(keyword))) return false;
  return shoppingKeywords.some((keyword) => domain.includes(keyword));
}

function getDomainCategory(domain) {
  const normalized = normalizeDomain(domain);
  const overrideCategory = CATEGORY_DEFINITIONS.find(
    (category) => category.id === domainCategoryOverrides[normalized]
  );
  if (overrideCategory) return overrideCategory;

  const matchedCategory = CATEGORY_DEFINITIONS.find((category) =>
    category.id !== "other" && category.domains.some((ruleDomain) => domainMatches(normalized, ruleDomain))
  );
  if (matchedCategory) return matchedCategory;
  if (looksLikeShoppingDomain(normalized)) {
    return CATEGORY_DEFINITIONS.find((category) => category.id === "shopping");
  }
  return CATEGORY_DEFINITIONS.find((category) => category.id === "other");
}

function buildCategorySummary(domains) {
  const totals = new Map(
    CATEGORY_DEFINITIONS.map((category) => [
      category.id,
      { ...category, seconds: 0 },
    ])
  );

  domains.forEach((item) => {
    const category = getDomainCategory(item.domain);
    const current = totals.get(category.id);
    current.seconds += Math.max(0, Math.floor(Number(item.seconds) || 0));
  });

  return [...totals.values()]
    .filter((category) => category.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

function buildDomainGroups(domains) {
  const groups = new Map(
    CATEGORY_DEFINITIONS.map((category) => [
      category.id,
      { ...category, seconds: 0, domains: [] },
    ])
  );

  domains.forEach((item) => {
    const category = getDomainCategory(item.domain);
    const group = groups.get(category.id);
    const safeSeconds = Math.max(0, Math.floor(Number(item.seconds) || 0));
    group.seconds += safeSeconds;
    group.domains.push({ ...item, seconds: safeSeconds });
  });

  return [...groups.values()]
    .filter((group) => group.domains.length > 0)
    .map((group) => ({
      ...group,
      domains: group.domains.sort((a, b) => b.seconds - a.seconds),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

function getCategorySignature(categories) {
  return categories.map((item) => item.id).join("|");
}

function scrollToDomainGroup(categoryId) {
  const group = document.querySelector(`[data-group="${CSS.escape(categoryId)}"]`);
  if (!group) return;

  document.querySelectorAll(".domain-group.is-highlighted").forEach((item) => {
    item.classList.remove("is-highlighted");
  });

  group.scrollIntoView({ behavior: "smooth", block: "start" });
  group.classList.add("is-highlighted");
  window.setTimeout(() => {
    group.classList.remove("is-highlighted");
  }, 1400);
}

function updateCategoryList(categories) {
  const list = document.getElementById("category-list");
  const totalSeconds = categories.reduce((sum, item) => sum + item.seconds, 0);

  categories.forEach((item) => {
    const row = list.querySelector(`[data-category="${CSS.escape(item.id)}"]`);
    if (!row) return;

    const percentage = Math.round((item.seconds / Math.max(1, totalSeconds)) * 100);
    row.querySelector(".category-time").textContent = `${formatDuration(item.seconds)} · ${percentage}%`;
    row.querySelector(".category-fill").style.width = `${percentage}%`;
  });
}

function renderCategoryList(categories, options = {}) {
  const list = document.getElementById("category-list");
  const { animate = true, force = false } = options;
  const nextSignature = getCategorySignature(categories);

  if (!categories.length) {
    list.innerHTML = "";
    list.dataset.signature = "";
    return;
  }

  if (!force && list.dataset.signature === nextSignature) {
    updateCategoryList(categories);
    return;
  }

  list.dataset.signature = nextSignature;

  const totalSeconds = categories.reduce((sum, item) => sum + item.seconds, 0);
  const fragment = document.createDocumentFragment();

  categories.forEach((item, index) => {
    const percentage = Math.round((item.seconds / Math.max(1, totalSeconds)) * 100);
    const li = document.createElement("li");
    li.className = "category-item";
    li.dataset.category = item.id;
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", `前往${item.label}網站清單`);
    li.style.setProperty("--category-color", item.color);
    li.style.setProperty("--category-glow", `${item.color}44`);
    if (animate) {
      li.style.animation = `li-in 200ms ease-out ${index * 40}ms both`;
    }

    const categoryRow = document.createElement("div");
    categoryRow.className = "category-row";
    const categoryLabel = document.createElement("span");
    categoryLabel.className = "category-label";
    const dot = document.createElement("span");
    dot.className = "category-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = item.label;
    const time = document.createElement("span");
    time.className = "category-time";
    time.textContent = `${formatDuration(item.seconds)} · ${percentage}%`;

    categoryLabel.appendChild(dot);
    categoryLabel.appendChild(label);
    categoryRow.appendChild(categoryLabel);
    categoryRow.appendChild(time);

    const track = document.createElement("div");
    track.className = "category-track";
    const fill = document.createElement("div");
    fill.className = "category-fill";
    track.appendChild(fill);

    li.appendChild(categoryRow);
    li.appendChild(track);
    fragment.appendChild(li);

    li.addEventListener("click", () => scrollToDomainGroup(item.id));
    li.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        scrollToDomainGroup(item.id);
      }
    });

    if (animate) {
      requestAnimationFrame(() => { fill.style.width = `${percentage}%`; });
    } else {
      fill.style.width = `${percentage}%`;
    }
  });

  list.replaceChildren(fragment);
}

function updateDomainList(domains) {
  const list = document.getElementById("usage-list");
  const totalSeconds = domains.reduce((sum, item) => sum + (item.seconds || 0), 0);
  const groups = buildDomainGroups(domains);

  groups.forEach((group) => {
    const groupEl = list.querySelector(`[data-group="${CSS.escape(group.id)}"]`);
    if (groupEl) {
      groupEl.querySelector(".domain-group-time").textContent = formatDuration(group.seconds);
    }
  });

  domains.forEach((item) => {
    const row = list.querySelector(`[data-domain="${CSS.escape(item.domain)}"]`);
    if (!row) return;

    const percentage = Math.round(((item.seconds || 0) / Math.max(1, totalSeconds)) * 100);
    row.querySelector(".time").textContent = formatDuration(item.seconds);
    row.querySelector(".domain-meta").textContent = `${percentage}%`;
    row.querySelector(".progress-fill").style.width = `${percentage}%`;
  });
}

function renderDomainList(domains, options = {}) {
  const list = document.getElementById("usage-list");
  const emptyTip = document.getElementById("empty-tip");
  const { animate = true, force = false } = options;
  const nextSignature = getDomainSignature(domains);

  emptyTip.hidden = domains.length > 0;
  if (!domains.length) {
    list.innerHTML = "";
    list.dataset.signature = "";
    return;
  }

  if (!force && list.dataset.signature === nextSignature) {
    updateDomainList(domains);
    return;
  }

  list.dataset.signature = nextSignature;

  const totalSeconds = domains.reduce((sum, item) => sum + (item.seconds || 0), 0);
  const groups = buildDomainGroups(domains);
  const fragment = document.createDocumentFragment();
  let rank = 1;

  groups.forEach((group, groupIndex) => {
    const groupLi = document.createElement("li");
    groupLi.className = "domain-group";
    groupLi.dataset.group = group.id;
    groupLi.style.setProperty("--category-color", group.color);
    groupLi.style.setProperty("--category-glow", `${group.color}44`);
    if (animate) {
      groupLi.style.animation = `li-in 200ms ease-out ${groupIndex * 60}ms both`;
    }

    const header = document.createElement("div");
    header.className = "domain-group-header";
    const title = document.createElement("div");
    title.className = "domain-group-title";
    const dot = document.createElement("span");
    dot.className = "category-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = group.label;
    const groupTime = document.createElement("span");
    groupTime.className = "domain-group-time";
    groupTime.textContent = formatDuration(group.seconds);

    title.appendChild(dot);
    title.appendChild(label);
    header.appendChild(title);
    header.appendChild(groupTime);

    const groupList = document.createElement("div");
    groupList.className = "domain-group-list";

    group.domains.forEach((item) => {
      const domainCard = document.createElement("div");
      domainCard.className = "domain-item";
      domainCard.dataset.domain = item.domain;
      const domainRow = document.createElement("div");
      domainRow.className = "domain-row";
      const domainLabel = document.createElement("div");
      domainLabel.className = "domain-label";

      const rankEl = document.createElement("span");
      rankEl.className = "rank-badge";
      rankEl.textContent = `#${rank}`;
      rank += 1;

      const domainEl = document.createElement("span");
      domainEl.className = "domain";
      domainEl.textContent = item.domain;

      const timeEl = document.createElement("span");
      timeEl.className = "time";
      timeEl.textContent = formatDuration(item.seconds);
      const categorySelect = document.createElement("select");
      categorySelect.className = "domain-category-select";
      categorySelect.setAttribute("aria-label", `調整 ${item.domain} 分類`);
      CATEGORY_DEFINITIONS.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.label;
        categorySelect.appendChild(option);
      });
      categorySelect.value = getDomainCategory(item.domain).id;
      categorySelect.addEventListener("change", async () => {
        await saveDomainCategoryOverride(item.domain, categorySelect.value);
        refreshCategoryOverrideView();
      });

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

      domainCard.appendChild(domainRow);
      domainCard.appendChild(meta);
      domainCard.appendChild(progressTrack);
      domainCard.appendChild(categorySelect);
      groupList.appendChild(domainCard);

      if (animate) {
        requestAnimationFrame(() => { progressFill.style.width = `${percentage}%`; });
      } else {
        progressFill.style.width = `${percentage}%`;
      }
    });

    groupLi.appendChild(header);
    groupLi.appendChild(groupList);
    fragment.appendChild(groupLi);
  });

  list.replaceChildren(fragment);
}

function refreshCategoryOverrideView() {
  if (!latestReport?.domains?.length) return;

  const previousScrollY = window.scrollY;
  const domains = [...latestReport.domains].sort((a, b) => b.seconds - a.seconds);
  renderCategoryList(buildCategorySummary(domains), {
    animate: false,
    force: true,
  });
  renderDomainList(domains, {
    animate: false,
    force: true,
  });
  window.scrollTo({ top: previousScrollY, behavior: "instant" });
}

async function getReportData(range) {
  if (range === "daily") {
    const daily = await getTodayUsage();
    return {
      range,
      title: getRangeTitle(range),
      date: daily.date,
      totalSeconds: daily.totalSeconds,
      avgSeconds: daily.totalSeconds,
      daysWithData: daily.totalSeconds > 0 ? 1 : 0,
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
    daysWithData: report.daysWithData,
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

async function renderReport(range, options = {}) {
  const { animate = true, forceList = false } = options;
  const rangeChanged = currentRange !== range;
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
    renderCategoryList(buildCategorySummary(domains), {
      animate,
      force: forceList || rangeChanged,
    });
    renderDomainList(domains, {
      animate,
      force: forceList || rangeChanged,
    });
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

async function getAiAnalysisData(range) {
  const selectedReport = await getReportData(range);
  const weekly = await getLastNDaysUsage(7);
  const periodDays = range === "monthly" ? 30 : range === "weekly" ? 7 : 1;
  const periodReport =
    range === "monthly"
      ? await getLastNDaysUsage(30)
      : range === "weekly"
        ? weekly
        : {
            days: [{
              date: selectedReport.date,
              totalSeconds: selectedReport.totalSeconds,
            }],
            daysWithData: selectedReport.daysWithData,
          };
  const yd = new Date(Date.now() - 86400000);
  const yesterdayKey = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
  const yesterdayEntry = weekly.days?.find(d => d.date === yesterdayKey);
  const yesterday = yesterdayEntry?.totalSeconds || 0;

  return {
    ...selectedReport,
    categories: buildCategorySummary(selectedReport.domains || []),
    history: {
      selectedRange: range,
      selectedPeriodDays: periodDays,
      selectedPeriodDaysWithData: periodReport.daysWithData || 0,
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

function getAiResultTitles(range) {
  if (range === "weekly") {
    return {
      summary: "近 7 天使用摘要",
      anomaly: "每週使用趨勢提醒",
      suggestion: "下週改善建議",
    };
  }
  if (range === "monthly") {
    return {
      summary: "近 30 天使用摘要",
      anomaly: "每月使用趨勢提醒",
      suggestion: "下月改善建議",
    };
  }
  return {
    summary: "今日使用摘要",
    anomaly: "使用時間提醒",
    suggestion: "明日改善建議",
  };
}

function renderAiAnalysis(analysis, range) {
  const titles = getAiResultTitles(range);
  document.getElementById("ai-summary-title").textContent = titles.summary;
  document.getElementById("ai-anomaly-title").textContent = titles.anomaly;
  document.getElementById("ai-suggestion-title").textContent = titles.suggestion;
  document.getElementById("ai-summary").textContent = analysis.todaySummary;
  document.getElementById("ai-anomaly").textContent = analysis.anomalyAlert;
  document.getElementById("ai-suggestion").textContent = analysis.tomorrowSuggestion;
  document.getElementById("ai-result").hidden = false;
}

async function handleGenerateAiAnalysis() {
  let settings = await handleSaveAiSettings();
  if (!settings) return;

  const generateBtn = document.getElementById("ai-generate");
  const analysisRange = currentRange;
  generateBtn.disabled = true;
  setAiStatus(TEXT.aiAnalyzing);

  try {
    const analysisData = await getAiAnalysisData(analysisRange);
    const analysis = await generateAiAnalysis(settings, analysisData);
    renderAiAnalysis(analysis, analysisRange);
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
  document.getElementById("category-title").textContent = TEXT.categoryTitle;
  document.getElementById("empty-tip").textContent = TEXT.noData;
}

function startAutoRefresh() {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(() => {
    renderReport(currentRange, { animate: false });
  }, REPORT_REFRESH_INTERVAL_MS);
}

async function initReport() {
  await loadDomainCategoryOverrides();
  localizeStaticText();
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      renderReport(btn.dataset.range, { animate: true, forceList: true });
    });
  });

  renderReport(currentRange, { animate: true, forceList: true });
  initAiControls();
  startAutoRefresh();
}

try {
  initReport().catch((error) => {
    const rangeEl = document.getElementById("report-range");
    if (rangeEl) rangeEl.textContent = TEXT.loadFailed;
    console.error("Report init failed", error);
  });
} catch (error) {
  const rangeEl = document.getElementById("report-range");
  if (rangeEl) rangeEl.textContent = TEXT.loadFailed;
  console.error("Report init failed", error);
}
