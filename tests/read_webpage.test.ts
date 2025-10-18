import test from "node:test";
import assert from "node:assert/strict";

import { buildReadWebpageTool } from "../src/tools/read_webpage.js";

test("buildReadWebpageTool extracts and trims content", async () => {
  const tool = buildReadWebpageTool({
    maxContentLength: 10,
    timeoutMs: 1000,
    loadClient: async () => ({
      tavily: () => ({
        extract: async () => ({
          results: [
            {
              rawContent: "A long piece of content that will be trimmed",
            },
          ],
        }),
      }),
    }),
  });
  const response = await tool("https://example.com");

  assert.equal(response.status, 200);
  assert.equal(response.content, "A long pie");
  assert.equal(response.contentLength, 10);
  assert.equal(response.preview, "A long pie".slice(0, 600));
});

test("buildReadWebpageTool returns error when no content available", async () => {
  const tool = buildReadWebpageTool({
    loadClient: async () => ({
      tavily: () => ({
        extract: async () => ({ results: [] }),
      }),
    }),
  });
  const response = await tool("https://example.com/nocontent");

  assert.equal(response.status, 404);
  assert.equal(response.error, "No content extracted");
});

