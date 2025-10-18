import { inferProvider, getApiKey } from "../src/providers/router.js";
import { ConfigurationSchema } from "../src/shared/config.js";
import test from "node:test";
import assert from "node:assert/strict";

test("inferProvider: anthropic", () => {
  assert.equal(inferProvider("anthropic:claude-sonnet-4"), "anthropic");
  assert.equal(inferProvider("claude-3.5-sonnet"), "anthropic");
});

test("inferProvider: openai", () => {
  assert.equal(inferProvider("openai:gpt-5"), "openai");
  assert.equal(inferProvider("gpt-4o-mini"), "openai");
});

test("inferProvider: google", () => {
  assert.equal(inferProvider("google:gemini-2.5-pro"), "google");
  assert.equal(inferProvider("gemini-2.0-flash"), "google");
});

test("inferProvider: xai (Grok)", () => {
  assert.equal(inferProvider("xai:grok-beta"), "xai");
  assert.equal(inferProvider("grok-beta"), "xai");
});

test("inferProvider: fireworks (including Kimi-K2)", () => {
  assert.equal(inferProvider("fireworks/kimi-k2-instruct"), "fireworks");
  assert.equal(inferProvider("accounts/fireworks/models/kimi-k2-instruct"), "fireworks");
});

test("getApiKey selects from config then env", () => {
  const cfg = ConfigurationSchema.parse({
    openai_api_key: "cfg-openai",
    anthropic_api_key: null,
    google_api_key: undefined,
    groq_api_key: null,
    fireworks_api_key: "cfg-fw",
  });
  process.env["OPENAI_API_KEY"] = "env-openai";
  process.env["ANTHROPIC_API_KEY"] = "env-anthropic";
  process.env["FIREWORKS_API_KEY"] = "env-fw";
  assert.equal(getApiKey("openai:gpt-5", cfg), "cfg-openai");
  assert.equal(getApiKey("claude-sonnet-4", cfg), "env-anthropic");
  assert.equal(getApiKey("fireworks/kimi-k2-instruct", cfg), "cfg-fw");
});


