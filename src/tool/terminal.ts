// ============================================================================
// Built-in tool: terminal — execute shell commands (with security validation)
// ============================================================================

import type { ToolHandler } from "../types.js";
import { validateCommand, validateStringArg, validateNumberArg } from "../utils/security.js";

export const terminalTool: ToolHandler = {
  definition: {
    name: "terminal",
    description: "Execute a shell command and return its output. Use for running builds, tests, git commands, and any shell operations.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        timeout: {
          type: "number",
          description: "Timeout in seconds (default: 30, max: 300)",
        },
        workdir: {
          type: "string",
          description: "Working directory for the command",
        },
      },
      required: ["command"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const command = validateStringArg(args.command, "command");
    const timeout = validateNumberArg(args.timeout ?? 30, "timeout", 1, 300) * 1000;
    const workdir = args.workdir as string | undefined;

    // Security: validate command for dangerous patterns
    const validation = validateCommand(command);
    if (!validation.allowed) {
      return `Security: ${validation.reason}`;
    }

    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      const { stdout, stderr } = await execFileAsync("sh", ["-c", command], {
        maxBuffer: 1024 * 1024, // 1MB
        timeout,
        cwd: workdir,
      });

      let output = "";
      if (validation.warning) {
        output += validation.warning + "\n";
      }
      if (stdout) output += stdout;
      if (stderr) output += (output && !output.endsWith("\n") ? "\n" : "") + stderr;
      return output || "(no output)";
    } catch (err: any) {
      let output = "";
      if (validation.warning) {
        output += validation.warning + "\n";
      }
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output && !output.endsWith("\n") ? "\n" : "") + err.stderr;
      output += `\n[exit code: ${err.code ?? "unknown"}]`;
      return output;
    }
  },
};
