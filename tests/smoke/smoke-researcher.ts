import "dotenv/config";
import { researcherSubgraph } from "../../src/researcher/graph.js";
import { fromRuntimeConfig } from "../../src/shared/config.js";

async function main() {
  // Disable tracing to avoid background multipart requests
  process.env["LANGCHAIN_TRACING_V2"] = "false";
  process.env["LANGSMITH_TRACING"] = "false";
  process.env["LANGSMITH_API_KEY"] = "";

  // Fetch logger
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
      if (contentType.includes("multipart")) console.log("[fetch][multipart]", url);
    } catch {}
    return originalFetch(input as any, init as any);
  }) as any;

  const cfg = fromRuntimeConfig();
  const topic = process.argv.slice(2).join(" ") || "langgraph tavily integration";
  const input = {
    researcher_messages: [],
    tool_call_iterations: 0,
    research_topic: topic,
    compressed_research: undefined,
    raw_notes: [],
  };
  const out = await (researcherSubgraph as any).invoke(input as any, { configurable: cfg } as any);
  const notes: string[] = Array.isArray(out?.raw_notes) ? out.raw_notes : [];
  console.log(`[OK] researcher '${topic}' → ${notes.length} notes`);
  for (const n of notes.slice(0, 3)) console.log("-", n.split("\n")[0]);
}

main().catch((e) => {
  console.error("[FAIL] smoke-researcher →", (e as Error).message);
  process.exit(1);
});


