// ============================================================================
// Gemini Provider Transport
// Uses the official @google/generative-ai SDK
// ============================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ProviderTransport,
  StreamOptions,
  StreamEvent,
  AssistantMessage,
  Message,
  ToolDefinition,
} from "../types.js";
import { emptyAssistantMessage, generateToolCallId } from "./helpers.js";

export class GeminiTransport implements ProviderTransport {
  readonly name = "gemini" as const;
  readonly api = "gemini" as const;

  async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
    const { model, messages, systemPrompt, tools, temperature, maxTokens, signal, apiKey } = options;

    const key = apiKey || process.env.GEMINI_API_KEY || "";
    if (!key) {
      yield { type: "error", error: new Error("Gemini API key not set"), message: emptyAssistantMessage() };
      return;
    }

    const genAI = new GoogleGenerativeAI(key);
    const partial = emptyAssistantMessage();

    try {
      // Convert messages to Gemini format
      const geminiHistory = this.convertMessages(messages);

      // Build generative model config
      const modelConfig: Record<string, unknown> = {};
      if (temperature !== undefined) modelConfig.temperature = temperature;
      if (maxTokens !== undefined) modelConfig.maxOutputTokens = maxTokens;

      // System instruction
      const modelParams: Record<string, unknown> = { model: model.id, ...modelConfig };
      // Note: systemInstruction is set on the model, not in chat

      const genModel = genAI.getGenerativeModel({
        model: model.id,
        systemInstruction: systemPrompt || undefined,
        generationConfig: {
          ...(temperature !== undefined ? { temperature } : {}),
          ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
        },
      });

      // Convert tools to Gemini format
      const geminiTools = this.convertTools(tools);

      // Separate the last user message for the initial send
      const lastUserMsg = geminiHistory.pop();
      if (!lastUserMsg) {
        yield { type: "error", error: new Error("No user message to send"), message: partial };
        return;
      }

      const chat = genModel.startChat({
        history: geminiHistory as any,
        tools: geminiTools ? [{ functionDeclarations: geminiTools as any }] : undefined,
      });

      yield { type: "start", message: partial };

      // Send the last user message as the prompt
      const userText = (lastUserMsg as any).parts?.map((p: any) => p.text).join("") || "";
      const result = await chat.sendMessageStream(userText);

      for await (const chunk of result.stream) {
        if (signal?.aborted) break;

        // Text content
        const text = chunk.text();
        if (text) {
          partial.content += text;
          yield { type: "text_delta", text };
        }

        // Function calls
        const funcCalls = chunk.functionCalls();
        if (funcCalls && funcCalls.length > 0) {
          if (!partial.toolCalls) partial.toolCalls = [];
          for (const fc of funcCalls) {
            const id = generateToolCallId();
            const args = JSON.stringify(fc.args || {});
            const toolCall = { id, name: fc.name, arguments: args };
            partial.toolCalls.push(toolCall);
            const idx = partial.toolCalls.length - 1;
            yield { type: "tool_call_start", index: idx, id, name: fc.name };
            yield { type: "tool_call_delta", index: idx, arguments: args };
          }
        }

        // Usage
        if (chunk.usageMetadata) {
          partial.usage = {
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
          };
          yield { type: "usage", usage: partial.usage };
        }
      }

      // Determine stop reason
      if (partial.toolCalls && partial.toolCalls.length > 0) {
        partial.stopReason = "tool_use";
      } else {
        partial.stopReason = "stop";
      }

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

  /** Convert our messages to Gemini chat history format */
  private convertMessages(messages: Message[]): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
    const result: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (const msg of messages) {
      switch (msg.role) {
        case "user":
          result.push({ role: "user", parts: [{ text: msg.content }] });
          break;
        case "assistant": {
          const parts: Array<Record<string, unknown>> = [];
          if (msg.content) parts.push({ text: msg.content });
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              parts.push({
                functionCall: { name: tc.name, args: JSON.parse(tc.arguments || "{}") },
              });
            }
          }
          result.push({ role: "model", parts });
          break;
        }
        case "tool_result": {
          result.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: msg.toolCallId,
                  response: { result: msg.content },
                },
              },
            ],
          });
          break;
        }
      }
    }

    return result;
  }

  /** Convert tool definitions to Gemini function declarations */
  private convertTools(tools?: ToolDefinition[]): Array<Record<string, unknown>> | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }
}
