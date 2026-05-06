// ============================================================================
// /skills command — manage skills (list, reload, info)
// ============================================================================

import { registerCommand, type CommandContext, c } from "../../cli/commands/registry.js";
import { getAllSkills, getSkill, getAllSlashCommands } from "../registry.js";
import { discoverAndRegister } from "../loader.js";

registerCommand({
  name: "skills",
  aliases: [],
  description: "Manage skills — list, reload, or show details",
  usage: "[list|reload|info <name>]",
  category: "info",
  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.args[0] || "list";

    switch (sub) {
      case "list": {
        const skills = getAllSkills();
        const commands = getAllSlashCommands();

        console.log("");
        console.log(c.bold.cyan("  Skills & Slash Commands"));
        console.log("");

        if (skills.length === 0 && commands.length === 0) {
          console.log(c.dim("  No skills or commands loaded."));
          console.log(c.dim("  Place SKILL.md in ~/.neonity-agent/skills/<name>/"));
          console.log(c.dim("  Place .md files in ~/.neonity-agent/commands/"));
          console.log("");
          return;
        }

        if (skills.length > 0) {
          console.log(`  ${c.bold("Skills")} ${c.dim(`(${skills.length})`)}`);
          for (const skill of skills) {
            const src = skill.source === "project" ? c.yellow("(project)") : c.dim("(global)");
            const tools = skill.allowedTools?.length
              ? c.dim(` [${skill.allowedTools.join(", ")}]`)
              : "";
            console.log(`    ${c.green(skill.name)} ${src} ${tools}`);
            console.log(`      ${c.dim(skill.description)}`);
          }
          console.log("");
        }

        if (commands.length > 0) {
          console.log(`  ${c.bold("Slash Commands")} ${c.dim(`(${commands.length})`)}`);
          for (const cmd of commands) {
            const prefix = cmd.prefix === "project" ? c.cyan("/project:") : c.yellow("/user:");
            console.log(`    ${prefix}${cmd.name}`);
          }
          console.log("");
        }
        break;
      }

      case "reload": {
        const result = await discoverAndRegister();
        console.log(`  ${c.success("✓")} Reloaded: ${result.skillsLoaded} skills, ${result.commandsLoaded} commands`);
        break;
      }

      case "info": {
        const name = ctx.args[1];
        if (!name) {
          console.log(c.dim("  Usage: /skills info <name>"));
          break;
        }

        const skill = getSkill(name);
        if (!skill) {
          console.log(c.error(`  Skill not found: ${name}`));
          break;
        }

        console.log("");
        console.log(`  ${c.bold(skill.name)}  ${c.dim(`[${skill.source}]`)}`);
        console.log(`  ${c.cyan("Description:")} ${skill.description}`);
        if (skill.allowedTools?.length) {
          console.log(`  ${c.cyan("Allowed tools:")} ${skill.allowedTools.join(", ")}`);
        }
        console.log(`  ${c.cyan("Directory:")} ${skill.directory}`);
        console.log("");
        console.log(c.dim("  Instructions:"));
        console.log("");
        for (const line of skill.instructions.split("\n")) {
          console.log(`    ${line}`);
        }
        console.log("");
        break;
      }

      default:
        console.log(c.dim("  Usage: /skills [list|reload|info <name>]"));
        break;
    }
  },
});
