import { z } from "zod";

/**
 * Configuration schema and helpers.
 * - Mirrors Python Configuration while leveraging Zod for runtime validation
 * - Merges environment variables (env-first) with optional runtime overrides
 */

export const SearchAPI = z.enum(["anthropic", "openai", "tavily", "duckduckgo", "exa", "none"]);

export const ConfigurationSchema = z.object({
  max_structured_output_retries: z.number().int().min(1).max(10).default(3),
  allow_clarification: z.boolean().default(true),
  max_concurrent_research_units: z.number().int().min(1).max(20).default(5),

  search_api: SearchAPI.default("tavily"),
  max_researcher_iterations: z.number().int().min(1).max(10).default(6),
  max_react_tool_calls: z.number().int().min(1).max(30).default(10),
  // Limit number of prior tool messages provided back to the model per turn
  max_tool_messages: z.number().int().min(1).max(500).default(64),

  // Prefer provider-native search tools (OpenAI/Anthropic) when available
  prefer_native_search: z.boolean().default(true),

  // Dedicated supervisor model (planner/orchestrator)
  supervisor_model: z.string().default("openai:gpt-5"),
  supervisor_model_max_tokens: z.number().int().default(10000),

  summarization_model: z.string().default("openai:gpt-5-mini"),
  summarization_model_max_tokens: z.number().int().default(8192),
  max_content_length: z.number().int().min(1000).max(200000).default(50000),
  research_model: z.string().default("openai:gpt-5"),
  research_model_max_tokens: z.number().int().default(10000),
  compression_model: z.string().default("openai:gpt-5-mini"),
  compression_model_max_tokens: z.number().int().default(8192),
  final_report_model: z.string().default("openai:gpt-5"),
  final_report_model_max_tokens: z.number().int().default(10000),

  anthropic_long_context_beta: z.boolean().default(false),

  // Optional webpage summarization controls (provider must return raw content)
  summarization_enabled: z.boolean().default(true),
  summarization_max_items: z.number().int().min(1).max(10).default(3),
  summarization_timeout_ms: z.number().int().min(1000).max(300000).default(60000),

  // Provider API keys (optional; may also be sourced from env)
  openai_api_key: z.string().optional().nullable().default(null),
  anthropic_api_key: z.string().optional().nullable().default(null),
  google_api_key: z.string().optional().nullable().default(null),
  fireworks_api_key: z.string().optional().nullable().default(null),
  xai_api_key: z.string().optional().nullable().default(null),
  together_api_key: z.string().optional().nullable().default(null),

  // Optional base URL overrides per provider
  base_url_overrides: z
    .object({
      openai: z.string().url().optional().nullable().default(null),
      anthropic: z.string().url().optional().nullable().default(null),
      google: z.string().url().optional().nullable().default(null),
      fireworks: z.string().url().optional().nullable().default(null),
      xai: z.string().url().optional().nullable().default(null),
      together: z.string().url().optional().nullable().default(null),
    })
    .optional()
    .nullable()
    .default(null),

  mcp_config: z
    .object({
      url: z.string().url().optional().nullable().default(null),
      tools: z.array(z.string()).optional().nullable().default(null),
      auth_required: z.boolean().optional().nullable().default(false),
    })
    .optional()
    .nullable()
    .default(null),
  mcp_prompt: z.string().optional().nullable().default(null),
});

export type Configuration = z.infer<typeof ConfigurationSchema>;

function envGet(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
}

export function parseBooleanEnvValue(raw: string | undefined): boolean | undefined {
  if (!raw || !/^(true|false)$/i.test(raw)) return undefined;
  return raw.toLowerCase() === "true";
}

export function applyTracingDefaults(): void {
  if (typeof process === "undefined" || !process.env) return;
  const env = process.env as Record<string, string | undefined>;
  if (env["LANGCHAIN_TRACING_V2"] == null) env["LANGCHAIN_TRACING_V2"] = "false";
  if (env["LANGCHAIN_TRACING"] == null) env["LANGCHAIN_TRACING"] = "false";
  if (env["LANGSMITH_TRACING"] == null) env["LANGSMITH_TRACING"] = "false";
}

export function disableTracing(): void {
  applyTracingDefaults();
  if (typeof process === "undefined" || !process.env) return;
  const env = process.env as Record<string, string | undefined>;
  delete env["LANGCHAIN_API_KEY"];
  delete env["LANGCHAIN_PROJECT"];
  delete env["LANGCHAIN_ENDPOINT"];
  delete env["LANGSMITH_API_KEY"];
  delete env["LANGSMITH_ENDPOINT"];
}

export function fromRuntimeConfig(
  runtime?: Partial<Configuration>
): Configuration {
  applyTracingDefaults();
  const envOverrides: Partial<Configuration> = {};
  const keys = Object.keys(ConfigurationSchema.shape) as (keyof Configuration)[];
  for (const key of keys) {
    const envKey = String(key).toUpperCase();
    const raw = envGet(envKey);
    if (raw == null) continue;
    try {
      const parsedBool = parseBooleanEnvValue(raw);
      if (parsedBool !== undefined) {
        (envOverrides as any)[key] = parsedBool;
      } else if (/^\d+$/.test(raw)) {
        (envOverrides as any)[key] = Number(raw);
      } else if (raw.startsWith("{") || raw.startsWith("[")) {
        (envOverrides as any)[key] = JSON.parse(raw);
      } else {
        (envOverrides as any)[key] = raw;
      }
    } catch {
      // ignore invalid env values
    }
  }
  // Ensure environment variables take precedence over runtime when both are provided
  const envFirst = { ...runtime, ...envOverrides } as Configuration;
  return ConfigurationSchema.parse(envFirst);
}
