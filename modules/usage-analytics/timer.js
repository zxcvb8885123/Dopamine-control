import { recordUsageChunk } from "./storage.js";

const TIMER_ID = "dd-timer";
const DEFAULT_REPORT_INTERVAL_SECONDS = 30;

let timerEl = null;
let intervalId = null;
let elapsedSeconds = 0;
let pendingReportSeconds = 0;
let lastTickAt = 0;
let reportIntervalSeconds = DEFAULT_REPORT_INTERVAL_SECONDS;
let timerEnabled = false;

function normalizeDomain(hostname = "") {
  return hostname.replace(/^www\./, "");
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function ensureTimerElement() {
  if (timerEl && document.body.contains(timerEl)) return timerEl;

  timerEl = document.getElementById(TIMER_ID);
  if (timerEl) return timerEl;

  timerEl = document.createElement("div");
  timerEl.id = TIMER_ID;
  timerEl.style.cssText = [
    "position: fixed",
    "bottom: 16px",
    "right: 16px",
    "background: rgba(0, 0, 0, 0.5)",
    "backdrop-filter: blur(4px)",
    "color: #fff",
    "font-size: 11px",
    "padding: 6px 10px",
    "border-radius: 12px",
    "z-index: 99999",
    "font-family: monospace",
    "pointer-events: none",
  ].join(";");
  document.body.appendChild(timerEl);

  return timerEl;
}

function updateTimerText() {
  const el = ensureTimerElement();
  const domain = normalizeDomain(location.hostname);
  el.textContent = `${domain}  ${formatDuration(elapsedSeconds)}`;
}

function reportUsage(seconds) {
  if (!seconds) return;

  const domain = normalizeDomain(location.hostname);
  recordUsageChunk({ domain, seconds }).catch(() => {});

  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

  chrome.runtime.sendMessage({ type: "CHECK_LIMIT", domain, seconds }, () => {
    if (chrome.runtime.lastError) {
      // Ignore if background receiver is not ready; local storage already persisted.
    }
  });
}

function onTick() {
  if (!timerEnabled) return;
  if (document.visibilityState === "hidden") {
    lastTickAt = Date.now();
    return;
  }

  const now = Date.now();
  const deltaSeconds = Math.max(1, Math.floor((now - lastTickAt) / 1000));
  lastTickAt = now;

  elapsedSeconds += deltaSeconds;
  pendingReportSeconds += deltaSeconds;
  updateTimerText();

  while (pendingReportSeconds >= reportIntervalSeconds) {
    reportUsage(reportIntervalSeconds);
    pendingReportSeconds -= reportIntervalSeconds;
  }
}

function flushRemainingUsage() {
  if (!pendingReportSeconds) return;
  reportUsage(pendingReportSeconds);
  pendingReportSeconds = 0;
}

function onPageHide() {
  flushRemainingUsage();
}

export function startTimer(options = {}) {
  if (intervalId) return;

  reportIntervalSeconds =
    Number.isInteger(options.reportIntervalSeconds) && options.reportIntervalSeconds > 0
      ? options.reportIntervalSeconds
      : DEFAULT_REPORT_INTERVAL_SECONDS;

  lastTickAt = Date.now();
  elapsedSeconds = 0;
  pendingReportSeconds = 0;
  timerEnabled = true;

  updateTimerText();
  intervalId = setInterval(onTick, 1000);
  window.addEventListener("pagehide", onPageHide);
}

export function stopTimer() {
  if (!intervalId) return;

  clearInterval(intervalId);
  intervalId = null;
  timerEnabled = false;
  flushRemainingUsage();
  window.removeEventListener("pagehide", onPageHide);
}
