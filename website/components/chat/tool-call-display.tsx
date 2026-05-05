"use client";

import { useState } from "react";

interface ToolCallDisplayProps {
  name: string;
  result?: string;
  isError?: boolean;
}

export function ToolCallDisplay({ name, result, isError }: ToolCallDisplayProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tool-call">
      <div className="tool-call-header" onClick={() => setOpen(!open)}>
        <span>{open ? "▼" : "▶"}</span>
        <span className="tool-name">{name}</span>
        {result !== undefined && (
          <span className={isError ? "tool-status-err" : "tool-status-ok"}>
            {isError ? "✗" : "✓"}
          </span>
        )}
      </div>
      {open && result && (
        <div className="tool-result">{result}</div>
      )}
    </div>
  );
}
