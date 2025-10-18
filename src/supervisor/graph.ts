import { StateGraph, START } from "@langchain/langgraph";
import { SupervisorStateAnnotation } from "../shared/state.js";
import { fromRuntimeConfig } from "../shared/config.js";
import { createModel } from "../providers/router.js";
import { runResearcherSubgraph } from "../researcher/graph.js";
import { toSupervisorState, toResearcherState } from "../shared/transform.js";
import { buildLeadResearcherPrompt, conductResearchTool, researchCompleteTool, thinkTool } from "../tools/core.js";
import type { BaseMessageLike, AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import type { ChatModel } from "../providers/types.js";
import { invokeWithRetry } from "../shared/invoke.js";
import { messageContentToString } from "../shared/messages.js";
import chalk from "chalk";

/** Supervisor subgraph: orchestrates researcher work and tools. */
async function supervisor(state: typeof SupervisorStateAnnotation.State): Promise<{ supervisor_messages: BaseMessageLike[] }> {
  const cfg = fromRuntimeConfig();
  try {
    const systemPrompt = await buildLeadResearcherPrompt({
      max_researcher_iterations: cfg.max_researcher_iterations,
      max_concurrent_research_units: cfg.max_concurrent_research_units,
    });

    // Bind tools and let model decide naturally
    const model: ChatModel = await createModel(cfg.supervisor_model, cfg);
    const tools = [conductResearchTool, researchCompleteTool, thinkTool];

    if (!model.bindTools) {
      throw new Error("Model does not support tool binding");
    }

    const toolBoundModel: ChatModel<BaseMessageLike, unknown> = model.bindTools(tools);

    // Simple conversation - no forced JSON actions
    const supervisor_messages = state.supervisor_messages ?? [];
    let messages: BaseMessageLike[];

    if (supervisor_messages.length === 0) {
      // First supervisor call - add research brief as user message
      const brief = state.research_brief ?? "";
      console.log(chalk.cyan(`[supervisor] `) + `starting with brief: "${brief}"`);
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: brief }
      ];
    } else {
      // Continue conversation with tools
      messages = [
        { role: "system", content: systemPrompt },
        ...supervisor_messages
      ];
      console.log(chalk.cyan(`[supervisor] `) + `continuing conversation, ${messages.length} messages`);
    }

    // If the most recent message contains tool calls, defer to supervisor_tools before invoking again
    const last = (state.supervisor_messages ?? [])[((state.supervisor_messages ?? []).length - 1)] as AIMessage | undefined;
    if (last?.tool_calls?.length) {
      console.log(chalk.cyan(`[supervisor] `) + `pending tool calls detected (${last.tool_calls.length}); deferring to tools node`);
      return { supervisor_messages };
    }

    const response = await invokeWithRetry<BaseMessageLike, unknown>(toolBoundModel, messages, {
      label: "supervisor.invoke",
      attempts: 3,
      timeoutMs: 60000,
      backoffMs: 1500,
    });
    const ai = response as AIMessage;
    // REPLACE messages with new response (prevents explosion)
    console.log(chalk.cyan(`[supervisor] `) + `response generated${ai.tool_calls?.length ? ` with ${ai.tool_calls.length} tool calls` : ""}`);
    return { supervisor_messages: [ai] };

  } catch (e) {
    console.error(chalk.cyan(`[supervisor] `) + "failed:", (e as Error).message);
    return { supervisor_messages: [] };
  }
}

async function supervisorTools(state: typeof SupervisorStateAnnotation.State): Promise<{ supervisor_messages: BaseMessageLike[]; raw_notes: string[]; notes: string[]; research_iterations: number }> {
  const cfg = fromRuntimeConfig();
  const supervisor_messages = state.supervisor_messages ?? [];
  const most_recent_message = supervisor_messages[supervisor_messages.length - 1] as AIMessage;

  // Direct tool call handling
  if (!most_recent_message?.tool_calls?.length) {
    console.log(chalk.cyan(`[supervisor] `) + "No tool calls - ending supervision loop");
    return {
      supervisor_messages,
      raw_notes: state.raw_notes ?? [],
      notes: state.notes ?? [],
      research_iterations: cfg.max_researcher_iterations
    };
  }

  const research_iterations = state.research_iterations ?? 0;
  const exceeded_iterations = research_iterations > cfg.max_researcher_iterations;
  const research_complete_called = most_recent_message.tool_calls.some(
    call => call.name === "ResearchComplete"
  );

  if (exceeded_iterations || research_complete_called) {
    console.log(chalk.cyan(`[supervisor] `) + "Research complete or max iterations reached");
    return {
      supervisor_messages,
      raw_notes: state.raw_notes ?? [],
      notes: state.notes ?? [],
      research_iterations: cfg.max_researcher_iterations
    };
  }

  // Process ALL tool calls and create responses 
  const toolMessages: ToolMessage[] = [];

  for (const toolCall of most_recent_message.tool_calls) {
    if (toolCall.name === "think_tool") {
      // Execute think_tool
      const reflection = toolCall.args["reflection"] || "";
      console.log(chalk.cyan(`[supervisor] `) + `think_tool: ${reflection.slice(0, 100)}...`);

      const result = await thinkTool.func({ reflection });
      toolMessages.push(new ToolMessage({
        content: result,
        tool_call_id: toolCall.id || "",
        name: "think_tool"
      }));

    } else if (toolCall.name === "ConductResearch") {
      // Execute ConductResearch
      const research_topic = toolCall.args["research_topic"] || "";
      console.log(chalk.cyan(`[supervisor] `) + `ConductResearch: ${research_topic.slice(0, 100)}...`);

      const result = await conductResearchTool.func({ research_topic });
      toolMessages.push(new ToolMessage({
        content: result,
        tool_call_id: toolCall.id || "",
        name: "ConductResearch"
      }));

    } else if (toolCall.name === "ResearchComplete") {
      // Execute ResearchComplete
      console.log(chalk.cyan(`[supervisor] `) + `ResearchComplete called`);

      const result = await researchCompleteTool.func({});
      toolMessages.push(new ToolMessage({
        content: result,
        tool_call_id: toolCall.id || "",
        name: "ResearchComplete"
      }));
    }
  }

  // If we have ConductResearch calls, execute actual research
  const conductResearchCalls = most_recent_message.tool_calls.filter(
    call => call.name === "ConductResearch"
  );

  if (conductResearchCalls.length > 0) {
    console.log(chalk.cyan(`[supervisor] `) + `executing research for ${conductResearchCalls.length} topics`);

    // Execute research tasks in parallel
    const researchResults = await Promise.all(
      conductResearchCalls.map(async (toolCall, index) => {
        const topic = toolCall.args["research_topic"] || "";
        console.log(chalk.cyan(`[supervisor] `) + `spawning researcher ${index + 1}/${conductResearchCalls.length}: "${topic.slice(0, 100)}..."`);

        const sup = toSupervisorState({
          messages: [],
          supervisor_messages,
          research_brief: state.research_brief ?? "",
          raw_notes: state.raw_notes ?? [],
          notes: state.notes ?? [],
          final_report: ""
        });
        // Extract a brief supervisor directive from the last assistant content (if any)
        let supervisorDirective = "";
        const lastAssistant = supervisor_messages.slice().reverse().find((m: any) => (m as any)?.role === "assistant");
        if (lastAssistant) {
          supervisorDirective = messageContentToString(lastAssistant).slice(0, 500);
        }
        if (!supervisorDirective) {
          supervisorDirective = `Focus on: ${topic}. Produce credible sources (URLs) and a concise TLDR.`;
        }
        const researcherInput = toResearcherState(sup, topic, {
          research_brief: state.research_brief ?? "",
          supervisor_directive: supervisorDirective,
        });
        const result = await runResearcherSubgraph(researcherInput);

        console.log(chalk.cyan(`[supervisor] `) + `researcher ${index + 1} complete: raw=${result.raw_notes?.length ?? 0}, compressed=${result.compressed_research ? "✓" : "✗"}`);
        return result;
      })
    );

    // Merge results
    const mergedRaw = researchResults.flatMap(r => r.raw_notes || []);
    const mergedNotes = researchResults.map(r => r.compressed_research).filter(Boolean) as string[];

    console.log(chalk.cyan(`[supervisor] `) + `research delegation complete:`);
    console.log(chalk.cyan(`  Total raw notes: ${mergedRaw.length}`));
    console.log(chalk.cyan(`  Compressed notes: ${mergedNotes.length}`));
    if (mergedNotes.length > 0) {
      console.log(chalk.cyan(`  Notes preview: ${mergedNotes.join(" | ").slice(0, 200)}...`));
    }

    return {
      supervisor_messages: toolMessages,  // REPLACE with tool results
      raw_notes: (state.raw_notes ?? []).concat(mergedRaw),
      notes: (state.notes ?? []).concat(mergedNotes),
      research_iterations: research_iterations + 1
    };
  }

  // Continue conversation with tool results (for think_tool or other non-research tools)
  return {
    supervisor_messages: toolMessages,  // REPLACE with tool results
    raw_notes: state.raw_notes ?? [],
    notes: state.notes ?? [],
    research_iterations: research_iterations + 1
  };
}

export const supervisorBuilder = new StateGraph(SupervisorStateAnnotation)
  .addNode("supervisor", supervisor)
  .addNode("supervisor_tools", supervisorTools);

supervisorBuilder.addEdge(START, "supervisor");
supervisorBuilder.addEdge("supervisor", "supervisor_tools");
supervisorBuilder.addConditionalEdges("supervisor_tools", (state: typeof SupervisorStateAnnotation.State) => {
  const iter = Number(state?.research_iterations ?? 0);
  const max = Number(fromRuntimeConfig().max_researcher_iterations ?? 3);
  return iter >= max ? "__end__" : "supervisor";
});

export const supervisorSubgraph = supervisorBuilder.compile();

// Typed helper to invoke the supervisor subgraph without leaking untyped values
export async function runSupervisorSubgraph(
  input: import("../shared/transform.js").SupervisorState
): Promise<{ supervisor_messages: BaseMessageLike[]; raw_notes: string[]; notes: string[]; research_iterations: number }> {
  const g = supervisorSubgraph as unknown as { invoke: (arg: unknown) => Promise<unknown> };
  const out = (await g.invoke(input as unknown)) as unknown as {
    supervisor_messages?: unknown;
    raw_notes?: unknown;
    notes?: unknown;
    research_iterations?: unknown;
  };
  return {
    supervisor_messages: Array.isArray(out?.supervisor_messages) ? (out.supervisor_messages as BaseMessageLike[]) : [],
    raw_notes: Array.isArray(out?.raw_notes) ? (out.raw_notes as string[]) : [],
    notes: Array.isArray(out?.notes) ? (out.notes as string[]) : [],
    research_iterations: Number(out?.research_iterations ?? 0),
  };
}
