"use client";

import { useState, useCallback } from "react";

interface ToolCallDisplayProps {
  name: string;
  arguments?: string;
  result?: string;
  isError?: boolean;
}

export function ToolCallDisplay({ name, arguments: args, result, isError }: ToolCallDisplayProps) {
  const [open, setOpen] = useState(false);

  // Parse write_file arguments to extract file path and content
  const writeFileData = parseWriteFileArgs(name, args, result, isError);

  return (
    <div className="tool-call">
      <div className="tool-call-header" onClick={() => setOpen(!open)}>
        <span>{open ? "▼" : "▶"}</span>
        <span className="tool-name">{name}</span>
        {writeFileData && <span className="tool-name-detail">{writeFileData.path}</span>}
        {result !== undefined && (
          <span className={isError ? "tool-status-err" : "tool-status-ok"}>
            {isError ? "✗" : "✓"}
          </span>
        )}
        {writeFileData && (
          <button
            className="msg-action-btn"
            onClick={(e) => { e.stopPropagation(); downloadFile(writeFileData); }}
            title={`Download ${writeFileData.path}`}
          >
            Download
          </button>
        )}
      </div>
      {open && result && (
        <div className="tool-result">{result}</div>
      )}
    </div>
  );
}

interface WriteFileData {
  path: string;
  content: string;
}

function parseWriteFileArgs(
  name: string,
  args: string | undefined,
  result: string | undefined,
  isError: boolean | undefined,
): WriteFileData | null {
  if (name !== "write_file" || isError || !args) return null;
  // Only show download when write succeeded
  if (result && result.startsWith("Error")) return null;

  try {
    const parsed = JSON.parse(args);
    if (parsed.path && parsed.content !== undefined) {
      return { path: parsed.path, content: parsed.content };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

function downloadFile(data: WriteFileData) {
  const blob = new Blob([data.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Use just the filename part for download
  const filename = data.path.split("/").pop() || data.path;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
