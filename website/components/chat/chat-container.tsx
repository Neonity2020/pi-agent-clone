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
  const [isThinking, setIsThinking] = useState(false);
  const [model, setModel] = useState("glm-4.7");
  const [sessionId, setSessionId] = useState("");

  const handleSend = useCallback(async (text: string) => {
    setIsLoading(true);
    setIsThinking(false);

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text, thinkingBlocks: [], toolCalls: [] };
    const asstId = nextId();
    const asstMsg: ChatMessage = { id: asstId, role: "assistant", content: "", thinkingBlocks: [], toolCalls: [], isStreaming: true };
    setMessages((prev) => [...prev, userMsg, asstMsg]);

    let currentThinking = "";

    const updateAsst = (patch: Partial<ChatMessage>) => {
      setMessages((prev) => prev.map((m) => m.id === asstId ? { ...m, ...patch } : m));
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model, sessionId }),
      });

      if (!res.ok) {
        const err = await res.text();
        updateAsst({ content: `Error: ${err}`, isStreaming: false });
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

              case "message_delta": {
                currentThinking += event.delta;
                const insideThink = isInsideThinkBlock(currentThinking);
                setIsThinking(insideThink);
                const displayText = extractDisplayText(currentThinking);
                updateAsst({ content: displayText });
                break;
              }

              case "message_done": {
                setIsThinking(false);
                if (currentThinking) {
                  const thinkBlocks = parseThinkBlocks(currentThinking);
                  const finalText = extractDisplayText(currentThinking);
                  updateAsst({ content: finalText, thinkingBlocks: thinkBlocks });
                  currentThinking = "";
                }
                break;
              }

              case "tool_call_start":
                setIsThinking(false);
                setMessages((prev) => prev.map((m) =>
                  m.id === asstId
                    ? { ...m, toolCalls: [...m.toolCalls, { name: event.toolCall?.name || "unknown", arguments: event.toolCall?.arguments }] }
                    : m
                ));
                break;

              case "tool_call_result":
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== asstId) return m;
                  const tc = m.toolCalls.map((t) =>
                    !t.result ? { ...t, result: event.result, isError: event.isError } : t
                  );
                  return { ...m, toolCalls: tc };
                }));
                break;

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
        updateAsst({ content: `Connection error: ${(err as Error).message}`, isStreaming: false });
      }
    } finally {
      updateAsst({ isStreaming: false });
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [model, sessionId]);

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <MessageList messages={messages} />
        {isThinking && (
          <div className="thinking-indicator">
            <span className="streaming-cursor" />
            <span style={{ marginLeft: "0.5rem", color: "var(--muted)" }}>Thinking...</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.3rem" }}>
        <ModelSelector value={model} onChange={setModel} />
        <button
          className="export-btn"
          onClick={() => exportChat(messages)}
          disabled={messages.length === 0}
        >
          Export Chat
        </button>
      </div>
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </>
  );
}

function isInsideThinkBlock(raw: string): boolean {
  const lastOpen = raw.lastIndexOf("<think");
  if (lastOpen === -1) return false;
  const closeAfterOpen = raw.indexOf("</think", lastOpen);
  return closeAfterOpen === -1;
}

function extractDisplayText(raw: string): string {
  const lastThinkEnd = raw.lastIndexOf("</think");
  if (lastThinkEnd !== -1) {
    const afterThink = raw.slice(lastThinkEnd);
    const gtIdx = afterThink.indexOf(">");
    if (gtIdx !== -1) {
      return raw.slice(lastThinkEnd + gtIdx + 1).trim();
    }
  }
  if (isInsideThinkBlock(raw)) return "";
  return raw;
}

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

function exportChat(messages: ChatMessage[]) {
  const lines: string[] = ["# Pi-Agent Chat Export", ""];
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push("## User", "");
      lines.push(msg.content);
      lines.push("");
    } else {
      lines.push("## Assistant", "");
      if (msg.thinkingBlocks.length) {
        lines.push("<details><summary>Thinking</summary>", "");
        for (const block of msg.thinkingBlocks) {
          lines.push(block);
        }
        lines.push("", "</details>", "");
      }
      for (const tc of msg.toolCalls) {
        lines.push(`**Tool: ${tc.name}** ${tc.isError ? "(error)" : "(ok)"}`);
        if (tc.result) lines.push("```", tc.result.slice(0, 500), "```");
        lines.push("");
      }
      const text = msg.content.replace(/<think[\s\S]*?<\/think\s*>?\n?/gi, "").trim();
      if (text) lines.push(text);
      lines.push("");
    }
  }

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat-${ts}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
