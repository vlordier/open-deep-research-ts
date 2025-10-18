#!/usr/bin/env node
import "dotenv/config";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";
import type { BaseMessageLike } from "@langchain/core/messages";
import { fromRuntimeConfig } from "../../src/shared/config.js";
import { createModel } from "../../src/providers/router.js";

async function main() {
  try { loadEnv({ path: resolve(process.cwd(), "../.env"), override: false }); } catch {}
  // Disable LangSmith/LangChain tracing to avoid multipart uploads/log noise
  delete (process as any).env.LANGCHAIN_TRACING_V2;
  delete (process as any).env.LANGCHAIN_API_KEY;
  delete (process as any).env.LANGCHAIN_PROJECT;

  const argv = process.argv.slice(2);
  const models: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--model" && argv[i + 1] && !argv[i + 1]!.startsWith("--")) { models.push(argv[++i] as string); continue; }
    if (a.startsWith("--model=")) { models.push(a.split("=", 2)[1] ?? ""); continue; }
  }
  const list = models.length > 0 ? models : [
    "fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic",
    "fireworks:accounts/fireworks/models/kimi-k2-instruct-0905",
  ];

  const getTimeTool = {
    name: "get_time",
    description: "Get the current time in a given IANA time zone.",
    schema: z.object({ zone: z.string().describe("IANA time zone, e.g. 'America/Los_Angeles'") }),
  };

  for (const id of list) {
    try {
      process.env["RESEARCH_MODEL"] = id; // Ensure fromRuntimeConfig picks it up
      const cfg = fromRuntimeConfig();
      const model = await createModel(cfg.research_model, cfg);
      const hasBind = typeof (model as any)?.bindTools === "function";
      if (!hasBind) {
        console.log(`[NO] ${id} bindTools missing on model instance`);
        continue;
      }
      const bound = (model as any).bindTools([getTimeTool]);
      const messages: BaseMessageLike[] = [
        { role: "user", content: "What time is it in America/Los_Angeles? Use tools if available." },
      ];
      const resp: any = await bound.invoke(messages as any);
      const toolCalls = resp?.tool_calls ?? resp?.additional_kwargs?.tool_calls ?? [];
      console.log(`[OK] ${id} tool call path worked (tool_calls=${Array.isArray(toolCalls) ? toolCalls.length : 0})`);
    } catch (e) {
      console.log(`[ERR] ${id} ${String((e as Error)?.message || e)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


