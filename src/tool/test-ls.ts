// ============================================================================
// Test the ls tool
// ============================================================================

import { lsTool } from "./ls.js";

async function runTests() {
  console.log("=== Test 1: List current directory (tree format) ===\n");
  const result1 = await lsTool.execute({
    path: ".",
    format: "tree",
  });
  console.log(result1);
  console.log("\n");

  console.log("=== Test 2: List with table format ===\n");
  const result2 = await lsTool.execute({
    path: "src",
    format: "table",
  });
  console.log(result2);
  console.log("\n");

  console.log("=== Test 3: List TypeScript files only ===\n");
  const result3 = await lsTool.execute({
    path: "src",
    format: "table",
    extensions: [".ts"],
  });
  console.log(result3);
  console.log("\n");

  console.log("=== Test 4: Recursive listing ===\n");
  const result4 = await lsTool.execute({
    path: "src",
    recursive: true,
    maxDepth: 2,
    format: "tree",
  });
  console.log(result4);
  console.log("\n");

  console.log("=== Test 5: JSON format ===\n");
  const result5 = await lsTool.execute({
    path: "src/tool",
    format: "json",
  });
  console.log(result5);

  console.log("\n✅ All ls tool tests completed!");
}

runTests().catch(console.error);
