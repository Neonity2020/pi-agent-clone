// ============================================================================
// Built-in tool: write_file — write content to a file
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import type { ToolHandler } from "../types.js";

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
    const filePath = args.path as string;
    const content = args.content as string;

    if (!filePath) {
      return "Error: path is required";
    }

    try {
      const resolved = path.resolve(filePath);

      // Create parent directories if they don't exist
      await fs.mkdir(path.dirname(resolved), { recursive: true });

      // Write the file
      await fs.writeFile(resolved, content, "utf-8");

      const lines = content.split("\n").length;
      const bytes = Buffer.byteLength(content, "utf-8");
      return `Successfully wrote ${lines} lines (${bytes} bytes) to ${resolved}`;
    } catch (err: any) {
      return `Error writing file: ${err.message}`;
    }
  },
};
