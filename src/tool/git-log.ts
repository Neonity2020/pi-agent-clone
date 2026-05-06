// ============================================================================
// Built-in tool: git_log — show commit logs (with path sandboxing)
// ============================================================================

import type { ToolHandler } from "../types.js";
import { resolveSandboxedPath, getSandboxRoot } from "../utils/security.js";

export const gitLogTool: ToolHandler = {
  definition: {
    name: "git_log",
    description: "Show the commit logs. Displays the commit history with author, date, and commit message.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository path (defaults to sandbox root)",
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
    const rawPath = args.path as string | undefined;
    const maxCount = (args.max_count as number) || 10;
    const oneline = args.oneline as boolean | undefined;

    let safePath: string;
    try {
      safePath = rawPath ? resolveSandboxedPath(rawPath) : getSandboxRoot();
    } catch (err: any) {
      return `Security: ${err.message}`;
    }

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      const gitArgs = [
        "-C",
        safePath,
        "log",
        `--max-count=${maxCount}`,
        oneline ? "--oneline" : "--pretty=format:%h - %an, %ar : %s",
      ];

      const { stdout, stderr } = await execFileAsync("git", gitArgs, {
        maxBuffer: 1024 * 1024 * 5,
        timeout: 10000,
      });

      let output = `Git Log for: ${safePath} (last ${maxCount} commits)\n`;
      output += "=" .repeat(60) + "\n\n";

      if (!stdout.trim()) {
        output += "No commits found in this repository.\n";
        return output;
      }

      output += stdout;

      // Get commit count
      const { stdout: countStdout } = await execFileAsync(
        "git",
        ["-C", safePath, "rev-list", "--count", "HEAD"],
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
