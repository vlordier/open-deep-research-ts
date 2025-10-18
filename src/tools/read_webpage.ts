export interface ReadWebpageOptions {
  maxContentLength?: number;
  timeoutMs?: number;
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
  };
  loadClient?: () => Promise<Record<string, unknown>>;
}

export interface ReadWebpageResult {
  url: string;
  status: number;
  content: string;
  preview: string;
  contentLength: number;
  error?: string;
}

function getLogger(logger?: ReadWebpageOptions["logger"]) {
  return logger ?? console;
}

export function buildReadWebpageTool(options: ReadWebpageOptions = {}) {
  const {
    maxContentLength = 50_000,
    timeoutMs = 30_000,
    logger,
    loadClient,
  } = options;

  const log = getLogger(logger);

  return async (url: string): Promise<ReadWebpageResult> => {
    try {
      const tavilyMod = await (loadClient ? loadClient() : import("@tavily/core"));
      const tavilyFn =
        (tavilyMod as any)?.tavily ??
        (tavilyMod as any)?.default?.tavily ??
        undefined;

      if (typeof tavilyFn !== "function") {
        throw new Error("@tavily/core not available");
      }

      const client = tavilyFn({ apiKey: (process as any)?.env?.TAVILY_API_KEY });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: any;
      try {
        response = await client.extract([url], { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (Array.isArray(response?.failedResults) && response.failedResults.includes(url)) {
        return {
          url,
          status: 0,
          content: "",
          preview: "",
          contentLength: 0,
          error: "Tavily extract failed for this URL",
        };
      }

      const result = Array.isArray(response?.results) ? response.results[0] : undefined;
      const rawContent = typeof result?.rawContent === "string" ? result.rawContent : undefined;
      if (!rawContent) {
        return {
          url,
          status: 404,
          content: "",
          preview: "",
          contentLength: 0,
          error: "No content extracted",
        };
      }

      const content = rawContent.slice(0, maxContentLength);
      return {
        url,
        status: 200,
        content,
        preview: content.slice(0, 600),
        contentLength: content.length,
      };
    } catch (error) {
      const message = (error as Error)?.message ?? String(error ?? "unknown error");
      log.warn?.(`[read_webpage] ${message}`);
      return {
        url,
        status: 0,
        content: "",
        preview: "",
        contentLength: 0,
        error: message,
      };
    }
  };
}

