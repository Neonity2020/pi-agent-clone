// ============================================================================
// Built-in tool: write_file — write content to a file (with path sandboxing)
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import type { ToolHandler } from "../types.js";
import {
  resolveSandboxedPath,
  checkSensitivePath,
  validateWriteSize,
  validateStringArg,
} from "../utils/security.js";

export const writeFileTool: ToolHandler = {
  definition: {
    name: "write_file",
    description:
      "Write content to a file. Creates the file if it does not exist, overwrites if it does. " +
      "Parent directories are created automatically. Use this instead of terminal echo/cat for file creation.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write",
        },
        content: {
          type: "string",
          description: "The complete content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = validateStringArg(args.path, "path");
    const content = validateStringArg(args.content, "content");

    try {
      // Security: validate content size
      validateWriteSize(content);

      // Security: resolve and validate path is within sandbox
      const resolved = resolveSandboxedPath(filePath);

      // Security: warn about sensitive files
      const sensitiveWarning = checkSensitivePath(resolved);

      // Create parent directories if they don't exist
      await fs.mkdir(path.dirname(resolved), { recursive: true });

      // Write the file
      await fs.writeFile(resolved, content, "utf-8");

      const lines = content.split("\n").length;
      const bytes = Buffer.byteLength(content, "utf-8");
      let result = `Successfully wrote ${lines} lines (${bytes} bytes) to ${resolved}`;
      if (sensitiveWarning) {
        result = sensitiveWarning + "\n" + result;
      }
      return result;
    } catch (err: any) {
      if (err.message?.startsWith("Security:")) {
        return err.message;
      }
      return `Error writing file: ${err.message}`;
    }
  },
};
