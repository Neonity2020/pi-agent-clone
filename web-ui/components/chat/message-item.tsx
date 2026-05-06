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

// 下载按钮组件
function DownloadButton({ filePath }: { filePath: string }) {
  const fileName = filePath.split("/").pop() || filePath;
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const url = `/api/download?path=${encodeURIComponent(filePath)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        alert(`Download failed: ${text}`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      alert(`Download error: ${err}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button 
      className="download-btn"
      onClick={handleDownload}
      disabled={isDownloading}
      title={`Download ${fileName}`}
    >
      📥 {isDownloading ? "Downloading..." : `Download ${fileName}`}
    </button>
  );
}

interface MessageContentProps {
  content: string;
}

function MessageContent({ content }: MessageContentProps) {
  // Use local regex instances to avoid concurrent lastIndex corruption
  const downloadPattern = /\[download:([^\]]+)\]/g;
  const reportPattern = /(?:AGENT_WEB_UI_BUILD_REPORT\.md|报告文件|build report)/gi;

  // 检查是否有下载指令或报告文件名
  const hasDownload指令 = downloadPattern.test(content);
  const hasReportName = reportPattern.test(content);
  
  // 重置正则
  downloadPattern.lastIndex = 0;
  reportPattern.lastIndex = 0;

  if (!hasDownload指令 && !hasReportName) {
    // 没有下载指令，使用原有的文件路径检测
    return <FilePathLinks content={content} />;
  }

  // 提取下载按钮
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  // 处理 [download:filename] 格式
  downloadPattern.lastIndex = 0;
  while ((match = downloadPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <ReactMarkdown key={`text-${lastIndex}`} remarkPlugins={[remarkGfm]}>
          {content.slice(lastIndex, match.index)}
        </ReactMarkdown>
      );
    }
    const filePath = match[1].trim();
    parts.push(<DownloadButton key={`dl-${match.index}`} filePath={filePath} />);
    lastIndex = match.index + match[0].length;
  }

  // 处理报告文件名
  reportPattern.lastIndex = 0;
  const reportMatches: { index: number; length: number; name: string }[] = [];
  while ((match = reportPattern.exec(content)) !== null) {
    reportMatches.push({ index: match.index, length: match[0].length, name: match[0] });
  }

  for (const rm of reportMatches) {
    if (rm.index >= lastIndex) {
      if (rm.index > lastIndex) {
        parts.push(
          <ReactMarkdown key={`text-${lastIndex}`} remarkPlugins={[remarkGfm]}>
            {content.slice(lastIndex, rm.index)}
          </ReactMarkdown>
        );
      }
      parts.push(<DownloadButton key={`dl-report-${rm.index}`} filePath="AGENT_WEB_UI_BUILD_REPORT.md" />);
      lastIndex = rm.index + rm.length;
    }
  }

  // 添加剩余文本
  if (lastIndex < content.length) {
    parts.push(
      <ReactMarkdown key={`text-${lastIndex}`} remarkPlugins={[remarkGfm]}>
        {content.slice(lastIndex)}
      </ReactMarkdown>
    );
  }

  return <>{parts}</>;
}

// 原有的文件路径检测逻辑
function FilePathLinks({ content }: { content: string }) {
  const filePathPattern = /(?:^|\s)([\.\/]?[a-zA-Z0-9_\-\/\.]+\.[a-zA-Z0-9]+)(?:\s|$)/g;
  
  const hasFilePath = filePathPattern.test(content);
  
  if (!hasFilePath) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  filePathPattern.lastIndex = 0;
  
  while ((match = filePathPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = content.slice(lastIndex, match.index);
      parts.push(
        <ReactMarkdown key={`text-${lastIndex}`} remarkPlugins={[remarkGfm]}>
          {beforeText}
        </ReactMarkdown>
      );
    }

    const filePath = match[1].trim();
    const fileName = filePath.split("/").pop() || filePath;
    
    parts.push(
      <span
        key={`link-${match.index}`}
        className="download-link"
        title={`Download ${fileName}`}
        style={{ cursor: "pointer", textDecoration: "underline", color: "var(--accent)" }}
        onClick={async (e) => {
          e.preventDefault();
          try {
            const res = await fetch(`/api/download?path=${encodeURIComponent(filePath)}`);
            if (!res.ok) {
              alert(`Download failed: ${await res.text()}`);
              return;
            }
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          } catch (err) {
            alert(`Download error: ${err}`);
          }
        }}
      >
        📥 {fileName}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const afterText = content.slice(lastIndex);
    parts.push(
      <ReactMarkdown key={`text-${lastIndex}`} remarkPlugins={[remarkGfm]}>
        {afterText}
      </ReactMarkdown>
    );
  }

  return <>{parts}</>;
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