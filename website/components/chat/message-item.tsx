"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallDisplay } from "./tool-call-display";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinkingBlocks: string[];
  toolCalls: { name: string; result?: string; isError?: boolean }[];
  isStreaming?: boolean;
}

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  if (message.role === "user") {
    return (
      <div className="msg-user">
        <div className="msg-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="msg-assistant">
      {message.thinkingBlocks.map((block, i) => (
        <ThinkingBlock key={i} content={block} />
      ))}
      {message.toolCalls.map((tc, i) => (
        <ToolCallDisplay key={i} name={tc.name} result={tc.result} isError={tc.isError} />
      ))}
      {message.content && (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {stripThinkTags(message.content)}
        </ReactMarkdown>
      )}
      {message.isStreaming && <span className="streaming-cursor" />}
    </div>
  );
}

function stripThinkTags(text: string): string {
  return text.replace(/<think[\s\S]*?<\/think\s*>?\n?/gi, "").trim();
}
