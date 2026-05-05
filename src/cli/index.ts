#!/usr/bin/env node
// ============================================================================
// pi-agent-clone — Interactive REPL with long-term memory + pretty markdown
//
// Rendering pipeline:
//   LLM stream → raw text buffer (during streaming)
//                ↓ message_done
//              markdown renderer (marked-terminal + chalk)
//                ↓
//              colored terminal output
//
// UI components:
//   - chalk:         All ANSI coloring (replaces hand-rolled escape codes)
//   - marked:        Full markdown → terminal rendering
//   - ThinkRenderer: <think...</think reasoning block detection + color
// ============================================================================

// Suppress only the punycode deprecation warning from openai SDK on Node.js 22+
// (Don't remove all warning listeners — that hides useful security/deprecation warnings)
const _origEmit = process.emit.bind(process) as (event: string | symbol, ...args: any[]) => boolean;
(process as any).emit = function (event: string | symbol, ...emitArgs: any[]): boolean {
  if (
    event === "warning" &&
    emitArgs[0]?.name === "DeprecationWarning" &&
    typeof emitArgs[0]?.message === "string" &&
    emitArgs[0].message.includes("punycode")
  ) {
    return false; // Suppress this specific warning only
  }
  return _origEmit(event, ...emitArgs);
};

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
import { resolveCommand, formatHelp, type CommandContext } from "./commands/index.js";
import { ThinkRenderer } from "./think-render.js";
import { renderMarkdown, renderInline, chalk } from "./markdown.js";
import type { AgentConfig, AgentEvent } from "../types.js";
import { CostRouter, type RouterStrategy } from "../router/index.js";

// ---- Chalk shortcuts --------------------------------------------------------

const c = {
  bold:     chalk.bold,
  dim:      chalk.dim,
  green:    chalk.green,
  yellow:   chalk.yellow,
  red:      chalk.red,
  cyan:     chalk.cyan,
  blue:     chalk.blue,
  magenta:  chalk.magenta,
  gray:     chalk.gray,
  white:    chalk.white,
  bgBlue:   chalk.bgBlue,
  italic:   chalk.italic,
  underline: chalk.underline,
  hex:      chalk.hex,
  // Compound styles
  success:  chalk.bold.green,
  error:    chalk.bold.red,
  warning:  chalk.bold.yellow,
  info:     chalk.bold.cyan,
  muted:    chalk.dim.gray,
  highlight: chalk.bold.cyan,
  think:    chalk.dim.cyan,    // Reasoning block color
  toolName: chalk.bold.yellow,
  prompt:   chalk.green,
};

// ---- Parse CLI args --------------------------------------------------------

function parseArgs(): { model: string; provider?: string; router?: boolean } {
  const args = process.argv.slice(2);
  let model = process.env.DEFAULT_MODEL || "glm-4-flash";
  let provider: string | undefined;
  let router = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" || args[i] === "-m") {
      model = args[++i];
    } else if (args[i] === "--provider" || args[i] === "-p") {
      provider = args[++i];
    } else if (args[i] === "--router" || args[i] === "-r") {
      router = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
${c.info("pi-agent-clone v0.1.0")}  ${c.dim("— AI coding agent with long-term memory")}

${c.bold("Usage:")} pi-agent [options]

${c.bold("Options:")}
  ${c.green("-m, --model <name>")}     Model to use (default: glm-4-flash)
  ${c.green("-p, --provider <name>")}  Provider to use
  ${c.green("-h, --help")}             Show this help

${c.bold("Available models:")}
${Object.entries(MODELS)
  .map(([k, v]) => `  ${c.cyan(k.padEnd(30))} ${v.name} ${c.dim(`(${v.provider})`)}`)
  .join("\n")}

${c.bold("Available providers:")} ${listProviders().join(", ")}

${c.bold("Environment variables:")}
  ${c.dim("OPENAI_API_KEY      ")} OpenAI API key
  ${c.dim("ANTHROPIC_API_KEY   ")} Anthropic API key
  ${c.dim("GEMINI_API_KEY      ")} Google Gemini API key
  ${c.dim("GLM_API_KEY         ")} 智谱 AI API key
  ${c.dim("MINIMAX_API_KEY     ")} MiniMax API key

${c.bold("Long-term memory:")}
  ${c.dim("~/.pi-agent/MEMORY.md")} — persists across sessions
`);
      process.exit(0);
    } else if (!args[i].startsWith("-")) {
      model = args[i];
    }
  }

  return { model, provider, router };
}

// ---- Built-in slash commands (non-registry) --------------------------------
// These are session-control commands that don't fit the CommandContext pattern

function handleBuiltinCommand(cmd: string, agent: AgentLoop, config: AgentConfig): boolean {
  const parts = cmd.split(/\s+/);

  switch (parts[0]) {
    case "/reset":
      console.log(c.muted("Conversation reset."));
      return true;

    case "/exit":
    case "/quit":
    case "/q":
      process.exit(0);

    case "/history": {
      const msgs = agent.getMessages();
      for (const msg of msgs) {
        const role = msg.role === "tool_result" ? "tool" : msg.role;
        const content = msg.role === "assistant"
          ? msg.content.slice(0, 100)
          : ("content" in msg ? (msg as any).content?.slice(0, 100) : "");
        console.log(`  ${c.dim(`[${role}]`)} ${content}...`);
      }
      return true;
    }

    case "/memory": {
      (async () => {
        const stats = await getMemoryStats();
        console.log(c.magenta(`Memory: ${stats.entries} entries`));
        console.log(c.dim(`Path: ${stats.path}`));
        const content = await formatMemoryForPrompt();
        if (content) {
          console.log(content);
        } else {
          console.log(c.dim("(empty)"));
        }
      })();
      return true;
    }

    case "/status": {
      (async () => {
        const stats = await getMemoryStats();
        const lines = [
          `${c.bold("Status")}`,
          `  ${c.cyan("Model:")}      ${config.model.name} ${c.dim(`(${config.model.provider})`)}`,
          `  ${c.cyan("Messages:")}   ${agent.getMessages().length}`,
          `  ${c.cyan("Max iter:")}   ${config.maxIterations}`,
          `  ${c.cyan("Memory:")}     ${stats.entries} entries ${c.dim(`(${stats.sizeBytes} bytes)`)}`,
        ];
        console.log(lines.join("\n"));
      })();
      return true;
    }

    default:
      return false;
  }
}

// ---- Spinner characters for "thinking" animation ---------------------------

const SPINNER_FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

// ---- Router command handler ------------------------------------------------

async function handleRouterCommand(
  input: string,
  router: CostRouter,
  config: AgentConfig,
): Promise<void> {
  const parts = input.split(/\s+/);
  const sub = parts[1];

  switch (sub) {
    case "stats": {
      const stats = router.getStats();
      console.log("");
      console.log(c.bold.cyan("  ╔══════════════════════════════════════╗"));
      console.log(c.bold.cyan("  ║") + c.bold.white("  Router Statistics                   ") + c.bold.cyan("║"));
      console.log(c.bold.cyan("  ╚══════════════════════════════════════╝"));
      console.log("");
      console.log(`  ${c.cyan("Total queries:")}     ${stats.totalQueries}`);
      console.log(`  ${c.cyan("Cheap (M2.7):")}       ${stats.cheapQueries}`);
      console.log(`  ${c.cyan("Expensive (GLM-5.1):")} ${stats.expensiveQueries}`);
      console.log(`  ${c.cyan("Escalation rate:")}    ${c.bold(`${stats.escalationRate}%`)}`);
      console.log(`  ${c.cyan("Classify tokens:")}    ${stats.totalClassifyTokens}`);
      console.log(`  ${c.cyan("Strategy:")}           ${router.getStrategy()}`);
      console.log(`  ${c.cyan("Threshold:")}          ${router.getThreshold()}`);

      if (stats.history.length > 0) {
        console.log(`\n  ${c.bold("Recent decisions:")}`);
        const recent = stats.history.slice(-10);
        for (const d of recent) {
          const icon = d.escalated ? c.yellow("↑") : c.green("·");
          const model = d.model.name;
          const score = d.score >= 0 ? `score=${d.score}` : "baseline";
          console.log(`    ${icon} ${c.dim(model)} ${c.dim(score)} ${c.dim(`${d.classifyTimeMs}ms`)}`);
        }
      }
      console.log("");
      break;
    }

    case "test": {
      const query = parts.slice(2).join(" ");
      if (!query) {
        console.log(c.dim("Usage: /router test <your query here>"));
        break;
      }
      console.log(c.dim(`  Classifying: "${query.slice(0, 80)}${query.length > 80 ? "..." : ""}"`));
      const result = await router.classify(query);
      const model = result.score >= router.getThreshold()
        ? router.getExpensiveModel().name
        : router.getCheapModel().name;
      const escalated = result.score >= router.getThreshold();
      console.log(
        `  Score: ${c.bold(String(result.score))} → ${escalated ? c.cyan(model) : c.yellow(model)} ` +
        c.dim(`(raw: "${result.raw.trim()}")`),
      );
      break;
    }

    case "strategy": {
      const strategy = parts[2] as RouterStrategy;
      if (!strategy || !["pre-classify", "always-cheap", "always-expensive"].includes(strategy)) {
        console.log(c.dim("Usage: /router strategy <pre-classify|always-cheap|always-expensive>"));
        break;
      }
      router.setStrategy(strategy);
      console.log(`  ${c.success("✓")} Strategy: ${c.bold(strategy)}`);
      break;
    }

    case "reset": {
      router.resetStats();
      console.log(`  ${c.success("✓")} Stats reset`);
      break;
    }

    default:
      console.log("");
      console.log(c.bold("  Router Commands:"));
      console.log(`    ${c.green("/router stats")}      ${c.dim("— Show routing statistics")}`);
      console.log(`    ${c.green("/router test <q>")}    ${c.dim("— Classify a query without running")}`);
      console.log(`    ${c.green("/router strategy <s>")} ${c.dim("— Switch strategy (pre-classify|always-cheap|always-expensive)")}`);
      console.log(`    ${c.green("/router reset")}      ${c.dim("— Reset statistics")}`);
      console.log("");
      break;
  }
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const { model: modelId, router: enableRouter } = parseArgs();
  const model = MODELS[modelId];
  if (!model) {
    console.error(c.error(`Unknown model: ${modelId}`));
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

  // ── Initialize Cost Router (if --router flag) ──────────────────────────
  let costRouter: CostRouter | null = null;
  if (enableRouter) {
    const cheapModel = MODELS["MiniMax-M2.7"];
    const expensiveModel = MODELS["glm-5.1"];
    if (!cheapModel || !expensiveModel) {
      console.error(c.error("Router requires both MiniMax-M2.7 and glm-5.1 in model registry."));
      process.exit(1);
    }
    costRouter = new CostRouter({
      cheapModel,
      expensiveModel,
      threshold: 4,
      strategy: "pre-classify",
    });
  }

  // Check memory status at startup
  const memStats = await getMemoryStats();

  // ── Pretty banner ────────────────────────────────────────────────────────
  // Use simple ASCII to avoid alignment issues across different terminals
  console.log("");
  console.log(c.bold.cyan("  ╔══════════════════════════════════════╗"));
  console.log(c.bold.cyan("  ║ ") + c.bold.white("pi-agent-clone v0.1.0") + c.bold.cyan("                ║"));
  console.log(c.bold.cyan("  ╚══════════════════════════════════════╝"));
  console.log("");
  console.log(`  ${c.cyan("Model:")}   ${c.bold(model.name)} ${c.dim(`(${model.provider})`)}`);
  console.log(`  ${c.cyan("Tools:")}   ${c.dim(allTools.map((t) => t.definition.name).join(", "))}`);
  console.log(`  ${c.cyan("Memory:")}  ${c.magenta(`${memStats.entries} entries`)} ${c.dim(memStats.path)}`);
  if (costRouter) {
    console.log(`  ${c.cyan("Router:")}   ${c.bold.yellow("ON")} ${c.dim("M2.7 → GLM-5.1 (threshold=4)")}`);
  }
  console.log("");
  console.log(`  ${c.dim("Type your message · /help for commands · Ctrl+C to exit")}`);
  console.log("");

  // REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
      rl.question(`${c.bold.green("❯ ")}`, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        prompt();
        return;
      }

      // Slash commands
      if (trimmed.startsWith("/")) {
        // Router commands (only when router is active)
        if (costRouter && trimmed.startsWith("/router")) {
          await handleRouterCommand(trimmed, costRouter, config);
          prompt();
          return;
        }

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
            console.error(c.error(`Command error: ${err instanceof Error ? err.message : err}`));
          }
        } else if (trimmed === "/help") {
          console.log(formatHelp());
        } else {
          console.log(c.error(`Unknown command: ${trimmed}`));
          console.log(c.dim("Type /help for available commands"));
        }

        prompt();
        return;
      }

      // Run agent
      // ── Router: classify & swap model if router is active ──────────────
      if (costRouter) {
        try {
          const decision = await costRouter.route(trimmed);
          const arrow = decision.escalated
            ? `${c.yellow("M2.7")} ${c.bold("→")} ${c.cyan("GLM-5.1")}`
            : `${c.yellow("M2.7")} (direct)`;
          const scoreStr = decision.score >= 0
            ? `complexity=${decision.score}`
            : "no-classify";
          console.log(
            `  ${c.dim("🔀 Router:")} ${arrow} ${c.dim(scoreStr)} ${c.dim(`(${decision.classifyTimeMs}ms)`)}`,
          );
          // Swap model on the agent config
          config.model = decision.model;
        } catch (err) {
          // Classification failed — fall back to cheap model
          console.log(`  ${c.warning("⚠ Router classify failed, using cheap model")}`);
          config.model = costRouter.getCheapModel();
        }
      }

      // Show animated thinking indicator
      let spinnerIdx = 0;
      const spinnerInterval = setInterval(() => {
        const frame = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
        process.stdout.write(`\r  ${c.dim(frame + " Thinking...")}`);
        spinnerIdx++;
      }, 80);

      try {
        const result = await agent.run(trimmed, (event: AgentEvent) => {
          handleEvent(event, spinnerInterval);
        });

        clearInterval(spinnerInterval);
        process.stdout.write("\r" + " ".repeat(30) + "\r"); // Clear spinner line

        console.log(c.dim(
          `─── done ${c.gray("│")} ${result.iterations} turns ` +
          `${c.gray("│")} ${result.totalUsage.inputTokens}+${result.totalUsage.outputTokens} tokens ───`
        ));
        console.log();
      } catch (err) {
        clearInterval(spinnerInterval);
        process.stdout.write("\r" + " ".repeat(30) + "\r");
        console.error(c.error(`Error: ${err instanceof Error ? err.message : err}`));
      }

      prompt();
    });
  };

  // Handle Ctrl+C
  rl.on("close", () => {
    agent.abort();
    console.log(`\n${c.dim("Bye!")}`);
    process.exit(0);
  });

  prompt();
}

// ---- Streaming state (per message) -----------------------------------------

let thinkRenderer = new ThinkRenderer();

/** Accumulates raw text during streaming for markdown rendering on completion */
let messageBuffer = "";
/** Whether we're in a think block (affects rendering) */
let inThinkBlock = false;

function handleEvent(event: AgentEvent, spinnerInterval?: NodeJS.Timeout): void {
  switch (event.type) {
    case "message_start":
      // Reset state for new message
      thinkRenderer.reset();
      messageBuffer = "";
      inThinkBlock = false;
      // Clear spinner if still running
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        process.stdout.write("\r" + " ".repeat(30) + "\r");
      }
      break;

    case "message_delta": {
      // Process through think renderer to detect reasoning blocks
      const rendered = thinkRenderer.process(event.delta);
      messageBuffer += event.delta; // Buffer raw text for markdown rendering

      // During streaming, show think content immediately (colored)
      // but buffer normal text for markdown rendering
      if (thinkRenderer.isInThink()) {
        process.stdout.write(c.think(rendered));
        inThinkBlock = true;
      } else if (inThinkBlock) {
        // Transition from think to normal — flush think
        process.stdout.write(c.think(thinkRenderer.flush()));
        inThinkBlock = false;
      }
      // Normal text: we DON'T print it during streaming — wait for message_done
      break;
    }

    case "message_done": {
      // Flush think renderer
      const thinkFlush = thinkRenderer.flush();
      if (thinkFlush) {
        process.stdout.write(c.think(thinkFlush));
      }

      // Render the full accumulated text as markdown
      const fullText = messageBuffer;

      // Extract content after the last </think tag (if any)
      let normalText = fullText;
      const lastThinkEnd = fullText.lastIndexOf("</think");
      if (lastThinkEnd !== -1) {
        const afterThink = fullText.slice(lastThinkEnd);
        const gtIdx = afterThink.indexOf(">");
        if (gtIdx !== -1) {
          normalText = fullText.slice(lastThinkEnd + gtIdx + 1).trim();
        } else {
          normalText = "";
        }
      }

      // Strip <think...</think blocks from the text before markdown rendering
      const cleanedText = normalText.replace(/<think[\s\S]*?<\/think\s*>?\n?/gi, "");

      if (cleanedText.trim()) {
        const rendered = renderMarkdown(cleanedText);
        process.stdout.write(rendered);
        if (!rendered.endsWith("\n")) {
          process.stdout.write("\n");
        }
      }

      // Usage info
      if (event.message.usage) {
        const { inputTokens, outputTokens } = event.message.usage;
        console.log(c.muted(
          `  [${inputTokens}in + ${outputTokens}out tokens]`
        ));
      }

      messageBuffer = "";
      break;
    }

    case "tool_call_start":
      process.stdout.write(`\n${c.toolName(`⟐ ${event.toolCall.name}`)} `);
      process.stdout.write(c.dim("⟳ running..."));
      break;

    case "tool_call_result": {
      // Clear the "running..." text
      process.stdout.write("\r" + " ".repeat(40) + "\r");

      const preview = event.result.length > 200
        ? event.result.slice(0, 200) + "..."
        : event.result;

      if (event.isError) {
        process.stdout.write(`  ${c.error("✗")} ${c.red(preview.replace(/\n/g, "\\n"))}\n`);
      } else {
        process.stdout.write(`  ${c.success("✓")} ${c.dim(preview.replace(/\n/g, "\\n"))}\n`);
      }
      break;
    }

    case "error":
      process.stdout.write(`\n${c.error(`Error: ${event.error.message}`)}\n`);
      break;

    case "agent_end":
      if (event.reason === "max_iterations") {
        process.stdout.write(`\n${c.warning("⚠ Max iterations reached")}\n`);
      }
      break;
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
