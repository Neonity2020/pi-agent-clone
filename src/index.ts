// ============================================================================
// neonity-agent — barrel export
// ============================================================================

export type {
  ApiMode,
  ProviderName,
  Model,
  UserMessage,
  AssistantMessage,
  ToolResultMessage,
  Message,
  StopReason,
  ToolCall,
  ToolDefinition,
  ToolHandler,
  Usage,
  StreamEvent,
  StreamOptions,
  ProviderTransport,
  AgentConfig,
  AgentEvent,
  AgentRunResult,
} from "./types.js";

export { AgentLoop } from "./agent/loop.js";
export {
  OpenAITransport,
  AnthropicTransport,
  GeminiTransport,
  GLMTransport,
  MiniMaxTransport,
  getTransport,
  getTransportForModel,
  listProviders,
  registerTransport,
} from "./provider/index.js";
