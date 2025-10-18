import test from "node:test";
import assert from "node:assert/strict";
import { messageContentToString, extractTextFromResponse } from "../src/shared/messages.js";

const makeMsg = (content: unknown) => ({ content }) as any;

test("messageContentToString handles plain string content", () => {
  const msg = makeMsg("hello world");
  assert.equal(messageContentToString(msg), "hello world");
});

test("messageContentToString joins OpenAI-style text parts", () => {
  const msg = makeMsg([
    { type: "text", text: "hello" },
    { type: "text", text: " world" },
    { type: "image", url: "ignored" },
  ]);
  assert.equal(messageContentToString(msg), "hello world");
});

test("messageContentToString falls back to JSON stringification", () => {
  const msg = makeMsg({ foo: "bar" });
  assert.equal(messageContentToString(msg), JSON.stringify({ foo: "bar" }));
});

test("messageContentToString returns empty string for undefined message", () => {
  assert.equal(messageContentToString(undefined), "");
});

test("extractTextFromResponse handles string content", () => {
  const resp = { content: "  trimmed  " };
  assert.equal(extractTextFromResponse(resp), "trimmed");
});

test("extractTextFromResponse joins array content", () => {
  const resp = { content: [{ text: "foo" }, { text: " bar" }] };
  assert.equal(extractTextFromResponse(resp), "foo bar");
});

test("extractTextFromResponse stringifies unknown content", () => {
  const resp = { content: { value: 42 } };
  assert.equal(extractTextFromResponse(resp), "[object Object]");
});

