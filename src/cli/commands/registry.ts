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

// ---- ANSI (shared across commands) ----------------------------------------

export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgCyan: "\x1b[46m",
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

export type CommandCategory = "session" | "config" | "memory" | "info";

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
};

export function formatHelp(): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`${ANSI.bold}${ANSI.cyan}pi-agent-clone Commands${ANSI.reset}`);
  lines.push("");

  const byCategory = getCommandsByCategory();
  for (const [cat, cmds] of Object.entries(byCategory)) {
    lines.push(`  ${ANSI.bold}${CATEGORY_LABELS[cat as CommandCategory]}:${ANSI.reset}`);
    for (const cmd of cmds) {
      const aliases = cmd.aliases?.length
        ? ` (${cmd.aliases.map((a) => `/${a}`).join(", ")})`
        : "";
      const usage = cmd.usage ? ` ${cmd.usage}` : "";
      lines.push(
        `    ${ANSI.green}/${cmd.name}${ANSI.reset}${ANSI.dim}${usage}${ANSI.reset}` +
        `${ANSI.gray}${aliases}${ANSI.reset}`,
      );
      lines.push(`      ${ANSI.dim}${cmd.description}${ANSI.reset}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
