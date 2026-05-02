// ============================================================================
// Anthropic Provider Transport
// Uses the official @anthropic-ai/sdk for streaming
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import type {
  ProviderTransport,
  StreamOptions,
  StreamEvent,
  AssistantMessage,
  ToolCall,
  Model,
  ToolDefinition,
  Usage,
} from "../types.js";
import { emptyAssistantMessage, generateToolCallId } from "./helpers.js";

export class AnthropicTransport implements ProviderTransport {
  readonly name = "anthropic" as const;
  readonly api = "anthropic" as const;

  private getClient(apiKey: string): Anthropic {
    return new Anthropic({ apiKey });
  }

  /** Convert our messages to Anthropic format */
  private convertMessages(messages: import("../types.js").Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];
    for (const msg of messages) {
      switch (msg.role) {
        case "user":
          result.push({ role: "user", content: msg.content });
          break;
        case "assistant":
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            // Anthropic uses content blocks for tool_use
            const blocks: Anthropic.ContentBlockParam[] = [];
            if (msg.content) {
              blocks.push({ type: "text", text: msg.content });
            }
            for (const tc of msg.toolCalls) {
              blocks.push({
                type: "tool_use",
                id: tc.id,
                name: tc.name,
                input: JSON.parse(tc.arguments || "{}"),
              });
            }
            result.push({ role: "assistant", content: blocks });
          } else {
            result.push({ role: "assistant", content: msg.content });
          }
          break;
        case "tool_result":
          result.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: msg.toolCallId,
                content: msg.content,
                is_error: msg.isError ?? false,
              },
            ],
          });
          break;
      }
    }
    return result;
  }

  /** Convert our tool definitions to Anthropic format */
  private convertTools(tools?: ToolDefinition[]): Anthropic.Tool[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));
  }

  async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
    const { model, messages, systemPrompt, tools, temperature, maxTokens, signal, apiKey } = options;

    const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
    if (!key) {
      yield { type: "error", error: new Error("Anthropic API key not set"), message: emptyAssistantMessage() };
      return;
    }

    const client = this.getClient(key);
    const partial = emptyAssistantMessage();

    try {
      const params: Anthropic.MessageCreateParamsStreaming = {
        model: model.id,
        messages: this.convertMessages(messages),
        max_tokens: maxTokens ?? model.maxTokens,
        stream: true,
      };

      if (systemPrompt) params.system = systemPrompt;
      if (temperature !== undefined) params.temperature = temperature;

      const anthropicTools = this.convertTools(tools);
      if (anthropicTools) params.tools = anthropicTools;

      const stream = client.messages.stream(params, { signal });

      yield { type: "start", message: partial };

      // The SDK's stream() returns a MessageStream that yields events
      for await (const event of stream) {
        if (signal?.aborted) break;

        switch (event.type) {
          case "content_block_start": {
            if (event.content_block.type === "text") {
              // Text block starting
            } else if (event.content_block.type === "tool_use") {
              const idx = event.index;
              if (!partial.toolCalls) partial.toolCalls = [];
              while (partial.toolCalls.length <= idx) {
                partial.toolCalls.push({ id: "", name: "", arguments: "" });
              }
              partial.toolCalls[idx] = {
                id: event.content_block.id,
                name: event.content_block.name,
                arguments: "",
              };
              yield {
                type: "tool_call_start",
                index: idx,
                id: event.content_block.id,
                name: event.content_block.name,
              };
            }
            break;
          }

          case "content_block_delta": {
            if (event.delta.type === "text_delta") {
              partial.content += event.delta.text;
              yield { type: "text_delta", text: event.delta.text };
            } else if (event.delta.type === "input_json_delta") {
              const idx = event.index;
              if (partial.toolCalls?.[idx]) {
                partial.toolCalls[idx].arguments += event.delta.partial_json;
                yield { type: "tool_call_delta", index: idx, arguments: event.delta.partial_json };
              }
            }
            break;
          }

          case "message_delta": {
            if (event.delta.stop_reason) {
              partial.stopReason = mapAnthropicStop(event.delta.stop_reason);
            }
            if (event.usage) {
              // Anthropic sends output tokens in message_delta
              const existing = partial.usage || { inputTokens: 0, outputTokens: 0 };
              partial.usage = {
                ...existing,
                outputTokens: event.usage.output_tokens,
              };
              yield { type: "usage", usage: partial.usage };
            }
            break;
          }

          case "message_start": {
            if (event.message.usage) {
              partial.usage = {
                inputTokens: event.message.usage.input_tokens,
                outputTokens: event.message.usage.output_tokens,
              };
              yield { type: "usage", usage: partial.usage };
            }
            break;
          }
        }
      }

      if (!partial.stopReason) partial.stopReason = "stop";
      yield { type: "done", message: partial };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (signal?.aborted) {
        partial.stopReason = "aborted";
        yield { type: "done", message: partial };
      } else {
        yield { type: "error", error, message: partial };
      }
    }
  }
}

function mapAnthropicStop(reason: string): "stop" | "tool_use" | "max_tokens" {
  switch (reason) {
    case "tool_use": return "tool_use";
    case "max_tokens": return "max_tokens";
    default: return "stop";
  }
}
