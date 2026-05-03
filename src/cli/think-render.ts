// ============================================================================
// Think Block Renderer — Detects and colorizes <think...</think reasoning blocks
//
// Some models (e.g., MiniMax M2.7) emit reasoning in <think...</think tags.
// This module intercepts the streaming text delta, tracks state across chunks,
// and applies dedicated ANSI colors to distinguish reasoning from normal output.
//
// Tag format is flexible:
//   <think\n...content...\n</think\n     (MiniMax M2.7 style)
//   <thinking>...content...</thinking>   (alternative style)
//   <think ...>...content...</think       (with attributes)
//
// Colors:
//   - Think content: dim + cyan (subtle but readable)
//   - Think tags: dim gray (visible but not distracting)
// ============================================================================

// ---- ANSI escape codes ------------------------------------------------------

const ANSI = {
  reset:   "\x1b[0m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  dimCyan: "\x1b[2m\x1b[36m",  // dim + cyan for think content
  gray:    "\x1b[90m",          // gray for think tags
};

/**
 * ThinkRenderer processes streaming text chunks and applies colors to
 * <think...</think reasoning blocks in real-time.
 *
 * It maintains a small buffer to handle tags split across chunks,
 * and uses a simple state machine: NORMAL → IN_THINK → NORMAL.
 */
export class ThinkRenderer {
  // Parser state
  private inThink = false;
  private buffer = "";

  // Tags to detect
  private static readonly OPEN = "<think";
  private static readonly CLOSE = "</think";

  /**
   * Process an incoming text delta chunk.
   * Returns a string (possibly with ANSI color codes) ready for stdout.write().
   */
  process(chunk: string): string {
    let output = "";
    this.buffer += chunk;

    while (this.buffer.length > 0) {
      if (this.inThink) {
        // ---- Inside think block: look for </think ----
        const closeIdx = this.findTag(this.buffer, ThinkRenderer.CLOSE);

        if (closeIdx !== -1) {
          // Emit think content before closing tag (colored)
          output += this.colorThink(this.buffer.slice(0, closeIdx));

          // Consume the closing tag + optional '>' after it
          let end = closeIdx + ThinkRenderer.CLOSE.length;
          if (end < this.buffer.length && this.buffer[end] === ">") end++;
          // Also consume a trailing newline if present
          if (end < this.buffer.length && this.buffer[end] === "\n") end++;

          this.buffer = this.buffer.slice(end);
          this.inThink = false;
        } else {
          // No closing tag yet — emit safe prefix, keep potential partial tag
          const safe = this.safeEmitLength(ThinkRenderer.CLOSE);
          output += this.colorThink(this.buffer.slice(0, safe));
          this.buffer = this.buffer.slice(safe);
          break; // Wait for more data
        }
      } else {
        // ---- Normal mode: look for <think opening ----
        const openIdx = this.findTag(this.buffer, ThinkRenderer.OPEN);

        if (openIdx !== -1) {
          // Emit normal text before the tag
          if (openIdx > 0) {
            output += this.buffer.slice(0, openIdx);
          }

          // Consume: <think + optional attributes + optional '>'
          let end = openIdx + ThinkRenderer.OPEN.length;
          // Skip any tag content until '>' or whitespace
          while (end < this.buffer.length && this.buffer[end] !== ">" && this.buffer[end] !== "\n" && this.buffer[end] !== " ") {
            end++;
          }
          // Skip to end of tag attributes if ' ' found (e.g., <think type="reasoning">)
          if (end < this.buffer.length && this.buffer[end] === " ") {
            const gtIdx = this.buffer.indexOf(">", end);
            if (gtIdx !== -1) end = gtIdx + 1;
          }
          // Consume '>' if present
          if (end < this.buffer.length && this.buffer[end] === ">") end++;
          // Consume trailing newline
          if (end < this.buffer.length && this.buffer[end] === "\n") end++;

          this.buffer = this.buffer.slice(end);
          this.inThink = true;
        } else {
          // No opening tag — emit safe prefix, keep potential partial tag
          const safe = this.safeEmitLength(ThinkRenderer.OPEN);
          output += this.buffer.slice(0, safe);
          this.buffer = this.buffer.slice(safe);
          if (this.buffer.length > 0) break; // Partial tag — wait
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
    }
    return output;
  }

  /** Reset state for a new message. */
  reset(): void {
    this.inThink = false;
    this.buffer = "";
  }

  /**
   * Find a tag in the buffer. Returns the start index or -1.
   * Handles the case where the tag might not have '>' at the end.
   */
  private findTag(buf: string, tag: string): number {
    return buf.indexOf(tag);
  }

  /**
   * How many chars from the start of buffer are safe to emit
   * without cutting a partial tag at the end?
   */
  private safeEmitLength(tag: string): number {
    const tagLen = tag.length;
    if (this.buffer.length <= tagLen) return 0;

    // Check if the tail of buffer could be a partial match of the tag
    for (let overlap = Math.min(tagLen - 1, this.buffer.length - 1); overlap >= 1; overlap--) {
      const tail = this.buffer.slice(-overlap);
      if (tag.startsWith(tail)) {
        return this.buffer.length - overlap;
      }
    }
    return this.buffer.length;
  }

  /** Apply think-content color. */
  private colorThink(text: string): string {
    if (!text) return "";
    return `${ANSI.dimCyan}${text}${ANSI.reset}`;
  }
}
