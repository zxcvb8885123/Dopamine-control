const TIMER_ID = "dd-timer";
const REPORT_INTERVAL_SECONDS = 30;

let timerEl = null;
let intervalId = null;
let elapsedSeconds = 0;
let pendingReportSeconds = 0;
let lastTickAt = 0;

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
    "background: rgba(0, 0, 0, 0.72)",
    "color: #fff",
    "font-size: 12px",
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
  el.textContent = `TIME ${formatDuration(elapsedSeconds)}`;
}

function reportUsage(seconds) {
  if (!seconds) return;
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

  chrome.runtime.sendMessage({
    type: "CHECK_LIMIT",
    domain: normalizeDomain(location.hostname),
    seconds,
  });
}

function onTick() {
  const now = Date.now();
  const deltaSeconds = Math.max(1, Math.floor((now - lastTickAt) / 1000));
  lastTickAt = now;

  elapsedSeconds += deltaSeconds;
  pendingReportSeconds += deltaSeconds;
  updateTimerText();

  while (pendingReportSeconds >= REPORT_INTERVAL_SECONDS) {
    reportUsage(REPORT_INTERVAL_SECONDS);
    pendingReportSeconds -= REPORT_INTERVAL_SECONDS;
  }
}

export function startTimer() {
  if (intervalId) return;

  lastTickAt = Date.now();
  elapsedSeconds = 0;
  pendingReportSeconds = 0;

  updateTimerText();
  intervalId = setInterval(onTick, 1000);
}
