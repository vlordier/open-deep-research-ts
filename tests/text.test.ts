import test from "node:test";
import assert from "node:assert/strict";
import { truncateText } from "../src/shared/text.js";

test("truncateText returns original string when within limit", () => {
  assert.equal(truncateText("hello", 5), "hello");
});

test("truncateText appends ellipsis when over limit", () => {
  assert.equal(truncateText("hello world", 5), "hello...");
});

test("truncateText returns empty string for non-positive limit", () => {
  assert.equal(truncateText("hello", 0), "");
});
