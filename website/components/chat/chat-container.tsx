"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import type { ChatMessage } from "./message-item";

let msgCounter = 0;
function nextId() { return `msg_${++msgCounter}_${Date.now()}`; }

// 测试用的预设消息
function getTestMessages(): ChatMessage[] {
  return [
    {
      id: nextId(),
      role: "assistant",
      content: "这是一个测试对话，用于演示文件下载功能。\n\n项目根目录有以下文件：\n- README.md\n- package.json\n- next.config.ts\n\n您可以点击下面的文件名下载对应文件。",
      thinkingBlocks: [],
      toolCalls: [],
      isStreaming: false,
    },
    {
      id: nextId(),
      role: "assistant",
      content: "我已为您生成报告文件 AGENT_WEB_UI_BUILD_REPORT.md。\n\n您可以点击下方按钮下载：\n[download:AGENT_WEB_UI_BUILD_REPORT.md]",
      thinkingBlocks: [],
      toolCalls: [],
      isStreaming: false,
    },
    {
      id: nextId(),
      role: "user",
      content: "测试下载链接",
      thinkingBlocks: [],
      toolCalls: [],
    },
    {
      id: nextId(),
      role: "assistant",
      content: "好的，这里有几个测试文件路径供您测试下载功能：\n\n1. README.md\n2. package.json\n3. next.config.ts\n\n点击上方的文件名即可下载！",
      thinkingBlocks: [],
      toolCalls: [],
      isStreaming: false,
    },
  ];
}

export interface ChatContainerProps {
  initialMessages?: ChatMessage[];
  initialSessionId?: string;
  onSessionUpdate?: (messages: ChatMessage[]) => void;
  onSessionIdChange?: (sessionId: string) => void;
  isTestMode?: boolean;
}

export function ChatContainer({
  initialMessages = [],
  initialSessionId = "",
  onSessionUpdate,
  onSessionIdChange,
  isTestMode = false,
}: ChatContainerProps = {}) {
  // 如果是测试模式，使用预设消息；否则使用传入的 initialMessages
  const [messages, setMessages] = useState<ChatMessage[]>(isTestMode ? getTestMessages() : initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [model, setModel] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("neonity-agent-selected-model") || "glm-4.7";
    }
    return "glm-4.7";
  });

  useEffect(() => {
    localStorage.setItem("neonity-agent-selected-model", model);
  }, [model]);
  const [sessionId, setSessionId] = useState(initialSessionId);

  useEffect(() => {
    if (messages !== initialMessages && !isTestMode) {
      onSessionUpdate?.(messages);
    }
  }, [messages, onSessionUpdate]); // initialMessages is omitted intentionally to only trigger on changes

  useEffect(() => {
    if (sessionId && sessionId !== initialSessionId) {
      onSessionIdChange?.(sessionId);
    }
  }, [sessionId, initialSessionId]);

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
                const patch: Partial<ChatMessage> = {};
                if (currentThinking) {
                  patch.thinkingBlocks = parseThinkBlocks(currentThinking);
                  patch.content = extractDisplayText(currentThinking);
                  currentThinking = "";
                }
                if (Object.keys(patch).length > 0) {
                  updateAsst(patch);
                }
                if (event.message && Array.isArray(event.message.toolCalls)) {
                  setMessages((prev) => prev.map((m) => {
                    if (m.id !== asstId) return m;
                    const updatedToolCalls = m.toolCalls.map((t) => {
                      const incoming = event.message.toolCalls.find((inTc: any) => inTc.id === t.id);
                      if (incoming) {
                        return { ...t, arguments: incoming.arguments };
                      }
                      return t;
                    });
                    return { ...m, toolCalls: updatedToolCalls };
                  }));
                }
                break;
              }

              case "tool_call_start":
                setIsThinking(false);
                setMessages((prev) => prev.map((m) =>
                  m.id === asstId
                    ? { ...m, toolCalls: [...m.toolCalls, { id: event.toolCall?.id, name: event.toolCall?.name || "unknown", arguments: event.toolCall?.arguments }] }
                    : m
                ));
                break;

              case "tool_call_result":
                setMessages((prev) => prev.map((m) => {
                  if (m.id !== asstId) return m;
                  const tc = m.toolCalls.map((t) =>
                    t.id === event.toolCallId ? { ...t, result: event.result, isError: event.isError } : t
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

  const blob = new Blob([lines.join("\n")], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chat-${ts}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}