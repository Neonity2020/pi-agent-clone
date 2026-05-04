// ============================================================================
// Built-in tool: read_file — read file contents (with path sandboxing)
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import type { ToolHandler } from "../types.js";
import {
  resolveSandboxedPath,
  checkSensitivePath,
  validateStringArg,
  validateNumberArg,
} from "../utils/security.js";

export const readFileTool: ToolHandler = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file. Returns file content with line numbers.",
    parameters: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to read",
        },
        offset: {
          type: "number",
          description: "Line number to start reading from (1-indexed, default: 1)",
        },
        limit: {
          type: "number",
          description: "Maximum number of lines to read (default: 500, max: 2000)",
        },
      },
      required: ["file_path"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = validateStringArg(args.file_path, "file_path");
    const offset = validateNumberArg(args.offset ?? 1, "offset", 1);
    const limit = validateNumberArg(args.limit ?? 500, "limit", 1, 2000);

    try {
      // Security: resolve and validate path is within sandbox
      const resolved = resolveSandboxedPath(filePath);

      // Security: warn about sensitive files
      const sensitiveWarning = checkSensitivePath(resolved);
      let header = "";
      if (sensitiveWarning) {
        header += sensitiveWarning + "\n";
      }

      const content = await fs.readFile(resolved, "utf-8");
      const lines = content.split("\n");
      const selected = lines.slice(offset - 1, offset - 1 + limit);

      const body = selected
        .map((line, i) => `${String(offset + i).padStart(6)}|${line}`)
        .join("\n");

      return header + body;
    } catch (err: any) {
      if (err.message?.startsWith("Security:")) {
        return err.message;
      }
      return `Error reading file: ${err.message}`;
    }
  },
};
