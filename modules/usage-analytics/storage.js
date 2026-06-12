const STORAGE_KEY = "usageAnalytics";
const SCHEMA_VERSION = 1;

function normalizeDomain(hostname = "") {
  return hostname.replace(/^www\./, "");
}

function toDateKey(timestamp = Date.now()) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyStore() {
  return {
    version: SCHEMA_VERSION,
    updatedAt: Date.now(),
    days: {},
  };
}

function sanitizeStore(rawValue) {
  if (!rawValue || typeof rawValue !== "object") return createEmptyStore();
  if (!rawValue.days || typeof rawValue.days !== "object") {
    return createEmptyStore();
  }

  return {
    version: Number(rawValue.version) || SCHEMA_VERSION,
    updatedAt: Number(rawValue.updatedAt) || Date.now(),
    days: rawValue.days,
  };
}

function withChromeStorage(task) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      reject(new Error("chrome.storage.local is unavailable"));
      return;
    }
    task(resolve, reject);
  });
}

export async function getUsageStore() {
  const payload = await withChromeStorage((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
  return sanitizeStore(payload[STORAGE_KEY]);
}

export async function saveUsageStore(store) {
  const normalized = sanitizeStore(store);
  normalized.updatedAt = Date.now();
  await withChromeStorage((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: normalized }, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

export async function recordUsageChunk({ domain, seconds, timestamp = Date.now() }) {
  const safeDomain = normalizeDomain(domain);
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  if (!safeDomain || !safeSeconds) return;

  const store = await getUsageStore();
  const dateKey = toDateKey(timestamp);
  const dayRecord = store.days[dateKey] || { totalSeconds: 0, domains: {} };

  dayRecord.totalSeconds += safeSeconds;
  dayRecord.domains[safeDomain] = (dayRecord.domains[safeDomain] || 0) + safeSeconds;
  store.days[dateKey] = dayRecord;

  await saveUsageStore(store);
}

export function formatSeconds(totalSeconds = 0) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export { STORAGE_KEY, toDateKey, normalizeDomain };
