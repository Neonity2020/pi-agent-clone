// ============================================================================
// Skill Prompt — format skills for system prompt injection
// ============================================================================

import { getAllSkills, getAllSlashCommands } from "./registry.js";

/**
 * Format all registered skills as a section for the system prompt.
 * The LLM reads this to discover what skills it can autonomously use.
 */
export function formatSkillsForPrompt(): string {
  const skills = getAllSkills();
  if (skills.length === 0) return "";

  const lines: string[] = [
    "",
    "══════════════════════════════════════════════",
    "AVAILABLE SKILLS",
    "══════════════════════════════════════════════",
    "",
    "The following skills are available. When the user's request matches a skill's description,",
    "follow the skill's instructions to complete the task. Skills may reference files in their",
    "directory — use read_file to access them as needed.",
    "",
  ];

  for (const skill of skills) {
    lines.push(`## ${skill.name}`);
    lines.push(`Description: ${skill.description}`);
    if (skill.allowedTools && skill.allowedTools.length > 0) {
      lines.push(`Allowed tools: ${skill.allowedTools.join(", ")}`);
    }
    lines.push("");
    lines.push(skill.instructions);
    lines.push("");
    lines.push("─".repeat(40));
    lines.push("");
  }

  lines.push("══════════════════════════════════════════════");
  lines.push("");

  return lines.join("\n");
}

/**
 * Format slash commands as help text for the REPL.
 */
export function formatSlashCommandHelp(): string {
  const commands = getAllSlashCommands();
  if (commands.length === 0) return "";

  const lines: string[] = [
    "",
    "  Slash Commands:",
  ];

  for (const cmd of commands) {
    lines.push(`    /${cmd.prefix}:${cmd.name}`);
  }

  lines.push("");
  return lines.join("\n");
}
