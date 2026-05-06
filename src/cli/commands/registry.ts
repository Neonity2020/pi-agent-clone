// ============================================================================
// Command Registry — extensible slash command system
//
// Design inspired by Hermes Agent's CommandDef:
//   - Central registry of all commands
//   - Each command has: name, aliases, description, usage, category, handler
//   - /help auto-generates from registry
//   - Easy to add new commands: just register()
// ============================================================================

import type { Interface as ReadlineInterface } from "readline";
import type { AgentLoop } from "../../agent/loop.js";
import type { AgentConfig } from "../../types.js";
import { chalk } from "../markdown.js";

// ---- Chalk shortcuts (shared across commands) ------------------------------

export const c = {
  reset:    chalk.reset,
  bold:     chalk.bold,
  dim:      chalk.dim,
  italic:   chalk.italic,
  green:    chalk.green,
  yellow:   chalk.yellow,
  blue:     chalk.blue,
  cyan:     chalk.cyan,
  red:      chalk.red,
  gray:     chalk.gray,
  magenta:  chalk.magenta,
  white:    chalk.white,
  bgBlue:   chalk.bgBlue,
  success:  chalk.bold.green,
  error:    chalk.bold.red,
  warning:  chalk.bold.yellow,
  info:     chalk.bold.cyan,
  muted:    chalk.dim.gray,
};

// Keep backward compat — ANSI is now a proxy to chalk
export const ANSI = {
  reset:   "",
  bold:    "",
  dim:     "",
  italic:  "",
  green:   "",
  yellow:  "",
  blue:    "",
  cyan:    "",
  red:     "",
  gray:    "",
  magenta: "",
  white:   "",
  bgBlue:  "",
  bgCyan:  "",
};

// ---- Command context: everything a command handler might need -------------

export interface CommandContext {
  agent: AgentLoop;
  config: AgentConfig;
  rl: ReadlineInterface;        // Readline interface — pause/resume around raw mode
  rawInput: string;             // The full raw user input string
  args: string[];               // Parsed arguments (command name stripped)
}

// ---- Command definition ----------------------------------------------------

export type CommandCategory = "session" | "config" | "memory" | "info" | "skills";

export interface CommandDef {
  /** Primary name (without /) */
  name: string;
  /** Aliases (without /) */
  aliases?: string[];
  /** Short description for /help */
  description: string;
  /** Usage string, e.g. "[list|<model-id>]" */
  usage?: string;
  /** Category for grouping in /help */
  category: CommandCategory;
  /** The handler */
  execute(ctx: CommandContext): Promise<void>;
}

// ---- Registry --------------------------------------------------------------

const commands = new Map<string, CommandDef>();

/** Register a command (and its aliases) */
export function registerCommand(cmd: CommandDef): void {
  commands.set(cmd.name, cmd);
  for (const alias of cmd.aliases ?? []) {
    commands.set(alias, cmd);
  }
}

/** Resolve a raw slash input to a command + remaining args */
export function resolveCommand(input: string): { cmd: CommandDef; args: string[] } | null {
  const parts = input.trim().split(/\s+/);
  const name = parts[0].toLowerCase().replace(/^\//, "");
  const args = parts.slice(1);

  const cmd = commands.get(name);
  if (!cmd) return null;
  return { cmd, args };
}

/** Get all unique commands (dedup aliases) */
export function getAllCommands(): CommandDef[] {
  const seen = new Set<string>();
  const result: CommandDef[] = [];
  commands.forEach((cmd) => {
    if (!seen.has(cmd.name)) {
      seen.add(cmd.name);
      result.push(cmd);
    }
  });
  return result;
}

/** Get commands grouped by category */
export function getCommandsByCategory(): Record<CommandCategory, CommandDef[]> {
  const grouped: Record<string, CommandDef[]> = {};
  for (const cmd of getAllCommands()) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  }
  return grouped as Record<CommandCategory, CommandDef[]>;
}

// ---- Helper to format help -------------------------------------------------

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  session: "Session",
  config:  "Configuration",
  memory:  "Memory",
  info:    "Info",
  skills:  "Skills",
};

const CATEGORY_ICONS: Record<CommandCategory, string> = {
  session: "⚡",
  config:  "⚙",
  memory:  "🧠",
  info:    "ℹ",
  skills:  "🎯",
};

export function formatHelp(): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(c.bold.cyan("  ╔══════════════════════════════════════╗"));
  lines.push(c.bold.cyan("  ║") + c.bold.white("  Commands                            ") + c.bold.cyan("║"));
  lines.push(c.bold.cyan("  ╚══════════════════════════════════════╝"));
  lines.push("");

  const byCategory = getCommandsByCategory();
  for (const [cat, cmds] of Object.entries(byCategory)) {
    const icon = CATEGORY_ICONS[cat as CommandCategory] || "•";
    lines.push(`  ${c.bold(`${icon} ${CATEGORY_LABELS[cat as CommandCategory]}:`)}`);

    for (const cmd of cmds) {
      const aliases = cmd.aliases?.length
        ? ` ${c.dim(`(${cmd.aliases.map((a) => `/${a}`).join(", ")})`)}`
        : "";
      const usage = cmd.usage ? ` ${c.dim(cmd.usage)}` : "";
      lines.push(
        `    ${c.green(`/${cmd.name}`)}${usage}${aliases}`,
      );
      lines.push(`      ${c.dim(cmd.description)}`);
    }
    lines.push("");
  }

  // Built-in commands (not in registry)
  lines.push(`  ${c.bold("⚡ Built-in:")}`);
  lines.push(`    ${c.green("/reset")} ${c.dim("─ Clear conversation history")}`);
  lines.push(`    ${c.green("/exit")}  ${c.gray(`(/quit, /q)`)} ${c.dim("─ Exit the agent")}`);
  lines.push(`    ${c.green("/history")}       ${c.dim("─ Show conversation history")}`);
  lines.push(`    ${c.green("/memory")}        ${c.dim("─ Show memory contents")}`);
  lines.push(`    ${c.green("/status")}        ${c.dim("─ Show agent status")}`);
  lines.push("");

  return lines.join("\n");
}
