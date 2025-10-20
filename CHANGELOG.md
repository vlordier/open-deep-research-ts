# Changelog

All notable changes to the Deep Research TypeScript implementation.

## [Unreleased]

## [0.1.5] - 2025-10-18

### Parity & Dependencies
- Aligned `langchain`, `@langchain/core`, `@langchain/langgraph`, and `@langchain/community` versions with the agents-playground reference implementation (LangChain 0.3.36 / LangGraph 0.4.9).
- Added `@tavily/core` as a direct dependency for the new webpage extraction tool helper.

### Tooling & Runtime
- Exported `buildTavilySearchTool` and `buildReadWebpageTool` for reuse in custom LangGraph nodes; both support dependency-injection hooks for tests and alternate runtimes.
- Updated prompt loader to resolve files from the current project root before falling back to the legacy `deep_research/prompts` path.

### CLI
- Official CLI entry point now lives at `dist/cli/deepresearch.js`; TypeScript runs via `src/cli/deepresearch.ts`.
- Streaming logs now cover graph/chain lifecycle events, Tavily summaries, webpage fetch previews, and structured retry diagnostics.

### Docs
- README and User Guide now reference the new tool helpers, CLI entry points, and configuration knobs (`CLI_SKIP_CLARIFICATION`, summarisation controls, etc.).
- Added attribution noting this TypeScript port is based on the LangChain [Open Deep Research](https://github.com/langchain-ai/open_deep_research) project with additional TS-specific improvements.


## [0.1.4] - 2025-09-17

### Parity & UX
- Restored 500-char guard for web summarization to avoid wasteful model calls on short pages; retained `max_content_length` slicing for longer pages.
- Removed fixed 80-note cap for researcher; rely on token-limit handling in compression.
- Chalked CLI logs for web summarization start/warn/end.

## [0.1.3] - 2025-09-17

### Parity & Behavior
- Web summarization parity with Python: Tavily path now requests raw content and runs LLM summarization on top results; summaries replace snippets (timeouts + fallbacks).
- `summarize_webpage.md` prompt aligned with Python’s `summarize_webpage_prompt` (full guidelines and examples).
- Native websearch detection mirrors Python strictly:
  - OpenAI: `additional_kwargs.tool_outputs[].type === "web_search_call"`
  - Anthropic: `response_metadata.usage.server_tool_use.web_search_requests > 0`

### Researcher UX
- First turn is action‑first; clarified “do not ask for clarification; search first; think after search”.
- Per‑turn system prompt injects topic/brief/progress and guidance to call `ResearchComplete` when coverage is sufficient (no numeric hard caps presented to the model).
- `think_tool` description enriched (when to use, what to address, use only after search).

### CLI & Lint
- Fixed env access (TS4111) and argv indexing guards in CLI.

## [0.1.2] - 2025-09-17

### Streaming & Visibility
- CLI now shows graph/chain start/end markers and phase highlights (compression/report)
- Newline after token streaming for clean logs
- Tool input pretty-printing and object output previews
- Tool error display for easier debugging

### Type Safety
- Generic `invokeWithRetry<M extends BaseMessageLike, R>`; removed remaining `any` casts in graphs
- Typed provider router API key/base URL resolution

### Resilience
- Model retries with exponential backoff and per-attempt timeouts
- Centralized error helpers: timeout, rate limit, network, token-limit detection
- Search tool wrapped with timeout and concise error preview

### Token-Limit Handling
- Compression retries with progressive truncation
- Final report retries with progressive findings truncation
- Graceful degradation messages when retries are exhausted

### Native Websearch (Config-Gated)
- Detect OpenAI/Anthropic native websearch calls (no graph changes)

### MCP (Optional, Feature-Flagged)
- Dynamic loader via `@langchain/mcp-adapters` (if installed)
- Tools fetched from `MCP_CONFIG.url` and appended to researcher tool list
- `get_langchain_tools` made async; researcher binds MCP tools automatically when present

### Guardrails & Logging
- Researcher logs when `raw_notes` are truncated to last 80 items

### Docs
- README updated with MCP examples and streaming notes
- Added `docs/USER_GUIDE.md` with setup, keys, CLI, MCP, Docker, troubleshooting

## [0.1.1] - 2025-09-16

### Architecture Improvements
- **Supervisor rewrite**: Converted from complex JSON action parsing to natural LangChain tool calling
- **Python pattern adoption**: Implemented ping-pong message replacement to prevent conversation explosion
- **Tool binding**: Proper LangChain DynamicStructuredTool integration with type safety

### Core Fixes
- **Model initialization**: Fixed LangChain `initChatModel()` undefined parameter handling
- **ResearchComplete detection**: Added boolean flag in state to properly terminate research loops
- **Tool call flow**: Fixed INVALID_TOOL_RESULTS errors with proper ToolMessage responses
- **Message management**: Eliminated exponential message growth (3→12→48→192→768→...)

### Enhanced Visibility
- **CLI streaming**: Added full tool arguments and result previews
- **Model tokens**: Robust chunk format handling for GPT-5 streaming
- **Process logging**: Compression and final report I/O visibility with previews
- **Parallel tracking**: Supervisor delegation progress with individual researcher status

### Tool System
- **ConductResearch tool**: Added proper supervisor delegation tool matching Python
- **Enhanced descriptions**: Improved tool docstrings for better model understanding
- **Search tools**: Real LangChain tool integration with Tavily web search
- **Type safety**: Removed `any` casts with proper interface definitions

### Bug Fixes
- **Infinite loops**: Fixed supervisor think_tool bias and researcher termination
- **JSON parsing**: Handle multiple JSON objects in model responses
- **Token limits**: Prevent conversation explosion with proper state management
- **Error handling**: Enhanced debugging with stack traces and detailed logging

### Development
- **TypeScript strict**: Proper typing throughout with minimal type assertions
- **Linting**: Zero warnings with ESLint configuration
- **Testing**: Multiple smoke tests for component validation

## [0.1.0] - 2025-09-13

### Initial Implementation
- Basic LangGraph architecture with supervisor and researcher subgraphs
- Provider system supporting OpenAI, Anthropic, Google, xAI, Fireworks
- Search integration with Tavily API
- Configuration management with Zod validation
- Unit test framework with comprehensive JSON repair testing

---

**Status**: Alpha software under active development. Core functionality working but ongoing refinements for robustness and user experience.