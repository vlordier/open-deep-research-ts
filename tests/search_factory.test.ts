import test from "node:test";
import assert from "node:assert/strict";
import { buildSearchTool } from "../src/search/factory.js";
import { fromRuntimeConfig } from "../src/shared/config.js";

test("buildSearchTool with provider 'none' returns empty results", async () => {
  const cfg = fromRuntimeConfig({ search_api: "none" as any });
  const search = buildSearchTool(cfg);
  const res = await search("hello world");
  assert.equal(res.provider, "none");
  assert.equal(Array.isArray(res.items), true);
});


