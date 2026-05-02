// ============================================================================
// Provider helpers — shared utilities for all providers
// ============================================================================

import type { Message, ToolDefinition, ToolCall, StreamEvent, AssistantMessage, Usage } from "../types.js";

/** Build a fresh empty AssistantMessage */
export function emptyAssistantMessage(): AssistantMessage {
  return {
    role: "assistant",
    content: "",
    toolCalls: [],
    stopReason: undefined,
    usage: undefined,
  };
}

/** Convert our Message[] to OpenAI-compatible chat format */
export function toOpenAIMessages(messages: Message[]): Array<Record<string, unknown>> {
  return messages.map((msg) => {
    switch (msg.role) {
      case "user":
        return { role: "user", content: msg.content };
      case "assistant": {
        const result: Record<string, unknown> = { role: "assistant", content: msg.content || null };
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          result.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          }));
        }
        return result;
      }
      case "tool_result":
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };
    }
  });
}

/** Convert ToolDefinition[] to OpenAI function tools format */
export function toOpenAITools(tools?: ToolDefinition[]): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

/** Generate a tool call ID */
export function generateToolCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Safely parse JSON, return original string on failure */
export function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

/**
 * Shared SSE parser for OpenAI-compatible streaming.
 * Yields raw event strings from an SSE stream.
 */
export async function* parseSSELines(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Accumulate streaming chunks into an AssistantMessage,
 * emitting StreamEvents as we go.
 */
export function processOpenAIDelta(
  partial: AssistantMessage,
  delta: {
    content?: string;
    tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
  },
): StreamEvent[] {
  const events: StreamEvent[] = [];

  // Text delta
  if (delta.content) {
    partial.content += delta.content;
    events.push({ type: "text_delta", text: delta.content });
  }

  // Tool call deltas
  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      const idx = tc.index ?? 0;
      if (!partial.toolCalls) partial.toolCalls = [];

      // Ensure the tool call slot exists
      while (partial.toolCalls.length <= idx) {
        partial.toolCalls.push({ id: "", name: "", arguments: "" });
      }

      const existing = partial.toolCalls[idx];

      if (tc.id) {
        existing.id = tc.id;
        events.push({ type: "tool_call_start", index: idx, id: tc.id, name: tc.function?.name || "" });
      }
      if (tc.function?.name) {
        existing.name = tc.function.name;
      }
      if (tc.function?.arguments) {
        existing.arguments += tc.function.arguments;
        events.push({ type: "tool_call_delta", index: idx, arguments: tc.function.arguments });
      }
    }
  }

  return events;
}
