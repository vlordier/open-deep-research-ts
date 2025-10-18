/* Manual script: universal init "ping" across providers using .env keys */
import "dotenv/config";
import { initChatModel } from "langchain/chat_models/universal";
import { createModel as createRoutedModel } from "../../src/providers/router.js";
import { ChatFireworks } from "@langchain/community/chat_models/fireworks";
import { ChatXAI } from "@langchain/xai";

function env(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
}

async function tryInvoke(model: string, modelProvider: string, apiKey?: string, baseURL?: string) {
  try {
    const llm = await initChatModel(model, { modelProvider, apiKey, baseURL } as any);
    const res = await (llm as any).invoke("ping");
    console.log(`[OK] ${modelProvider}:${model} →`, typeof res === "object" ? JSON.stringify(res).slice(0, 120) : String(res));
  } catch (e) {
    console.log(`[FAIL] ${modelProvider}:${model} →`, (e as Error).message);
  }
}

async function main() {
  // Disable LangSmith/LangChain tracing to avoid multipart upload (403) in simple smoke tests
  try {
    process.env["LANGCHAIN_TRACING_V2"] = "false";
    process.env["LANGSMITH_TRACING"] = "false";
    process.env["LANGCHAIN_API_KEY"] = "";
    process.env["LANGSMITH_API_KEY"] = "";
    process.env["LANGCHAIN_PROJECT"] = "";
    process.env["LANGCHAIN_ENDPOINT"] = "";
    process.env["LANGSMITH_ENDPOINT"] = "";
  } catch {}
  const argv = process.argv.slice(2);
  const mIdx = argv.findIndex((a) => a === "--model");
  let modelArg = "";
  if (mIdx !== -1 && argv[mIdx + 1] && !argv[mIdx + 1]!.startsWith("--")) modelArg = argv[mIdx + 1] as string;
  const eq = argv.find((a) => a.startsWith("--model="));
  if (!modelArg && eq) modelArg = eq.split("=", 2)[1] ?? "";

  // If a model is provided, use the project's router for exact parity with the agent
  if (modelArg) {
    const { fromRuntimeConfig } = await import("../../src/shared/config.js");
    const cfg = fromRuntimeConfig();
    try {
      const model = await createRoutedModel(modelArg, cfg);
      const res = await (model as any).invoke("Return the single word: pong");
      console.log(`[OK] ${modelArg} →`, typeof res === "object" ? JSON.stringify(res).slice(0, 120) : String(res));
    } catch (e) {
      console.log(`[FAIL] ${modelArg} →`, (e as Error).message);
    }
    return;
  }

  const tasks: Promise<void>[] = [];
  if (env("OPENAI_API_KEY")) tasks.push(tryInvoke("gpt-5", "openai", env("OPENAI_API_KEY")));
  if (env("XAI_API_KEY")) {
    const llm = new ChatXAI({ model: "grok-4-0709", apiKey: env("XAI_API_KEY") } as any);
    try {
      const res = await (llm as any).invoke("ping");
      console.log(`[OK] xai:grok-4-0709 →`, typeof res === "object" ? JSON.stringify(res).slice(0, 120) : String(res));
    } catch (e) {
      console.log(`[FAIL] xai:grok-4-0709 →`, (e as Error).message);
    }
  }
  if (env("FIREWORKS_API_KEY")) {
    const fw = new ChatFireworks({ model: "kimi-k2-instruct-0905", apiKey: env("FIREWORKS_API_KEY") } as any);
    try {
      const res = await (fw as any).invoke("ping");
      console.log(`[OK] fireworks:kimi-k2-instruct-0905 →`, typeof res === "object" ? JSON.stringify(res).slice(0, 120) : String(res));
    } catch (e) {
      console.log(`[FAIL] fireworks:kimi-k2-instruct-0905 →`, (e as Error).message);
    }
  }
  if (env("TOGETHER_API_KEY")) {
    // Use OpenAI-compatible client with Together baseURL
    tasks.push(tryInvoke("Qwen/Qwen3-Next-80B-A3B-Instruct", "openai", env("TOGETHER_API_KEY"), "https://api.together.xyz/v1"));
  }
  if (env("GOOGLE_API_KEY")) tasks.push(tryInvoke("gemini-2.5-pro", "google-genai", env("GOOGLE_API_KEY")));
  await Promise.all(tasks);
}

void main();


