"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallDisplay } from "./tool-call-display";

export interface ToolCallInfo {
  id?: string;
  name: string;
  arguments?: string;
  result?: string;
  isError?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinkingBlocks: string[];
  toolCalls: ToolCallInfo[];
  isStreaming?: boolean;
}

interface MessageItemProps {
  message: ChatMessage;
}

// 提取文本内容（去除 think 标签）
function stripThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think\s*>?\n?/gi, "").trim();
}

// 纯 Markdown 渲染，不再检测文件路径，避免显示问题
function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
}

export function MessageItem({ message }: MessageItemProps) {
  if (message.role === "user") {
    return (
      <div className="msg-user">
        <div className="msg-bubble">{message.content}</div>
      </div>
    );
  }

  const textContent = stripThinkTags(message.content);

  return (
    <div className="msg-assistant">
      {message.thinkingBlocks.map((block, i) => (
        <ThinkingBlock key={i} content={block} />
      ))}
      {message.toolCalls.map((tc, i) => (
        <ToolCallDisplay key={i} name={tc.name} arguments={tc.arguments} result={tc.result} isError={tc.isError} />
      ))}
      {textContent && (
        <MessageContent content={textContent} />
      )}
      {message.isStreaming && <span className="streaming-cursor" />}
      {!message.isStreaming && textContent && (
        <div className="msg-actions">
          <CopyButton text={textContent} />
        </div>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for non-HTTPS
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <button className="msg-action-btn" onClick={handleCopy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}