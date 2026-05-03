// ============================================================================
// Built-in tool: soul — agent's personality and identity via SOUL.md
//
// Four operations:
//   - soul_write: add a new personality/identity entry
//   - soul_read:  read all soul entries
//   - soul_search: search soul entries by keyword
//   - soul_remove: remove entries matching text
//
// The SOUL.md defines the agent's core identity, personality traits,
// communication style, and behavioral guidelines. Unlike MEMORY.md which
// stores facts about the user/environment, SOUL.md defines who the agent is.
// ============================================================================

import type { ToolHandler } from "../types.js";
import {
  addSoul,
  readSoul,
  searchSoul,
  removeSoul,
  getSoulStats,
} from "../soul/index.js";

export const soulWriteTool: ToolHandler = {
  definition: {
    name: "soul_write",
    description:
      "Add a personality trait, behavioral guideline, or identity element to SOUL.md. " +
      "Use this to define your character, communication style, values, or core principles. " +
      "Write in first person ('I am...', 'I prefer...', 'I always...'). " +
      "Examples: 'I am an optimistic and friendly assistant', " +
      "'I prefer to give concise answers', " +
      "'I always provide code examples when explaining technical concepts'.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The personality trait or guideline to add. Write in first person.",
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
    const count = await addSoul(content.trim());
    return `Soul entry added. Total soul entries: ${count}`;
  },
};

export const soulReadTool: ToolHandler = {
  definition: {
    name: "soul_read",
    description:
      "Read all soul entries from SOUL.md to review your current personality and identity. " +
      "Use this to understand who you are and how you should behave.",
    parameters: {
      type: "object",
      properties: {},
    },
  },

  async execute(): Promise<string> {
    const entries = await readSoul();
    const stats = await getSoulStats();
    if (entries.length === 0) {
      return `SOUL.md is empty (${stats.path}). You have no defined personality traits yet.`;
    }
    const header = `Your Soul (${entries.length} entries, ${stats.path}):\n`;
    return header + entries.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
  },
};

export const soulSearchTool: ToolHandler = {
  definition: {
    name: "soul_search",
    description:
      "Search soul entries by keyword. Use this to find specific personality traits or guidelines.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword or phrase to search for in your soul entries",
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
    const results = await searchSoul(query);
    if (results.length === 0) {
      return `No soul entries matching "${query}"`;
    }
    return results.map((e, i) => `  ${i + 1}. ${e}`).join("\n");
  },
};

export const soulRemoveTool: ToolHandler = {
  definition: {
    name: "soul_remove",
    description:
      "Remove soul entries that contain the given text. Use this to remove personality traits " +
      "or guidelines you no longer want to follow. Be careful when removing core identity elements.",
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
    const removed = await removeSoul(query);
    if (removed === 0) {
      return `No soul entries matched "${query}"`;
    }
    return `Removed ${removed} soul entr${removed === 1 ? "y" : "ies"}`;
  },
};
