/* Manual script: fetch model lists from providers using API keys in .env */
import "dotenv/config";

type Provider = "openai" | "anthropic" | "xai" | "fireworks" | "google" | "together";

function env(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
}

async function fetchJson(url: string, init?: RequestInit) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function listOpenAI() {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return null;
  return fetchJson("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}


async function listFireworks() {
  const apiKey = env("FIREWORKS_API_KEY");
  if (!apiKey) return null;
  // Fireworks models list is under the inference API prefix
  return fetchJson("https://api.fireworks.ai/inference/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

async function listGoogle() {
  const apiKey = env("GOOGLE_API_KEY");
  if (!apiKey) return null;
  return fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
}

async function listXAI() {
  const apiKey = env("XAI_API_KEY");
  if (!apiKey) return null;
  // xAI is OpenAI-compatible; attempt standard models endpoint
  return fetchJson("https://api.x.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

async function listTogether() {
  const apiKey = env("TOGETHER_API_KEY");
  if (!apiKey) return null;
  return fetchJson("https://api.together.xyz/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

async function listAnthropic() {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  // Anthropic requires version header; models endpoint may be limited
  return fetchJson("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
}

async function main() {
  const results: Record<Provider, unknown> = {
    openai: null,
    anthropic: null,
    xai: null,
    fireworks: null,
    google: null,
    together: null,
  };
  for (const [name, fn] of [
    ["openai", listOpenAI],
    ["anthropic", listAnthropic],
    ["xai", listXAI],
    ["fireworks", listFireworks],
    ["google", listGoogle],
    ["together", listTogether],
  ] as const) {
    try {
      // @ts-ignore
      results[name] = await fn();
    } catch (e) {
      // @ts-ignore
      results[name] = { error: String((e as Error).message || e) };
    }
  }

  const out = JSON.stringify(results, null, 2);
  console.log(out);
}

void main();


