import test from "node:test";
import assert from "node:assert/strict";
import {
  openaiWebsearchCalled,
  anthropicWebsearchCalled,
  hasNativeWebsearch,
} from "../src/shared/native_search.js";

test("openaiWebsearchCalled detects web_search_call tool output", () => {
  const message = {
    additional_kwargs: {
      tool_outputs: [
        { type: "web_search_call", payload: {} },
        { type: "other" },
      ],
    },
  };
  assert.equal(openaiWebsearchCalled(message as any), true);
});

test("openaiWebsearchCalled returns false when tool output absent", () => {
  const message = { additional_kwargs: { tool_outputs: [{ type: "not_it" }] } };
  assert.equal(openaiWebsearchCalled(message as any), false);
});

test("anthropicWebsearchCalled detects server tool usage", () => {
  const message = {
    response_metadata: {
      usage: { server_tool_use: { web_search_requests: 2 } },
    },
  };
  assert.equal(anthropicWebsearchCalled(message as any), true);
});

test("anthropicWebsearchCalled returns false for zero usage", () => {
  const message = {
    response_metadata: {
      usage: { server_tool_use: { web_search_requests: 0 } },
    },
  };
  assert.equal(anthropicWebsearchCalled(message as any), false);
});

test("hasNativeWebsearch combines both heuristics", () => {
  const openaiMsg = {
    additional_kwargs: { tool_outputs: [{ type: "web_search_call" }] },
  };
  const anthropicMsg = {
    response_metadata: { usage: { server_tool_use: { web_search_requests: 1 } } },
  };
  assert.equal(hasNativeWebsearch(openaiMsg as any), true);
  assert.equal(hasNativeWebsearch(anthropicMsg as any), true);
  assert.equal(hasNativeWebsearch({} as any), false);
});

