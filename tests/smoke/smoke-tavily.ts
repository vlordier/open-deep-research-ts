/* Manual script: validate Tavily tool import and API key in .env */
import "dotenv/config";

async function main() {
  // Disable LangSmith/LangChain tracing to avoid background requests
  process.env["LANGCHAIN_TRACING_V2"] = "false";
  process.env["LANGSMITH_TRACING"] = "false";
  process.env["LANGSMITH_API_KEY"] = "";

  // Lightweight fetch logger to identify any multipart requests
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    try {
      const url = typeof input === "string" ? input : input?.url ?? String(input);
      let contentType = "";
      const h = init?.headers;
      if (h) {
        if (h instanceof Headers) contentType = h.get("content-type") ?? "";
        else if (Array.isArray(h)) contentType = String(h.find((x) => x[0].toLowerCase() === "content-type")?.[1] ?? "");
        else if (typeof h === "object") contentType = String(h["content-type"] ?? h["Content-Type"] ?? "");
      }
      if (contentType.includes("multipart")) {
        console.log("[fetch][multipart]", url);
      } else {
        console.log("[fetch]", url);
      }
    } catch {}
    return originalFetch(input as any, init as any);
  }) as any;

  const apiKey = process.env?.["TAVILY_API_KEY"];
  if (!apiKey) {
    console.log("[skip] TAVILY_API_KEY not set");
    return;
  }

  try {
    const query = "langgraph langchain tavily";
    const { TavilySearch } = await import("@langchain/tavily");
    const tool: any = new TavilySearch({
      apiKey,
      maxResults: 5,
      searchDepth: "basic",
      includeImages: false,
      includeAnswer: false,
      includeRawContent: false,
    } as any);
    console.log("[before] Tavily.invoke");
    const res = await tool.invoke({ query });
    console.log("[after] Tavily.invoke");
    const arr = Array.isArray(res) ? res : Array.isArray((res as any)?.results) ? (res as any).results : [];
    console.log(`[OK] tavily '${query}' → ${arr.length} results`);
    for (const item of arr.slice(0, 3)) {
      console.log("-", item.title ?? "(no title)", "::", item.url);
    }
  } catch (e) {
    console.error("[FAIL] tavily →", (e as Error).message);
  }
}

void main();


