import test from "node:test";
import assert from "node:assert/strict";
import { resolveModelClass } from "../src/shared/models.js";

// OpenAI
test("resolves GPT-5-mini to 200K tokens", () => {
  assert.equal(resolveModelClass("openai:gpt-5-mini"), "200K");
});

test("resolves GPT-5-nano to 128K tokens", () => {
  assert.equal(resolveModelClass("openai:gpt-5-nano"), "128K");
});

test("resolves GPT-5 to 400K tokens", () => {
  assert.equal(resolveModelClass("openai:gpt-5"), "400K");
});

test("resolves O3 models to 200K tokens", () => {
  assert.equal(resolveModelClass("openai:o3"), "200K");
  assert.equal(resolveModelClass("openai:o3-mini"), "200K");
});

test("resolves 4o to 128K tokens", () => {
  assert.equal(resolveModelClass("openai:gpt-4o"), "128K");
});

// Anthropic
test("resolves Claude Opus 4.1 to 1M tokens", () => {
  assert.equal(resolveModelClass("anthropic:claude-opus-4-1-20250805"), "1M");
});

test("resolves Claude Sonnet 4 to 200K tokens (default)", () => {
  assert.equal(resolveModelClass("anthropic:claude-sonnet-4-20250514"), "200K");
});

test("resolves older Claude to 200K tokens", () => {
  assert.equal(resolveModelClass("anthropic:claude-3-5-sonnet"), "200K");
});

// Google
test("resolves Gemini 2.5 to 1M tokens", () => {
  assert.equal(resolveModelClass("google:gemini-2.5-pro"), "1M");
});

test("resolves Gemini 2.0 Pro Experimental to 2M tokens", () => {
  assert.equal(resolveModelClass("google:gemini-2.0-pro-experimental"), "2M");
});

test("resolves Gemini 1.5 Pro to 2M tokens", () => {
  assert.equal(resolveModelClass("google:gemini-1.5-pro"), "2M");
});
