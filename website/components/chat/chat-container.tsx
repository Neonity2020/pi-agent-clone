"use client";

import { useState, useCallback, useRef } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import type { ChatMessage } from "./message-item";

let msgCounter = 0;
function nextId() { return `msg_${++msgCounter}_${Date.now()}`; }

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState("glm-4.7");
  const [sessionId, setSessionId] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const handleSend = useCallback(async (text: string) => {
    setIsLoading(true);

    // Add user message
    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text, thinkingBlocks: [], toolCalls: [] };
    // Add empty assistant message for streaming
    const asstId = nextId();
    const asstMsg: ChatMessage = { id: asstId, role: "assistant", content: "", thinkingBlocks: [], toolCalls: [], isStreaming: true };

    setMessages((prev) => [...prev, userMsg, asstMsg]);

    const ac = new AbortController();
    abortRef.current = ac;

    // Track current thinking block
    let currentThinking = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model, sessionId }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        updateMessage(asstId, { content: `Error: ${err}`, isStreaming: false });
        setIsLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) continue;
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "session":
                setSessionId(event.sessionId);
                break;

              case "message_delta":
                currentThinking = appendThinking(currentThinking, event.delta);
                // Extract display text (after closing think tag)
                const displayText = extractDisplayText(currentThinking);
                updateMessage(asstId, { content: displayText });
                break;

              case "message_done":
                // Flush any remaining thinking
                if (currentThinking) {
                  const thinkBlocks = parseThinkBlocks(currentThinking);
                  const finalText = extractDisplayText(currentThinking);
                  updateMessage(asstId, {
                    content: finalText,
                    thinkingBlocks: thinkBlocks,
                  });
                  currentThinking = "";
                }
                if (event.message?.usage) {
                  // Could display token usage
                }
                break;

              case "tool_call_start":
                updateMessage(asstId, (prev) => {
                  const tc = [...prev.toolCalls, { name: event.toolCall?.name || "unknown" }];
                  return { toolCalls: tc };
                });
                break;

              case "tool_call_result": {
                const tcName = event.toolCallId;
                updateMessage(asstId, (prev) => {
                  const tc = prev.toolCalls.map((t) =>
                    !t.result && tcName ? { ...t, result: event.result, isError: event.isError } : t
                  );
                  return { toolCalls: tc };
                });
                break;
              }

              case "agent_end":
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        updateMessage(asstId, { content: `Connection error: ${(err as Error).message}`, isStreaming: false });
      }
    } finally {
      updateMessage(asstId, { isStreaming: false });
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [model, sessionId, updateMessage]);

  // Note: updateMessage with a function isn't directly supported by our simple updater.
  // Let me fix the tool_call cases to use setMessages directly.

  return (
    <>
      <div className="message-list-wrapper" style={{ flex: 1, overflow: "hidden" }}>
        <MessageList messages={messages} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.3rem" }}>
        <ModelSelector value={model} onChange={setModel} />
      </div>
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </>
  );
}

// Accumulate raw text including think tags
function appendThinking(current: string, delta: string): string {
  return current + delta;
}

// Extract display text: everything after the last </think tag
function extractDisplayText(raw: string): string {
  const lastThinkEnd = raw.lastIndexOf("</think");
  if (lastThinkEnd !== -1) {
    const afterThink = raw.slice(lastThinkEnd);
    const gtIdx = afterThink.indexOf(">");
    if (gtIdx !== -1) {
      return raw.slice(lastThinkEnd + gtIdx + 1).trim();
    }
  }
  // No closed think tag — if inside think block, show nothing
  const openThink = raw.lastIndexOf("<think");
  if (openThink !== -1) {
    const closeAfterOpen = raw.indexOf("</think", openThink);
    if (closeAfterOpen === -1) return ""; // Still inside think block
  }
  return raw;
}

// Parse completed think blocks from raw text
function parseThinkBlocks(raw: string): string[] {
  const blocks: string[] = [];
  const regex = /<think[^>]*>([\s\S]*?)<\/think\s*>?/gi;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    const content = match[1].trim();
    if (content) blocks.push(content);
  }
  return blocks;
}
