// ============================================================================
// Think Block Renderer — Detects and colorizes <think...</think reasoning blocks
//
// Some models (e.g., MiniMax M2.7) emit reasoning in <think...</think tags.
// This module intercepts streaming text deltas, tracks state across chunks,
// and applies dedicated ANSI colors to distinguish reasoning from normal output.
//
// Tag formats supported:
//   <think\n...content...\n</think\n       (MiniMax M2.7 style — most common)
//   <thinking>...content...</thinking>     (DeepSeek / alternative style)
//   <think type="...">...content...</think  (attributes)
//
// Colors:
//   - Think content: dim + cyan (subtle but readable)
//   - Think tags: hidden (stripped from output)
// ============================================================================

const ANSI = {
  reset:   "\x1b[0m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  dimCyan: "\x1b[2m\x1b[36m",
  gray:    "\x1b[90m",
};

/**
 * ThinkRenderer processes streaming text chunks and colorizes <think...</think
 * reasoning blocks in real-time.
 *
 * It tracks the full opening tag (e.g., "<think" or "<thinking") so that it
 * can correctly match the corresponding closing tag (e.g., </think or </thinking).
 */
export class ThinkRenderer {
  private inThink = false;
  private buffer = "";
  /** The full tag name we matched on open (e.g., "think" or "thinking") */
  private openTagName = "";

  /**
   * Process an incoming text delta chunk.
   * Returns colored text ready for stdout.write().
   */
  process(chunk: string): string {
    let output = "";
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (this.inThink) {
        // ---- Inside think block: look for closing tag ----
        const closeTag = `</${this.openTagName}`;
        const closeIdx = this.buffer.indexOf(closeTag);

        if (closeIdx !== -1) {
          // Emit think content before closing tag (colored)
          output += this.colorThink(this.buffer.slice(0, closeIdx));

          // Consume closing tag + optional '>' + optional '\n'
          let end = closeIdx + closeTag.length;
          if (end < this.buffer.length && this.buffer[end] === ">") end++;
          if (end < this.buffer.length && this.buffer[end] === "\n") end++;

          this.buffer = this.buffer.slice(end);
          this.inThink = false;
          this.openTagName = "";
        } else {
          // No closing tag yet — check if tail could be a partial close tag
          const safe = this.safeEmitLength(closeTag);
          output += this.colorThink(this.buffer.slice(0, safe));
          this.buffer = this.buffer.slice(safe);
          break;
        }
      } else {
        // ---- Normal mode: look for <think or <thinking opening ----
        const match = this.findOpenTag(this.buffer);

        if (match) {
          // Emit normal text before the tag
          if (match.index > 0) {
            output += this.buffer.slice(0, match.index);
          }

          // Track the tag name for correct closing
          this.openTagName = match.tagName;

          // Consume: <tagName + optional attrs + optional '>' + optional '\n'
          let end = match.index + match.fullMatch.length;
          // Skip any attributes (everything until '>' or '\n')
          while (end < this.buffer.length && this.buffer[end] !== ">" && this.buffer[end] !== "\n") {
            end++;
          }
          if (end < this.buffer.length && this.buffer[end] === ">") end++;
          if (end < this.buffer.length && this.buffer[end] === "\n") end++;

          this.buffer = this.buffer.slice(end);
          this.inThink = true;
        } else {
          // No opening tag — emit safe prefix
          const safe = this.safeEmitLength("<think");
          output += this.buffer.slice(0, safe);
          this.buffer = this.buffer.slice(safe);
          if (this.buffer.length > 0) break;
        }
      }
    }

    return output;
  }

  /**
   * Flush remaining buffer. Call at end of message.
   */
  flush(): string {
    let output = "";
    if (this.buffer.length > 0) {
      output += this.inThink
        ? this.colorThink(this.buffer)
        : this.buffer;
      this.buffer = "";
    }
    if (this.inThink) {
      output += ANSI.reset;
      this.inThink = false;
      this.openTagName = "";
    }
    return output;
  }

  /** Whether we're currently inside a think block */
  isInThink(): boolean {
    return this.inThink;
  }

  /** Reset state for a new message. */
  reset(): void {
    this.inThink = false;
    this.buffer = "";
    this.openTagName = "";
  }

  /**
   * Find an opening think tag in the buffer.
   * Returns the index, full matched string, and extracted tag name.
   * Supports: <think, <thinking, <think attr="...">
   */
  private findOpenTag(buf: string): { index: number; fullMatch: string; tagName: string } | null {
    // Try <think first (most common)
    // We need to match <think followed by: >, \n, space, or end-of-buffer
    // Also support <thinking (longer variant)
    
    const patterns = [
      /<think(?=ing|\s|>|\n|$)/i,
    ];

    for (const pat of patterns) {
      const m = buf.match(pat);
      if (m && m.index !== undefined) {
        // Determine the actual tag name
        const fullMatch = m[0]; // "<think"
        let tagName = "think";

        // Check if it's <thinking
        if (buf.slice(m.index! + 1).startsWith("thinking") &&
            (buf.length <= m.index! + 9 || /[>\s\n]/.test(buf[m.index! + 9]))) {
          tagName = "thinking";
        }

        return {
          index: m.index,
          fullMatch: "<" + tagName.slice(0, tagName === "thinking" ? 8 : 5),
          tagName,
        };
      }
    }
    return null;
  }

  /**
   * How many chars from the start of buffer are safe to emit
   * without cutting a partial tag at the end?
   */
  private safeEmitLength(tag: string): number {
    const lastLt = this.buffer.lastIndexOf("<");
    if (lastLt === -1) {
      return this.buffer.length;
    }

    const tail = this.buffer.slice(lastLt);
    if (tag.startsWith(tail)) {
      return lastLt;
    }

    return this.buffer.length;
  }

  /** Apply think-content color. */
  private colorThink(text: string): string {
    if (!text) return "";
    return `${ANSI.dimCyan}${text}${ANSI.reset}`;
  }
}
