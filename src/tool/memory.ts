// ============================================================================
// Built-in tool: memory — long-term memory via MEMORY.md
//
// Three operations:
//   - memory_write: add a new memory entry
//   - memory_read:  read all memory entries
//   - memory_search: search memory by keyword
//   - memory_remove: remove entries matching text
// ============================================================================

import type { ToolHandler } from "../types.js";
import {
  addMemory,
  readMemory,
  searchMemory,
  removeMemory,
  getMemoryStats,
} from "../memory/index.js";

export const memoryWriteTool: ToolHandler = {
  definition: {
    name: "memory_write",
    description:
      "Save an important fact to long-term memory (MEMORY.md). " +
      "Use this to remember user preferences, project conventions, environment details, " +
      "or any information that should persist across sessions. " +
      "Write declarative facts, not instructions. Examples: " +
      "'User prefers Chinese responses', 'Project uses pnpm not npm', " +
      "'GLM API base URL is https://open.bigmodel.cn/api/paas/v4'.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The fact to save to memory. Write as a declarative statement.",
        },
      },
      required: ["content"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const content = args.content as string;
    if (!content?.trim()) {
      return "Error: content is required";
    }
    const count = await addMemory(content.trim());
    return `Memory saved. Total entries: ${count}`;
  },
};

export const memoryReadTool: ToolHandler = {
  definition: {
    name: "memory_read",
    description:
      "Read all long-term memory entries from MEMORY.md. " +
      "Use this to recall previously saved facts about the user, project, or environment.",
    parameters: {
      type: "object",
      properties: {},
    },
  },

  async execute(): Promise<string> {
    const entries = await readMemory();
    const stats = await getMemoryStats();
    if (entries.length === 0) {
      return `Memory is empty (${stats.path})`;
    }
    const header = `Memory (${entries.length} entries, ${stats.path}):\n`;
    return header + entries.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
  },
};

export const memorySearchTool: ToolHandler = {
  definition: {
    name: "memory_search",
    description:
      "Search long-term memory entries by keyword. Returns matching entries.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword or phrase to search for",
        },
      },
      required: ["query"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const query = args.query as string;
    if (!query?.trim()) {
      return "Error: query is required";
    }
    const results = await searchMemory(query);
    if (results.length === 0) {
      return `No memory entries matching "${query}"`;
    }
    return results.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
  },
};

export const memoryRemoveTool: ToolHandler = {
  definition: {
    name: "memory_remove",
    description:
      "Remove memory entries that contain the given text. Use this to delete outdated or incorrect facts.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text to match for removal. All entries containing this text will be removed.",
        },
      },
      required: ["query"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const query = args.query as string;
    if (!query?.trim()) {
      return "Error: query is required";
    }
    const removed = await removeMemory(query);
    if (removed === 0) {
      return `No entries matched "${query}"`;
    }
    return `Removed ${removed} entr${removed === 1 ? "y" : "ies"}`;
  },
};
