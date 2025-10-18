/* Manual script: verify Anthropic beta header using direct client */
import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";

function env(key: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[key] : undefined;
}

async function main() {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.log("[skip] ANTHROPIC_API_KEY not set");
    return;
  }

  const llmDefault = new ChatAnthropic({ model: "claude-sonnet-4", apiKey } as any);
  const r1 = await (llmDefault as any).invoke("ping");
  console.log("[Anthropic default]", typeof r1 === "object" ? JSON.stringify(r1).slice(0, 120) : String(r1));

  const llmBeta = new ChatAnthropic({
    model: "claude-sonnet-4",
    apiKey,
    clientOptions: { headers: { "anthropic-beta": "context-1m-2025-08-07" } },
  } as any);
  const r2 = await (llmBeta as any).invoke("ping");
  console.log("[Anthropic beta]", typeof r2 === "object" ? JSON.stringify(r2).slice(0, 120) : String(r2));
}

void main();

