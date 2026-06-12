import { getUsageStore, toDateKey } from "./storage.js";

function getDateKeys(days = 7, endTimestamp = Date.now()) {
  const keys = [];
  const endDate = new Date(endTimestamp);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - i);
    keys.push(toDateKey(date.getTime()));
  }
  return keys;
}

function sortDomainEntries(entries) {
  return [...entries].sort((a, b) => b[1] - a[1]);
}

export async function getTodayUsage() {
  const store = await getUsageStore();
  const todayKey = toDateKey();
  const dayRecord = store.days[todayKey] || { totalSeconds: 0, domains: {} };
  const totalSeconds = Math.max(0, Number(dayRecord.totalSeconds) || 0);
  return {
    date: todayKey,
    totalSeconds,
    domains: sortDomainEntries(Object.entries(dayRecord.domains || {}).map(
      ([domain, seconds]) => [domain, Math.max(0, Number(seconds) || 0)]
    )).map(
      ([domain, seconds]) => ({ domain, seconds })
    ),
  };
}

export async function getLastNDaysUsage(days = 7) {
  const store = await getUsageStore();
  const dateKeys = getDateKeys(days);
  const totals = [];
  const domainTotals = {};

  dateKeys.forEach((dateKey) => {
    const dayRecord = store.days[dateKey] || { totalSeconds: 0, domains: {} };
    const dayTotalSeconds = Math.max(0, Number(dayRecord.totalSeconds) || 0);
    totals.push({
      date: dateKey,
      totalSeconds: dayTotalSeconds,
    });

    Object.entries(dayRecord.domains || {}).forEach(([domain, seconds]) => {
      domainTotals[domain] =
        (domainTotals[domain] || 0) + Math.max(0, Number(seconds) || 0);
    });
  });

  const totalSeconds = totals.reduce((acc, item) => acc + item.totalSeconds, 0);

  const daysWithData = totals.filter(d => d.totalSeconds > 0).length;

  return {
    days: totals,
    totalSeconds,
    daysWithData,
    avgSecondsPerDay: Math.floor(totalSeconds / Math.max(1, daysWithData)),
    topDomains: sortDomainEntries(Object.entries(domainTotals)).map(([domain, seconds]) => ({
      domain,
      seconds,
    })),
  };
}
