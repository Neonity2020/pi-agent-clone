// ============================================================================
// Built-in tool: git_diff — show changes between commits
// ============================================================================

import type { ToolHandler } from "../types.js";

export const gitDiffTool: ToolHandler = {
  definition: {
    name: "git_diff",
    description: "Show changes between commits, commit and working tree, etc. Displays the actual differences (diff) between files.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository path (defaults to current directory)",
        },
        target: {
          type: "string",
          description: "Commit or ref to compare against (e.g., 'HEAD~1', 'main'). If not specified, shows unstaged changes.",
        },
        file: {
          type: "string",
          description: "Specific file to show diff for",
        },
        lines: {
          type: "number",
          description: "Number of context lines (default: 3)",
        },
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = args.path as string | undefined;
    const target = args.target as string | undefined;
    const file = args.file as string | undefined;
    const lines = (args.lines as number) || 3;

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      const gitArgs: string[] = ["-C", path || ".", "diff"];

      if (target) {
        gitArgs.push(target);
      }

      if (file) {
        gitArgs.push("--", file);
      }

      gitArgs.push(`-U${lines}`);

      const { stdout, stderr } = await execFileAsync("git", gitArgs, {
        maxBuffer: 1024 * 1024 * 10,
        timeout: 15000,
      });

      let output = `Git Diff${target ? ` (${target})` : ""} for: ${path || "current directory"}\n`;
      output += "=".repeat(60) + "\n\n";

      if (!stdout.trim()) {
        output += "No differences found.\n";
        return output;
      }

      output += stdout;

      // Count lines changed
      const additions = (stdout.match(/^\+/gm) || []).filter((l) => l !== "+++").length;
      const deletions = (stdout.match(/^-/gm) || []).filter((l) => l !== "---").length;

      output += "\n" + "-".repeat(60) + "\n";
      output += `Changes: +${additions} -${deletions}\n`;

      if (stderr) {
        output += "\nWarnings:\n" + stderr;
      }

      return output;
    } catch (err: any) {
      return `Error: ${err.message}\n${err.stderr || ""}`;
    }
  },
};
