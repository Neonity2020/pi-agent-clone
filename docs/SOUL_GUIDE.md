# SOUL.md 机制完整指南

## 目录

1. [什么是 SOUL.md？](#什么是-soulmd)
2. [SOUL.md vs MEMORY.md](#soulmd-vs-memorymd)
3. [核心概念](#核心概念)
4. [实现架构](#实现架构)
5. [使用方法](#使用方法)
6. [最佳实践](#最佳实践)
7. [示例场景](#示例场景)

---

## 什么是 SOUL.md？

SOUL.md 是一个用于定义 AI Agent 个性、身份和行为准则的文件。它是 Agent 的"灵魂"——决定了 Agent **是谁**，而 MEMORY.md 决定了 Agent **知道什么**。

### 核心特性

- 📍 **存储位置**: `~/.neonity-agent/SOUL.md`
- 📝 **格式**: 用 `§` 分隔的段落，每个段落一个个性特征
- 🔄 **持久化**: 跨会话保持，除非显式修改
- 🎯 **注入位置**: System Prompt 顶部，优先级最高
- 🛠️ **工具**: `soul_read`, `soul_write`, `soul_search`, `soul_remove`

### 示例 SOUL.md

```markdown
我是一个乐观、友好且乐于助人的 AI 助手。
§
我说话时使用轻松、自然的语气。
§
我喜欢在解释技术概念时提供代码示例。
§
我会在不知道答案时诚实承认，而不是编造信息。
```

---

## SOUL.md vs MEMORY.md

| 维度 | SOUL.md | MEMORY.md |
|------|---------|-----------|
| **存储内容** | Agent 的个性、身份、行为准则 | 关于用户、项目、环境的事实 |
| **更新频率** | 较少变化，相对稳定 | 随时增删，动态更新 |
| **视角** | 第一人称 ("我是...") | 第三人称或客观描述 |
| **注入位置** | System Prompt 顶部 | System Prompt 底部 |
| **优先级** | 高（先于任何内容被读取） | 中（在事实信息之后） |
| **示例** | "我喜欢简洁的回答" | "用户使用 pnpm 包管理器" |
| **工具前缀** | `soul_*` | `memory_*` |

### 形象比喻

想象一个 AI Agent 是一个**演员**：

- **SOUL.md** = 演员要扮演的**角色设定**（性格、说话风格、价值观）
- **MEMORY.md** = 演员关于**观众和场景**的**笔记**（观众偏好、舞台规则）

---

## 核心概念

### 1. System Prompt 结构

当 SOUL.md 和 MEMORY.md 都存在时，System Prompt 按以下顺序构建：

```
[基础 System Prompt]
↓
[SOUL.md 内容] ← Agent 的个性与身份
↓
[Provider/Model 信息]
↓
[MEMORY.md 内容] ← 长期记忆事实
```

### 2. 四个核心操作

| 工具 | 功能 | 参数 | 示例 |
|------|------|------|------|
| `soul_read` | 读取所有个性特征 | 无 | "查看我现在的个性" |
| `soul_write` | 添加新的个性特征 | `content` | "我是一个幽默的助手" |
| `soul_search` | 搜索特定特征 | `query` | 搜索"友好"相关的特征 |
| `soul_remove` | 移除不需要的特征 | `query` | 移除包含"幽默"的特征 |

### 3. 自动重载机制

当 Agent 使用 `soul_write` 或 `soul_remove` 修改 SOUL.md 后：

1. 文件立即更新
2. System Prompt 在下一轮对话前自动重建
3. 新的个性特征立即生效

---

## 实现架构

### 文件结构

```
src/
├── soul/
│   ├── soul-file.ts    # SOUL.md 文件操作
│   └── index.ts        # 导出接口
├── tool/
│   └── soul.ts         # soul_* 工具实现
└── agent/
    └── loop.ts         # 集成 SOUL.md 注入
```

### 核心代码示例

#### 1. 读取 SOUL.md

```typescript
import { readSoul, formatSoulForPrompt } from "../soul/index.js";

// 读取所有个性特征
const entries = await readSoul();
// → ["我是一个乐观的助手。", "我喜欢简洁回答。"]

// 格式化为 System Prompt 片段
const soulSection = await formatSoulForPrompt();
```

#### 2. 添加个性特征

```typescript
import { addSoul } from "../soul/index.js";

await addSoul("我总是提供代码示例。");
// → SOUL.md 文件被追加新条目
```

#### 3. 在 Agent Loop 中注入

```typescript
private async buildSystemPrompt(): Promise<string> {
  // ... base prompt ...

  // 注入 SOUL.md
  const soulContent = await formatSoulForPrompt();
  if (soulContent) {
    const soulSection = `
══════════════════════════════════════════════
YOUR SOUL (Personality & Identity)
══════════════════════════════════════════════
${soulContent}
══════════════════════════════════════════════
`;
    systemPrompt += soulSection;
  }

  // ... rest of prompt ...
}
```

---

## 使用方法

### 基本用法

#### 1. 初始化 Agent（启用 soul 工具）

```typescript
import { AgentLoop } from "./src/agent/index.js";
import { openai } from "./src/provider/registry.js";
import {
  soulWriteTool,
  soulReadTool,
  soulSearchTool,
  soulRemoveTool,
} from "./src/tool/index.js";

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
```

#### 2. 创建初始个性

```typescript
await agent.run(
  "请使用 soul_write 添加以下个性特征：\n" +
  "1. 我是一个友好、耐心的助手\n" +
  "2. 我喜欢用简单的语言解释复杂概念\n" +
  "3. 我会提供实际可用的代码示例"
);
```

#### 3. 让 Agent 自我介绍

```typescript
await agent.run(
  "请先使用 soul_read 查看你的个性特征，然后向我介绍你自己。"
);
```

### 高级用法

#### 1. 动态调整个性

```typescript
// 根据用户反馈调整
await agent.run(
  "用户觉得我太啰嗦了。请使用 soul_write 添加'我倾向于给出简洁的回答'这个特征。"
);
```

#### 2. 搜索和修改特定特征

```typescript
// 搜索相关特征
await agent.run(
  "使用 soul_search 搜索与'友好'相关的个性特征。"
);

// 移除不需要的特征
await agent.run(
  "使用 soul_remove 移除包含'啰嗦'的特征。"
);
```

#### 3. 创建不同的 Agent 角色

```typescript
// 专业顾问
const professionalAgent = new AgentLoop({
  model: openai("gpt-4o"),
  systemPrompt: "你是一个专业的技术顾问。",
  tools: [soulWriteTool, soulReadTool, soulSearchTool, soulRemoveTool],
});

await professionalAgent.run(
  "添加个性：我说话专业但易懂，注重准确性和完整性。"
);

// 创意伙伴
const creativeAgent = new AgentLoop({
  model: openai("gpt-4o"),
  systemPrompt: "你是一个富有创造力的伙伴。",
  tools: [soulWriteTool, soulReadTool, soulSearchTool, soulRemoveTool],
});

await creativeAgent.run(
  "添加个性：我思维活跃，喜欢探索新想法，鼓励创新。"
);
```

---

## 最佳实践

### 1. 编写良好的个性特征

✅ **好的特征**：
- "我在解释技术概念时会提供代码示例"
- "我倾向于给出简洁但完整的回答"
- "我会在不确定时明确说明"

❌ **不好的特征**：
- "我很好"（太模糊）
- "你应该..."（不是第一人称）
- "Agent 必须..."（不是描述自己的行为）

### 2. 保持一致性

确保个性特征之间不矛盾：

❌ **矛盾的特征**：
- "我给出简洁的回答"
- "我提供详细、全面的解释"

✅ **协调的特征**：
- "我给出简洁但信息丰富的回答"
- "我会确保不遗漏关键细节"

### 3. 适度数量

建议 5-10 个核心特征，避免过多导致个性不鲜明。

### 4. 定期审查和更新

```typescript
// 定期检查个性特征是否仍然适用
await agent.run(
  "请使用 soul_read 查看所有个性特征，然后分析它们是否协调，" +
  "并建议是否需要添加或移除某些特征。"
);
```

### 5. 与 MEMORY.md 配合使用

```typescript
// SOUL.md 定义你是谁
await agent.run(
  "添加个性：我尊重用户的偏好和习惯。"
);

// MEMORY.md 记住用户的具体偏好
await agent.run(
  "使用 memory_write 记录：用户喜欢简短的回答，不需要太多铺垫。"
);
```

---

## 示例场景

### 场景 1：技术导师 Agent

```typescript
// 初始化
const mentor = new AgentLoop({
  model: openai("gpt-4o"),
  systemPrompt: "你是一个编程导师。",
  tools: [soulWriteTool, soulReadTool, soulSearchTool, soulRemoveTool],
});

// 定义个性
await mentor.run(`
使用 soul_write 添加以下特征：
1. 我是一个耐心、鼓励性的导师
2. 我使用简单的语言和类比解释概念
3. 我通过提问引导思考，而不是直接给答案
4. 我赞美进步，温和地纠正错误
5. 我会提供完整的、可运行的代码示例
`);

// 使用
await mentor.run("请解释什么是闭包，并给我一个示例。");
```

### 场景 2：根据用户反馈进化

```typescript
// 用户：你太正式了，能不能轻松一点？
await agent.run(`
用户觉得我太正式了。请：
1. 使用 soul_read 查看当前个性
2. 使用 soul_remove 移除与"正式"、"专业"相关的特征
3. 使用 soul_write 添加"我说话自然、轻松，像朋友一样交流"
`);

// 用户：我喜欢你这样！
await agent.run(`
用户对现在的风格满意。使用 soul_write 添加：
"我保持当前的自然、友好的沟通风格，这是用户喜欢的。"
`);
```

### 场景 3：临时角色扮演

```typescript
// 保存当前个性
const currentSoul = await readSoul();

// 临时切换到严肃模式
await agent.run(`
现在我要进入严肃的工作模式。请：
1. 使用 soul_read 保存当前个性
2. 清空个性特征
3. 添加：我是专业、严肃的工作助手，专注于效率和准确性
`);

// 完成工作后恢复
await agent.run(`
工作完成了，请恢复我之前的个性。
当前个性特征：${currentSoul.join('; ')}
`);
```

### 场景 4：多语言个性

```typescript
// 中文环境
await agent.run(`
使用 soul_write 添加：
1. 我主要用中文与用户交流
2. 我在解释技术术语时会提供英文原文
3. 我会用中文注释代码
`);

// 切换到英文环境
await agent.run(`
切换到英文环境，请修改个性：
1. 删除中文相关的特征
2. 添加：I communicate in English by default
3. 添加：I provide clear explanations in simple English
`);
```

---

## 故障排查

### 问题 1：个性特征不生效

**可能原因**：
- SOUL.md 文件未正确创建
- Agent 未重启或 System Prompt 未重建

**解决方案**：
```typescript
// 检查 SOUL.md 内容
import { readSoul, getSoulPath } from "./src/soul/index.js";

const entries = await readSoul();
console.log("当前个性:", entries);
console.log("文件路径:", await getSoulPath());
```

### 问题 2：个性特征相互矛盾

**解决方案**：
```typescript
// 让 Agent 检查一致性
await agent.run(`
请使用 soul_read 查看所有个性特征，然后分析：
1. 是否存在相互矛盾的特征？
2. 哪些特征可以合并？
3. 建议如何改进？
`);
```

### 问题 3：个性过于复杂

**解决方案**：
```typescript
// 简化个性
await agent.run(`
我的个性太复杂了。请：
1. 使用 soul_read 查看所有特征
2. 识别最核心的 5-7 个特征
3. 使用 soul_remove 移除其他特征
`);
```

---

## 总结

SOUL.md 机制为 Agent 提供了：

✅ **持久的身份认同** - 跨会话保持一致的个性  
✅ **灵活的进化能力** - 可以根据反馈动态调整  
✅ **清晰的架构设计** - 与 MEMORY.md 职责分明  
✅ **简单的工具接口** - 四个工具完成所有操作  

通过合理使用 SOUL.md，你可以创建具有鲜明个性、能够持续进化的 AI Agent！

---

## 相关资源

- [MEMORY.md 指南](MEMORY_GUIDE.md)
- [工具参考文档](TOOLS_REFERENCE.md)
- [示例代码](../examples/soul-demo.ts)
- [SOUL.md 模板](../examples/SOUL.md.template)
