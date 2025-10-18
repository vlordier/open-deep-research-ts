import type { Configuration } from "../shared/config";
import type { SearchResults } from "./types";
import { loadPrompt } from "../prompts/loader.js";
import { createModel } from "../providers/router.js";
import { buildTavilySearchTool } from "../tools/web_search.js";

export type SearchProvider = "tavily" | "openai" | "anthropic" | "duckduckgo" | "exa" | "none";

export function getSearchProvider(cfg: Configuration): SearchProvider {
  return (cfg.search_api as unknown as SearchProvider) ?? "none";
}

export type SearchTool = (query: string) => Promise<SearchResults>;

export function buildSearchTool(cfg: Configuration): SearchTool {
  const provider = getSearchProvider(cfg);
  switch (provider) {
    case "tavily": {
      const includeRaw = Boolean(cfg.summarization_enabled);
      const summarization = includeRaw
        ? {
            enabled: true,
            getModel: async () => createModel(cfg.summarization_model, cfg),
            promptLoader: async (name: string, vars: Record<string, unknown>) =>
              loadPrompt(name, vars as Record<string, string | number>),
            maxItems: cfg.summarization_max_items,
            timeoutMs: cfg.summarization_timeout_ms,
            maxContentLength: cfg.max_content_length,
            logger: console,
          }
        : undefined;

      return buildTavilySearchTool({
        maxResults: Number((cfg as any).search_max_results ?? 5),
        searchDepth: (cfg as any).search_depth === "advanced" ? "advanced" : "basic",
        includeRawContent: includeRaw,
        ...(summarization ? { summarization } : {}),
      });
    }
    case "duckduckgo":
      return duckDuckGoSearch;
    case "openai":
      return nativeOpenAISearch;
    case "anthropic":
      return nativeAnthropicSearch;
    case "exa":
      return exaSearch;
    case "none":
    default:
      return async (query: string) => ({ provider: provider, query, items: [] });
  }
}

async function duckDuckGoSearch(query: string): Promise<SearchResults> {
  const ddg = await import("duck-duck-scrape");
  const r: unknown = await (ddg as any).search(query, { safeSearch: "moderate" } as any);
  let items: { url: string; title?: string; snippet?: string }[] = [];
  if (r && typeof r === "object" && Array.isArray((r as any).results)) {
    items = (r as any).results
      .filter((x: any) => typeof x?.url === "string")
      .map((x: any) => {
        const o: any = { url: String(x.url) };
        if (typeof x.title === "string") o.title = x.title;
        if (typeof x.description === "string") o.snippet = x.description;
        return o;
      });
  }
  return { provider: "duckduckgo", query, items };
}

async function nativeOpenAISearch(query: string): Promise<SearchResults> {
  // Placeholder: native search is detected via model tool-calls, not a direct HTTP call here
  return { provider: "openai", query, items: [] };
}

async function nativeAnthropicSearch(query: string): Promise<SearchResults> {
  // Placeholder: native search is detected via model tool-calls, not a direct HTTP call here
  return { provider: "anthropic", query, items: [] };
}

async function exaSearch(query: string): Promise<SearchResults> {
  // Placeholder: integrate Exa API if configured
  return { provider: "exa", query, items: [] };
}
