// ============================================================================
// Built-in tool: read_file — read file contents
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import type { ToolHandler } from "../types.js";

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
          description: "Maximum number of lines to read (default: 500)",
        },
      },
      required: ["file_path"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const filePath = args.file_path as string;
    const offset = (args.offset as number) || 1;
    const limit = (args.limit as number) || 500;

    try {
      const resolved = path.resolve(filePath);
      const content = await fs.readFile(resolved, "utf-8");
      const lines = content.split("\n");
      const selected = lines.slice(offset - 1, offset - 1 + limit);

      return selected
        .map((line, i) => `${String(offset + i).padStart(6)}|${line}`)
        .join("\n");
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  },
};
