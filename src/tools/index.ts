import type { Configuration } from "../shared/config.js";
import { buildSearchTool, type SearchTool } from "../search/factory.js";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { withTimeout } from "../shared/time.js";
import { formatErrorBrief } from "../shared/errors.js";
import { loadPrompt } from "../prompts/loader.js";
import { createModel } from "../providers/router.js";
import { extractTextFromResponse } from "../shared/messages.js";
import { loadMcpTools } from "../mcp/client.js";

export { buildTavilySearchTool, type TavilySearchOptions, type TavilySummarizationOptions } from "./web_search.js";
export { buildReadWebpageTool, type ReadWebpageOptions, type ReadWebpageResult } from "./read_webpage.js";

export type Tools = {
  search: SearchTool;
};

/**
 * Assemble all tools available to the agent based on configuration.
 * For now this exposes the selected Search tool; MCP and others can be added here later.
 */
export function get_all_tools(cfg: Configuration): Tools {
  return {
    search: buildSearchTool(cfg),
  };
}

/** LangChain Tools for model.bindTools (names must match what the model will call). */
export async function get_langchain_tools(cfg: Configuration) {
  const searchFn = buildSearchTool(cfg);
  const searchTool = new DynamicStructuredTool({
    name: "search",
    description: "Search the web and return top results with titles, urls, and snippets.",
    schema: z.object({ query: z.string() }),
    func: async ({ query }: { query: string }) => {
      try {
        const res = await withTimeout(Promise.resolve(searchFn(query)), 20000, "search tool");
        const items = res.items ?? [];

        // Optional summarization of raw content (provider-dependent)
        if ((cfg as any).summarization_enabled && items.length > 0) {
          const maxItems = Number((cfg as any).summarization_max_items ?? 3);
          const timeoutMs = Number((cfg as any).summarization_timeout_ms ?? 60000);
          const top = items.slice(0, maxItems);
          const model = await createModel(cfg.summarization_model, cfg);

          const summaries = await Promise.all(
            top.map(async (it) => {
              const raw = (it as any).rawContent as string | undefined;
              if (!raw || raw.length < 500) return it.snippet ?? "";
              try {
                const prompt = await loadPrompt("summarize_webpage.md", {
                  webpage_content: raw,
                  date: new Date().toDateString(),
                });
                const text = await withTimeout(
                  model.invoke([{ role: "user", content: prompt }] as any),
                  timeoutMs,
                  "summarize_webpage"
                );
                const summary = extractTextFromResponse(text);
                return summary || (it.snippet ?? "");
              } catch (_e) {
                return it.snippet ?? "";
              }
            })
          );
          for (let i = 0; i < top.length; i++) {
            const target = top[i];
            if (!target) continue;
            (target as any).snippet = (summaries[i] ?? target.snippet) as any;
          }
        }

        const printable = items.slice(0, 5).map((it, i) => `${i + 1}. ${it.title ?? it.url}\n${it.url}${it.snippet ? `\n${it.snippet}` : ""}`).join("\n\n");
        return printable || "No results";
      } catch (e) {
        return `Error searching: ${formatErrorBrief(e)}`;
      }
    }
  });
  const tools: any[] = [searchTool];
  // Optionally load MCP tools if configured
  try {
    const mcpTools = await loadMcpTools(cfg);
    if (Array.isArray(mcpTools) && mcpTools.length > 0) {
      tools.push(...mcpTools);
      console.log(`[mcp] Loaded ${mcpTools.length} MCP tools`);
    }
  } catch (e) {
    console.warn("[mcp] MCP tool load failed:", (e as Error).message);
  }
  return tools as any;
}


