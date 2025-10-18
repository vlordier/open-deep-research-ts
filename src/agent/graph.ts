import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { AgentStateAnnotation } from "../shared/state.js";
import { runSupervisorSubgraph } from "../supervisor/graph.js";
import { fromRuntimeConfig } from "../shared/config.js";
import { createModel } from "../providers/router.js";
import { buildFinalReportPrompt, buildClarifyWithUserPrompt } from "../tools/core.js";
import { parseJsonSafely } from "../shared/json.js";
import { toSupervisorState } from "../shared/transform.js";
import type { AgentState as AgentStateShape } from "../shared/transform.js";
import type { BaseMessageLike } from "@langchain/core/messages";
import { messageContentToString, extractTextFromResponse } from "../shared/messages.js";
import { isTokenLimitError } from "../shared/errors.js";
import { getModelTokenLimit } from "../shared/models.js";
import { invokeWithRetry } from "../shared/invoke.js";
import type { ClarifyWithUser } from "../shared/types.js";
import chalk from "chalk";

/**
 * Main Agent graph (parent) that embeds the Supervisor subgraph.
 * Checkpointer is applied only at the parent compile to persist state across steps.
 */
async function clarifyWithUser(state: typeof AgentStateAnnotation.State): Promise<{ messages: BaseMessageLike[] }> {
  const cfg = fromRuntimeConfig();
  // If clarification disabled, continue
  if (!cfg.allow_clarification) return { messages: state.messages ?? [] };
  try {
    const model = await createModel(cfg.research_model, cfg);
    // Build a simple transcript string from prior messages if present
    const transcript = Array.isArray(state.messages)
      ? state.messages.map((m) => messageContentToString(m)).join("\n\n")
      : "";
    const prompt = await buildClarifyWithUserPrompt(transcript);
    const resp: unknown = await invokeWithRetry<BaseMessageLike, unknown>(model, [{ role: "user", content: prompt }] as BaseMessageLike[], {
      label: "clarify.invoke",
      attempts: 3,
      timeoutMs: 30000,
      backoffMs: 1000,
    });
    const text = extractTextFromResponse(resp);
    const parsed = parseJsonSafely<ClarifyWithUser>(text);
    if (parsed?.need_clarification && parsed?.question) {
      const msg = `Clarification needed: ${parsed.question}`;
      return { messages: (state.messages ?? []).concat([{ role: "assistant", content: msg }]) };
    }
    if (parsed?.verification) {
      return { messages: (state.messages ?? []).concat([{ role: "assistant", content: parsed.verification }]) };
    }
  } catch {
    // Ignore failures and continue
  }
  return { messages: state.messages ?? [] };
}

async function writeResearchBrief(_state: typeof AgentStateAnnotation.State): Promise<{ research_brief: string }> {
  // Keep provided brief if present; otherwise a placeholder
  const brief = _state.research_brief ?? "";
  return { research_brief: brief };
}

async function runSupervisor(state: typeof AgentStateAnnotation.State): Promise<{ supervisor_messages: BaseMessageLike[]; raw_notes: string[]; notes: string[]; research_iterations: number }> {
  const agentShape: AgentStateShape = {
    messages: state.messages ?? [],
    supervisor_messages: state.supervisor_messages ?? [],
    research_brief: state.research_brief ?? "",
    raw_notes: state.raw_notes ?? [],
    notes: state.notes ?? [],
    final_report: state.final_report ?? "",
  };
  const sup = toSupervisorState(agentShape);
  const result = await runSupervisorSubgraph(sup);
  return result;
}

async function finalReportGeneration(state: typeof AgentStateAnnotation.State): Promise<{ final_report: string }> {
  const cfg = fromRuntimeConfig();
  let findings = (state.notes ?? []).join("\n\n");
  console.log(chalk.blue(`[agent] `) + `final report generation start:`);
  console.log(chalk.blue(`  Research brief: ${(state.research_brief ?? "").length} chars`));
  console.log(chalk.blue(`  Findings: ${state.notes?.length ?? 0} notes, ${findings.length} chars`));
  console.log(chalk.blue(`  Findings preview: ${findings.slice(0, 300)}${findings.length > 300 ? "..." : ""}`));

  try {
    const model = await createModel(cfg.final_report_model, cfg);
    console.log(chalk.blue(`[agent] `) + `invoking final report model: ${cfg.final_report_model}`);

    let attempts = 0;
    const maxAttempts = 3;
    let findingsCharLimit: number | null = null;

    while (attempts < maxAttempts) {
      attempts += 1;
      const prompt = await buildFinalReportPrompt({
        research_brief: state.research_brief ?? "",
        messages: JSON.stringify(state.messages ?? []),
        findings,
      });
      try {
        const resp: unknown = await model.invoke([{ role: "user", content: prompt }] as BaseMessageLike[]);
        const text: string = extractTextFromResponse(resp);
        console.log(chalk.blue(`[agent] `) + `final report generated:`);
        console.log(chalk.blue(`  Output length: ${text.length} chars`));
        console.log(chalk.blue(`  Output preview: ${text.slice(0, 300)}${text.length > 300 ? "..." : ""}`));
        return { final_report: text };
      } catch (e) {
        if (isTokenLimitError(e)) {
          if (findingsCharLimit == null) {
            const maxTokens = getModelTokenLimit(cfg.final_report_model, { anthropicLongContextBeta: cfg.anthropic_long_context_beta });
            findingsCharLimit = Math.max(1000, maxTokens * 4);
          } else {
            findingsCharLimit = Math.floor(findingsCharLimit * 0.9);
          }
          const before = findings.length;
          findings = findings.slice(0, findingsCharLimit);
          console.warn(chalk.yellow(`[agent] `) + `Token limit during final report; truncating findings ${before} -> ${findings.length} and retrying (${attempts}/${maxAttempts})`);
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    console.error(chalk.blue(`[agent] `) + "final report failed:", (e as Error).message);
    console.error(chalk.blue(`[agent] `) + "final report stack:", (e as Error).stack);
  }
  // Graceful degradation mirroring original: explicit fallback message
  return { final_report: "Error generating final report: Maximum retries exceeded" };
}

export const agentBuilder = new StateGraph(AgentStateAnnotation)
  .addNode("clarify_with_user", clarifyWithUser)
  .addNode("write_research_brief", writeResearchBrief)
  .addNode("research_supervisor", runSupervisor)
  .addNode("final_report_generation", finalReportGeneration)
  .addEdge(START, "clarify_with_user")
  .addEdge("clarify_with_user", "write_research_brief")
  .addEdge("write_research_brief", "research_supervisor")
  .addEdge("research_supervisor", "final_report_generation")
  .addEdge("final_report_generation", END);

export function createAgentGraph() {
  const checkpointer = new MemorySaver();
  return agentBuilder.compile({ checkpointer });
}
