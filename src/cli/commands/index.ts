// ============================================================================
// Commands — auto-register all command modules
// ============================================================================

// Import each command module. The act of importing triggers registerCommand().
// Add new command files here as you create them.

import "./model.js";

// Re-export the registry API for use by the REPL
export {
  type CommandContext,
  type CommandDef,
  type CommandCategory,
  ANSI,
  resolveCommand,
  getAllCommands,
  getCommandsByCategory,
  formatHelp,
} from "./registry.js";
