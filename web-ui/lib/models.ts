// Web model registry — mirrors src/cli/models.ts without chalk dependencies

export interface WebModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  maxTokens: number;
  cost?: { inputPerMillion: number; outputPerMillion: number };
}

export const MODELS: Record<string, WebModel> = {
  "gpt-4o": {
    id: "gpt-4o", name: "GPT-4o", provider: "openai",
    contextWindow: 128000, maxTokens: 16384,
    cost: { inputPerMillion: 2.5, outputPerMillion: 10 },
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai",
    contextWindow: 128000, maxTokens: 16384,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  "claude-sonnet-4-20250514": {
    id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic",
    contextWindow: 200000, maxTokens: 16384,
    cost: { inputPerMillion: 3, outputPerMillion: 15 },
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini",
    contextWindow: 1000000, maxTokens: 65536,
    cost: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  "glm-5.1": {
    id: "glm-5.1", name: "GLM-5.1", provider: "glm",
    contextWindow: 128000, maxTokens: 4096,
    cost: { inputPerMillion: 0.05, outputPerMillion: 0.05 },
  },
  "glm-4.7": {
    id: "glm-4.7", name: "GLM-4.7", provider: "glm",
    contextWindow: 128000, maxTokens: 4096,
    cost: { inputPerMillion: 0.0001, outputPerMillion: 0.0001 },
  },
  "MiniMax-M2.7": {
    id: "MiniMax-M2.7", name: "MiniMax M2.7", provider: "minimax",
    contextWindow: 1000000, maxTokens: 16384,
  },
};

export const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  glm: "GLM",
  minimax: "MiniMax",
};

export function getModelsByProvider(): Record<string, WebModel[]> {
  const grouped: Record<string, WebModel[]> = {};
  for (const model of Object.values(MODELS)) {
    if (!grouped[model.provider]) grouped[model.provider] = [];
    grouped[model.provider].push(model);
  }
  return grouped;
}
