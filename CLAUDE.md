# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm install          # Install dependencies (uses npm, not pnpm despite lockfile presence)
npm run build        # Compile TypeScript → dist/ (tsc)
npm run dev          # Development mode with watch (tsx watch)
npm start            # Run compiled CLI: node dist/cli/index.js
npm run typecheck    # Type-check without emitting: tsc --noEmit
```

The CLI accepts flags: `neonity -m <model> -p <provider> --router`

### Web Projects

Two independent Next.js 16 apps live at the repo root:

- **`site/`** — Pure static landing page (Hero + Features, dark theme, en/zh). Builds to flat HTML via `output: 'export'`. Zero backend. `cd site && npm run dev`
- **`web-ui/`** — Agent Web UI (chat interface with SSE streaming). Depends on `neonity-agent` core via `file:..`. Has API routes (`/api/chat`). `cd web-ui && npm run dev`

## Architecture

This is a lightweight AI coding agent framework implementing the **REACT pattern** (Reason → Act → Observe). TypeScript, ESM-only (`"type": "module"`), targets ES2022 with Node16 module resolution.

### Core Flow

```
CLI (src/cli/) → AgentLoop (src/agent/loop.ts) → ProviderTransport (src/provider/) → LLM API
                                                       ↕
                                               ToolHandler (src/tool/)
```

**AgentLoop** is the central orchestrator. Each `run()` call:
1. Injects SOUL.md, MEMORY.md, and model info into the system prompt
2. Sends messages to the appropriate provider transport
3. Streams back the LLM response
4. Executes tool calls in parallel
5. Repeats until no tool calls remain or max iterations hit
6. Trims context at 80% of model's context window (FIFO)

### Key Modules

- **`src/types.ts`** — All shared types: `Model`, `Message`, `StreamEvent`, `ToolCall`, `ProviderTransport`, etc.
- **`src/agent/loop.ts`** — REACT loop: streaming, tool execution, context protection, system prompt assembly
- **`src/provider/`** — Provider transports implementing `ProviderTransport.stream()`. Each wraps an SDK (openai, @anthropic-ai/sdk, @google/generative-ai). GLM and MiniMax use OpenAI-compatible API via `baseUrl` override.
- **`src/provider/registry.ts`** — Maps `ProviderName` → `ProviderTransport`. Auto-registers all built-in providers.
- **`src/provider/helpers.ts`** — Message format conversion (`toOpenAIMessages`, `toAnthropicMessages`, etc.) and tool ID generation
- **`src/tool/`** — Built-in tools implementing `ToolHandler` (terminal, read_file, write_file, git_*, ls, memory_*, soul_*)
- **`src/context/manager.ts`** — Token estimation (Chinese-aware heuristic: 0.5 token/char Chinese, 0.25 for English) and FIFO trimming at 80% context threshold
- **`src/cli/index.ts`** — Interactive REPL with chalk-colored output, markdown rendering (marked-terminal), `<think/>` block detection (ThinkRenderer), and slash commands
- **`src/cli/models.ts`** — Model registry (`MODELS` record) with metadata (context window, cost, provider mapping)
- **`src/event-stream.ts`** — Push-based `AsyncIterable` for streaming LLM events to consumers
- **`src/memory/`** — Long-term memory persisted to `~/.neonity-agent/MEMORY.md` (§-delimited entries, loaded into system prompt)
- **`src/soul/`** — Agent personality persisted to `~/.neonity-agent/SOUL.md` (same format as memory)
- **`src/router/index.ts`** — `CostRouter`: FrugalGPT-style model routing that classifies query complexity via cheap model, escalates to expensive model if score >= threshold

### Provider System

Each provider implements `ProviderTransport` with a single `stream()` method returning `AsyncIterable<StreamEvent>`. The `ApiMode` determines message format conversion:
- `"openai"` — OpenAI, GLM, MiniMax (all use OpenAI SDK with `baseUrl` override for compat providers)
- `"anthropic"` — Anthropic Messages API
- `"gemini"` — Google Generative AI

API keys come from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GLM_API_KEY`, `MINIMAX_API_KEY`) loaded via dotenv.

### Cost Router (`--router` flag)

When enabled, classifies each user query with the cheap model (MiniMax M2.7), then routes to either the cheap model or the expensive model (GLM-5.1) based on a complexity score (1-5, threshold default 4). Strategies: `pre-classify`, `always-cheap`, `always-expensive`.

## Conventions

- Module system: ESM only. Imports use `.js` extensions (TypeScript Node16 resolution requirement).
- No test framework is configured. There are standalone test files (`test-router.ts`, `test-visual.ts`) run with `tsx`.
- Subdirectories at the repo root (`api-key-manager/`, `emergence-novel/`, `geometry-kids/`, `maxwell-equations/`, `oauth-jwt-security/`) are independent demo/example projects, not part of the main build.
