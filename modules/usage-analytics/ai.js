const AI_SETTINGS_KEY = "aiSettings";

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  endpoint: "",
};

const PROVIDER_DEFAULTS = {
  openai: {
    model: "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  gemini: {
    model: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
  },
  custom: {
    model: "",
    endpoint: "",
  },
};

function withChromeStorage(task) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      reject(new Error("chrome.storage.local is unavailable"));
      return;
    }
    task(resolve, reject);
  });
}

function normalizeSettings(rawValue) {
  const provider = ["openai", "gemini", "custom"].includes(rawValue?.provider)
    ? rawValue.provider
    : DEFAULT_AI_SETTINGS.provider;
  const defaults = PROVIDER_DEFAULTS[provider];

  return {
    ...DEFAULT_AI_SETTINGS,
    enabled: Boolean(rawValue?.enabled),
    provider,
    apiKey: String(rawValue?.apiKey || ""),
    model: provider === "custom" ? String(rawValue?.model || "") : defaults.model,
    endpoint: String(rawValue?.endpoint || defaults.endpoint),
  };
}

export async function getAiSettings() {
  const payload = await withChromeStorage((resolve, reject) => {
    chrome.storage.local.get([AI_SETTINGS_KEY], (result) => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
  return normalizeSettings(payload[AI_SETTINGS_KEY]);
}

export async function saveAiSettings(settings) {
  const normalized = normalizeSettings(settings);
  await withChromeStorage((resolve, reject) => {
    chrome.storage.local.set({ [AI_SETTINGS_KEY]: normalized }, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
  return normalized;
}

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}\u5c0f\u6642 ${minutes}\u5206\u9418`;
  return `${minutes}\u5206\u9418`;
}

function buildUsageSnapshot(report) {
  const domains = [...(report.domains || [])]
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 10)
    .map((item) => ({
      domain: item.domain,
      seconds: Math.max(0, Math.floor(Number(item.seconds) || 0)),
      duration: formatDuration(item.seconds),
    }));

  return {
    range: report.range || null,
    rangeTitle: report.title,
    totalSeconds: Math.max(0, Math.floor(Number(report.totalSeconds) || 0)),
    totalDuration: formatDuration(report.totalSeconds),
    avgSeconds: Math.max(0, Math.floor(Number(report.avgSeconds) || 0)),
    avgDuration: formatDuration(report.avgSeconds),
    domains,
    history: report.history || null,
  };
}

function buildPrompt(report) {
  const snapshot = buildUsageSnapshot(report);
  return [
    "You are the usage-analysis assistant for the Dopamine-control Chrome extension.",
    "Analyze usageAnalytics data and respond in Traditional Chinese.",
    "Analyze the selected report range, not only today. rangeTitle tells whether the selected range is today, last 7 days, or last 30 days.",
    "Give short, concrete, actionable observations. Avoid subjective risk labels or moral judgment.",
    "For today, compare with yesterday and the last-7-days average when available.",
    "For last 7 days or last 30 days, summarize the selected period, daily pattern, and highest-time domains.",
    "Return JSON only. Do not return Markdown or extra text.",
    "Required JSON keys: usageSummary, anomalyAlert, tomorrowSuggestion.",
    `Data: ${JSON.stringify(snapshot)}`,
  ].join("\n");
}

function parseJsonObject(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeAnalysis(text) {
  const parsed = parseJsonObject(text);
  if (!parsed) {
    return {
      todaySummary: text || "\u672a\u6536\u5230\u53ef\u8b80\u53d6\u7684 AI \u5206\u6790\u5167\u5bb9\u3002",
      anomalyAlert: "\u8acb\u7a0d\u5f8c\u91cd\u65b0\u7522\u751f\u5206\u6790\u3002",
      tomorrowSuggestion: "\u5148\u8a2d\u5b9a\u4e00\u500b\u660e\u78ba\u7684\u4f7f\u7528\u4e0a\u9650\uff0c\u518d\u89c0\u5bdf\u660e\u65e5\u8b8a\u5316\u3002",
    };
  }

  return {
    todaySummary: String(
      parsed.usageSummary ||
      parsed.todaySummary ||
      "\u4f7f\u7528\u8cc7\u6599\u4e0d\u8db3\uff0c\u66ab\u6642\u7121\u6cd5\u5f62\u6210\u5b8c\u6574\u6458\u8981\u3002"
    ),
    anomalyAlert: String(parsed.anomalyAlert || "\u76ee\u524d\u6c92\u6709\u660e\u986f\u7570\u5e38\u3002"),
    tomorrowSuggestion: String(
      parsed.tomorrowSuggestion || "\u660e\u65e5\u5148\u5f9e\u964d\u4f4e\u6700\u9ad8\u4f7f\u7528\u7db2\u7ad9\u7684\u6642\u9593\u958b\u59cb\u3002"
    ),
  };
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `API request failed (${response.status})`;
    throw new Error(String(message));
  }
  return payload;
}

async function callOpenAi(settings, prompt) {
  const payload = await postJson(
    PROVIDER_DEFAULTS.openai.endpoint,
    { Authorization: `Bearer ${settings.apiKey}` },
    {
      model: settings.model || PROVIDER_DEFAULTS.openai.model,
      messages: [
        { role: "system", content: "Return concise Traditional Chinese JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }
  );

  return payload?.choices?.[0]?.message?.content || "";
}

async function callGemini(settings, prompt) {
  const model = encodeURIComponent(settings.model || PROVIDER_DEFAULTS.gemini.model);
  const base = PROVIDER_DEFAULTS.gemini.endpoint;
  const url = `${base}/${model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  const payload = await postJson(
    url,
    {},
    {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }
  );

  return payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

async function callCustom(settings, prompt) {
  const body = {
    messages: [
      { role: "system", content: "Return concise Traditional Chinese JSON only." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  };
  if (settings.model) {
    body.model = settings.model;
  }

  const payload = await postJson(settings.endpoint, { Authorization: `Bearer ${settings.apiKey}` }, body);

  return (
    payload?.choices?.[0]?.message?.content ||
    payload?.output_text ||
    payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") ||
    ""
  );
}

export async function generateAiAnalysis(settings, report) {
  const normalized = normalizeSettings(settings);
  if (!normalized.enabled) {
    throw new Error("\u8acb\u5148\u555f\u7528 AI \u5206\u6790\u529f\u80fd\u3002");
  }
  if (!normalized.apiKey.trim()) {
    throw new Error("\u8acb\u5148\u8f38\u5165 API Key \u5f8c\u518d\u4f7f\u7528 AI \u5206\u6790\u529f\u80fd\u3002");
  }
  if (normalized.provider === "custom" && !normalized.endpoint.trim()) {
    throw new Error("\u8acb\u5148\u8f38\u5165 Custom API Endpoint\u3002");
  }

  const prompt = buildPrompt(report);
  const text =
    normalized.provider === "gemini"
      ? await callGemini(normalized, prompt)
      : normalized.provider === "custom"
        ? await callCustom(normalized, prompt)
        : await callOpenAi(normalized, prompt);

  return normalizeAnalysis(text);
}

export { AI_SETTINGS_KEY, DEFAULT_AI_SETTINGS, PROVIDER_DEFAULTS };
