# Deep Research – User Guide

Version: 0.1.5

## 1. Requirements
- Node.js 18+
- Provider API keys (as available): OpenAI, Anthropic, Google, Fireworks, xAI
- Optional: MCP server (HTTP/SSE or stdio) and @langchain/mcp-adapters

## 2. Installation
```bash
npm install
```

## 3. Configuration (.env)
Create a file named `.env` in the project root.

Minimum (use what you have):
```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
FIREWORKS_API_KEY=...
XAI_API_KEY=...
```

Optional overrides & knobs:
```bash
# Model token overrides (approximate or exact overrides)
MODEL_TOKEN_OVERRIDES='{"openai:gpt-5": 400000}'
MODEL_TOKEN_OVERRIDES_PATH=./overrides.json

# Search provider selection
# Allowed: anthropic|openai|tavily|duckduckgo|exa|none
SEARCH_API=tavily

# Prefer provider-native websearch detection (OpenAI/Anthropic)
PREFER_NATIVE_SEARCH=true

# Model assignments (override defaults as needed)
SUPERVISOR_MODEL=openai:gpt-5
RESEARCH_MODEL=fireworks:accounts/fireworks/models/kimi-k2-instruct-0905
SUMMARIZATION_MODEL=google:gemini-2.5-flash-preview-05-20
COMPRESSION_MODEL=fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic
FINAL_REPORT_MODEL=openai:gpt-5

# Webpage summarization (enabled by default)
SUMMARIZATION_ENABLED=true
SUMMARIZATION_MAX_ITEMS=3
SUMMARIZATION_TIMEOUT_MS=60000

# Optional: skip interactive clarification (non-TTY contexts)
CLI_SKIP_CLARIFICATION=false
```

Notes:
- With summarization enabled, Tavily is queried with `includeRawContent=true`, and top results are summarized via the `summarize_webpage.md` prompt using the configured `summarization_model`.
- Native websearch detection mirrors the Python logic: OpenAI via `additional_kwargs.tool_outputs`, Anthropic via `response_metadata.usage.server_tool_use`.

### Recommended model choices
- **Supervision / orchestration**
  - `openai:gpt-5` – battle-tested default; excellent planning and tool routing.
  - `anthropic:claude-sonnet-4-20250514` – strong alternative with fast response and reliable tool calling.
- **Researcher / high-parallel workloads**
  - `fireworks:accounts/fireworks/models/kimi-k2-instruct-0905` – fast, low latency researcher; great for iterative tool loops.
  - `fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic` – balanced quality with generous context, cost-effective for bulk queries.
- **Summarization / compression / final report**
  - `google:gemini-2.5-flash-preview-05-20` – strong summarizer with medium latency; great for compression and report stages.
  - `google:gemini-2.5-flash-preview-09-2025` – same flash stack, newest alignment tweaks; use when available for slight quality bump.
  - `google:gemini-2.5-pro-preview-06-05` – highest quality Gemini profile (slower); ideal when accuracy matters more than speed.
  - `anthropic:claude-sonnet-4.5-20250929` – excellent summarizer/final-report writer with rapid turnaround.
  - `anthropic:claude-sonnet-4-20250514` – still a fast, reliable fallback for summarization tasks if 4.5 is unavailable.

Tip: mix and match. For example, run `gpt-5` as supervisor, `kimi-k2-instruct-0905` as researcher, and `gemini-2.5-flash-preview-05-20` for summarization/compression to balance speed and accuracy.

### MCP (optional)
Install adapters:
```bash
npm i @langchain/mcp-adapters
```
Run an MCP server (your process/container), then set:
```bash
# HTTP/SSE server
MCP_CONFIG='{"url":"http://localhost:8000/mcp","auth_required":false}'
# or STDIO server (example path)
# MCP_CONFIG='{"url":"stdio:./your_mcp_server","auth_required":false}'
```
At runtime we dynamically connect and append tools from the server to the researcher's tool list.
If the adapters package or server is missing/unreachable, MCP is skipped gracefully.

## 4. Run via CLI
```bash
npm run cli -- "Your research question"
```
Examples:
```bash
npm run cli -- "Best compact under-desk exercise bikes available in Europe"
```

Under the hood the compiled entry point is `dist/cli/deepresearch.js`. For direct TypeScript execution (useful during development) run:

```bash
npx tsx src/cli/deepresearch.ts --help
```

Streaming shows:
- Graph/chain/node start/end markers
- Tool start/end with input/output previews (Tavily summaries, webpage extracts, etc.)
- Live token stream for model responses (a newline is appended once streaming completes)
- Retry/degradation logs from the structured error pipeline

## 5. Testing
- `npm run test` compiles TypeScript and runs only `*.test.ts` unit suites under `tests/` (output emitted to `dist/tests/**`).
- Smoke checks live in `tests/smoke/`; each script is runnable through dedicated npm commands such as `npm run smoke`, `npm run smoke:agent`, `npm run smoke:anthropic`, etc. These remain integration-style probes and are intentionally excluded from `npm run test` so they do not fail CI when credentials are unavailable.
- The legacy operational utilities stay in `scripts/` (currently only `cli.ts` plus any data fixtures). If you add new maintenance utilities, prefer `tests/smoke/` for health checks and `tests/unit/` (or the root `tests/`) for deterministic unit coverage.

### Candidate areas for more unit coverage
- `src/shared/config.ts`: exercise configuration fallbacks, environment overrides, and error branches without mocking models.
- `src/shared/messages.ts` and `src/shared/transform.ts`: pure transformations suitable for table-driven tests.
- `src/shared/time.ts` and `src/shared/state.ts`: helpers with predictable outputs that can be verified without network access.
- `src/providers/types.ts` and `src/providers/universal.ts`: validation logic around provider selection can use fixture inputs to ensure graceful degradation.

## 6. What happens during a run
- Supervisor plans and may delegate topics to researchers
- Researchers use tools (search, MCP tools if configured, think_tool) with strict tool-calling contract
- Raw notes gathered -> compressed -> supervisor aggregates -> final report generated

## 7. Resilience & Guardrails
- Retries with exponential backoff and timeouts for model calls
- Token-limit handling with progressive truncation (compression & final report)
- Graceful degradation strings when retries are exhausted
- Raw notes window capping with warning logs

## 8. Native Websearch (OpenAI/Anthropic)
If `PREFER_NATIVE_SEARCH=true`, the researcher respects provider-native websearch calls (detected heuristically) even if LangChain `tool_calls` are absent.

## 9. Docker (basic example)
```dockerfile
# Dockerfile (example)
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "dist/cli/deepresearch.js", "Research topic"]
```
Build & run:
```bash
docker build -t deep-research .
docker run --rm -e OPENAI_API_KEY -e MCP_CONFIG deep-research
```

## 10. Troubleshooting
- "@langchain/mcp-adapters not installed; skipping MCP tools": install the package or remove MCP_CONFIG
- Token/context limit errors: agent will retry and truncate; check logs for truncation notices
- Rate limits (429): retries apply with extended backoff; consider provider quotas
- No final report: ensure provider keys are set; see CLI end-of-run summary

## 11. References
- LangGraphJS & LangChain TS
- Model Context Protocol (MCP) servers
- Tavily Search / Extract APIs

## 12. Extending built-in tools

Reusable helpers live in `src/tools/`:

- `buildTavilySearchTool(options)` – wraps Tavily search with optional summarisation and dependency-injection hooks (`loadModule`, `summarization.getModel`).
- `buildReadWebpageTool(options)` – uses `@tavily/core` extract to fetch raw page content with configurable timeouts and truncation limits.

They power the agent by default but can also be imported into custom LangGraph nodes, web handlers, or tests.

## 13. Customising prompts

Prompts live in `prompts/` at the project root. The loader first checks that directory and only falls back to the legacy `deep_research/prompts` location if necessary. Modify or add markdown prompts there to override copy used by the CLI and agent flows.
