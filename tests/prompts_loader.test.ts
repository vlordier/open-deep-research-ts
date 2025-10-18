import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPrompt } from "../src/prompts/loader.js";

async function setupPromptFile() {
  const root = await mkdtemp(join(tmpdir(), "prompt-loader-"));
  const promptDir = join(root, "deep_research", "prompts");
  await mkdir(promptDir, { recursive: true });
  const promptPath = join(promptDir, "test.md");
  await writeFile(promptPath, "Hello {name}! Today is {day}.");
  return { root, promptPath };
}

test("loadPrompt resolves relative to project root", async () => {
  const originalCwd = process.cwd();
  const { root } = await setupPromptFile();
  try {
    process.chdir(root);
    const output = await loadPrompt("test.md", { name: "World", day: "Monday" });
    assert.equal(output, "Hello World! Today is Monday.");
  } finally {
    process.chdir(originalCwd);
  }
});

test("loadPrompt also works when cwd is deep_research directory", async () => {
  const originalCwd = process.cwd();
  const { root } = await setupPromptFile();
  try {
    process.chdir(join(root, "deep_research"));
    const output = await loadPrompt("test.md", { name: "LangGraph", day: "Friday" });
    assert.equal(output, "Hello LangGraph! Today is Friday.");
  } finally {
    process.chdir(originalCwd);
  }
});

