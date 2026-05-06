// ============================================================================
// Skill Types — SkillDef (model-invoked) and SlashCommandDef (user-invoked)
//
// Compatible with Claude Code's skills/commands architecture:
//   - Skills: SKILL.md with YAML frontmatter, LLM decides when to use
//   - Slash Commands: .md prompt templates, user invokes via /prefix:name
// ============================================================================

/** Skill (model-invoked) — loaded from SKILL.md */
export interface SkillDef {
  name: string;                    // From frontmatter
  description: string;             // From frontmatter — LLM uses this to decide activation
  allowedTools?: string[];         // From frontmatter — restrict available tools
  instructions: string;            // SKILL.md body (after frontmatter)
  directory: string;               // Skill directory absolute path (for attached files)
  source: "global" | "project";    // Global (~) or project-level (.)
}

/** Slash Command (user-invoked) — loaded from .md file */
export interface SlashCommandDef {
  name: string;                    // Filename without .md
  prompt: string;                  // File content (prompt template)
  prefix: "project" | "user";     // /project: or /user:
  filePath: string;                // .md file absolute path
}
