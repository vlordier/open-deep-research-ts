import test from "node:test";
import assert from "node:assert/strict";
import { fromRuntimeConfig, ConfigurationSchema } from "../src/shared/config.js";

test("config: applies defaults", () => {
  const cfg = fromRuntimeConfig({});
  const parsed = ConfigurationSchema.parse(cfg);
  assert.ok(parsed.max_structured_output_retries > 0);
});

test("config: env overrides runtime", () => {
  const prev = process.env?.["MAX_RESEARCHER_ITERATIONS"];
  process.env["MAX_RESEARCHER_ITERATIONS"] = "9";
  const cfg = fromRuntimeConfig({ max_researcher_iterations: 3 } as any);
  assert.equal(cfg.max_researcher_iterations, 9);
  if (prev === undefined) delete process.env["MAX_RESEARCHER_ITERATIONS"];
  else process.env["MAX_RESEARCHER_ITERATIONS"] = prev;
});
