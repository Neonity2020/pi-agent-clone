// ============================================================================
// Skill System — barrel export
// ============================================================================

export type { SkillDef, SlashCommandDef } from "./types.js";
export {
  registerSkill,
  getSkill,
  getAllSkills,
  registerSlashCommand,
  getSlashCommand,
  getAllSlashCommands,
  clearAll,
} from "./registry.js";
export { discoverAndRegister } from "./loader.js";
export { formatSkillsForPrompt, formatSlashCommandHelp } from "./prompt.js";
