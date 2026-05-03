
import { ThinkRenderer } from "./src/cli/think-render.js";

function assertEqual(actual: string, expected: string, label: string) {
  // Strip ANSI codes for comparison of logical content
  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
  const cleanActual = stripAnsi(actual);
  const cleanExpected = stripAnsi(expected);
  if (cleanActual !== cleanExpected) {
    console.log(`FAIL: ${label}`);
    console.log(`  expected: ${JSON.stringify(cleanExpected)}`);
    console.log(`  actual:   ${JSON.stringify(cleanActual)}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${label}`);
  }
}

// Test 1: Simple think block in one chunk
{
  const r = new ThinkRenderer();
  const out = r.process("<think\nreasoning here\n</think\nNormal text");
  const flushed = r.flush();
  const full = out + flushed;
  assertEqual(full, "reasoning here\nNormal text", "single-chunk think block");
}

// Test 2: Think block split across multiple chunks
{
  const r = new ThinkRenderer();
  const chunks = ["<thi", "nk>\nstep 1\n", "step 2</th", "ink>\nFinal answer"];
  let full = "";
  for (const c of chunks) {
    full += r.process(c);
  }
  full += r.flush();
  assertEqual(full, "\nstep 1\nstep 2\nFinal answer", "multi-chunk think block");
}

// Test 3: No think tags — passthrough
{
  const r = new ThinkRenderer();
  const out = r.process("Hello, world! No thinking here.");
  assertEqual(out, "Hello, world! No thinking here.", "no think tags passthrough");
}

// Test 4: Multiple think blocks
{
  const r = new ThinkRenderer();
  const out = r.process("<think\nA</think\nText1<think\nB</think\nText2");
  const flushed = r.flush();
  const full = out + flushed;
  assertEqual(full, "\nA\nText1\nB\nText2", "multiple think blocks");
}

// Test 5: Think without closing tag (flushed)
{
  const r = new ThinkRenderer();
  const out = r.process("<think\nunfinished reasoning");
  const flushed = r.flush();
  const full = out + flushed;
  assertEqual(full, "\nunfinished reasoning", "unclosed think block (flush)");
}

// Test 6: Reset between messages
{
  const r = new ThinkRenderer();
  r.process("<think\nold");
  r.reset();
  const out = r.process("fresh start");
  assertEqual(out, "fresh start", "reset clears state");
}

// Visual test: show what the colors look like
console.log("\n--- Visual test ---");
{
  const r = new ThinkRenderer();
  const out = r.process("<think\nLet me analyze this problem step by step.\nFirst, I need to consider...\n</think\nThe answer is 42.");
  const flushed = r.flush();
  console.log(out + flushed);
}

console.log("\nAll tests passed!");

