// ============================================================================
// Model Registry — all available models, grouped by provider
// ============================================================================

import type { Model, ProviderName } from "../types.js";
import { chalk } from "./markdown.js";

export const MODELS: Record<string, Model> = {
  // ---- OpenAI ----
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    api: "openai",
    contextWindow: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 2.5, outputPerMillion: 10 },
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    api: "openai",
    contextWindow: 128000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },

  // ---- Anthropic ----
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    api: "anthropic",
    contextWindow: 200000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 3, outputPerMillion: 15 },
  },

  // ---- Google Gemini ----
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    api: "gemini",
    contextWindow: 1000000,
    maxTokens: 65536,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },

  // ---- 智谱 AI (GLM) ----
  "glm-5.1": {
    id: "glm-5.1",
    name: "GLM-5.1",
    provider: "glm",
    api: "openai",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.05, outputPerMillion: 0.05 },
  },
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM-4.7",
    provider: "glm",
    api: "openai",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    contextWindow: 128000,
    maxTokens: 4096,
    supportsStreaming: true,
    supportsToolCalling: true,
    cost: { inputPerMillion: 0.0001, outputPerMillion: 0.0001 },
  },

  // ---- MiniMax ----
  "MiniMax-M2.7": {
    id: "MiniMax-M2.7",
    name: "MiniMax M2.7",
    provider: "minimax",
    api: "openai",
    baseUrl: "https://api.minimax.chat/v1",
    contextWindow: 1000000,
    maxTokens: 16384,
    supportsStreaming: true,
    supportsToolCalling: true,
  },
};

/** Provider display info — uses chalk color functions instead of raw ANSI */
export const PROVIDER_INFO: Record<ProviderName, { label: string; colorFn: (text: string) => string; envKey: string }> = {
  openai:    { label: "OpenAI",    colorFn: chalk.green,    envKey: "OPENAI_API_KEY" },
  anthropic: { label: "Anthropic", colorFn: chalk.magenta,  envKey: "ANTHROPIC_API_KEY" },
  gemini:    { label: "Gemini",    colorFn: chalk.blue,     envKey: "GEMINI_API_KEY" },
  glm:       { label: "GLM/智谱",  colorFn: chalk.cyan,     envKey: "GLM_API_KEY" },
  minimax:   { label: "MiniMax",   colorFn: chalk.yellow,   envKey: "MINIMAX_API_KEY" },
};

/** Get models grouped by provider */
export function getModelsByProvider(): Record<ProviderName, Model[]> {
  const grouped: Record<string, Model[]> = {};
  for (const model of Object.values(MODELS)) {
    if (!grouped[model.provider]) grouped[model.provider] = [];
    grouped[model.provider].push(model);
  }
  return grouped as Record<ProviderName, Model[]>;
}

/** Resolve a model ID with fuzzy matching */
export function resolveModel(input: string): Model | null {
  // Exact match
  if (MODELS[input]) return MODELS[input];

  // Case-insensitive match
  const lower = input.toLowerCase();
  for (const [id, model] of Object.entries(MODELS)) {
    if (id.toLowerCase() === lower) return model;
  }

  // Partial match: check if input is a substring of model id or name
  for (const [id, model] of Object.entries(MODELS)) {
    if (id.toLowerCase().includes(lower) || model.name.toLowerCase().includes(lower)) {
      return model;
    }
  }

  return null;
}

/** Format token count to human-readable */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

/** Format cost per million tokens */
export function formatCost(cost: { inputPerMillion: number; outputPerMillion: number }): string {
  const inp = cost.inputPerMillion;
  const out = cost.outputPerMillion;
  if (inp === 0 && out === 0) return "free";
  if (inp < 0.01) return `$${inp.toFixed(4)}/$${out.toFixed(4)}`;
  return `$${inp}/$${out}`;
}
