// ============================================================================
// Provider Registry — register and resolve transports
// ============================================================================

import type { ProviderName, ProviderTransport, Model } from "../types.js";
import { OpenAITransport } from "./openai.js";
import { AnthropicTransport } from "./anthropic.js";
import { GeminiTransport } from "./gemini.js";
import { GLMTransport } from "./glm.js";
import { MiniMaxTransport } from "./minimax.js";

const registry = new Map<ProviderName, ProviderTransport>();

/** Register a transport for a provider */
export function registerTransport(transport: ProviderTransport): void {
  registry.set(transport.name, transport);
}

/** Get the transport for a provider */
export function getTransport(provider: ProviderName): ProviderTransport {
  const transport = registry.get(provider);
  if (!transport) throw new Error(`No transport registered for provider: ${provider}`);
  return transport;
}

/** Resolve the transport for a model (uses model.provider) */
export function getTransportForModel(model: Model): ProviderTransport {
  return getTransport(model.provider);
}

/** List all registered providers */
export function listProviders(): ProviderName[] {
  return Array.from(registry.keys());
}

// ---- Auto-register built-in providers ----
registerTransport(new OpenAITransport());
registerTransport(new AnthropicTransport());
registerTransport(new GeminiTransport());
registerTransport(new GLMTransport());
registerTransport(new MiniMaxTransport());
