import "dotenv/config";
import type { BaseMessageLike } from "@langchain/core/messages";
import { fromRuntimeConfig } from "../../src/shared/config.js";
import { createModel, inferProvider } from "../../src/providers/router.js";

async function pingOne(name: string, modelId: string) {
  const cfg = fromRuntimeConfig();
  const provider = inferProvider(modelId);
  const start = Date.now();
  try {
    const model = await createModel(modelId, cfg);
    const resp: unknown = await model.invoke([{ role: "user", content: "ping" } as BaseMessageLike]);
    const text = String((resp as any)?.content?.[0]?.text ?? (resp as any)?.content ?? "").slice(0, 80);
    const ms = Date.now() - start;
    console.log(`[ok] ${name} (${provider}:${modelId}) ${ms}ms -> ${JSON.stringify(text)}`);
  } catch (e) {
    const err = e as any;
    const ms = Date.now() - start;
    const code = err?.status ?? err?.code ?? err?.response?.status ?? "";
    const body = typeof err?.response?.data === "string" ? err.response.data.slice(0, 200) : JSON.stringify(err?.response?.data ?? err?.data ?? err?.message ?? String(err)).slice(0, 200);
    console.error(`[fail] ${name} (${provider}:${modelId}) ${ms}ms code=${code} body=${body}`);
  }
}

async function main() {
  const cfg = fromRuntimeConfig();
  const entries: Array<[string, string]> = [
    ["supervisor_model", cfg.supervisor_model],
    ["research_model", cfg.research_model],
    ["summarization_model", cfg.summarization_model],
    ["compression_model", cfg.compression_model],
    ["final_report_model", cfg.final_report_model],
  ];
  for (const [name, id] of entries) {
    await pingOne(name, id);
  }
}

main().catch((e) => {
  console.error("[ping-models] Error:", (e as Error).message);
  process.exit(1);
});


