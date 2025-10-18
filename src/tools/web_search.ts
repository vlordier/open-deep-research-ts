import type { ChatModel } from "../providers/types.js";
import { extractTextFromResponse } from "../shared/messages.js";
import { withTimeout } from "../shared/time.js";

export interface SearchResultItem {
  url: string;
  title?: string;
  snippet?: string;
  rawContent?: string;
  [key: string]: unknown;
}

export interface SearchResults {
  provider: string;
  query: string;
  items: SearchResultItem[];
}

export interface TavilySummarizationOptions {
  enabled: boolean;
  model?: ChatModel;
  getModel?: () => Promise<ChatModel | undefined>;
  promptLoader: (name: string, vars: Record<string, unknown>) => Promise<string>;
  maxItems?: number;
  timeoutMs?: number;
  maxContentLength?: number;
  logger?: { info?: (message: string) => void; warn?: (message: string) => void };
}

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeRawContent?: boolean;
  summarization?: TavilySummarizationOptions;
  loadModule?: () => Promise<Record<string, unknown>>;
}

export function buildTavilySearchTool(options: TavilySearchOptions = {}): (query: string) => Promise<SearchResults> {
  const {
    maxResults = 5,
    searchDepth = "basic",
    includeRawContent = false,
    summarization,
    loadModule,
  } = options;

  const shouldSummarize = Boolean(summarization?.enabled);
  const shouldIncludeRaw = includeRawContent || shouldSummarize;
  const logger = summarization?.logger ?? console;

  let cachedModel: ChatModel | undefined;
  const ensureModel = async (): Promise<ChatModel | undefined> => {
    if (!shouldSummarize) return undefined;
    if (summarization?.model) return summarization.model;
    if (!cachedModel && typeof summarization?.getModel === "function") {
      cachedModel = await summarization.getModel();
    }
    return cachedModel;
  };

  return async function tavilySearch(query: string): Promise<SearchResults> {
    try {
      const tavilyModule = await (loadModule ? loadModule() : import("@langchain/tavily"));
      const TavilySearchCtor = (tavilyModule as Record<string, unknown>)?.["TavilySearch"] as
        | (new (cfg: Record<string, unknown>) => { invoke: (input: unknown) => Promise<unknown> })
        | undefined;

      if (typeof TavilySearchCtor !== "function") {
        throw new Error("TavilySearch is not available");
      }

      const tool = new TavilySearchCtor({
        apiKey: (process as any)?.env?.TAVILY_API_KEY,
        maxResults,
        searchDepth,
        includeImages: false,
        includeAnswer: false,
        includeRawContent: shouldIncludeRaw,
      });

      const rawResults = await tool.invoke({ query });
      const items = parseTavilyResults(rawResults, shouldIncludeRaw);

      if (shouldSummarize && items.length > 0) {
        await applySummaries(items, {
          ...summarization!,
          getModel: ensureModel,
          logger,
        });
      }

      return { provider: "tavily", query, items };
    } catch (err) {
      logger?.warn?.(`[web_search] Tavily error: ${(err as Error).message}`);
      return { provider: "tavily", query, items: [] };
    }
  };
}

function parseTavilyResults(res: unknown, captureRawContent: boolean): SearchResultItem[] {
  const arr = Array.isArray(res)
    ? res
    : res && typeof res === "object" && Array.isArray((res as any).results)
      ? (res as any).results
      : [];

  return (arr as unknown[]).map((entry) => {
    const record = entry as Record<string, unknown>;
    const item: SearchResultItem = {
      url: String(record["url"] ?? ""),
    };
    if (typeof record["title"] === "string") item.title = record["title"] as string;

    const snippet = record["snippet"] ?? (!captureRawContent ? record["content"] : undefined);
    if (typeof snippet === "string") item.snippet = snippet;

    if (captureRawContent && typeof record["content"] === "string") {
      item.rawContent = record["content"] as string;
    }

    return item;
  });
}

async function applySummaries(
  items: SearchResultItem[],
  config: TavilySummarizationOptions & {
    getModel: () => Promise<ChatModel | undefined>;
    logger: { info?: (msg: string) => void; warn?: (msg: string) => void };
  }
): Promise<void> {
  const {
    getModel,
    promptLoader,
    maxItems = 3,
    timeoutMs = 60000,
    maxContentLength = 50000,
    logger,
  } = config;

  const model = await getModel();
  if (!model) {
    logger?.warn?.("[web_search] Summarization enabled but no model available");
    return;
  }

  const top = items.slice(0, Math.max(1, maxItems));
  logger?.info?.(`[web_search] Summarizing ${top.length}/${items.length} Tavily result(s)`);

  const summaries = await Promise.all(
    top.map(async (item) => {
      const raw = item.rawContent;
      if (!raw || raw.length < 500) {
        return item.snippet ?? "";
      }

      try {
        const prompt = await promptLoader("summarize_webpage.md", {
          webpage_content: raw.slice(0, maxContentLength),
          date: new Date().toDateString(),
        });

        const response = await withTimeout(
          model.invoke([{ role: "user", content: prompt }] as any),
          timeoutMs,
          "summarize_webpage"
        );

        const text = extractTextFromResponse(response);
        return text || item.snippet || "";
      } catch (err) {
        logger?.warn?.(`[web_search] Summarization failed for ${item.url}: ${(err as Error).message}`);
        return item.snippet ?? "";
      }
    })
  );

  top.forEach((item, idx) => {
    const next = summaries[idx];
    if (typeof next === "string" && next.length > 0) {
      item.snippet = next;
    }
  });
}

