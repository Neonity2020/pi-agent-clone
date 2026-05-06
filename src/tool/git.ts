// ============================================================================
// Built-in tool: git — execute Git commands (with proper argument parsing)
// ============================================================================

import type { ToolHandler } from "../types.js";
import { validateStringArg, validateNumberArg, getSandboxRoot, resolveSandboxedPath } from "../utils/security.js";

/**
 * Parse a command string into an array of arguments, respecting quoted strings.
 * e.g. 'commit -m "fix: hello world"' → ['commit', '-m', 'fix: hello world']
 */
function parseCommandString(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      if (inDoubleQuote) {
        escaped = true;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    args.push(current);
  }

  return args;
}

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
    const gitCommand = validateStringArg(args.command, "command");
    const timeout = validateNumberArg(args.timeout ?? 60, "timeout", 1, 600) * 1000;

    // Resolve workdir within sandbox (default to sandbox root)
    let workdir: string;
    try {
      workdir = args.workdir
        ? resolveSandboxedPath(args.workdir as string)
        : getSandboxRoot();
    } catch (err: any) {
      return `Security: ${err.message}`;
    }

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    // Security: parse command respecting quotes instead of naive split(" ")
    const gitArgs = parseCommandString(gitCommand);

    try {
      const { stdout, stderr } = await execFileAsync("git", gitArgs, {
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
