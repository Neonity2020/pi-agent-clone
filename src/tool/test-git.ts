// ============================================================================
// Test the git tools
// ============================================================================

import { gitStatusTool, gitLogTool, gitDiffTool, gitTool } from "./index.js";

async function runGitTests() {
  console.log("=== Test 1: git_status ===\n");
  try {
    const result1 = await gitStatusTool.execute({});
    console.log(result1);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log("\n");

  console.log("=== Test 2: git_log ===\n");
  try {
    const result2 = await gitLogTool.execute({
      max_count: 5,
      oneline: true,
    });
    console.log(result2);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log("\n");

  console.log("=== Test 3: git_diff (unstaged) ===\n");
  try {
    const result3 = await gitDiffTool.execute({});
    console.log(result3);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }
  console.log("\n");

  console.log("=== Test 4: git (custom command) ===\n");
  try {
    const result4 = await gitTool.execute({
      command: "branch -a",
    });
    console.log(result4);
  } catch (err: any) {
    console.log(`Error: ${err.message}`);
  }

  console.log("\n✅ Git tool tests completed!");
}

runGitTests().catch(console.error);
