// ============================================================================
// Context Manager - Simple 80% threshold protection
// ============================================================================

import type { Message, Model } from "../types.js";

/**
 * Estimate token count for a string.
 * Approximate: 1 token ≈ 4 characters for English/code,
 *              1 token ≈ 2 characters for Chinese.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count Chinese characters
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // Count other characters
  const otherChars = text.length - chineseChars;

  // Chinese: ~0.5 token per char, English/code: ~0.25 token per char
  return Math.ceil(chineseChars * 0.5 + otherChars * 0.25);
}

/**
 * Estimate token count for a message.
 */
function estimateMessageTokens(message: Message): number {
  let content = "";
  if (message.role === "assistant" && "toolCalls" in message && message.toolCalls) {
    // Include tool calls in estimation
    content = message.content + JSON.stringify(message.toolCalls);
  } else {
    content = message.content;
  }
  return estimateTokens(content) + 10; // Add overhead for role/metadata
}

/**
 * Estimate total tokens for a message array.
 */
function estimateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);
}

/**
 * Context window threshold (default: 80%)
 */
const DEFAULT_THRESHOLD = 0.8;

/**
 * Trim messages to fit within 80% of context window.
 * Strategy: Keep recent messages, drop old ones from the beginning.
 */
export function trimMessages(
  messages: Message[],
  model: Model,
  threshold: number = DEFAULT_THRESHOLD,
): Message[] {
  const maxTokens = Math.floor(model.contextWindow * threshold);
  const estimatedTokens = estimateTotalTokens(messages);

  // If within limit, return as-is
  if (estimatedTokens <= maxTokens) {
    return messages;
  }

  // Need to trim - keep recent messages (from end)
  const kept: Message[] = [];
  let currentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateMessageTokens(msg);

    if (currentTokens + msgTokens > maxTokens) {
      break; // Would exceed budget, stop
    }

    kept.unshift(msg);
    currentTokens += msgTokens;
  }

  return kept;
}

/**
 * Get context usage info for debugging.
 */
export function getContextInfo(messages: Message[], model: Model): {
  estimatedTokens: number;
  contextWindow: number;
  usagePercentage: number;
  needsTrim: boolean;
} {
  const estimatedTokens = estimateTotalTokens(messages);
  const usagePercentage = (estimatedTokens / model.contextWindow) * 100;
  const needsTrim = usagePercentage > DEFAULT_THRESHOLD * 100;

  return {
    estimatedTokens,
    contextWindow: model.contextWindow,
    usagePercentage: Math.round(usagePercentage * 10) / 10,
    needsTrim,
  };
}
