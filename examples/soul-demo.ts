/**
 * SOUL.md 演示脚本
 * 
 * 这个脚本展示如何使用 SOUL.md 机制来定义和管理 Agent 的个性与身份。
 */

import { AgentLoop } from "../src/agent/index.js";
import { openai } from "../src/provider/registry.js";
import {
  soulWriteTool,
  soulReadTool,
  soulSearchTool,
  soulRemoveTool,
} from "../src/tool/index.js";

// 初始化 Agent，启用 soul 工具
const agent = new AgentLoop({
  model: openai("gpt-4o"),
  systemPrompt: "你是一个有帮助的 AI 助手。",
  tools: [
    soulWriteTool,
    soulReadTool,
    soulSearchTool,
    soulRemoveTool,
  ],
  maxIterations: 10,
});

// 示例 1: 创建初始个性
async function demo1_CreateInitialSoul() {
  console.log("\n=== 示例 1: 创建初始个性 ===\n");

  const result = await agent.run(
    "请使用 soul_write 工具为我创建以下个性特征：\n" +
    "1. 我是一个乐观、友好且乐于助人的 AI 助手\n" +
    "2. 我说话时使用轻松、自然的语气\n" +
    "3. 我喜欢在解释技术概念时提供代码示例\n" +
    "4. 我会在不知道答案时诚实承认，而不是编造"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 示例 2: 读取并理解自己的个性
async function demo2_ReadSoul() {
  console.log("\n=== 示例 2: 读取自己的个性 ===\n");

  const result = await agent.run(
    "请使用 soul_read 工具查看我当前的个性特征，然后告诉我你对自己的理解。"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 示例 3: 根据个性回答问题
async function demo3_AnswerWithPersonality() {
  console.log("\n=== 示例 3: 根据个性回答问题 ===\n");

  const result = await agent.run(
    "你好！请介绍一下你自己，并告诉我如何在 JavaScript 中创建一个异步函数。"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 示例 4: 搜索特定个性特征
async function demo4_SearchSoul() {
  console.log("\n=== 示例 4: 搜索个性特征 ===\n");

  const result = await agent.run(
    "请使用 soul_search 工具搜索与'友好'或'乐观'相关的个性特征。"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 示例 5: 进化个性
async function demo5_EvolveSoul() {
  console.log("\n=== 示例 5: 进化个性 ===\n");

  const result = await agent.run(
    "我觉得我需要变得更专业一些。请使用 soul_write 添加以下特征：\n" +
    "1. 在处理技术问题时，我会提供详细、准确的解释\n" +
    "2. 我会确保代码示例完整且可以直接运行"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 示例 6: 移除不需要的特征
async function demo6_RemoveSoul() {
  console.log("\n=== 示例 6: 移除个性特征 ===\n");

  const result = await agent.run(
    "我认为'轻松、自然的语气'不太适合我的专业形象。请使用 soul_remove 移除这个特征。"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 示例 7: 查看最终的个性
async function demo7_FinalSoul() {
  console.log("\n=== 示例 7: 查看最终个性 ===\n");

  const result = await agent.run(
    "请使用 soul_read 查看我现在的所有个性特征，然后总结一下我现在的形象。"
  );

  console.log("Agent 响应:", result.messages[result.messages.length - 1]?.content);
}

// 运行所有示例
async function runAllDemos() {
  try {
    await demo1_CreateInitialSoul();
    await demo2_ReadSoul();
    await demo3_AnswerWithPersonality();
    await demo4_SearchSoul();
    await demo5_EvolveSoul();
    await demo6_RemoveSoul();
    await demo7_FinalSoul();

    console.log("\n=== 所有演示完成 ===\n");
  } catch (error) {
    console.error("错误:", error);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllDemos();
}

export { runAllDemos };
