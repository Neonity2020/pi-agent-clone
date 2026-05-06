// ============================================================================
// Skill Loader — discover and load skills/commands from disk
//
// Directory mapping (compatible with Claude Code):
//   ~/.neonity-agent/skills/<name>/SKILL.md   → global skills
//   .neonity-agent/skills/<name>/SKILL.md     → project skills (override global)
//   ~/.neonity-agent/commands/<name>.md        → user slash commands
//   .neonity-agent/commands/<name>.md          → project slash commands
// ============================================================================

import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import type { SkillDef, SlashCommandDef } from "./types.js";
import { registerSkill, registerSlashCommand, clearAll } from "./registry.js";

// ---- YAML frontmatter parser -----------------------------------------------

interface Frontmatter {
  name?: string;
  description?: string;
  "allowed-tools"?: string | string[];
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const raw = match[1];
  const body = match[2];

  // Minimal YAML parser (we only need name, description, allowed-tools)
  const fm: Frontmatter = {};
  for (const line of raw.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: string = line.slice(colonIdx + 1).trim();

    // Strip quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key === "name") fm.name = value;
    else if (key === "description") fm.description = value;
    else if (key === "allowed-tools") {
      // Parse as comma-separated list: "Tool1, Tool2, Tool3"
      fm["allowed-tools"] = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  return { frontmatter: fm, body };
}

// ---- Skill loader ----------------------------------------------------------

async function loadSkillFromDirectory(
  dirPath: string,
  source: "global" | "project",
): Promise<SkillDef | null> {
  const skillMdPath = join(dirPath, "SKILL.md");
  if (!existsSync(skillMdPath)) return null;

  try {
    const content = await readFile(skillMdPath, "utf-8");
    const parsed = parseFrontmatter(content);
    if (!parsed) return null;

    const { frontmatter, body } = parsed;
    const name = frontmatter.name || dirPath.split("/").pop() || "unknown";

    return {
      name,
      description: frontmatter.description || "",
      allowedTools: Array.isArray(frontmatter["allowed-tools"])
        ? frontmatter["allowed-tools"]
        : undefined,
      instructions: body.trim(),
      directory: resolve(dirPath),
      source,
    };
  } catch {
    return null;
  }
}

// ---- Slash command loader ---------------------------------------------------

async function loadSlashCommand(
  filePath: string,
  prefix: "project" | "user",
): Promise<SlashCommandDef | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const name = filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown";

    return {
      name,
      prompt: content.trim(),
      prefix,
      filePath: resolve(filePath),
    };
  } catch {
    return null;
  }
}

// ---- Directory scanner ------------------------------------------------------

async function scanSkillsDir(baseDir: string, source: "global" | "project"): Promise<void> {
  const skillsDir = join(baseDir, "skills");
  if (!existsSync(skillsDir)) return;

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skill = await loadSkillFromDirectory(join(skillsDir, entry.name), source);
      if (skill) {
        registerSkill(skill);
      }
    }
  } catch {
    // Directory not readable — skip
  }
}

async function scanCommandsDir(baseDir: string, prefix: "user" | "project"): Promise<void> {
  const commandsDir = join(baseDir, "commands");
  if (!existsSync(commandsDir)) return;

  try {
    const entries = await readdir(commandsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const cmd = await loadSlashCommand(join(commandsDir, entry.name), prefix);
      if (cmd) {
        registerSlashCommand(cmd);
      }
    }
  } catch {
    // Directory not readable — skip
  }
}

// ---- Public API -------------------------------------------------------------

/**
 * Discover and register all skills and slash commands.
 * Scans global (~/.neonity-agent/) and project (cwd/.neonity-agent/) directories.
 * Project-level definitions override global ones.
 */
export async function discoverAndRegister(projectDir?: string): Promise<{
  skillsLoaded: number;
  commandsLoaded: number;
}> {
  clearAll();

  const globalDir = join(homedir(), ".neonity-agent");
  const cwd = projectDir || process.cwd();

  // Also support .claude directory (Claude Code compatibility)
  const projectDir_neonity = join(cwd, ".neonity-agent");
  const projectDir_claude = join(cwd, ".claude");

  // Load global first (project overrides will replace)
  await scanSkillsDir(globalDir, "global");
  await scanCommandsDir(globalDir, "user");

  // Load project-level (overrides global)
  if (existsSync(projectDir_neonity)) {
    await scanSkillsDir(projectDir_neonity, "project");
    await scanCommandsDir(projectDir_neonity, "project");
  }
  if (existsSync(projectDir_claude)) {
    await scanSkillsDir(projectDir_claude, "project");
    await scanCommandsDir(projectDir_claude, "project");
  }

  // Import counts
  const { getAllSkills, getAllSlashCommands } = await import("./registry.js");
  return {
    skillsLoaded: getAllSkills().length,
    commandsLoaded: getAllSlashCommands().length,
  };
}
