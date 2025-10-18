import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonSafely } from "../src/shared/json.js";

test("parseJsonSafely repairs simple malformed JSON", () => {
  const repaired = parseJsonSafely<{ a: number }>("{\"a\":1,}");
  assert.equal(repaired?.a, 1);
});

test("parseJsonSafely repairs bare text to JSON string", () => {
  const out = parseJsonSafely<any>("not-json");
  assert.equal(out, "not-json");
});

test("valid JSON passes through unchanged", () => {
  const input = '{"name":"John","age":30}';
  const out = parseJsonSafely<{ name: string; age: number }>(input);
  assert.deepEqual(out, { name: "John", age: 30 });
});

test("repairs missing quotes on keys and single-quoted strings", () => {
  const out = parseJsonSafely<{ name: string }>("{name: 'John'}");
  assert.deepEqual(out, { name: "John" });
});

test("repairs trailing commas and strips comments", () => {
  const out = parseJsonSafely<{ a: number; b: number }>(
    '{ "a": 1, /* note */ "b": 2, }'
  );
  assert.deepEqual(out, { a: 1, b: 2 });
});

test("repairs Python constants None/True/False", () => {
  const out = parseJsonSafely<{ a: null; b: boolean; c: boolean }>(
    '{a: None, b: True, c: False}'
  );
  assert.deepEqual(out, { a: null, b: true, c: false });
});


