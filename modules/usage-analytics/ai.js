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
  if (hours > 0) return `${hours} 小時 ${minutes} 分鐘`;
  return `${minutes} 分鐘`;
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
    "你是 Dopamine-control Chrome Extension 的使用行為分析助手。",
    "請根據 usageAnalytics 的網站使用時間資料，用繁體中文給出簡短、具體、可執行的建議。",
    "history 若存在，請用近 7 天平均與昨日資料判斷今日是否異常。",
    "請只輸出 JSON，不要 Markdown，不要額外說明。",
    "JSON 欄位必須包含：todaySummary、distractionRisk、anomalyAlert、tomorrowSuggestion。",
    "distractionRisk 請使用「低風險」、「中風險」或「高風險」開頭。",
    `資料：${JSON.stringify(snapshot)}`,
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
      todaySummary: text || "AI 沒有回傳可讀取的分析內容。",
      distractionRisk: "無法判定",
      anomalyAlert: "請稍後重新產生分析。",
      tomorrowSuggestion: "先設定一個明確的使用上限，再觀察明日變化。",
    };
  }

  return {
    todaySummary: String(parsed.todaySummary || "今日使用資料不足，暫時無法形成完整摘要。"),
    distractionRisk: String(parsed.distractionRisk || "無法判定"),
    anomalyAlert: String(parsed.anomalyAlert || "目前沒有明顯異常。"),
    tomorrowSuggestion: String(parsed.tomorrowSuggestion || "明日先從降低最高使用網站的時間開始。"),
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
        { role: "system", content: "你會輸出簡潔、有效的繁體中文 JSON 分析。" },
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
      { role: "system", content: "你會輸出簡潔、有效的繁體中文 JSON 分析。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
  };
  if (settings.model) {
    body.model = settings.model;
  }

  const payload = await postJson(
    settings.endpoint,
    { Authorization: `Bearer ${settings.apiKey}` },
    body
  );

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
    throw new Error("請先啟用 AI 分析功能。");
  }
  if (!normalized.apiKey.trim()) {
    throw new Error("請先輸入 API Key 後再使用 AI 分析功能。");
  }
  if (normalized.provider === "custom" && !normalized.endpoint.trim()) {
    throw new Error("請先輸入 Custom API Endpoint。");
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
