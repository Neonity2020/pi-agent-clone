// ============================================================================
// Built-in tool: git_log — show commit logs
// ============================================================================

import type { ToolHandler } from "../types.js";

export const gitLogTool: ToolHandler = {
  definition: {
    name: "git_log",
    description: "Show the commit logs. Displays the commit history with author, date, and commit message.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository path (defaults to current directory)",
        },
        max_count: {
          type: "number",
          description: "Maximum number of commits to show (default: 10)",
        },
        oneline: {
          type: "boolean",
          description: "Show each commit on a single line (default: false)",
        },
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = args.path as string | undefined;
    const maxCount = (args.max_count as number) || 10;
    const oneline = args.oneline as boolean | undefined;

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      const gitArgs = [
        "-C",
        path || ".",
        "log",
        `--max-count=${maxCount}`,
        oneline ? "--oneline" : "--pretty=format:%h - %an, %ar : %s",
      ];

      const { stdout, stderr } = await execFileAsync("git", gitArgs, {
        maxBuffer: 1024 * 1024 * 5,
        timeout: 10000,
      });

      let output = `Git Log for: ${path || "current directory"} (last ${maxCount} commits)\n`;
      output += "=" .repeat(60) + "\n\n";

      if (!stdout.trim()) {
        output += "No commits found in this repository.\n";
        return output;
      }

      output += stdout;

      // Get commit count
      const { stdout: countStdout } = await execFileAsync(
        "git",
        ["-C", path || ".", "rev-list", "--count", "HEAD"],
        { timeout: 5000 },
      );

      output += `\n${"-".repeat(60)}\n`;
      output += `Total commits: ${countStdout.trim()}\n`;

      if (stderr) {
        output += "\nWarnings:\n" + stderr;
      }

      return output;
    } catch (err: any) {
      return `Error: ${err.message}\n${err.stderr || ""}`;
    }
  },
};
