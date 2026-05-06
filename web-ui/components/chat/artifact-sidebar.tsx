import { useMemo } from "react";
import type { ChatMessage } from "./message-item";
import { parseWriteFileArgs, downloadFile, type WriteFileData } from "./tool-call-display";

interface ArtifactSidebarProps {
  messages: ChatMessage[];
}

export function ArtifactSidebar({ messages }: ArtifactSidebarProps) {
  // Extract all successful write_file artifacts
  const artifacts = useMemo(() => {
    const filesMap = new Map<string, WriteFileData>();
    
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.toolCalls) continue;
      
      for (const tc of msg.toolCalls) {
        const fileData = parseWriteFileArgs(tc.name, tc.arguments, tc.result, tc.isError);
        if (fileData) {
          // Keep the latest version of the file
          filesMap.set(fileData.path, fileData);
        }
      }
    }
    
    return Array.from(filesMap.values());
  }, [messages]);

  if (artifacts.length === 0) {
    return (
      <div className="chat-artifact-sidebar">
        <div className="chat-artifact-header">
          Generated Files
        </div>
        <div style={{ textAlign: "center", color: "var(--muted)", padding: "3rem 1rem", fontSize: "0.85rem" }}>
          No files generated yet.<br/><br/>Ask the AI to write a file to see it here.
        </div>
      </div>
    );
  }

  return (
    <div className="chat-artifact-sidebar">
      <div className="chat-artifact-header">
        Generated Files
      </div>
      <div className="chat-artifact-list">
        {artifacts.map((file, idx) => {
          const filename = file.path.split("/").pop() || file.path;
          return (
            <div key={idx} className="artifact-item">
              <div className="artifact-item-info">
                <span className="artifact-icon">📄</span>
                <span className="artifact-name" title={file.path}>{filename}</span>
              </div>
              <button
                className="msg-action-btn artifact-download-btn"
                onClick={() => downloadFile(file)}
                title={`Download ${filename}`}
              >
                Download
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
