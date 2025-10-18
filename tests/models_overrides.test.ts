import test from "node:test";
import assert from "node:assert/strict";
import { setModelTokenOverrides, resolveModelClass } from "../src/shared/models.js";

test("exact-id override wins", () => {
  setModelTokenOverrides({ "openai:gpt-5": 262144 });
  assert.equal(resolveModelClass("openai:gpt-5"), "256K");
  setModelTokenOverrides({});
});

test("sonnet-4 upgrades to 1M with beta flag", () => {
  assert.equal(resolveModelClass("anthropic:claude-sonnet-4"), "200K");
  assert.equal(
    resolveModelClass("anthropic:claude-sonnet-4", { anthropicLongContextBeta: true }),
    "1M"
  );
});
