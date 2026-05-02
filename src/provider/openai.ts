// ============================================================================
// OpenAI Provider Transport
// Uses the official openai SDK for streaming
// ============================================================================

import OpenAI from "openai";
import type {
  ProviderTransport,
  StreamOptions,
  StreamEvent,
  AssistantMessage,
  ToolCall,
  Model,
} from "../types.js";
import { emptyAssistantMessage, generateToolCallId, toOpenAIMessages, toOpenAITools } from "./helpers.js";

export class OpenAITransport implements ProviderTransport {
  readonly name = "openai" as const;
  readonly api = "openai" as const;

  private getClient(apiKey: string, baseURL?: string): OpenAI {
    return new OpenAI({ apiKey, baseURL: baseURL || undefined });
  }

  async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
    const {
      model,
      messages,
      systemPrompt,
      tools,
      temperature,
      maxTokens,
      signal,
      apiKey,
    } = options;

    const key = apiKey || process.env.OPENAI_API_KEY || "";
    if (!key) {
      yield { type: "error", error: new Error("OpenAI API key not set"), message: emptyAssistantMessage() };
      return;
    }

    const client = this.getClient(key, model.baseUrl);

    // Build messages array with optional system prompt
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      openaiMessages.push({ role: "system", content: systemPrompt });
    }
    openaiMessages.push(...(toOpenAIMessages(messages) as unknown as OpenAI.ChatCompletionMessageParam[]));

    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: model.id,
      messages: openaiMessages,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (temperature !== undefined) params.temperature = temperature;
    if (maxTokens !== undefined) params.max_tokens = maxTokens;

    const openaiTools = toOpenAITools(tools);
    if (openaiTools) params.tools = openaiTools as unknown as OpenAI.ChatCompletionTool[];

    const partial = emptyAssistantMessage();

    try {
      const stream = await client.chat.completions.create(params, { signal });

      yield { type: "start", message: partial };

      for await (const chunk of stream) {
        if (signal?.aborted) break;

        const choice = chunk.choices?.[0];
        const delta = choice?.delta;

        // Usage
        if (chunk.usage) {
          partial.usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
          yield { type: "usage", usage: partial.usage };
        }

        if (!delta) continue;

        // Text content
        if (delta.content) {
          partial.content += delta.content;
          yield { type: "text_delta", text: delta.content };
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!partial.toolCalls) partial.toolCalls = [];

            while (partial.toolCalls.length <= idx) {
              partial.toolCalls.push({ id: "", name: "", arguments: "" });
            }

            const existing = partial.toolCalls[idx];

            if (tc.id) {
              existing.id = tc.id;
            }
            if (tc.function?.name) {
              existing.name = tc.function.name;
              yield { type: "tool_call_start", index: idx, id: existing.id, name: existing.name };
            }
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
              yield { type: "tool_call_delta", index: idx, arguments: tc.function.arguments };
            }
          }
        }

        // Stop reason
        if (choice?.finish_reason) {
          partial.stopReason = mapFinishReason(choice.finish_reason);
        }
      }

      // Fix tool call IDs if missing
      if (partial.toolCalls) {
        for (const tc of partial.toolCalls) {
          if (!tc.id) tc.id = generateToolCallId();
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

function mapFinishReason(reason: string): "stop" | "tool_use" | "max_tokens" {
  switch (reason) {
    case "tool_calls": return "tool_use";
    case "length": return "max_tokens";
    default: return "stop";
  }
}
