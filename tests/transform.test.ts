import test from "node:test";
import assert from "node:assert/strict";
import {
  toSupervisorState,
  toResearcherState,
  toAgentFromResearcher,
} from "../src/shared/transform.js";
import type { AgentState, SupervisorState } from "../src/shared/transform.js";

test("toSupervisorState maps agent fields with defaults", () => {
  const agent: AgentState = {
    messages: [] as any,
    supervisor_messages: [{ content: "hi" } as any],
    research_brief: "brief",
    raw_notes: ["raw"],
    notes: ["note"],
  };
  const supervisor = toSupervisorState(agent);
  assert.deepEqual(supervisor, {
    supervisor_messages: [{ content: "hi" }],
    research_brief: "brief",
    notes: ["note"],
    research_iterations: 0,
    raw_notes: ["raw"],
  });
});

test("toSupervisorState fills missing optional fields", () => {
  const agent: AgentState = {
    messages: [] as any,
    supervisor_messages: [] as any,
    raw_notes: [] as any,
    notes: [] as any,
  };
  const supervisor = toSupervisorState(agent);
  assert.deepEqual(supervisor, {
    supervisor_messages: [],
    research_brief: "",
    notes: [],
    research_iterations: 0,
    raw_notes: [],
  });
});

test("toResearcherState seeds topic and optional extras", () => {
  const supervisorState: SupervisorState = {
    supervisor_messages: [],
    research_brief: "ignored",
    notes: [],
    research_iterations: 0,
    raw_notes: [],
  };
  const state = toResearcherState(
    supervisorState,
    "topic",
    { research_brief: "brief", supervisor_directive: "directive" }
  );
  assert.deepEqual(state, {
    researcher_messages: [],
    tool_call_iterations: 0,
    research_topic: "topic",
    raw_notes: [],
    research_brief: "brief",
    supervisor_directive: "directive",
  });
});

test("toAgentFromResearcher aggregates notes and raw notes", () => {
  const aggregated = toAgentFromResearcher([
    { compressed_research: "note1", raw_notes: ["raw1"] },
    { compressed_research: "", raw_notes: [] },
    { compressed_research: undefined as any, raw_notes: ["raw2"] },
    { compressed_research: "note2", raw_notes: undefined as any },
  ]);
  assert.deepEqual(aggregated, {
    raw_notes: ["raw1", "raw2"],
    notes: ["note1", "note2"],
  });
});

