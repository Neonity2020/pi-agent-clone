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
//   - SOUL.md injection into system prompt for agent personality/identity
//   - MEMORY.md injection into system prompt for long-term memory
//   - Provider/model info injection into system prompt
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
import { formatMemoryForPrompt } from "../memory/index.js";
import { formatSoulForPrompt } from "../soul/index.js";

export class AgentLoop {
  private config: AgentConfig;
  private messages: Message[] = [];
  private abortController: AbortController | null = null;
  private cachedSystemPrompt: string | null = null;

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
   * Build the system prompt, injecting SOUL.md, provider/model info, and MEMORY.md content.
   * The prompt structure:
   *   1. Base system prompt (from config)
   *   2. SOUL.md section (agent's personality and identity)
   *   3. Provider/model info section
   *   4. MEMORY.md section (if MEMORY.md has entries)
   *   5. Memory usage instructions
   */
  private async buildSystemPrompt(): Promise<string> {
    const basePrompt = this.config.systemPrompt || "You are a helpful AI assistant.";
    const model = this.config.model;

    // Build SOUL.md section (agent's personality and identity)
    const soulContent = await formatSoulForPrompt();
    let soulSection = "";
    if (soulContent) {
      soulSection = [
        "",
        "══════════════════════════════════════════════",
        "YOUR SOUL (Personality & Identity)",
        "══════════════════════════════════════════════",
        soulContent,
        "══════════════════════════════════════════════",
        "",
        "The above entries define who you are as an AI assistant. They describe your personality,",
        "communication style, values, and behavioral guidelines. Let these traits guide your responses.",
        "You can evolve your soul using soul_write, soul_read, soul_search, and soul_remove tools.",
        "",
      ].join("\n");
    }

    // Build provider/model info section
    const modelInfoSection = [
      "══════════════════════════════════════════════",
      "CURRENT PROVIDER & MODEL",
      "══════════════════════════════════════════════",
      `Provider: ${model.provider}`,
      `Model: ${model.name} (${model.id})`,
      `API mode: ${model.api}`,
      `Context window: ${model.contextWindow} tokens`,
      `Max output: ${model.maxTokens} tokens`,
      "══════════════════════════════════════════════",
      "",
      "You are currently running on the above provider and model. You can mention this information if the user asks about your identity.",
      "",
    ].join("\n");

    // Read memory entries
    const memoryContent = await formatMemoryForPrompt();

    if (!memoryContent) {
      return basePrompt + soulSection + modelInfoSection;
    }

    // Inject memory into system prompt
    const memorySection = [
      "══════════════════════════════════════════════",
      "LONG-TERM MEMORY (persistent across sessions)",
      "══════════════════════════════════════════════",
      memoryContent,
      "══════════════════════════════════════════════",
      "",
      "The above facts are from your long-term memory (MEMORY.md). They persist across conversations.",
      "Use memory_write to save new important facts (user preferences, project conventions, environment details).",
      "Use memory_read to review all memories. Use memory_search to find specific memories.",
      "Use memory_remove to delete outdated entries.",
      "",
    ].join("\n");

    return basePrompt + soulSection + modelInfoSection + memorySection;
  }

  /**
   * Invalidate the cached system prompt (called after soul or memory changes).
   * Next LLM call will rebuild the prompt with fresh soul and memory content.
   */
  invalidateSoulCache(): void {
    this.cachedSystemPrompt = null;
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

    // Build system prompt with soul and memory injection (rebuilt each run)
    let systemPrompt = await this.buildSystemPrompt();

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
          console.warn(
            `[Context] Trimmed from ${beforeLength} to ${this.messages.length} messages ` +
              `(${contextInfo.usagePercentage}% of ${contextInfo.contextWindow} tokens)`,
          );
        } else {
          emit({ type: "turn_start" });
        }

        // Stream LLM response (use soul/memory-injected system prompt)
        const assistantMessage = await this.streamResponse(emit, totalUsage, systemPrompt);

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

        // If soul or memory was written/removed, rebuild system prompt for next turn
        const hasSoulChanges = toolCalls.some((tc) =>
          tc.name === "soul_write" || tc.name === "soul_remove"
        );
        const hasMemoryChanges = toolCalls.some((tc) =>
          tc.name === "memory_write" || tc.name === "memory_remove"
        );
        if (hasSoulChanges || hasMemoryChanges) {
          systemPrompt = await this.buildSystemPrompt();
        }

        // Add tool results to history
        for (const result of toolResults) {
          this.messages.push(result);
        }

        emit({ type: "turn_end" });
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
    systemPrompt: string,
  ): Promise<AssistantMessage> {
    const transport = getTransportForModel(this.config.model);

    const stream = transport.stream({
      model: this.config.model,
      messages: this.messages,
      systemPrompt,  // Use soul/memory-injected system prompt
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
