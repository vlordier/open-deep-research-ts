import type { Configuration } from "../shared/config";
import type { SearchResults } from "./types";
import { loadPrompt } from "../prompts/loader.js";
import { createModel } from "../providers/router.js";
import { extractTextFromResponse } from "../shared/messages.js";
import { withTimeout } from "../shared/time.js";
import chalk from "chalk";

export type SearchProvider = "tavily" | "openai" | "anthropic" | "duckduckgo" | "exa" | "none";

export function getSearchProvider(cfg: Configuration): SearchProvider {
  return (cfg.search_api as unknown as SearchProvider) ?? "none";
}

export type SearchTool = (query: string) => Promise<SearchResults>;

export function buildSearchTool(cfg: Configuration): SearchTool {
  const provider = getSearchProvider(cfg);
  switch (provider) {
    case "tavily":
      return tavilySearch;
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

type TavilyItem = { url: string; title?: string; content?: string; snippet?: string };
function isTavilyArray(x: unknown): x is TavilyItem[] {
  return Array.isArray(x) && x.every((r) => typeof (r as any)?.url === "string");
}
function pickItems(x: unknown): TavilyItem[] {
  if (isTavilyArray(x)) return x;
  if (x && typeof x === "object" && isTavilyArray((x as any).results)) return (x as any).results as TavilyItem[];
  return [];
}

async function tavilySearch(query: string): Promise<SearchResults> {
  try {
    // Official Tavily tool only (community package removed)
    const { TavilySearch } = await import("@langchain/tavily");
    // Read config dynamically to decide raw content inclusion
    const cfg: Configuration = (await import("../shared/config.js")).fromRuntimeConfig();
    const includeRaw = Boolean(cfg.summarization_enabled);
    const tool = new TavilySearch({
      apiKey: (process as any)?.env?.["TAVILY_API_KEY"],
      maxResults: 5,
      searchDepth: "basic",
      includeImages: false,
      includeAnswer: false,
      includeRawContent: includeRaw,
    } as any);
    const res: unknown = await (tool as any).invoke({ query });
    const arr = pickItems(res);
    const items = arr.map((r) => {
      const o: any = { url: r.url };
      if (typeof r.title === "string") o.title = r.title;
      const snip = r.snippet ?? (!includeRaw ? r.content : undefined);
      if (typeof snip === "string") o.snippet = snip;
      const rc = includeRaw ? (r as any)?.content : undefined;
      if (typeof rc === "string") o.rawContent = rc;
      return o as unknown as import("./types.js").SearchResults["items"][number];
    });

    // Optional LLM summarization on raw content 
    if (includeRaw && items.length > 0) {
      const maxItems = Number((cfg as any).summarization_max_items ?? 3);
      const timeoutMs = Number((cfg as any).summarization_timeout_ms ?? 60000);
      const model = await createModel(cfg.summarization_model, cfg);
      const top = items.slice(0, maxItems);
      console.log(chalk.blueBright(`[websum:start] summarizing ${top.length}/${items.length} pages`));
      const summaries = await Promise.all(
        top.map(async (it) => {
          const raw = (it as any).rawContent as string | undefined;
          if (!raw || raw.length < 500) return it.snippet ?? "";
          try {
            const maxChars = Number((cfg as any).max_content_length ?? 50000);
            const rawSlice = raw.slice(0, maxChars);
            const prompt = await loadPrompt("summarize_webpage.md", {
              webpage_content: rawSlice,
              date: new Date().toDateString(),
            });
            const resp = await withTimeout(
              model.invoke([{ role: "user", content: prompt }] as any),
              timeoutMs,
              "summarize_webpage"
            );
            const text = extractTextFromResponse(resp);
            return text || (it.snippet ?? "");
          } catch {
            console.warn(chalk.yellow(`[websum:warn] summarize failed for ${it.url}; using snippet`));
            return it.snippet ?? "";
          }
        })
      );
      for (let i = 0; i < top.length; i++) {
        const target = top[i];
        if (!target) continue;
        (target as any).snippet = (summaries[i] ?? target.snippet) as any;
      }
      console.log(chalk.blueBright(`[websum:end] summaries updated for ${top.length} page(s)`));
    }
    return { provider: "tavily", query, items };
  } catch (_e) {
    return { provider: "tavily", query, items: [] };
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
