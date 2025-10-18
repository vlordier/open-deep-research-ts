#!/usr/bin/env tsx
// Mermaid visualizer for deep_research main agent and its subgraphs
// Usage: npx tsx agents/deep_research/scripts/print-graph.ts

import { createAgentGraph } from "../../src/agent/graph.js";
import { supervisorBuilder, supervisorSubgraph } from "../../src/supervisor/graph.js";

async function main() {
  try {
    // Get the compiled main agent graph
    const graph = createAgentGraph();
    // Use LangGraph's visualization helpers if available
    const representation: any = (graph as any)?.getGraph?.() ?? graph;

    // Output the actual Mermaid representation
    console.log("=== DEEP_RESEARCH MAIN AGENT GRAPH ===");

    // Try to get Mermaid string directly
    const hasDraw = typeof representation?.drawMermaid === "function";
    if (hasDraw) {
      const mermaidStr = representation.drawMermaid();
      console.log(mermaidStr);
      return;
    }
    // Fallback: analyze the representation object safely
    const nodes: Array<{ id: string }> = Array.isArray(representation?.nodes) ? representation.nodes : [];
    const edges: Array<{ source: string; target: string }> = Array.isArray(representation?.edges) ? representation.edges : [];
    console.log("Graph nodes:", nodes.map((n) => n.id));
    console.log("Graph edges:", edges.map((e) => `${e.source} -> ${e.target}`));

    // Manual Mermaid from actual structure
    const mermaid = [
      "graph TD",
      ...nodes.map((n) => `  ${n.id}[\"${n.id}\"]`),
      ...edges.map((e) => `  ${e.source} --> ${e.target}`),
    ].join("\n");
    console.log(mermaid);

    // Also print the supervisor subgraph
    console.log("\n=== SUPERVISOR SUBGRAPH ===");
    const supRep: any = (supervisorBuilder as any)?.getGraph?.() ?? (supervisorSubgraph as any)?.getGraph?.() ?? supervisorSubgraph;
    const supHasDraw = typeof supRep?.drawMermaid === "function";
    if (supHasDraw) {
      console.log(supRep.drawMermaid());
    } else {
      const sNodes: Array<{ id: string }> = Array.isArray(supRep?.nodes) ? supRep.nodes : [];
      const sEdges: Array<{ source: string; target: string }> = Array.isArray(supRep?.edges) ? supRep.edges : [];
      const supMermaid = [
        "graph TD",
        ...sNodes.map((n) => `  ${n.id}[\"${n.id}\"]`),
        ...sEdges.map((e) => `  ${e.source} --> ${e.target}`),
      ].join("\n");
      console.log(supMermaid);
    }

  } catch (e) {
    console.error("Failed to generate graph visualization:", e);
    console.log("=== FALLBACK: Manual inspection needed ===");
    console.log("Check graph_streaming.ts for actual structure");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


