// ============================================================================
// Markdown Renderer — Terminal-pretty rendering of LLM markdown output
//
// Combines:
//   - marked:      Parse markdown → tokens
//   - marked-terminal: Render tokens with ANSI colors/styles
//   - chalk:       Modern, clean ANSI color API (replaces hand-rolled codes)
//
// This module provides two rendering modes:
//   1. renderMarkdown(text) — Full markdown → ANSI terminal output
//   2. renderInline(text)   — Lightweight inline rendering (code spans, bold, etc.)
//
// Architecture decision: we render markdown on message_done (not streaming).
// During streaming, we buffer raw text, then render the complete buffer as
// markdown when the message finishes. This gives the best formatting quality
// (proper list indentation, code blocks, table alignment, etc.)
// ============================================================================

import { Marked } from "marked";
import Renderer from "marked-terminal";
import chalk from "chalk";

// ---- Configure marked with terminal renderer --------------------------------

const marked = new Marked();

// Use `any` cast because marked-terminal's renderer types don't match
// marked v15's strict _Renderer interface, but they work correctly at runtime.
(marked as any).setOptions({
  renderer: new Renderer({
    // Theme customization for a cohesive CLI look
    code: chalk.hex("#c9d1d9").bgHex("#161b22"),     // GitHub dark-style code blocks
    blockquote: chalk.hex("#8b949e").italic,          // Subtle gray quotes
    html: chalk.hex("#8b949e"),                        // Dim HTML
    heading: chalk.bold.cyan,                          // Cyan bold headings
    firstHeading: chalk.bold.cyan.underline,           // H1 underlined
    hr: chalk.hex("#30363d"),                          // Subtle divider
    bullet: chalk.green("●"),                          // Green bullet points
    listitem: chalk.reset,                             // Clean list items
    table: chalk.reset,                                // Clean tables
    tablerow: chalk.reset,
    tablecell: chalk.reset,
    strong: chalk.bold,                                // **bold**
    em: chalk.italic,                                  // *italic*
    codespan: chalk.hex("#79c0ff").bgHex("#1c2128"),   // `code` spans
    del: chalk.strikethrough.gray,                     // ~~strikethrough~~
    link: chalk.blue.underline,                        // [links](url)
    href: chalk.blue.underline,
    paragraph: chalk.reset,                            // Normal paragraphs
    reflink: chalk.blue,
    refimage: chalk.blue,
    text: chalk.reset,
    // Width: use terminal width, min 60, max 120
    width: Math.min(Math.max((process.stdout.columns ?? 80) - 4, 60), 120),
    // Don't reflow text inside code blocks
    reflowText: true,
    showParagraph: false,    // No blank line between paragraphs
  }),
});

// ---- Public API -------------------------------------------------------------

/**
 * Render a full markdown string to ANSI-colored terminal output.
 * Use this for complete LLM responses (called on message_done).
 */
export function renderMarkdown(text: string): string {
  if (!text || !text.trim()) return "";
  try {
    return marked.parse(text) as string;
  } catch {
    // If markdown parsing fails, return raw text
    return text;
  }
}

/**
 * Render inline markdown elements (code spans, bold, italic, links).
 * Lighter than full renderMarkdown — doesn't handle blocks/lists/tables.
 * Useful for short status messages, tool results, etc.
 */
export function renderInline(text: string): string {
  if (!text) return "";
  // Use marked for inline parsing
  try {
    return marked.parseInline(text) as string;
  } catch {
    return text;
  }
}

/**
 * Strip all markdown formatting, returning plain text.
 * Useful for previews, truncation, etc.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")        // Remove code blocks
    .replace(/`([^`]+)`/g, "$1")            // Remove inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1")      // Remove bold
    .replace(/\*([^*]+)\*/g, "$1")          // Remove italic
    .replace(/~~([^~]+)~~/g, "$1")          // Remove strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links
    .replace(/^[#]+\s+/gm, "")              // Remove heading markers
    .replace(/^[-*+]\s+/gm, "")             // Remove list markers
    .replace(/^\d+\.\s+/gm, "")             // Remove numbered list markers
    .replace(/^>\s+/gm, "")                 // Remove blockquotes
    .trim();
}

// Re-export chalk for use across CLI modules
export { chalk };
