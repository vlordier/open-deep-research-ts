import test from "node:test";
import assert from "node:assert/strict";

test("createUniversalModel throws on empty id", async () => {
  const universalModule = await import("langchain/chat_models/universal");
  // Ensure the real implementation is harmless for this test
  if (!("initChatModel" in universalModule)) {
    throw new Error("Expected initChatModel export");
  }
  const { createUniversalModel } = await import("../src/providers/universal.js");
  await assert.rejects(createUniversalModel("" as any), /Invalid modelId/);
});

