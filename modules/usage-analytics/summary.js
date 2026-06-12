import { getUsageStore, toDateKey } from "./storage.js";

function getDateKeys(days = 7, endTimestamp = Date.now()) {
  const keys = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const ts = endTimestamp - i * 24 * 60 * 60 * 1000;
    keys.push(toDateKey(ts));
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
  return {
    date: todayKey,
    totalSeconds: dayRecord.totalSeconds || 0,
    domains: sortDomainEntries(Object.entries(dayRecord.domains || {})).map(
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
    totals.push({
      date: dateKey,
      totalSeconds: dayRecord.totalSeconds || 0,
    });

    Object.entries(dayRecord.domains || {}).forEach(([domain, seconds]) => {
      domainTotals[domain] = (domainTotals[domain] || 0) + seconds;
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
