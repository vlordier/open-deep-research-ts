import { createAgentGraph } from "./agent/graph";

async function main() {
  const graph = createAgentGraph();
  await graph.invoke({ messages: [] });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
