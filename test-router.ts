// Test script for CostRouter — verifies intelligent routing to GLM-5.1
import "dotenv/config";
import { MODELS } from "./dist/cli/models.js";
import { CostRouter } from "./dist/router/index.js";

const cheapModel = MODELS["MiniMax-M2.7"];
const expensiveModel = MODELS["glm-5.1"];

if (!cheapModel || !expensiveModel) {
  console.error("Missing models in registry");
  process.exit(1);
}

const router = new CostRouter({
  cheapModel,
  expensiveModel,
  threshold: 4,
  strategy: "pre-classify",
});

async function testRouter() {
  console.log("\n=== CostRouter Test ===\n");
  console.log(`Cheap model: ${cheapModel.name} (${cheapModel.provider})`);
  console.log(`Expensive model: ${expensiveModel.name} (${expensiveModel.provider})`);
  console.log(`Threshold: 4 (score >= 4 → escalate to GLM-5.1)\n`);

  // Test queries of varying complexity
  const testQueries = [
    // Simple queries (should stay on MiniMax-M2.7)
    { text: "Hello, how are you?", expectedEscalated: false },
    { text: "What is 2+2?", expectedEscalated: false },

    // Moderate complexity (should stay on MiniMax-M2.7)
    { text: "How do I read a file in Node.js?", expectedEscalated: false },
    { text: "Explain what a REST API is", expectedEscalated: false },

    // Complex queries (should escalate to GLM-5.1)
    { text: "Design a scalable microservices architecture with authentication", expectedEscalated: true },
    { text: "Debug this code that has a race condition in concurrent database operations", expectedEscalated: true },
    { text: "Explain the security implications of SQL injection and how to prevent it", expectedEscalated: true },
    { text: "Write a complex sorting algorithm implementation with detailed comments", expectedEscalated: true },

    // Very complex queries (should definitely escalate)
    { text: "I need to implement a distributed consensus algorithm like Raft from scratch, including leader election, log replication, and safety properties. Please provide the full implementation with explanation.", expectedEscalated: true },
    { text: "Analyze the security vulnerabilities in this authentication system and propose a comprehensive fix including session management, token handling, and protection against CSRF, XSS, and replay attacks", expectedEscalated: true },
  ];

  let passed = 0;
  let failed = 0;

  for (const { text, expectedEscalated } of testQueries) {
    console.log(`Query: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`);
    console.log(`Expected: ${expectedEscalated ? "escalate to GLM-5.1" : "MiniMax-M2.7"}`);

    try {
      const decision = await router.route(text);

      const actual = decision.escalated ? "escalate" : "cheap";
      const expectedStr = expectedEscalated ? "escalate" : "cheap";
      const match = actual === expectedStr ? "✓ PASS" : "✗ FAIL";

      console.log(`Result: ${match} | Score: ${decision.score} | Model: ${decision.model.name}`);
      console.log(`Classification time: ${decision.classifyTimeMs}ms`);
      console.log(`Reasoning: ${decision.reasoning}`);
      console.log("");

      if (actual === expectedStr) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      console.log(`✗ ERROR: ${err instanceof Error ? err.message : err}`);
      console.log("");
      failed++;
    }
  }

  // Print stats
  const stats = router.getStats();
  console.log("\n=== Router Statistics ===");
  console.log(`Total queries: ${stats.totalQueries}`);
  console.log(`Cheap (MiniMax-M2.7): ${stats.cheapQueries}`);
  console.log(`Expensive (GLM-5.1): ${stats.expensiveQueries}`);
  console.log(`Escalation rate: ${stats.escalationRate}%`);
  console.log(`Classify tokens: ${stats.totalClassifyTokens}`);
  console.log(`\nPassed: ${passed}/${testQueries.length}`);
  console.log(`Failed: ${failed}/${testQueries.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

testRouter().catch(console.error);