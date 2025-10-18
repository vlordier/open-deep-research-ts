import test from "node:test";
import assert from "node:assert/strict";
import { overrideListReducer } from "../src/shared/reducers.js";

test("overrideListReducer concats when given an array update", () => {
  const out = overrideListReducer(["a"], ["b", "c"]);
  assert.deepEqual(out, ["a", "b", "c"]);
});

test("overrideListReducer overrides when given {type:'override'}", () => {
  const out = overrideListReducer(["a"], { type: "override", value: ["z"] });
  assert.deepEqual(out, ["z"]);
});

test("overrideListReducer ignores invalid override shapes (returns existing)", () => {
  // @ts-expect-error intentional wrong shape
  const out = overrideListReducer(["a"], { type: "bad", value: ["z"] });
  assert.deepEqual(out, ["a"]);
});
