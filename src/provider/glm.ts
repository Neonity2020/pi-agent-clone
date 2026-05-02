// ============================================================================
// GLM Provider Transport (智谱 AI)
// OpenAI-compatible API via raw fetch — no SDK dependency
// Base URL: https://open.bigmodel.cn/api/coding/paas/v4
// ============================================================================

import type {
  ProviderTransport,
  StreamOptions,
  StreamEvent,
  AssistantMessage,
} from "../types.js";
import {
  emptyAssistantMessage,
  toOpenAIMessages,
  toOpenAITools,
  parseSSELines,
} from "./helpers.js";

export class GLMTransport implements ProviderTransport {
  readonly name = "glm" as const;
  readonly api = "openai" as const;

  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || "https://open.bigmodel.cn/api/coding/paas/v4";
  }

  async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
    const { model, messages, systemPrompt, tools, temperature, maxTokens, signal, apiKey } = options;

    const key = apiKey || process.env.GLM_API_KEY || "";
    if (!key) {
      yield { type: "error", error: new Error("GLM_API_KEY not set"), message: emptyAssistantMessage() };
      return;
    }

    const partial = emptyAssistantMessage();

    try {
      // Build request body in OpenAI format
      const body: Record<string, unknown> = {
        model: model.id,
        messages: systemPrompt
          ? [{ role: "system", content: systemPrompt }, ...toOpenAIMessages(messages)]
          : toOpenAIMessages(messages),
        stream: true,
      };

      if (temperature !== undefined) body.temperature = temperature;
      if (maxTokens !== undefined) body.max_tokens = maxTokens;

      const openaiTools = toOpenAITools(tools);
      if (openaiTools) body.tools = openaiTools;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const text = await response.text();
        yield { type: "error", error: new Error(`GLM API error ${response.status}: ${text}`), message: partial };
        return;
      }

      if (!response.body) {
        yield { type: "error", error: new Error("GLM: empty response body"), message: partial };
        return;
      }

      yield { type: "start", message: partial };

      for await (const data of parseSSELines(response.body, signal)) {
        let chunk: any;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }

        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (!delta) continue;

        // Text
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
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) {
              existing.arguments += tc.function.arguments;
              yield { type: "tool_call_delta", index: idx, arguments: tc.function.arguments };
            }
            if (tc.id || tc.function?.name) {
              yield { type: "tool_call_start", index: idx, id: existing.id, name: existing.name };
            }
          }
        }

        // Usage (GLM may include in final chunk)
        if (chunk.usage) {
          partial.usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
          yield { type: "usage", usage: partial.usage };
        }

        // Finish
        if (choice.finish_reason) {
          partial.stopReason = choice.finish_reason === "tool_calls"
            ? "tool_use"
            : choice.finish_reason === "length"
            ? "max_tokens"
            : "stop";
        }
      }

      // Fill in missing tool call IDs
      if (partial.toolCalls) {
        for (let i = 0; i < partial.toolCalls.length; i++) {
          if (!partial.toolCalls[i].id) {
            partial.toolCalls[i].id = `glm_call_${i}_${Date.now()}`;
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
