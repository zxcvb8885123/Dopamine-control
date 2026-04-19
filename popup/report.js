import { getTodayUsage } from "../modules/usage-analytics/summary.js";

function formatToMinutes(seconds) {
  const mins = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  return `${mins} min`;
}

function renderEmptyState() {
  const list = document.getElementById("usage-list");
  const emptyTip = document.getElementById("empty-tip");
  const topDomain = document.getElementById("top-domain");

  list.innerHTML = "";
  emptyTip.hidden = false;
  topDomain.textContent = "Top 1: --";
}

function renderTopDomain(domains) {
  const topDomain = document.getElementById("top-domain");
  if (!domains.length) {
    topDomain.textContent = "Top 1: --";
    return;
  }

  const first = domains[0];
  topDomain.textContent = `Top 1: ${first.domain} (${formatToMinutes(first.seconds)})`;
}

function renderDomainList(domains) {
  const list = document.getElementById("usage-list");
  const emptyTip = document.getElementById("empty-tip");

  list.innerHTML = "";
  emptyTip.hidden = domains.length > 0;

  domains.forEach((item) => {
    const li = document.createElement("li");

    const domainEl = document.createElement("span");
    domainEl.className = "domain";
    domainEl.textContent = `${item.domain}:`;

    const timeEl = document.createElement("span");
    timeEl.className = "time";
    timeEl.textContent = formatToMinutes(item.seconds);

    li.appendChild(domainEl);
    li.appendChild(timeEl);
    list.appendChild(li);
  });
}

async function initReport() {
  const dateEl = document.getElementById("today-date");

  try {
    const today = await getTodayUsage();
    dateEl.textContent = today.date;

    const domains = [...(today.domains || [])].sort((a, b) => b.seconds - a.seconds);
    if (!domains.length) {
      renderEmptyState();
      return;
    }

    renderTopDomain(domains);
    renderDomainList(domains);
  } catch (error) {
    dateEl.textContent = "Load failed";
    renderEmptyState();
  }
}

initReport();
