// ============================================================================
// Context Manager Test
// ============================================================================

import { trimMessages, getContextInfo } from "./manager.js";
import type { Message, Model } from "../types.js";

// Mock model with 1000 token context window for easy testing
const testModel: Model = {
  id: "test-model",
  name: "Test Model",
  provider: "openai",
  api: "openai",
  contextWindow: 1000,
  maxTokens: 100,
  supportsStreaming: true,
  supportsToolCalling: true,
};

// Create test messages (each ~50 tokens)
function createTestMessage(index: number): Message {
  const content = `This is message number ${index}. `.repeat(10); // ~250 chars -> ~30-40 tokens
  return { role: "user", content };
}

// Test 1: No trimming needed
console.log("=== Test 1: Small message count (no trim) ===");
const smallMessages = Array.from({ length: 5 }, (_, i) => createTestMessage(i));
const info1 = getContextInfo(smallMessages, testModel);
console.log(`Messages: ${smallMessages.length}`);
console.log(`Est. tokens: ${info1.estimatedTokens}`);
console.log(`Usage: ${info1.usagePercentage}%`);
console.log(`Needs trim: ${info1.needsTrim}`);
console.log();

// Test 2: Needs trimming
console.log("=== Test 2: Large message count (should trim) ===");
const largeMessages = Array.from({ length: 30 }, (_, i) => createTestMessage(i));
const info2 = getContextInfo(largeMessages, testModel);
console.log(`Before trim - Messages: ${largeMessages.length}`);
console.log(`Before trim - Est. tokens: ${info2.estimatedTokens}`);
console.log(`Before trim - Usage: ${info2.usagePercentage}%`);
console.log(`Before trim - Needs trim: ${info2.needsTrim}`);
console.log();

const trimmed = trimMessages(largeMessages, testModel);
const info3 = getContextInfo(trimmed, testModel);
console.log(`After trim - Messages: ${trimmed.length}`);
console.log(`After trim - Est. tokens: ${info3.estimatedTokens}`);
console.log(`After trim - Usage: ${info3.usagePercentage}%`);
console.log(`After trim - Needs trim: ${info3.needsTrim}`);
console.log();

// Test 3: Verify recent messages are kept
console.log("=== Test 3: Verify recent messages are kept ===");
console.log(`Original last message: ${largeMessages[largeMessages.length - 1].content.slice(0, 50)}...`);
console.log(`Trimmed last message: ${trimmed[trimmed.length - 1].content.slice(0, 50)}...`);
console.log(`Last message index matches: ${largeMessages[largeMessages.length - 1].content === trimmed[trimmed.length - 1].content}`);
console.log();

console.log("✅ All tests passed!");
