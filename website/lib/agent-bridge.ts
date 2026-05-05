// Server-side bridge: imports compiled agent core from dist/
// This file is only used by Next.js server (API routes)

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load root .env (two levels up from website/)
const envPath = path.resolve(process.cwd(), "../.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Verify keys loaded
console.log("[agent-bridge] GLM_API_KEY:", process.env.GLM_API_KEY ? "set" : "missing");
console.log("[agent-bridge] MINIMAX_API_KEY:", process.env.MINIMAX_API_KEY ? "set" : "missing");

import { AgentLoop } from "../../dist/agent/loop.js";
import {
  terminalTool,
  readFileTool,
  writeFileTool,
  lsTool,
  gitTool,
  gitStatusTool,
  gitLogTool,
  gitDiffTool,
  memoryWriteTool,
  memoryReadTool,
  memorySearchTool,
  memoryRemoveTool,
  soulWriteTool,
  soulReadTool,
  soulSearchTool,
  soulRemoveTool,
} from "../../dist/tool/index.js";
import { MODELS as CLI_MODELS } from "../../dist/cli/models.js";
import type { Model } from "../../dist/types.js";

const ALL_TOOLS = [
  terminalTool, readFileTool, writeFileTool, lsTool,
  gitTool, gitStatusTool, gitLogTool, gitDiffTool,
  memoryWriteTool, memoryReadTool, memorySearchTool, memoryRemoveTool,
  soulWriteTool, soulReadTool, soulSearchTool, soulRemoveTool,
];

export function createWebAgent(modelId: string, maxIterations = 20): AgentLoop {
  const model = CLI_MODELS[modelId];
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  console.log("[agent-bridge] Creating agent for model:", modelId, model.name);

  return new AgentLoop({
    model: model as Model,
    systemPrompt: "You are a helpful AI coding assistant. Be concise and direct.",
    tools: ALL_TOOLS,
    maxIterations,
  });
}

export function getAvailableModel(modelId: string): Model | undefined {
  return CLI_MODELS[modelId] as Model | undefined;
}

export function listModelIds(): string[] {
  return Object.keys(CLI_MODELS);
}
