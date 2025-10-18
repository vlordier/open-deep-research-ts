import "dotenv/config";
import { createAgentGraph } from "../../src/agent/graph.js";

async function main() {
  process.env["LANGCHAIN_TRACING_V2"] = "false";
  process.env["LANGSMITH_TRACING"] = "false";
  process.env["LANGSMITH_API_KEY"] = "";

  const brief = process.argv.slice(2).join(" ") || "LangGraph + Tavily: gather 3 sources and summarize";
  const graph = createAgentGraph();
  const out = await (graph as any).invoke(
    { messages: [], research_brief: brief } as any,
    { configurable: { thread_id: `smoke-${Date.now()}` } } as any
  );
  const raw = Array.isArray(out?.raw_notes) ? out.raw_notes : [];
  const notes = Array.isArray(out?.notes) ? out.notes : [];
  console.log(`[OK] agent run → raw_notes=${raw.length}, notes=${notes.length}`);
  for (const n of raw.slice(0, 3)) console.log("-", String(n).split("\n")[0]);
}

main().catch((e) => {
  console.error("[FAIL] smoke-agent →", (e as Error).message);
  process.exit(1);
});

