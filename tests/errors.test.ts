import test from "node:test";
import assert from "node:assert/strict";
import {
  isTokenLimitError,
  isTimeoutError,
  isRateLimitError,
  isOverloadedError,
  isNetworkError,
  isRetryableError,
  formatErrorBrief,
} from "../src/shared/errors.js";

const makeError = (message: string) => new Error(message);

test("token limit heuristics detect common phrases", () => {
  assert.equal(isTokenLimitError(makeError("Maximum context length exceeded")), true);
  assert.equal(isTokenLimitError(makeError("all good")), false);
});

test("timeout heuristics cover timed out variations", () => {
  assert.equal(isTimeoutError(makeError("Request timed out")), true);
  assert.equal(isTimeoutError(makeError("other")), false);
});

test("rate limit heuristics catch 429 and phrases", () => {
  assert.equal(isRateLimitError(makeError("429 Too Many Requests")), true);
  assert.equal(isRateLimitError(makeError("ok")), false);
});

test("overloaded heuristics include explicit type", () => {
  const overloaded = new Error("Service unavailable");
  assert.equal(isOverloadedError(overloaded), true);
  assert.equal(isOverloadedError(makeError("fine")), false);
  assert.equal(isOverloadedError({ error: { type: "overloaded_error" } } as any), true);
});

test("network heuristics detect common errno snippets", () => {
  assert.equal(isNetworkError(makeError("ECONNRESET")), true);
  assert.equal(isNetworkError(makeError("done")), false);
});

test("isRetryableError combines retryable predicates", () => {
  assert.equal(isRetryableError(makeError("timeout")), true);
  assert.equal(isRetryableError(makeError("429")), true);
  assert.equal(isRetryableError(makeError("ECONNRESET")), true);
  assert.equal(isRetryableError(makeError("non retry")), false);
});

test("formatErrorBrief truncates long messages", () => {
  const long = "a".repeat(200);
  const formatted = formatErrorBrief(makeError(long), 50);
  assert.equal(formatted.length, 53);
  assert.equal(formatted.endsWith("..."), true);
});

test("formatErrorBrief returns message when within limit", () => {
  const formatted = formatErrorBrief(makeError("short"), 50);
  assert.equal(formatted, "short");
});

