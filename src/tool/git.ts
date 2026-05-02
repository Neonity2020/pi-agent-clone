// ============================================================================
// Built-in tool: git — execute Git commands
// ============================================================================

import type { ToolHandler } from "../types.js";

export const gitTool: ToolHandler = {
  definition: {
    name: "git",
    description: "Execute Git commands. Use for version control operations like status, log, diff, commit, branch, checkout, push, pull, etc.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Git command to execute (e.g., 'status', 'log -5', 'diff HEAD~1', 'commit -m \"message\"')",
        },
        workdir: {
          type: "string",
          description: "Working directory for the git command (defaults to current directory)",
        },
        timeout: {
          type: "number",
          description: "Timeout in seconds (default: 60, git operations can take longer)",
        },
      },
      required: ["command"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const gitCommand = args.command as string;
    const timeout = ((args.timeout as number) || 60) * 1000;
    const workdir = args.workdir as string | undefined;

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      const { stdout, stderr } = await execFileAsync("git", gitCommand.split(" "), {
        maxBuffer: 1024 * 1024 * 10, // 10MB for git output
        timeout,
        cwd: workdir,
      });

      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;
      return output || "(no output)";
    } catch (err: any) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      output += `\n[exit code: ${err.code ?? "unknown"}]`;
      return output;
    }
  },
};
