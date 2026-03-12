import test from "node:test";
import assert from "node:assert/strict";
import { extractContentType } from "../src/shared/http.js";

test("extractContentType reads from Headers instances", () => {
  const headers = new Headers({ "content-type": "multipart/form-data" });
  assert.equal(extractContentType(headers), "multipart/form-data");
});

test("extractContentType reads from header tuples", () => {
  assert.equal(extractContentType([["Content-Type", "application/json"]]), "application/json");
});

test("extractContentType reads from plain objects", () => {
  assert.equal(extractContentType({ "Content-Type": "text/plain" }), "text/plain");
});

test("extractContentType returns empty string for unsupported input", () => {
  assert.equal(extractContentType(undefined), "");
  assert.equal(extractContentType("content-type: text/plain"), "");
});
