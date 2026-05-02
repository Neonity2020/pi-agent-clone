// ============================================================================
// Agent Loop — REACT pattern: Reason → Act → Observe → repeat
//
// Inspired by pi-mono's agent-loop.ts:
//   - Streaming LLM responses with event emission
//   - Tool execution (parallel by default)
//   - Multi-turn iteration budget
//   - Graceful abort handling
//   - Error recovery
//   - Context window protection (80% threshold)
// ============================================================================

import type {
  AgentConfig,
  AgentEvent,
  AgentRunResult,
  AssistantMessage,
  Message,
  StreamEvent,
  ToolCall,
  ToolHandler,
  ToolResultMessage,
  Usage,
} from "../types.js";
import { getTransportForModel } from "../provider/registry.js";
import { trimMessages, getContextInfo } from "../context/index.js";

export class AgentLoop {
  private config: AgentConfig;
  private messages: Message[] = [];
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /** Get current conversation messages */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /** Abort the current run */
  abort(): void {
    this.abortController?.abort();
  }

  /**
   * Run the agent loop with a user message.
   * Returns the full result including all events and messages.
   */
  async run(
    userMessage: string,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<AgentRunResult> {
    this.abortController = new AbortController();
    const events: AgentEvent[] = [];
    const totalUsage: Usage = { inputTokens: 0, outputTokens: 0 };
    let iterations = 0;

    const emit = (event: AgentEvent) => {
      events.push(event);
      onEvent?.(event);
    };

    // Add user message to history
    this.messages.push({ role: "user", content: userMessage });

    try {
      while (iterations < this.config.maxIterations) {
        iterations++;

        // Check abort
        if (this.abortController.signal.aborted) {
          emit({ type: "agent_end", reason: "aborted" });
          break;
        }

        // Check and trim context before calling LLM
        const contextInfo = getContextInfo(this.messages, this.config.model);
        if (contextInfo.needsTrim) {
          const beforeLength = this.messages.length;
          this.messages = trimMessages(this.messages, this.config.model);
          emit({
            type: "turn_start",
          } as any);
          // Emit a debug event for context trim (optional)
          console.warn(
            `[Context] Trimmed from ${beforeLength} to ${this.messages.length} messages ` +
              `(${contextInfo.usagePercentage}% of ${contextInfo.contextWindow} tokens)`,
          );
        } else {
          emit({ type: "turn_start" });
        }

        // Stream LLM response
        const assistantMessage = await this.streamResponse(emit, totalUsage);

        // Check for errors or abort
        if (assistantMessage.stopReason === "error") {
          emit({ type: "agent_end", reason: "error" });
          break;
        }
        if (assistantMessage.stopReason === "aborted") {
          emit({ type: "agent_end", reason: "aborted" });
          break;
        }

        // Add assistant message to history
        this.messages.push(assistantMessage);

        // Check if there are tool calls to execute
        const toolCalls = assistantMessage.toolCalls;
        if (!toolCalls || toolCalls.length === 0) {
          // No tool calls — agent is done
          emit({ type: "turn_end" });
          emit({ type: "agent_end", reason: "completed" });
          break;
        }

        // Execute tool calls
        const toolResults = await this.executeToolCalls(toolCalls, emit);

        // Add tool results to history
        for (const result of toolResults) {
          this.messages.push(result);
        }

        emit({ type: "turn_end" });

        // If stop reason was tool_use, continue the loop to get next response
        // If stop reason was max_tokens or stop, we still continue because
        // the LLM explicitly asked for tool execution
      }

      if (iterations >= this.config.maxIterations) {
        emit({ type: "agent_end", reason: "max_iterations" });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      emit({ type: "error", error });
      emit({ type: "agent_end", reason: "error" });
    }

    return {
      messages: [...this.messages],
      events,
      totalUsage,
      iterations,
      stopReason: events[events.length - 1]?.type === "agent_end"
        ? (events[events.length - 1] as any).reason
        : "unknown",
    };
  }

  /**
   * Stream an LLM response and accumulate into an AssistantMessage.
   */
  private async streamResponse(
    emit: (event: AgentEvent) => void,
    totalUsage: Usage,
  ): Promise<AssistantMessage> {
    const transport = getTransportForModel(this.config.model);

    const stream = transport.stream({
      model: this.config.model,
      messages: this.messages,
      systemPrompt: this.config.systemPrompt,
      tools: this.config.tools?.map((t) => t.definition),
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      signal: this.abortController!.signal,
      apiKey: this.config.apiKey,
    });

    let assistantMessage: AssistantMessage = {
      role: "assistant",
      content: "",
      toolCalls: [],
      stopReason: undefined,
      usage: undefined,
    };

    for await (const event of stream) {
      switch (event.type) {
        case "start":
          emit({ type: "message_start", message: event.message });
          break;

        case "text_delta":
          emit({ type: "message_delta", delta: event.text });
          break;

        case "tool_call_start":
          emit({ type: "tool_call_start", toolCall: { id: event.id, name: event.name, arguments: "" } });
          break;

        case "tool_call_delta":
          // Delta events are incremental — handled internally
          break;

        case "usage":
          if (event.usage) {
            totalUsage.inputTokens += event.usage.inputTokens;
            totalUsage.outputTokens += event.usage.outputTokens;
            if (event.usage.cacheReadTokens) {
              totalUsage.cacheReadTokens = (totalUsage.cacheReadTokens ?? 0) + event.usage.cacheReadTokens;
            }
            if (event.usage.cacheWriteTokens) {
              totalUsage.cacheWriteTokens = (totalUsage.cacheWriteTokens ?? 0) + event.usage.cacheWriteTokens;
            }
          }
          break;

        case "done":
          assistantMessage = event.message;
          emit({ type: "message_done", message: assistantMessage });
          break;

        case "error":
          assistantMessage = event.message;
          assistantMessage.stopReason = "error";
          emit({ type: "message_done", message: assistantMessage });
          break;
      }
    }

    return assistantMessage;
  }

  /**
   * Execute tool calls in parallel.
   * Returns tool result messages.
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    emit: (event: AgentEvent) => void,
  ): Promise<ToolResultMessage[]> {
    // Build tool name -> handler map
    const toolMap = new Map<string, ToolHandler>();
    for (const tool of this.config.tools ?? []) {
      toolMap.set(tool.definition.name, tool);
    }

    // Execute all tool calls in parallel
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const handler = toolMap.get(tc.name);

        if (!handler) {
          const errMsg = `Unknown tool: ${tc.name}`;
          emit({ type: "tool_call_result", toolCallId: tc.id, result: errMsg, isError: true });
          return {
            role: "tool_result" as const,
            toolCallId: tc.id,
            content: errMsg,
            isError: true,
          };
        }

        try {
          // Parse arguments
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.arguments);
          } catch {
            args = {};
          }

          const result = await handler.execute(args);
          emit({ type: "tool_call_result", toolCallId: tc.id, result, isError: false });
          return {
            role: "tool_result" as const,
            toolCallId: tc.id,
            content: result,
            isError: false,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          emit({ type: "tool_call_result", toolCallId: tc.id, result: errMsg, isError: true });
          return {
            role: "tool_result" as const,
            toolCallId: tc.id,
            content: errMsg,
            isError: true,
          };
        }
      }),
    );

    return results;
  }
}
