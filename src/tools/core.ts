import { loadPrompt } from "../prompts/loader.js";
import type { ClarifyWithUser, ConductResearch, ResearchComplete } from "../shared/types";
import { currentDateString } from "../shared/time.js";

/** Build clarify-with-user prompt with injected variables. */
export async function buildClarifyWithUserPrompt(messagesMarkdown: string): Promise<string> {
  const date = currentDateString();
  return loadPrompt("clarify_with_user.md", { date, messages: messagesMarkdown });
}

/** Build lead researcher supervisor system prompt. */
export async function buildLeadResearcherPrompt(params: {
  max_researcher_iterations: number;
  max_concurrent_research_units: number;
}): Promise<string> {
  const date = currentDateString();
  return loadPrompt("lead_researcher.md", {
    date,
    max_researcher_iterations: String(params.max_researcher_iterations),
    max_concurrent_research_units: String(params.max_concurrent_research_units),
  });
}

/** Build researcher system prompt (tools loop). */
export async function buildResearchSystemPrompt(mcpPromptSection: string): Promise<string> {
  const date = currentDateString();
  return loadPrompt("research_system.md", { date, mcp_prompt: mcpPromptSection });
}

/** Build compression system prompt. */
export async function buildCompressResearchPrompt(): Promise<string> {
  const date = currentDateString();
  return loadPrompt("compress_research.md", { date });
}

/** Build final report generation prompt. */
export async function buildFinalReportPrompt(args: {
  research_brief: string;
  messages: string;
  findings: string;
}): Promise<string> {
  const date = currentDateString();
  return loadPrompt("final_report.md", { date, ...args });
}

// Tool definitions for researcher
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";

/** ResearchComplete tool - signals researcher has gathered sufficient information */
export const researchCompleteTool = new DynamicStructuredTool({
  name: "ResearchComplete",
  description: "Call this when you have gathered sufficient information to thoroughly answer the research topic. Only call when you are confident you have comprehensive, reliable sources and can provide a complete answer.",
  schema: z.object({}),
  func: async () => {
    return "Research task completed successfully.";
  }
});

/** ConductResearch tool - delegates research to sub-agents like Python */
export const conductResearchTool = new DynamicStructuredTool({
  name: "ConductResearch",
  description: "Delegate a specific research topic to a specialized sub-agent researcher. Use this to break down complex research into focused investigation areas. Each sub-agent will conduct thorough research and return findings.",
  schema: z.object({
    research_topic: z.string().describe("Specific, focused research topic for the sub-agent to investigate thoroughly")
  }),
  func: async ({ research_topic }: { research_topic: string }) => {
    return `Research delegated: ${research_topic}`;
  }
});

/** Think tool for strategic reflection during research */
export const thinkTool = new DynamicStructuredTool({
  name: "think_tool",
  description: "Strategic reflection tool for research planning.\n\nWhen to use:\n- After receiving search results: What key information did I find?\n- Before deciding next steps: Do I have enough to answer comprehensively?\n- When assessing research gaps: What specific information is still missing?\n- Before concluding research: Can I provide a complete answer now?\n\nYour reflection should address:\n1) Analysis of current findings (concrete facts, URLs)\n2) Gap assessment (what is missing and why it matters)\n3) Quality evaluation (are sources credible/diverse?)\n4) Strategic decision (continue searching vs. call ResearchComplete).\n\nImportant: Use think_tool AFTER a search to reflect; do not use it before the first search.",
  schema: z.object({
    reflection: z.string().describe("Your detailed analysis of current research progress, what you've learned so far, what gaps remain, and what your next steps should be")
  }),
  func: async ({ reflection }: { reflection: string }) => {
    return `Reflection recorded: ${reflection}`;
  }
});

// Placeholders for structured outputs to keep types nearby
export type { ClarifyWithUser, ConductResearch, ResearchComplete };
