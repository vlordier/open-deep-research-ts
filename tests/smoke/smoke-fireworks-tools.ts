#!/usr/bin/env node
import "dotenv/config";
import { ChatFireworks } from "@langchain/community/chat_models/fireworks";
import { z } from "zod";

function stripPrefix(id: string): string {
  return String(id || "").replace(/^fireworks:/i, "");
}

async function testModel(modelId: string, apiKey: string) {
  const model = stripPrefix(modelId);
  const llm = new ChatFireworks({ model, apiKey } as any);

  const getTimeTool = {
    name: "get_time",
    description: "Get the current time in a given IANA time zone.",
    schema: z.object({ zone: z.string().describe("IANA time zone, e.g. 'America/Los_Angeles'") }),
  };

  try {
    const llmWithTools = (llm as any).bindTools?.([getTimeTool]);
    if (!llmWithTools) {
      return { model: modelId, supportsTools: false, note: "bindTools not available" };
    }
    // Ask a question that strongly suggests a tool call
    const res: any = await llmWithTools.invoke([{ role: "user", content: "What time is it in America/Los_Angeles? Use tools if available." }] as any);
    // Heuristic: if no error thrown, we consider tool binding supported
    const toolCalls = (res as any)?.tool_calls ?? (res as any)?.additional_kwargs?.tool_calls ?? [];
    return { model: modelId, supportsTools: true, toolCallsCount: Array.isArray(toolCalls) ? toolCalls.length : 0 };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return { model: modelId, supportsTools: false, error: msg };
  }
}

async function main() {
  // Disable LangSmith/LangChain tracing to avoid multipart upload noise
  delete (process as any).env.LANGCHAIN_TRACING_V2;
  delete (process as any).env.LANGCHAIN_API_KEY;
  delete (process as any).env.LANGCHAIN_PROJECT;

  const apiKey = process.env["FIREWORKS_API_KEY"];
  if (!apiKey) {
    console.error("FIREWORKS_API_KEY is not set");
    process.exit(1);
  }

  const models = [
    "fireworks:accounts/fireworks/models/gpt-oss-120b",
    "fireworks:accounts/fireworks/models/kimi-k2-instruct-0905",
    "fireworks:accounts/fireworks/models/qwen3-235b-a22b-thinking-2507",
    "fireworks:accounts/fireworks/models/deepseek-v3p1",
    "fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic",
    "fireworks:accounts/fireworks/models/mixtral-8x22b-instruct",
    "fireworks:accounts/fireworks/models/glm-4p5",
  ];

  const results = [] as any[];
  for (const id of models) {
    const r = await testModel(id, apiKey);
    results.push(r);
  }
  for (const r of results) {
    if (r.supportsTools) {
      console.log(`[OK] ${r.model} supports tools (tool_calls=${r.toolCallsCount ?? 0})`);
    } else {
      console.log(`[NO] ${r.model} does not support tools: ${r.error ?? r.note ?? "unknown"}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


