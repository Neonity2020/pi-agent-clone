"use client";

import { useState } from "react";

interface ThinkingBlockProps {
  content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="thinking-block">
      <div className="thinking-toggle" onClick={() => setOpen(!open)}>
        <span>{open ? "▼" : "▶"}</span>
        <span>Thinking...</span>
      </div>
      {open && <div className="thinking-content">{content}</div>}
    </div>
  );
}
