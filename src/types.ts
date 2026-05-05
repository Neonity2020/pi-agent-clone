// ============================================================================
// neonity-agent: Core Types
// Inspired by pi-mono's @mariozechner/pi-ai types.ts
// ============================================================================

// ---- Provider identifiers -------------------------------------------------

/** Wire protocol types */
export type ApiMode =
  | "openai"        // OpenAI-compatible (covers OpenAI, GLM, MiniMax, DeepSeek, etc.)
  | "anthropic"     // Anthropic Messages API
  | "gemini";       // Google Generative AI

/** Named provider */
export type ProviderName =
  | "openai"
  | "anthropic"
  | "gemini"
  | "glm"           // 智谱 AI (OpenAI-compatible)
  | "minimax";      // MiniMax (OpenAI-compatible)

// ---- Model ----------------------------------------------------------------

export interface Model {
  id: string;               // e.g. "gpt-4o", "claude-sonnet-4-20250514"
  name: string;             // Human-readable name
  provider: ProviderName;
  api: ApiMode;
  baseUrl?: string;         // Override base URL for compatible providers
  contextWindow: number;    // Max context tokens
  maxTokens: number;        // Max output tokens
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  cost?: {
    inputPerMillion: number;   // USD per 1M input tokens
    outputPerMillion: number;  // USD per 1M output tokens
  };
}

// ---- Messages -------------------------------------------------------------

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;          // Text content
  toolCalls?: ToolCall[];   // Tool calls if any
  stopReason?: StopReason;
  usage?: Usage;
}

export interface ToolResultMessage {
  role: "tool_result";
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export type StopReason = "stop" | "tool_use" | "error" | "aborted" | "max_tokens";

// ---- Tool Calling ---------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;       // JSON string
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

export interface ToolHandler {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}

// ---- Usage ----------------------------------------------------------------

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

// ---- Streaming Events -----------------------------------------------------

export type StreamEvent =
  | { type: "start"; message: AssistantMessage }
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; index: number; id: string; name: string }
  | { type: "tool_call_delta"; index: number; arguments: string }
  | { type: "usage"; usage: Usage }
  | { type: "done"; message: AssistantMessage }
  | { type: "error"; error: Error; message: AssistantMessage };

// ---- Provider Transport ---------------------------------------------------

export interface StreamOptions {
  model: Model;
  messages: Message[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  apiKey?: string;
}

/**
 * Provider transport interface.
 * Each provider implements this to handle LLM communication.
 */
export interface ProviderTransport {
  readonly name: ProviderName;
  readonly api: ApiMode;

  /**
   * Stream a response from the LLM.
   * Returns an async iterable of StreamEvent.
   * Errors must be emitted as { type: "error" } events, never thrown.
   */
  stream(options: StreamOptions): AsyncIterable<StreamEvent>;
}

// ---- Agent Loop -----------------------------------------------------------

export interface AgentConfig {
  model: Model;
  systemPrompt?: string;
  tools?: ToolHandler[];
  maxIterations: number;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}

/** Events emitted by the agent loop during execution */
export type AgentEvent =
  | { type: "turn_start" }
  | { type: "message_start"; message: AssistantMessage }
  | { type: "message_delta"; delta: string }
  | { type: "message_done"; message: AssistantMessage }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_call_result"; toolCallId: string; result: string; isError: boolean }
  | { type: "turn_end" }
  | { type: "agent_end"; reason: "completed" | "error" | "aborted" | "max_iterations" }
  | { type: "error"; error: Error };

export interface AgentRunResult {
  messages: Message[];
  events: AgentEvent[];
  totalUsage: Usage;
  iterations: number;
  stopReason: string;
}
