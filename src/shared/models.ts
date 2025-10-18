/** Token window classes to normalize limits across providers. */
export type ModelClass = "4K" | "32K" | "128K" | "200K" | "256K" | "400K" | "1M" | "2M" | "10M";

const MODEL_CLASS_TO_LIMIT: Record<ModelClass, number> = {
  "4K": 4096,
  "32K": 32768,
  "128K": 131072,
  "200K": 200000,
  "256K": 262144,
  "400K": 400000,
  "1M": 1000000,
  "2M": 2000000,
  "10M": 10000000,
};

let MODEL_TOKEN_OVERRIDES: Record<string, number> = {};

/** Allow dynamic per-model token limit overrides at runtime (env/file). */
export function setModelTokenOverrides(overrides: Record<string, number>) {
  MODEL_TOKEN_OVERRIDES = Object.fromEntries(
    Object.entries(overrides).map(([k, v]) => [k.toLowerCase(), v])
  );
}

export interface ResolveOptions {
  anthropicLongContextBeta?: boolean;
}

function tokensToClass(tokens: number): ModelClass {
  if (tokens >= MODEL_CLASS_TO_LIMIT["10M"]) return "10M";
  if (tokens >= MODEL_CLASS_TO_LIMIT["2M"]) return "2M";
  if (tokens >= MODEL_CLASS_TO_LIMIT["1M"]) return "1M";
  if (tokens >= MODEL_CLASS_TO_LIMIT["400K"]) return "400K";
  if (tokens >= MODEL_CLASS_TO_LIMIT["256K"]) return "256K";
  if (tokens >= MODEL_CLASS_TO_LIMIT["200K"]) return "200K";
  if (tokens >= MODEL_CLASS_TO_LIMIT["128K"]) return "128K";
  if (tokens >= MODEL_CLASS_TO_LIMIT["32K"]) return "32K";
  return "4K";
}

/** Heuristic mapping from model id → normalized token class, with optional flags. */
export function resolveModelClass(modelId: string, options?: ResolveOptions): ModelClass {
  const id = modelId.toLowerCase();

  // Overrides take precedence if exact model id is provided
  const override = MODEL_TOKEN_OVERRIDES[id];
  if (typeof override === "number" && override > 0) {
    return tokensToClass(override);
  }

  // OpenAI
  if (id.startsWith("openai:")) {
    if (id.includes("gpt-5-mini")) return "200K";
    if (id.includes("gpt-5-nano")) return "128K";
    if (id.includes("gpt-5")) return "400K";
    if (id.includes("gpt-4.1")) return "1M";
    if (id.includes("o3")) return "200K";
    if (id.includes("o1")) return "200K";
    if (id.includes("gpt-4o")) return "128K";
    return "128K";
  }

  // Anthropic (Claude)
  if (id.startsWith("anthropic:") || id.includes("claude")) {
    if (id.includes("opus-4.1") || id.includes("opus-4-1")) return "1M";
    if (id.includes("sonnet-4")) {
      return options?.anthropicLongContextBeta ? "1M" : "200K";
    }
    if (id.includes("opus-4") || id.includes("3-5") || id.includes("3-")) return "200K";
    return "200K";
  }

  // Google (Gemini)
  if (id.startsWith("google") || id.includes("gemini")) {
    if (id.includes("2.0-pro-experimental")) return "2M";
    if (id.includes("2.5") || id.includes("2.0")) return "1M";
    if (id.includes("1.5-pro")) return "2M";
    if (id.includes("1.5")) return "1M";
    return "1M";
  }

  // xAI / Grok
  if (id.startsWith("xai:") || id.includes("grok")) {
    if (id.includes("grok-4-0709") || id.includes("grok-code-fast-1")) return "256K";
    return "256K";
  }

  // Fireworks (explicit model id mappings using fully-qualified ids)
  if (id.startsWith("fireworks:") || id.includes("accounts/fireworks/models/")) {
    if (id.includes("llama4-maverick-instruct-basic") || id.includes("llama4-scout-instruct-basic")) return "1M";
    if (id.includes("deepseek-v3p1") || id.includes("deepseek-v3-0324")) return "200K"; // 163,840
    if (id.includes("deepseek-v3")) return "128K"; // 131,072
    if (id.includes("deepseek-r1")) return "200K"; // 163,840
    if (id.includes("qwen3-235b-a22b-thinking-2507") || id.includes("qwen3-235b-a22b-instruct-2507")) return "256K";
    if (id.includes("qwen3-235b-a22b")) return "128K";
    if (id.includes("qwen3-30b-a3b-instruct-2507") || id.includes("qwen3-coder-30b-a3b-instruct")) return "256K";
    if (id.includes("qwen3-30b-a3b-thinking-2507")) return "256K";
    if (id.includes("qwen3-coder-480b-a35b-instruct")) return "256K";
    if (id.includes("qwen3-embedding-8b")) return "32K"; // 40,960
    if (id.includes("qwen2p5-vl-32b-instruct")) return "128K";
    if (id.includes("glm-4p5-air") || id.includes("glm-4p5")) return "128K";
    if (id.includes("gpt-oss-120b") || id.includes("gpt-oss-20b")) return "128K";
    if (id.includes("kimi-k2-instruct-0905")) return "256K";
    if (id.includes("kimi-k2-instruct")) return "128K";
    if (id.includes("mixtral-8x22b-instruct")) return "32K";
    if (id.includes("llama-v3p1-405b-instruct") || id.includes("llama-v3p1-70b-instruct") || id.includes("llama-v3p1-8b-instruct") || id.includes("llama-v3p3-70b-instruct")) return "128K";
    return "256K";
  }

  // Kimi / Moonshot
  if (id.includes("kimi") || id.includes("k2") || id.includes("moonshot")) return "256K";

  // Qwen
  if (id.startsWith("qwen:") || id.includes("qwen3")) {
    if (id.includes("30b") || id.includes("a3b") || id.includes("2507")) return "256K";
    if (id.includes("8b")) return "128K";
    return "256K";
  }

  // xAI / Grok
  if (id.startsWith("xai:") || id.includes("grok")) return "256K";

  // Cohere
  if (id.startsWith("cohere:")) return "128K";

  return "128K";
}

/** Return numeric token limit for a given model id using class resolution. */
export function getModelTokenLimit(modelId: string, options?: ResolveOptions): number {
  const id = modelId.toLowerCase();
  const override = MODEL_TOKEN_OVERRIDES[id];
  if (typeof override === "number" && override > 0) return override;
  const klass = resolveModelClass(modelId, options);
  return MODEL_CLASS_TO_LIMIT[klass];
}

function parseOverridesJson(json: string): Record<string, number> | null {
  try {
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object") {
      const mapped: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj)) {
        const num = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(num)) continue;
        mapped[k.toLowerCase()] = num;
      }
      return mapped;
    }
  } catch (_e) {
    void 0;
  }
  return null;
}

/** Load token overrides from env variables or JSON file path if present. */
export function loadModelOverridesFromEnv(): void {
  const json = typeof process !== "undefined" ? process.env?.["MODEL_TOKEN_OVERRIDES"] : undefined;
  if (json) {
    const parsed = parseOverridesJson(json);
    if (parsed) {
      setModelTokenOverrides(parsed);
      return;
    }
  }
  const path = typeof process !== "undefined" ? process.env?.["MODEL_TOKEN_OVERRIDES_PATH"] : undefined;
  if (path) {
    try {
      // Lazy require to avoid bundling fs in environments that don't need it
      const fs = require("fs") as typeof import("fs");
      if (fs.existsSync(path)) {
        const contents = fs.readFileSync(path, "utf8");
        const parsed = parseOverridesJson(contents);
        if (parsed) setModelTokenOverrides(parsed);
      }
    } catch (_e) {
      void 0;
    }
  }
}

// Auto-load on module import (no-ops if env not set)
loadModelOverridesFromEnv();
