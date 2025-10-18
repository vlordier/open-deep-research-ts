import "dotenv/config";
import { createAgentGraph } from "../src/agent/graph.js";
import { fromRuntimeConfig } from "../src/shared/config.js";
import { createModel } from "../src/providers/router.js";
import { buildClarifyWithUserPrompt } from "../src/tools/core.js";
import { parseJsonSafely } from "../src/shared/json.js";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";

async function clarifyLoop(initialBrief?: string) {
  const cfg = fromRuntimeConfig();
  // Disable tracing/telemetry to avoid background requests
  process.env["LANGCHAIN_TRACING_V2"] = "false";
  process.env["LANGSMITH_TRACING"] = "false";
  process.env["LANGSMITH_API_KEY"] = "";

  // Lightweight fetch logger
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    try {
      const url = typeof input === "string" ? input : input?.url ?? String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      let contentType = "";
      const h = init?.headers;
      if (h) {
        if (h instanceof Headers) contentType = h.get("content-type") ?? "";
        else if (Array.isArray(h)) contentType = String(h.find((x) => x[0].toLowerCase() === "content-type")?.[1] ?? "");
        else if (typeof h === "object") contentType = String(h["content-type"] ?? h["Content-Type"] ?? "");
      }
      if (contentType.includes("multipart")) console.log(`[fetch][multipart] ${method} ${url}`);
    } catch {}
    return originalFetch(input as any, init as any);
  }) as any;
  const rl = createInterface({ input, output });
  const messages: string[] = [];
  let researchBrief = initialBrief ?? "";

  // If no initial brief provided, ask the user
  if (!researchBrief) {
    researchBrief = (await rl.question("Enter your research brief: ")).trim();
  }
  messages.push(researchBrief);

  try {
    const model = await createModel(cfg.research_model, cfg);
    // up to 3 clarification rounds
    for (let i = 0; i < 3; i++) {
      const prompt = await buildClarifyWithUserPrompt(messages.join("\n\n"));
      const resp: any = await (model as any).invoke([{ role: "user", content: prompt }]);
      const text = String(resp?.content?.[0]?.text ?? resp?.content ?? "").trim();
      const parsed = parseJsonSafely<any>(text);
      if (parsed?.need_clarification) {
        console.log(`\n[Clarification] ${parsed.question}`);
        const answer = (await rl.question("> ")).trim();
        if (answer) messages.push(answer);
      } else {
        // Use verification message if provided
        if (parsed?.verification) messages.push(parsed.verification);
        break;
      }
    }
  } catch {
    // If clarification fails (no keys), continue with provided brief
  }

  await rl.close();
  return { messages, researchBrief };
}

async function run() {
  const threadId = `cli-${Date.now()}`;
  // Simple argv parsing for --help/-h, --preview-len/-pl, --verbose/-v
  const argv = process.argv.slice(2);
  let briefFromArg = "";
  let previewLen = Number(process.env["PREVIEW_LEN"] ?? "");
  if (!Number.isFinite(previewLen) || previewLen <= 0) previewLen = 800; // default preview length
  let verbose = String(process.env["VERBOSE"] ?? "").toLowerCase() === "true";

  const argParts: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--help" || a === "-h") {
      console.log(
        "Usage:\n" +
          "  npm run cli -- [options] \"Your research brief\"\n" +
          "  node -r dotenv/config dist/scripts/cli.js [options] \"Your research brief\"\n\n" +
          "Options:\n" +
          "  -h, --help                 Show help\n" +
          "  -v, --verbose              Print full tool outputs (disables truncation)\n" +
          "      --preview-len, -pl N   Set tool output preview length (default 800)\n"
      );
      process.exit(0);
    } else if (a === "--verbose" || a === "-v") {
      verbose = true;
    } else if (a === "--preview-len" || a === "-pl") {
      const next = argv[++i] ?? "";
      const n = Number(next);
      if (Number.isFinite(n) && n > 0) previewLen = n;
    } else if (a === "--model") {
      const v = argv[++i] ?? "";
      if (v && !v.startsWith("--")) process.env["RESEARCH_MODEL"] = v;
    } else if (a.startsWith("--model=")) {
      const v = a.split("=", 2)[1] ?? "";
      if (v) process.env["RESEARCH_MODEL"] = v;
    } else if (a === "--research-model") {
      const v = argv[++i] ?? "";
      if (v && !v.startsWith("--")) process.env["RESEARCH_MODEL"] = v;
    } else if (a.startsWith("--research-model=")) {
      const v = a.split("=", 2)[1] ?? "";
      if (v) process.env["RESEARCH_MODEL"] = v;
    } else if (a === "--supervisor-model") {
      const v = argv[++i] ?? "";
      if (v && !v.startsWith("--")) process.env["SUPERVISOR_MODEL"] = v;
    } else if (a.startsWith("--supervisor-model=")) {
      const v = a.split("=", 2)[1] ?? "";
      if (v) process.env["SUPERVISOR_MODEL"] = v;
    } else if (a === "--summarization-model") {
      const v = argv[++i] ?? "";
      if (v && !v.startsWith("--")) process.env["SUMMARIZATION_MODEL"] = v;
    } else if (a.startsWith("--summarization-model=")) {
      const v = a.split("=", 2)[1] ?? "";
      if (v) process.env["SUMMARIZATION_MODEL"] = v;
    } else if (a === "--compression-model") {
      const v = argv[++i] ?? "";
      if (v && !v.startsWith("--")) process.env["COMPRESSION_MODEL"] = v;
    } else if (a.startsWith("--compression-model=")) {
      const v = a.split("=", 2)[1] ?? "";
      if (v) process.env["COMPRESSION_MODEL"] = v;
    } else if (a === "--final-report-model") {
      const v = argv[++i] ?? "";
      if (v && !v.startsWith("--")) process.env["FINAL_REPORT_MODEL"] = v;
    } else if (a.startsWith("--final-report-model=")) {
      const v = a.split("=", 2)[1] ?? "";
      if (v) process.env["FINAL_REPORT_MODEL"] = v;
    } else {
      argParts.push(a);
    }
  }
  // Treat remaining args as the brief
  if (!briefFromArg && argParts.length > 0) {
    briefFromArg = argParts.join(" ");
  }
  const cfg = fromRuntimeConfig();
  console.log(chalk.gray(`[config] research_model=${cfg.research_model}, summarization_model=${cfg.summarization_model}, compression_model=${cfg.compression_model}, final_report_model=${cfg.final_report_model}, search_api=${cfg.search_api}`));
  const { messages, researchBrief } = await clarifyLoop(briefFromArg);

  // Prevent the graph from running its own non-interactive clarify step,
  // since we already handled interactive clarification above.
  process.env["ALLOW_CLARIFICATION"] = "false";

  const graph = createAgentGraph();
  // Stream graph events for live visibility
  let finalState: any = null;
  try {
    // Prefer event streaming to observe progress similar to Python astream
    // version: "v2" emits standardized event names
    for await (const ev of (graph as any).streamEvents(
      { messages, research_brief: researchBrief } as any,
      { configurable: { thread_id: threadId }, version: "v2" } as any
    )) {
      const name = (ev as any)?.name ?? "";
      const event = (ev as any)?.event ?? "";
      // High-level graph/chain markers
      if (event === "on_graph_start") {
        console.log(chalk.cyan(`[graph:start]`));
      } else if (event === "on_graph_end") {
        console.log("\n" + chalk.cyan(`[graph:end]`));
      } else if (event === "on_chain_start") {
        console.log(chalk.magenta(`[chain:start] `) + chalk.bold(name));
      } else if (event === "on_chain_end") {
        console.log(chalk.magenta(`[chain:end]   `) + chalk.bold(name));
      }
      // Node lifecycle
      if (event === "on_node_start") {
        console.log(chalk.green(`[node:start] `) + chalk.bold(name));
        if (name === "compress_research") {
          console.log(chalk.blueBright.bold("[phase] Compressing research notes..."));
        } else if (name === "final_report_generation") {
          console.log(chalk.blueBright.bold("[phase] Generating final report..."));
        }
      } else if (event === "on_node_end") {
        console.log(chalk.green(`[node:end]   `) + chalk.bold(name));
      }
      // Tool lifecycle with full args and results
      if (event === "on_tool_start") {
        const toolName = (ev as unknown as { name?: string })?.name ?? "tool";
        const toolInput = (ev as unknown as { data?: { input?: unknown } })?.data?.input;
        console.log(chalk.yellow(`[tool:start] `) + chalk.bold(toolName));
        if (toolInput && typeof toolInput === "object") {
          const inputStr = JSON.stringify(toolInput, null, 2);
          console.log(chalk.gray(`  Input: ${inputStr}`));
        }
      } else if (event === "on_tool_end") {
        const toolName = (ev as unknown as { name?: string })?.name ?? "tool";
        const toolOutput = (ev as unknown as { data?: { output?: unknown } })?.data?.output;
        console.log(chalk.yellow(`[tool:end] `) + chalk.bold(toolName));
        if (typeof toolOutput === "string" && toolOutput.length > 0) {
          if (verbose) {
            console.log(chalk.gray(`  Output: ${toolOutput}`));
          } else {
            const preview = toolOutput.slice(0, previewLen);
            console.log(chalk.gray(`  Output: ${preview}${toolOutput.length > previewLen ? "..." : ""}`));
          }
        } else if (toolOutput && typeof toolOutput === "object") {
          const preview = JSON.stringify(toolOutput, null, 2);
          if (verbose) {
            console.log(chalk.gray(`  Output: ${preview}`));
          } else {
            const trimmed = preview.length > previewLen ? preview.slice(0, previewLen) + "..." : preview;
            console.log(chalk.gray(`  Output: ${trimmed}`));
          }
        }
      } else if (event === "on_tool_error") {
        const toolName = (ev as unknown as { name?: string })?.name ?? "tool";
        const errMsg = (ev as unknown as { data?: { error?: unknown } })?.data?.error;
        console.log(chalk.red(`[tool:error] `) + chalk.bold(toolName));
        if (errMsg) console.log(chalk.red(`  Error: ${String(errMsg).slice(0, 200)}`));
      }
      // Enhanced model token streaming for GPT-5
      if (event === "on_chat_model_stream" || event === "on_llm_stream") {
        const eventData = ev as unknown as { data?: { chunk?: unknown } };
        const chunk = eventData?.data?.chunk;
        let token = "";

        // Handle different chunk formats
        if (typeof chunk === "string") {
          token = chunk;
        } else if (chunk && typeof chunk === "object") {
          const chunkObj = chunk as Record<string, unknown>;
          // OpenAI format
          if (typeof chunkObj["content"] === "string") {
            token = chunkObj["content"];
          }
          // Anthropic format
          else if (Array.isArray(chunkObj["content"])) {
            token = (chunkObj["content"] as { text?: string }[])
              .map(c => c?.text ?? "")
              .join("");
          }
          // Delta format
          else if (chunkObj["delta"] && typeof (chunkObj["delta"] as { content?: string })["content"] === "string") {
            token = (chunkObj["delta"] as { content: string })["content"];
          }
          // Message content format
          else if (chunkObj["message"] && Array.isArray((chunkObj["message"] as { content?: unknown[] })["content"])) {
            token = ((chunkObj["message"] as { content: { text?: string }[] })["content"])
              .map(c => c?.text ?? "")
              .join("");
          }
        }

        if (token) {
          process.stdout.write(token);
        }
      } else if (event === "on_chat_model_end" || event === "on_llm_end") {
        // Ensure the next logs start on a new line after token streaming
        process.stdout.write("\n");
      }
      // Capture final state/output when available
      if (event === "on_chain_end" || event === "on_graph_end") {
        const data = (ev as any)?.data ?? {};
        finalState = (data as any)?.output ?? finalState;
      }
    }
  } catch (e) {
    console.error("[CLI] Streaming failed:", (e as Error).message);
    console.error("[CLI] Stream stack:", (e as Error).stack);
    console.error("[CLI] This is likely a JSON parsing issue in event stream - continuing with fallback invoke");
  }

  // Fallback: if event stream didn’t expose final state, do a single invoke to get it
  if (!finalState) {
    try {
      finalState = await (graph as any).invoke(
        { messages, research_brief: researchBrief } as any,
        { configurable: { thread_id: threadId } } as any
      );
    } catch (e) {
      console.error("[CLI] Invoke failed:", (e as Error).message);
    }
  }

  const raw = Array.isArray(finalState?.raw_notes) ? finalState.raw_notes : [];
  const notes = Array.isArray(finalState?.notes) ? finalState.notes : [];
  const report = String(finalState?.final_report ?? "");
  console.log(`\n[Agent] raw_notes=${raw.length}, notes=${notes.length}`);
  if (report) {
    console.log("\n[Final Report]\n");
    console.log(report);
  } else {
    console.log("\n(No final report produced — ensure provider keys are set.)");
  }
}

run().catch((e) => {
  console.error("[CLI Error]", (e as Error).message);
  console.error("[CLI Stack]", (e as Error).stack);
  process.exit(1);
});


