import test from "node:test";
import assert from "node:assert/strict";

import { buildTavilySearchTool } from "../src/tools/web_search.js";

test("buildTavilySearchTool summarizes raw content when enabled", async () => {
  const results = [
    {
      url: "https://example.com",
      title: "Example",
      content: "x".repeat(600),
    },
  ];

  const tool = buildTavilySearchTool({
    maxResults: 3,
    includeRawContent: true,
    loadModule: async () => ({
      TavilySearch: class {
        constructor(public config: Record<string, unknown>) {}
        async invoke(): Promise<unknown> {
          return { results };
        }
      },
    }),
    summarization: {
      enabled: true,
      getModel: async () => ({ invoke: async () => ({ content: "Summarized content" }) }),
      promptLoader: async () => "prompt",
      maxItems: 1,
      timeoutMs: 1000,
      maxContentLength: 500,
      logger: { info: () => undefined, warn: () => undefined },
    },
  });

  const response = await tool("example query");
  assert.equal(response.provider, "tavily");
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0]?.snippet, "Summarized content");
});

test("buildTavilySearchTool handles errors gracefully", async () => {
  const tool = buildTavilySearchTool({
    loadModule: async () => ({
      TavilySearch: class {
        async invoke(): Promise<unknown> {
          throw new Error("boom");
        }
      },
    }),
  });

  const response = await tool("query");
  assert.equal(response.items.length, 0);
});

