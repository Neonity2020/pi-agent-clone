#!/usr/bin/env node
// ============================================================================
// pi-agent-clone — Interactive REPL with long-term memory
// ============================================================================

// Suppress punycode deprecation warning from openai SDK on Node.js 22+
process.removeAllListeners("warning");

import "dotenv/config";
import * as readline from "readline";
import { AgentLoop } from "../agent/loop.js";
import { listProviders } from "../provider/registry.js";
import {
  terminalTool,
  readFileTool,
  writeFileTool,
  memoryWriteTool,
  memoryReadTool,
  memorySearchTool,
  memoryRemoveTool,
} from "../tool/index.js";
import { getMemoryStats, formatMemoryForPrompt } from "../memory/index.js";
import { MODELS } from "./models.js";
import {
  ANSI,
  resolveCommand,
  formatHelp,
  type CommandContext,
} from "./commands/index.js";
import { ThinkRenderer } from "./think-render.js";
import type { AgentConfig, AgentEvent } from "../types.js";

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
pi-agent-clone v0.1.0 — AI coding agent with long-term memory

Usage: pi-agent [options]

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

Long-term memory:
  ~/.pi-agent/MEMORY.md — persists across sessions
`);
      process.exit(0);
    } else if (!args[i].startsWith("-")) {
      model = args[i];
    }
  }

  return { model, provider };
}

// ---- Built-in slash commands (non-registry) --------------------------------
// These are session-control commands that don't fit the CommandContext pattern

function handleBuiltinCommand(cmd: string, agent: AgentLoop, config: AgentConfig): boolean {
  const parts = cmd.split(/\s+/);

  switch (parts[0]) {
    case "/reset":
      console.log("Conversation reset.");
      return true;

    case "/exit":
    case "/quit":
    case "/q":
      process.exit(0);

    case "/history": {
      const msgs = agent.getMessages();
      for (const msg of msgs) {
        const role = msg.role === "tool_result" ? "tool" : msg.role;
        const content = msg.role === "assistant" ? msg.content.slice(0, 100) : ("content" in msg ? (msg as any).content?.slice(0, 100) : "");
        console.log(`  ${ANSI.dim}[${role}] ${content}...${ANSI.reset}`);
      }
      return true;
    }

    case "/memory": {
      (async () => {
        const stats = await getMemoryStats();
        console.log(`${ANSI.magenta}Memory: ${stats.entries} entries${ANSI.reset}`);
        console.log(`${ANSI.dim}Path: ${stats.path}${ANSI.reset}`);
        const content = await formatMemoryForPrompt();
        if (content) {
          console.log(content);
        } else {
          console.log(`${ANSI.dim}(empty)${ANSI.reset}`);
        }
      })();
      return true;
    }

    case "/status": {
      (async () => {
        console.log(`Model: ${config.model.name} (${config.model.provider})`);
        console.log(`Messages: ${agent.getMessages().length}`);
        console.log(`Max iterations: ${config.maxIterations}`);
        const stats = await getMemoryStats();
        console.log(`Memory: ${stats.entries} entries (${stats.sizeBytes} bytes)`);
      })();
      return true;
    }

    default:
      return false;
  }
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const { model: modelId } = parseArgs();
  const model = MODELS[modelId];
  if (!model) {
    console.error(`${ANSI.red}Unknown model: ${modelId}${ANSI.reset}`);
    console.error(`Available: ${Object.keys(MODELS).join(", ")}`);
    process.exit(1);
  }

  // All tools including memory tools
  const allTools = [
    terminalTool,
    readFileTool,
    writeFileTool,
    memoryWriteTool,
    memoryReadTool,
    memorySearchTool,
    memoryRemoveTool,
  ];

  // Build agent config
  const config: AgentConfig = {
    model,
    systemPrompt: "You are a helpful AI coding assistant. You can use tools to help the user. Be concise and direct.",
    tools: allTools,
    maxIterations: 20,
  };

  const agent = new AgentLoop(config);

  // Check memory status at startup
  const memStats = await getMemoryStats();

  // Banner
  console.log(`\n${ANSI.bold}${ANSI.cyan}pi-agent-clone v0.1.0${ANSI.reset}`);
  console.log(`${ANSI.dim}Model: ${model.name} (${model.provider}) | Type your message, Ctrl+C to exit${ANSI.reset}`);
  console.log(`${ANSI.dim}Tools: ${allTools.map((t) => t.definition.name).join(", ")}${ANSI.reset}`);
  console.log(`${ANSI.magenta}Memory: ${memStats.entries} entries (${memStats.path})${ANSI.reset}`);
  console.log(`${ANSI.dim}Type /help for commands${ANSI.reset}\n`);

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
        // Try built-in commands first (session control)
        if (handleBuiltinCommand(trimmed, agent, config)) {
          prompt();
          return;
        }

        // Try registry commands (/model, etc.)
        const resolved = resolveCommand(trimmed);
        if (resolved) {
          const ctx: CommandContext = {
            agent,
            config,
            rl,
            rawInput: trimmed,
            args: resolved.args,
          };
          try {
            await resolved.cmd.execute(ctx);
          } catch (err) {
            console.error(`${ANSI.red}Command error: ${err instanceof Error ? err.message : err}${ANSI.reset}`);
          }
        } else if (trimmed === "/help") {
          console.log(formatHelp());
        } else {
          console.log(`${ANSI.red}Unknown command: ${trimmed}${ANSI.reset}`);
          console.log(`${ANSI.dim}Type /help for available commands${ANSI.reset}`);
        }

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

// ---- Think block renderer (stateful, persists per message) ------------------
// Detects <think...</think reasoning blocks from models like MiniMax M2.7
// and renders them with dedicated dim-cyan color for clarity.
let thinkRenderer = new ThinkRenderer();

function handleEvent(event: AgentEvent): void {
  switch (event.type) {
    case "message_delta": {
      // Process text through think renderer to colorize reasoning blocks
      const rendered = thinkRenderer.process(event.delta);
      process.stdout.write(rendered);
      break;
    }

    case "message_start":
      // Reset think renderer for each new assistant message
      thinkRenderer.reset();
      break;

    case "message_done":
      // Flush any remaining buffered content
      process.stdout.write(thinkRenderer.flush());
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

    case "tool_call_result": {
      const preview = event.result.length > 200
        ? event.result.slice(0, 200) + "..."
        : event.result;
      const color = event.isError ? ANSI.red : ANSI.dim;
      process.stdout.write(`${color}${preview.replace(/\n/g, "\\n")}${ANSI.reset}\n`);
      break;
    }

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

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
