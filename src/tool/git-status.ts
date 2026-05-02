// ============================================================================
// Built-in tool: git_status — show Git repository status
// ============================================================================

import type { ToolHandler } from "../types.js";

export const gitStatusTool: ToolHandler = {
  definition: {
    name: "git_status",
    description: "Show the working tree status. Displays paths that have differences between the index file and the current HEAD commit, paths that have differences between the working tree and the index file, and paths in the working tree that are not tracked by Git.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repository path (defaults to current directory)",
        },
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = args.path as string | undefined;

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      // Get status with porcelain format for easy parsing
      const { stdout, stderr } = await execFileAsync(
        "git",
        ["-C", path || ".", "status", "--short"],
        {
          maxBuffer: 1024 * 1024,
          timeout: 10000,
        },
      );

      let output = `Git Status for: ${path || "current directory"}\n`;
      output += "=" .repeat(50) + "\n\n";

      if (!stdout.trim()) {
        output += "✓ Working tree is clean. No changes to commit.\n";
        return output;
      }

      output += stdout;

      // Parse and summarize
      const lines = stdout.trim().split("\n");
      let modified = 0,
        added = 0,
        deleted = 0,
        untracked = 0,
        renamed = 0;

      for (const line of lines) {
        const status = line.substring(0, 2);
        if (status.includes("M")) modified++;
        if (status.includes("A")) added++;
        if (status.includes("D")) deleted++;
        if (status.includes("??")) untracked++;
        if (status.includes("R")) renamed++;
      }

      output += "\n" + "-".repeat(50) + "\n";
      output += "Summary:\n";
      if (modified > 0) output += `  • Modified:   ${modified}\n`;
      if (added > 0) output += `  • Added:      ${added}\n`;
      if (deleted > 0) output += `  • Deleted:    ${deleted}\n`;
      if (renamed > 0) output += `  • Renamed:    ${renamed}\n`;
      if (untracked > 0) output += `  • Untracked:  ${untracked}\n`;

      if (stderr) {
        output += "\nWarnings:\n" + stderr;
      }

      return output;
    } catch (err: any) {
      return `Error: ${err.message}\n${err.stderr || ""}`;
    }
  },
};
