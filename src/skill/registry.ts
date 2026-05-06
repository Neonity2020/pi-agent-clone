// ============================================================================
// Skill Registry — Map-based registry for skills and slash commands
// ============================================================================

import type { SkillDef, SlashCommandDef } from "./types.js";

const skills = new Map<string, SkillDef>();
const slashCommands = new Map<string, SlashCommandDef>();

// ---- Skill registry --------------------------------------------------------

export function registerSkill(skill: SkillDef): void {
  // Project-level skills override global skills with the same name
  const existing = skills.get(skill.name);
  if (existing && existing.source === "project" && skill.source === "global") {
    return; // Keep project-level skill
  }
  skills.set(skill.name, skill);
}

export function getSkill(name: string): SkillDef | undefined {
  return skills.get(name);
}

export function getAllSkills(): SkillDef[] {
  return Array.from(skills.values());
}

// ---- Slash command registry -------------------------------------------------

export function registerSlashCommand(cmd: SlashCommandDef): void {
  // Key format: "prefix:name" (e.g., "project:optimize", "user:hello")
  const key = `${cmd.prefix}:${cmd.name}`;
  // Project commands override user commands with the same name
  const existing = slashCommands.get(key);
  if (existing && existing.prefix === "project" && cmd.prefix === "user") {
    return; // Keep project-level command
  }
  slashCommands.set(key, cmd);
}

export function getSlashCommand(prefix: string, name: string): SlashCommandDef | undefined {
  return slashCommands.get(`${prefix}:${name}`);
}

export function getAllSlashCommands(): SlashCommandDef[] {
  return Array.from(slashCommands.values());
}

// ---- Clear all (for reload) ------------------------------------------------

export function clearAll(): void {
  skills.clear();
  slashCommands.clear();
}
