import { StateGraph, START, END } from "@langchain/langgraph";
import { ResearcherStateAnnotation } from "../shared/state.js";
import { fromRuntimeConfig } from "../shared/config.js";
import { get_all_tools, get_langchain_tools } from "../tools/index.js";
import { buildResearchSystemPrompt, buildCompressResearchPrompt, researchCompleteTool, thinkTool } from "../tools/core.js";
import { createModel } from "../providers/router.js";
import type { BaseMessageLike, AIMessage } from "@langchain/core/messages";
import type { ChatModel } from "../providers/types.js";
import { ToolMessage } from "@langchain/core/messages";
import { extractTextFromResponse } from "../shared/messages.js";
import { getModelTokenLimit } from "../shared/models.js";
import { isTokenLimitError } from "../shared/errors.js";
import { invokeWithRetry } from "../shared/invoke.js";
import { hasNativeWebsearch } from "../shared/native_search.js";
import chalk from "chalk";

/** Researcher subgraph: executes tool calls and compacts raw notes. */
async function researcher(state: typeof ResearcherStateAnnotation.State): Promise<{ researcher_messages: BaseMessageLike[] }> {
  const cfg = fromRuntimeConfig();
  const topic = state.research_topic ?? "";
  const existingMessages = state.researcher_messages ?? [];

  try {
    let systemPrompt = await buildResearchSystemPrompt(cfg.mcp_prompt ?? "");
    // Append compact per-turn context + guidance
    const searches = Number(state.search_call_count ?? 0);
    const findings = Number((state.raw_notes ?? []).length);
    const briefForTurn = (state.research_brief ?? "").slice(0, 600);
    const topicLine = `Topic: ${topic}`;
    const briefLine = briefForTurn ? `Original request: "${briefForTurn}"` : undefined;
    const status = `Progress: searches=${searches}, notes=${findings}.`;
    const rule = `Do not claim the question is missing; use the topic and brief above.`;
    const guidance = `If coverage is sufficient to write a confident, well-cited answer, call ResearchComplete now; otherwise continue targeted searches and use think_tool after each search to reflect.`;
    const sysLines = [topicLine, briefLine, status, rule, guidance].filter(Boolean) as string[];
    systemPrompt = `${systemPrompt}\n\n${sysLines.join("\n")}`;
    const model = await createModel(cfg.research_model, cfg);

    // Bind LC Tools to require tool usage from second turn onward
    const lcTools = [...(await get_langchain_tools(cfg)), researchCompleteTool, thinkTool];

    if (!model.bindTools) {
      throw new Error("Model does not support tool binding");
    }

    const firstTurn = existingMessages.length === 0;
    const maxToolMsgs = Math.max(1, Number((cfg as any).max_tool_messages ?? 64));
    const windowed = firstTurn ? [] : existingMessages.slice(-maxToolMsgs);
    const toolBoundModel: ChatModel<BaseMessageLike, unknown> = firstTurn
      ? model.bindTools(lcTools)
      : model.bindTools(lcTools, { tool_choice: "required" });

    let messages: BaseMessageLike[];

    if (existingMessages.length === 0) {
      // First researcher call - compose context-aware user message
      const brief = state.research_brief ?? "";
      const directive = state.supervisor_directive ?? "";
      const lines: string[] = [
        `You are researching: ${topic}`,
        brief ? `This is part of the request: "${brief}"` : undefined,
        directive ? `Supervisor guidance: ${directive}` : undefined,
        "Begin immediately with a web search. Gather URLs and dates, cite sources, and provide a concise TLDR. Do not ask for clarification. Use think_tool only after a search to reflect, not before.",
      ].filter(Boolean) as string[];
      let userContent = lines.join("\n\n");

      // Dynamic token budget (15% of context window)
      try {
        const limit = getModelTokenLimit(cfg.research_model, { anthropicLongContextBeta: cfg.anthropic_long_context_beta });
        const budgetChars = Math.max(2000, Math.floor(limit * 0.15) * 4);
        if (userContent.length > budgetChars) {
          // Degradation order: directive tail -> brief tail -> strip formatting -> keep focus line
          const focusLine = `You are researching: ${topic}`;
          let briefPart = brief ? `This is part of the request: "${brief}"` : "";
          let dirPart = directive ? `Supervisor guidance: ${directive}` : "";
          const maxPart = Math.floor((budgetChars - focusLine.length - 200) / 2);
          if (dirPart.length > maxPart) dirPart = dirPart.slice(0, maxPart) + "...";
          if (briefPart.length > maxPart) briefPart = briefPart.slice(0, maxPart) + "...";
          const finalLines = [
            focusLine,
            briefPart || undefined,
            dirPart || undefined,
            "Begin immediately with a web search. Gather URLs and dates, cite sources, and provide a concise TLDR. Do not ask for clarification. Use think_tool only after a search to reflect, not before.",
          ].filter(Boolean) as string[];
          userContent = finalLines.join("\n\n");
          console.log(chalk.green(`[researcher] `) + `trimmed first-turn context to ~${budgetChars} chars`);
        }
      } catch {
        // best-effort; ignore
      }

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ];
      console.log(chalk.green(`[researcher] `) + `starting research on: "${topic}" (first-turn tool_choice=${firstTurn ? "natural" : "required"})`);
    } else {
      // Python pattern: add system + windowed tool messages only (cap to avoid runaway history)
      messages = [{ role: "system", content: systemPrompt }, ...windowed];
      if (existingMessages.length !== windowed.length) {
        console.log(chalk.green(`[researcher] `) + `continuing with ${windowed.length}/${existingMessages.length} tool messages (capped, tool_choice=required)`);
      } else {
        console.log(chalk.green(`[researcher] `) + `continuing with ${existingMessages.length} tool messages (tool_choice=required)`);
      }
    }

    const response = await invokeWithRetry<BaseMessageLike, unknown>(toolBoundModel, messages, {
      label: "researcher.invoke",
      attempts: 3,
      timeoutMs: 45000,
      backoffMs: 1500,
    });
    return { researcher_messages: [response as AIMessage] };

  } catch (e) {
    console.error("[researcher] research step failed:", (e as Error).message);
    return { researcher_messages: existingMessages };
  }
}

async function researcherTools(state: typeof ResearcherStateAnnotation.State): Promise<{ raw_notes: string[]; tool_call_iterations: number; researcher_messages: BaseMessageLike[]; research_complete_called: boolean; tool_call_count: number; search_call_count: number }> {
  const messages = state.researcher_messages ?? [];
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (!lastMessage?.tool_calls?.length) {
    const native = fromRuntimeConfig().prefer_native_search ? hasNativeWebsearch(lastMessage) : false;
    if (native) {
      console.log(chalk.green(`[researcher] `) + "native websearch detected (provider), continuing loop");
    } else {
      console.log(chalk.green(`[researcher] `) + "no tool calls to process");
    }
    return {
      raw_notes: state.raw_notes ?? [],
      // Increment iterations even on idle to avoid infinite loops when model returns no tool calls
      tool_call_iterations: (state.tool_call_iterations ?? 0) + 1,
      researcher_messages: messages,
      research_complete_called: false,
      tool_call_count: state.tool_call_count ?? 0,
      search_call_count: state.search_call_count ?? 0
    };
  }

  const cfg = fromRuntimeConfig();
  const tools = get_all_tools(cfg);
  let accumulatedNotes = state.raw_notes ?? [];
  const toolMessages: BaseMessageLike[] = [];
  let researchCompleteFlag = false;
  let toolCallCount = Number(state.tool_call_count ?? 0);
  let searchCallCount = Number(state.search_call_count ?? 0);

  console.log(chalk.green(`[researcher] `) + `processing ${lastMessage.tool_calls.length} tool calls`);

  // Process each tool call and create tool messages
  for (const toolCall of lastMessage.tool_calls) {
    const toolName = toolCall.name;
    const args = toolCall.args;

    console.log(chalk.green(`[researcher] `) + `executing tool: ${toolName}`);
    toolCallCount += 1;

    if (toolName === "search") {
      const query = args["query"] || "";
      console.log(chalk.green(`[researcher] `) + `search query: "${query}"`);

      const res = await tools.search(query);
      const count = Array.isArray(res?.items) ? res.items.length : 0;
      console.log(chalk.green(`[researcher] `) + `found ${count} results`);
      searchCallCount += 1;

      // Show first few results for visibility
      const topResults = (res.items ?? []).slice(0, 3);
      for (const [i, item] of topResults.entries()) {
        const title = (item.title ?? item.url ?? "").slice(0, 60);
        console.log(chalk.green(`  ${i + 1}. ${title}... - ${item.url}`));
      }

      const notes = (res.items ?? []).map((item) => {
        const title = item.title ?? item.url ?? "";
        const url = item.url ?? "";
        const snippet = item.snippet ? `\n${item.snippet}` : "";
        return `${title}\n${url}${snippet}`;
      });
      accumulatedNotes = accumulatedNotes.concat(notes);

      // Create tool message for conversation
      const searchResults = notes.slice(0, 5).join("\n\n"); // Top 5 for conversation
      toolMessages.push(new ToolMessage({
        content: `Found ${count} results:\n\n${searchResults}`,
        tool_call_id: toolCall.id || ""
      }));

    } else if (toolName === "ResearchComplete") {
      console.log(chalk.green(`[researcher] `) + "ResearchComplete called");
      researchCompleteFlag = true;
      toolMessages.push(new ToolMessage({
        content: "Research completed successfully.",
        tool_call_id: toolCall.id || ""
      }));

    } else if (toolName === "think_tool") {
      const reflection = args["reflection"] || "thinking...";
      console.log(chalk.green(`[researcher] `) + `reflection: ${reflection.slice(0, 150)}${reflection.length > 150 ? "..." : ""}`);
      toolMessages.push(new ToolMessage({
        content: `Reflection: ${reflection}`,
        tool_call_id: toolCall.id || ""
      }));
    }
  }

  // No fixed window cap; rely on compression token-limit handling for truncation parity with Python

  return {
    raw_notes: accumulatedNotes,
    tool_call_iterations: (state.tool_call_iterations ?? 0) + 1,
    researcher_messages: toolMessages,  // Python pattern: REPLACE with tool results only
    research_complete_called: researchCompleteFlag,
    tool_call_count: toolCallCount,
    search_call_count: searchCallCount
  };
}

async function compressResearch(state: typeof ResearcherStateAnnotation.State): Promise<{ compressed_research: string; raw_notes: string[] }> {
  const cfg = fromRuntimeConfig();
  const prompt = await buildCompressResearchPrompt();
  const rawNotes = state.raw_notes ?? [];
  // We'll progressively truncate number of notes on token-limit errors
  let takeCount = Math.min(10, rawNotes.length || 0) || 0;
  let text = rawNotes.slice(-takeCount).join("\n\n");

    console.log(chalk.green(`[researcher] `) + `compress start:`);
    console.log(chalk.green(`  Raw notes: ${rawNotes.length} items`));
  const searchCount = Number(state.search_call_count ?? 0);
  const toolCount = Number(state.tool_call_count ?? 0);
  console.log(`  Tool calls total: ${toolCount}, search calls: ${searchCount}`);
  if (searchCount === 0) {
    console.warn(chalk.yellow(`[researcher] `) + "WARNING: Zero search calls before compression. Results may be hallucinated.");
  }
    console.log(chalk.green(`  Input chars: ${text.length}`));
    console.log(chalk.green(`  Input preview: ${text.slice(0, 300)}${text.length > 300 ? "..." : ""}`));

  try {
    const model = await createModel(cfg.compression_model, cfg);
    if (!model) throw new Error("Failed to create compression model");

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      attempts += 1;
      const messages: BaseMessageLike[] = [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ];

      try {
        console.log(chalk.green(`[researcher] `) + `invoking compression model: ${cfg.compression_model} (attempt ${attempts}/${maxAttempts}, notes ${takeCount})`);
        const resp: unknown = await model.invoke(messages);
        const out: string = extractTextFromResponse(resp);
        console.log(chalk.green(`[researcher] `) + `compress done:`);
        console.log(chalk.green(`  Output length: ${out.length} chars`));
        console.log(chalk.green(`  Output preview: ${out.slice(0, 300)}${out.length > 300 ? "..." : ""}`));
        return { compressed_research: out, raw_notes: rawNotes };
      } catch (err) {
        if (isTokenLimitError(err) && takeCount > 3) {
          const prev = takeCount;
          takeCount = Math.max(3, Math.floor(takeCount * 0.8));
          text = rawNotes.slice(-takeCount).join("\n\n");
          console.warn(chalk.yellow(`[researcher] `) + `Token limit during compression; reducing notes window ${prev} -> ${takeCount} and retrying`);
          continue;
        }
        throw err;
      }
    }
  } catch (e) {
    console.error(chalk.green(`[researcher] `) + "compression failed:", (e as Error).message);
    console.error(chalk.green(`[researcher] `) + "compression stack:", (e as Error).stack);
  }
  // Graceful degradation mirroring original: explicit fallback message
  return { compressed_research: "Error synthesizing research report: Maximum retries exceeded", raw_notes: rawNotes };
}

export const researcherBuilder = new StateGraph(ResearcherStateAnnotation)
  .addNode("researcher", researcher)
  .addNode("researcher_tools", researcherTools)
  .addNode("compress_research", compressResearch)
  .addEdge(START, "researcher")
  .addEdge("researcher", "researcher_tools")
  .addConditionalEdges("researcher_tools", (state: typeof ResearcherStateAnnotation.State) => {
    // Use boolean flag set by researcher_tools 
    if (state.research_complete_called) {
      console.log(chalk.green(`[researcher] `) + "ResearchComplete flag detected, proceeding to compression");
      return "compress_research";
    }

    // Check iteration limit
    const iterations = state.tool_call_iterations ?? 0;
    const maxIterations = fromRuntimeConfig().max_react_tool_calls ?? 10;

    if (iterations >= maxIterations) {
      console.log(chalk.green(`[researcher] `) + `max iterations (${maxIterations}) reached, proceeding to compression`);
      return "compress_research";
    }

    // Continue research loop
    console.log(chalk.green(`[researcher] `) + `continuing research loop (iteration ${iterations}/${maxIterations})`);
    return "researcher";
  })
  .addEdge("compress_research", END);

export const researcherSubgraph = researcherBuilder.compile();

// Typed helper to invoke the researcher subgraph without leaking untyped values
export async function runResearcherSubgraph(
  input: import("../shared/transform.js").ResearcherState
): Promise<{ raw_notes: string[]; compressed_research?: string }> {
  const g = researcherSubgraph as unknown as { invoke: (arg: unknown) => Promise<unknown> };
  const out = (await g.invoke(input as unknown)) as unknown as { raw_notes?: unknown; compressed_research?: unknown };
  const result: { raw_notes: string[]; compressed_research?: string } = {
    raw_notes: Array.isArray((out as any)?.raw_notes) ? (out as any).raw_notes as string[] : [],
  };
  if (typeof (out as any)?.compressed_research === "string") {
    result.compressed_research = (out as any).compressed_research as string;
  }
  return result;
}
