import { Configuration } from "../shared/config.js";
import { ChatModel } from "./types.js";
// Lazy-load universal to avoid importing providers unnecessarily in some paths

/** Provider routing helpers for model initialization. */

export type Provider = "openai" | "anthropic" | "google" | "fireworks" | "xai" | "together";

export function inferProvider(modelId: string): Provider {
  const id = modelId.toLowerCase();
  // Prioritize Fireworks for account-scoped and fireworks-qualified ids
  if (
    id.startsWith("fireworks:") ||
    id.includes("fireworks/") ||
    id.includes("accounts/fireworks/models") ||
    id.includes("kimi") ||
    id.includes("k2")
  ) return "fireworks";
  // Together AI
  if (
    id.startsWith("together:") ||
    id.includes("together.ai") ||
    id.includes("together.xyz")
  ) return "together";
  if (id.startsWith("openai:") || id.includes("gpt-")) return "openai";
  if (id.startsWith("anthropic:") || id.includes("claude")) return "anthropic";
  if (id.startsWith("google:") || id.includes("gemini")) return "google";
  if (id.startsWith("xai:") || id.includes("grok")) return "xai";
  return "openai";
}

export function getApiKey(modelId: string, cfg: Configuration): string | undefined {
  const provider = inferProvider(modelId);
  switch (provider) {
    case "openai":
      return cfg.openai_api_key ?? process.env?.["OPENAI_API_KEY"];
    case "anthropic":
      return cfg.anthropic_api_key ?? process.env?.["ANTHROPIC_API_KEY"];
    case "google":
      return cfg.google_api_key ?? process.env?.["GOOGLE_API_KEY"];
    case "xai":
      return cfg.xai_api_key ?? process.env?.["XAI_API_KEY"];
    case "fireworks":
      return cfg.fireworks_api_key ?? process.env?.["FIREWORKS_API_KEY"];
    case "together":
      return cfg.together_api_key ?? process.env?.["TOGETHER_API_KEY"];
    default:
      return undefined;
  }
}

export async function createModel(modelId: string, cfg: Configuration): Promise<ChatModel> {
  const provider = inferProvider(modelId);
  const apiKey = getApiKey(modelId, cfg);
  const baseUrlOverrides = cfg.base_url_overrides;
  const baseUrl = baseUrlOverrides
    ? provider === "openai"
      ? baseUrlOverrides.openai ?? undefined
      : provider === "anthropic"
        ? baseUrlOverrides.anthropic ?? undefined
        : provider === "google"
          ? baseUrlOverrides.google ?? undefined
          : provider === "fireworks"
            ? baseUrlOverrides.fireworks ?? undefined
            : provider === "xai"
              ? baseUrlOverrides.xai ?? undefined
              : provider === "together"
                ? baseUrlOverrides.together ?? undefined
              : undefined
    : undefined;
  const bareId = String(modelId || "").replace(/^(openai|anthropic|google|xai|fireworks|together):/i, "");

  if (provider === "anthropic" && cfg.anthropic_long_context_beta) {
    const { createAnthropicWithLongContext } = await import("./factory.js");
    const opts: any = { modelId: bareId };
    if (apiKey) opts.apiKey = apiKey;
    if (baseUrl) opts.baseUrl = baseUrl;
    return createAnthropicWithLongContext(opts);
  }

  if (provider === "xai") {
    try {
      const { createUniversalModel } = await import("./universal.js");
      return createUniversalModel(bareId, {
        modelProvider: "xai",
        apiKey,
        baseURL: baseUrl,
      } as any);
    } catch (_e) {
      const { createXAI } = await import("./factory.js");
      {
        const opts: any = { modelId: bareId };
        if (apiKey) opts.apiKey = apiKey;
        if (baseUrl) opts.baseUrl = baseUrl;
        return createXAI(opts);
      }
    }
  }
  if (provider === "fireworks") {
    const { createFireworks } = await import("./factory.js");
    const opts: any = { modelId: bareId };
    if (apiKey) opts.apiKey = apiKey;
    if (baseUrl) opts.baseUrl = baseUrl;
    return createFireworks(opts);
  }
  if (provider === "together") {
    const { createTogether } = await import("./factory.js");
    const opts: any = { modelId: bareId, baseUrl: baseUrl || "https://api.together.xyz/v1" };
    if (apiKey) opts.apiKey = apiKey;
    return createTogether(opts);
  }

  const { createUniversalModel } = await import("./universal.js");
  return createUniversalModel(bareId, {
    modelProvider: provider === "google" ? "google-genai" : provider,
    apiKey,
    baseURL: baseUrl,
  } as any);
}


