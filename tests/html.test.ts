import test from "node:test";
import assert from "node:assert/strict";

import { looksLikeHtml, detectInputFormat } from "../src/html/detection.js";
import { htmlInnerText, htmlInnerTextWithMap } from "../src/html/text.js";

test("looksLikeHtml detects HTML snippets", () => {
  assert.equal(looksLikeHtml("<p>Hello</p>"), true);
  assert.equal(looksLikeHtml("<div><span>Hi</span></div>"), true);
  assert.equal(looksLikeHtml("Hello world"), false);
});

test("detectInputFormat returns expected labels", () => {
  assert.equal(detectInputFormat("<p>Doc</p>"), "html");
  assert.equal(detectInputFormat("Plain text"), "text");
});

test("htmlInnerText normalizes whitespace and entities", () => {
  const html = "<p>Hello &amp; welcome<br>to <strong>HTML</strong></p>";
  const text = htmlInnerText(html);
  assert.equal(text, "Hello & welcome\nto HTML");
});

test("htmlInnerTextWithMap tracks character mapping", () => {
  const html = "<p data-id=\"1\">Hello</p>";
  const { text, map } = htmlInnerTextWithMap(html);
  assert.equal(text, "Hello");
  assert.equal(map.length, html.length + 1);
  const terminal = map[html.length]!;
  assert.equal(terminal >= text.length, true);
});

