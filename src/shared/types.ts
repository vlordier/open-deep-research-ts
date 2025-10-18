export interface ConductResearch {
  research_topic: string;
}

export interface ResearchComplete {}

export interface Summary {
  summary: string;
  key_excerpts: string;
}

export interface ClarifyWithUser {
  need_clarification: boolean;
  question: string;
  verification: string;
}

export interface ResearchQuestion {
  research_brief: string;
}

export type SupervisorAction =
  | { action: "ConductResearch"; topics: string[] }
  | { action: "ResearchComplete" }
  | { action: "think_tool"; reflection?: string };

export interface ToolSearchProposal {
  tool: "search";
  args: { query: string };
}
