import "dotenv/config";
import { fromRuntimeConfig } from "../../src/shared/config.js";

async function main() {
  const cfg = fromRuntimeConfig();
  const out = {
    supervisor_model: cfg.supervisor_model,
    research_model: cfg.research_model,
    summarization_model: cfg.summarization_model,
    compression_model: cfg.compression_model,
    final_report_model: cfg.final_report_model,
    search_api: cfg.search_api,
    prefer_native_search: cfg.prefer_native_search,
    base_url_overrides: cfg.base_url_overrides,
    max_react_tool_calls: cfg.max_react_tool_calls,
    max_researcher_iterations: cfg.max_researcher_iterations,
    max_concurrent_research_units: cfg.max_concurrent_research_units,
    allow_clarification: cfg.allow_clarification,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("[print-config] Error:", (e as Error).message);
  process.exit(1);
});


