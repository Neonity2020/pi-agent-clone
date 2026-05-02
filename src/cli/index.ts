#!/usr/bin/env node
// ============================================================================
// pi-agent-clone — Interactive REPL
// ============================================================================

// Suppress punycode deprecation warning from openai SDK on Node.js 22+
process.removeAllListeners("warning");

import "dotenv/config";
import * as readline from "readline";
import { AgentLoop } from "../agent/loop.js";
import { listProviders } from "../provider/registry.js";
import { terminalTool, readFileTool, writeFileTool } from "../tool/index.js";
import type { AgentConfig, AgentEvent, Model, ProviderName } from "../types.js";

// ---- Built-in models -------------------------------------------------------

const MODELS: Record<string, Model> = {
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    api: "openai",
    contextWindow: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 2.5, outputPerMillion: 10 },
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    api: "openai",
    contextWindow: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    api: "anthropic",
    contextWindow: 200000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 3, outputPerMillion: 15 },
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    api: "gemini",
    contextWindow: 1000000,
    maxTokens: 65536,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  "glm-5.1": {
    id: "glm-5.1",
    name: "GLM-5.1",
    provider: "glm",
    api: "openai",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.05, outputPerMillion: 0.05 },
  },
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM-4.7",
    provider: "glm",
    api: "openai",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.0001, outputPerMillion: 0.0001 },
  },
  "MiniMax-M2.7": {
    id: "MiniMax-M2.7",
    name: "MiniMax M2.7",
    provider: "minimax",
    api: "openai",
    baseUrl: "https://api.minimax.chat/v1",
    contextWindow: 1000000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
  },
};

// ---- Parse CLI args --------------------------------------------------------

function parseArgs(): { model: string; provider?: string } {
  const args = process.argv.slice(2);
  let model = process.env.DEFAULT_MODEL || "glm-4-flash";
  let provider: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" || args[i] === "-m") {
      model = args[++i];
    } else if (args[i] === "--provider" || args[i] === "-p") {
      provider = args[++i];
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
pi-agent-clone v0.1.0 — AI coding agent

Usage: pi-clone [options]

Options:
  -m, --model <name>     Model to use (default: glm-4-flash)
  -p, --provider <name>  Provider to use
  -h, --help             Show this help

Available models:
${Object.entries(MODELS)
  .map(([k, v]) => `  ${k.padEnd(30)} ${v.name} (${v.provider})`)
  .join("\n")}

Available providers: ${listProviders().join(", ")}

Environment variables:
  OPENAI_API_KEY      OpenAI API key
  ANTHROPIC_API_KEY   Anthropic API key
  GEMINI_API_KEY      Google Gemini API key
  GLM_API_KEY         智谱 AI API key
  MINIMAX_API_KEY     MiniMax API key
`);
      process.exit(0);
    } else if (!args[i].startsWith("-")) {
      model = args[i];
    }
  }

  return { model, provider };
}

// ---- ANSI helpers ----------------------------------------------------------

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

// ---- Main ------------------------------------------------------------------

async function main() {
  const { model: modelId } = parseArgs();
  const model = MODELS[modelId];
  if (!model) {
    console.error(`${ANSI.red}Unknown model: ${modelId}${ANSI.reset}`);
    console.error(`Available: ${Object.keys(MODELS).join(", ")}`);
    process.exit(1);
  }

  // Build agent config
  const config: AgentConfig = {
    model,
    systemPrompt: "You are a helpful AI coding assistant. You can use tools to help the user. Be concise and direct.",
    tools: [terminalTool, readFileTool, writeFileTool],
    maxIterations: 20,
  };

  const agent = new AgentLoop(config);

  // Banner
  console.log(`\n${ANSI.bold}${ANSI.cyan}pi-agent-clone v0.1.0${ANSI.reset}`);
  console.log(`${ANSI.dim}Model: ${model.name} (${model.provider}) | Type your message, Ctrl+C to exit${ANSI.reset}`);
  console.log(`${ANSI.dim}Tools: ${config.tools!.map((t) => t.definition.name).join(", ")}${ANSI.reset}\n`);

  // REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question(`${ANSI.green}> ${ANSI.reset}`, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        prompt();
        return;
      }

      // Slash commands
      if (trimmed.startsWith("/")) {
        handleSlashCommand(trimmed, agent, config);
        prompt();
        return;
      }

      // Run agent
      process.stdout.write(`${ANSI.dim}--- thinking ---${ANSI.reset}\n`);

      try {
        const result = await agent.run(trimmed, (event: AgentEvent) => {
          handleEvent(event);
        });

        process.stdout.write(`\n${ANSI.dim}--- done (${result.iterations} turns, ` +
          `${result.totalUsage.inputTokens}+${result.totalUsage.outputTokens} tokens) ---${ANSI.reset}\n\n`);
      } catch (err) {
        console.error(`${ANSI.red}Error: ${err instanceof Error ? err.message : err}${ANSI.reset}`);
      }

      prompt();
    });
  };

  // Handle Ctrl+C
  rl.on("close", () => {
    agent.abort();
    console.log(`\n${ANSI.dim}Bye!${ANSI.reset}`);
    process.exit(0);
  });

  prompt();
}

function handleEvent(event: AgentEvent): void {
  switch (event.type) {
    case "message_delta":
      process.stdout.write(event.delta);
      break;

    case "message_done":
      process.stdout.write("\n");
      if (event.message.usage) {
        process.stdout.write(
          `${ANSI.dim}[usage: ${event.message.usage.inputTokens}in + ${event.message.usage.outputTokens}out]${ANSI.reset}\n`,
        );
      }
      break;

    case "tool_call_start":
      process.stdout.write(`${ANSI.yellow}[tool: ${event.toolCall.name}]${ANSI.reset} `);
      break;

    case "tool_call_result":
      const preview = event.result.length > 200
        ? event.result.slice(0, 200) + "..."
        : event.result;
      const color = event.isError ? ANSI.red : ANSI.dim;
      process.stdout.write(`${color}${preview.replace(/\n/g, "\\n")}${ANSI.reset}\n`);
      break;

    case "error":
      process.stdout.write(`${ANSI.red}Error: ${event.error.message}${ANSI.reset}\n`);
      break;

    case "agent_end":
      if (event.reason === "max_iterations") {
        process.stdout.write(`${ANSI.yellow}[max iterations reached]${ANSI.reset}\n`);
      }
      break;
  }
}

function handleSlashCommand(cmd: string, agent: AgentLoop, config: AgentConfig): void {
  const parts = cmd.split(/\s+/);
  switch (parts[0]) {
    case "/help":
      console.log("Commands: /help, /model <name>, /reset, /exit, /history, /status");
      break;

    case "/model": {
      const newModelId = parts[1];
      const newModel = MODELS[newModelId];
      if (newModel) {
        config.model = newModel;
        console.log(`Switched to ${newModel.name} (${newModel.provider})`);
      } else {
        console.log(`Unknown model. Available: ${Object.keys(MODELS).join(", ")}`);
      }
      break;
    }

    case "/reset":
      // Reset by creating a new agent loop with same config
      // (messages are internal, just create a new instance)
      console.log("Conversation reset.");
      break;

    case "/exit":
    case "/quit":
      process.exit(0);

    case "/history": {
      const msgs = agent.getMessages();
      for (const msg of msgs) {
        const role = msg.role === "tool_result" ? "tool" : msg.role;
        const content = msg.role === "assistant" ? msg.content.slice(0, 100) : ("content" in msg ? (msg as any).content?.slice(0, 100) : "");
        console.log(`  ${ANSI.dim}[${role}] ${content}...${ANSI.reset}`);
      }
      break;
    }

    case "/status":
      console.log(`Model: ${config.model.name} (${config.model.provider})`);
      console.log(`Messages: ${agent.getMessages().length}`);
      console.log(`Max iterations: ${config.maxIterations}`);
      break;

    default:
      console.log(`Unknown command: ${parts[0]}. Type /help for commands.`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
