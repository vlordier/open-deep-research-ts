# Deep Research (TypeScript)

A TypeScript implementation of the deep research agent using LangGraph for multi-agent orchestration. Currently in alpha with major functionality working.

## Status: Alpha v0.1.5

- ✅ **Working**: Supervisor delegation, parallel researchers, real web search, compression, final reports
- ✅ **Fixed**: Model initialization, tool binding, ResearchComplete termination logic
- 🔧 **Debug**: Enhanced streaming visibility for development and testing (node/tool lifecycle, token streaming, structured retries)
- 🧱 **Resilience**: Retries/timeouts, token-limit truncation, graceful degradation messages
- 🧰 **Optional**: MCP tool loading via `@langchain/mcp-adapters` (feature-flagged)

## Setup

1. Node 18+ (LTS recommended)
2. Install deps:

```
npm install
```

3. Create `.env` in this folder with any keys you have:

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
FIREWORKS_API_KEY=...
XAI_API_KEY=...
```

Optional overrides & config:

```
MODEL_TOKEN_OVERRIDES='{"openai:gpt-5": 400000}'
MODEL_TOKEN_OVERRIDES_PATH=./overrides.json

# MCP (optional)
# Use HTTP/SSE MCP server
MCP_CONFIG='{"url":"http://localhost:8000/mcp","auth_required":false}'
# Or STDIO MCP server (path depends on your server)
# MCP_CONFIG='{"url":"stdio:./your_mcp_server","auth_required":false}'

# Research knobs (have sensible defaults)
# SEARCH_API=tavily|openai|anthropic|duckduckgo|exa|none
# PREFER_NATIVE_SEARCH=true
```

### Recommended model profiles
- **Supervisor / planner**
  - `openai:gpt-5` (default) – most reliable orchestrator with strong tool routing.
  - `anthropic:claude-sonnet-4-20250514` – high quality, fast responses; great balance.
- **Researcher loops**
  - `fireworks:accounts/fireworks/models/kimi-k2-instruct-0905` – lightweight, quick tool-calling model for iterative searches.
  - `fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic` – robust context window, competitive speed.
- **Summaries, compression, final reports**
  - `google:gemini-2.5-flash-preview-05-20` – dependable flash tier for medium-latency summarization.
  - `google:gemini-2.5-flash-preview-09-2025` – latest flash build; same performance profile with improved factuality.
  - `google:gemini-2.5-pro-preview-06-05` – highest quality Gemini option; slower but excellent when accuracy matters.
  - `anthropic:claude-sonnet-4.5-20250929` – fast, articulate summarizer; works well for final reports.

Suggested starting lineup: `gpt-5` supervisor, `kimi-k2-instruct-0905` researcher, and `gemini-2.5-flash-preview-05-20` for compression/final report. Mix and match based on latency vs accuracy needs.

## Scripts

### CLI Usage
```bash
# Run research agent with a query
npm run cli -- "Your research question"

# Example
npm run cli -- "What are the benefits of meditation for stress relief?"
```

### Advanced: override models at runtime

You can run from the compiled `dist/` output or directly from source via `tsx`. Below are concrete examples with provider-qualified model IDs.

From dist (build then run):

```bash
npm run build && \
  RESEARCH_MODEL="fireworks:accounts/fireworks/models/kimi-k2-instruct-0905" \
  SUPERVISOR_MODEL="anthropic:claude-sonnet-4-20250514" \
  SUMMARIZATION_MODEL="google:gemini-2.5-flash-preview-05-20" \
  COMPRESSION_MODEL="fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic" \
  FINAL_REPORT_MODEL="openai:gpt-5" \
  node dist/cli/deepresearch.js \
  "Do some research on the pros and cons of Neon versus Supabase Postgres providers. I want to understand them in terms of security, speed, ease of use. In particular I am interested in how well they work with Vercel and GCP as we are building a SaaS apps that use both environments extensively."
```

From source (no build; uses tsx):

```bash
npx tsx src/cli/deepresearch.ts \
  --research-model fireworks:accounts/fireworks/models/kimi-k2-instruct-0905 \
  --supervisor-model anthropic:claude-sonnet-4-20250514 \
  --summarization-model google:gemini-2.5-flash-preview-05-20 \
  --compression-model fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic \
  --final-report-model openai:gpt-5 \
  "Do some research on the pros and cons of Neon versus Supabase Postgres providers. I want to understand them in terms of security, speed, ease of use. In particular I am interested in how well they work with Vercel and GCP as we are building a SaaS apps that use both environments extensively."

npx tsx src/cli/deepresearch.ts \
  --research-model fireworks:accounts/fireworks/models/kimi-k2-instruct-0905 \
  --supervisor-model anthropic:claude-sonnet-4-20250514 \
  --summarization-model google:gemini-2.5-flash-preview-05-20 \
  --compression-model fireworks:accounts/fireworks/models/llama4-maverick-instruct-basic \
  --final-report-model openai:gpt-5 \
  "Do some research on the pros and cons of AI SDK versus Langchain/Langgraph/Langsmith. What are their strenghts and weaknesses? How are they the same? How are they different. What companies are using them? What major products are using them?"
```

Streaming is enabled by default and shows:
- graph/chain/node lifecycle events
- tool start/end with input/output previews (including Tavily summaries and webpage fetch metadata)
- live model token streams (with automatic newline handling after stream completion)
- retry/degradation logs from the structured error pipeline

### Built-in tool helpers

Need the same behaviour elsewhere? Import our helpers directly:

- `buildTavilySearchTool(options)` – wraps Tavily search with optional in-band summarisation, dependency injection hooks (`loadModule`, `summarization.getModel`), and deterministic result shaping used by the agent.
- `buildReadWebpageTool(options)` – uses `@tavily/core` extract to pull raw page content with timeouts, preview truncation, and error handling baked in.

Both are defined in `src/tools/` and ship with defaults that mirror the agent configuration. Pass your own loggers/models if you embed them in other LangGraph nodes.

### Development
```bash
npm run dev          # Entry point
npm run build        # TypeScript compilation
npm run typecheck    # Type checking only
npm run lint         # ESLint
npm run test         # Unit tests
```

### Testing & Debugging
```bash
# Provider tests
npm run discovery    # List models from all providers
npm run smoke        # Test basic model initialization
npm run smoke:anthropic  # Test Anthropic beta headers

# Component tests
npm run smoke:researcher  # Test single researcher
npm run smoke:agent      # Test full agent flow
```

## Optional: MCP Tools

MCP tools can be loaded at runtime if you:
- Install the adapters: `npm i @langchain/mcp-adapters`
- Run an MCP server (HTTP/SSE or stdio)
- Set `MCP_CONFIG` in `.env` (see above)

Tools discovered from the MCP server are appended to the researcher's tool list automatically. If the package or server is not present, MCP is skipped gracefully.

## User Guide

For full setup details, configuration, MCP usage, troubleshooting, and container tips, see `USER_GUIDE.md`.

## Notes

- Google universal provider is `google-genai`.
- Anthropic 1M context requires beta header; toggle via config or use the smoke script.
- Kimi-K2 runs via Fireworks (`kimi-k2-instruct-0905`).
- xAI Grok examples: `grok-4-0709`, `grok-code-fast-1`.
