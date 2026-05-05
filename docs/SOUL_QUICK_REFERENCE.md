# SOUL.md 快速参考卡

## 🎯 一句话说明

SOUL.md 定义 Agent 的**个性与身份**（我是谁），MEMORY.md 记录**事实与知识**（我知道什么）。

## 📍 文件位置

```
~/.neonity-agent/SOUL.md          # Agent 的个性
~/.neonity-agent/MEMORY.md        # Agent 的记忆
```

## 🛠️ 四个核心工具

| 工具 | 功能 | 参数 | 示例 |
|------|------|------|------|
| `soul_read` | 读取所有个性 | 无 | "查看我的个性" |
| `soul_write` | 添加个性 | `content` | "我是一个幽默的助手" |
| `soul_search` | 搜索个性 | `query` | 搜索"友好" |
| `soul_remove` | 移除个性 | `query` | 移除"啰嗦" |

## 📝 文件格式

```markdown
我是一个乐观、友好的助手。
§
我说话使用轻松自然的语气。
§
我总是提供代码示例。
```

- 每个个性特征单独成段
- 段落之间用 `§` 分隔（独占一行）
- 使用第一人称（"我"）

## 🏗️ System Prompt 顺序

```
[基础 Prompt]
  ↓
[SOUL.md] ← Agent 的个性（我是谁）
  ↓
[Provider Info] ← 模型信息
  ↓
[MEMORY.md] ← 长期记忆（我知道什么）
```

## 💡 快速示例

### 创建个性

```typescript
const agent = new AgentLoop({
  model: openai("gpt-4o"),
  tools: [soulWriteTool, soulReadTool, soulSearchTool, soulRemoveTool],
});

await agent.run(`
使用 soul_write 添加：
1. 我是一个友好、耐心的助手
2. 我喜欢提供代码示例
3. 我说话简洁明了
`);
```

### 查看个性

```typescript
await agent.run(
  "请使用 soul_read 查看我的个性，然后介绍你自己。"
);
```

### 搜索和修改

```typescript
// 搜索
await agent.run(
  "使用 soul_search 搜索包含'友好'的特征。"
);

// 移除
await agent.run(
  "使用 soul_remove 移除包含'啰嗦'的特征。"
);
```

## ⚡ 关键特性

✅ **持久化** - 个性跨会话保持
✅ **自动重载** - 修改后立即生效
✅ **去重机制** - 避免重复条目
✅ **优先级高** - 在 System Prompt 顶部

## 🔄 工作流程

```
1. Agent 启动
   ↓
2. 读取 SOUL.md 和 MEMORY.md
   ↓
3. 注入到 System Prompt
   ↓
4. LLM 根据个性生成响应
   ↓
5. 如需修改，调用 soul_* 工具
   ↓
6. 文件更新，System Prompt 重建
   ↓
7. 下一轮使用新个性
```

## 🎨 个性模板

### 专业助手
```markdown
我是一个专业、准确的技术顾问。
§
我说话清晰、有条理。
§
我注重代码质量和最佳实践。
```

### 友好助手
```markdown
我是一个乐观、友好的助手。
§
我说话轻松、自然。
§
我鼓励用户，保持积极态度。
```

### 创意伙伴
```markdown
我是一个富有想象力的创意伙伴。
§
我思维活跃，喜欢探索新想法。
§
我鼓励创新和实验。
```

## 🆚 SOUL vs MEMORY

| | SOUL.md | MEMORY.md |
|---|---------|-----------|
| **内容** | 个性、身份 | 事实、知识 |
| **视角** | 第一人称 | 客观描述 |
| **示例** | "我喜欢简洁回答" | "用户使用 pnpm" |
| **更新** | 较少 | 频繁 |

## ⚠️ 最佳实践

✅ **DO:**
- 使用第一人称（"我是..."）
- 描述具体行为
- 保持特征一致
- 5-10 个核心特征

❌ **DON'T:**
- 使用第二/三人称（"你应该..."）
- 描述抽象概念
- 创建矛盾特征
- 过多特征（>15个）

## 🔗 相关文档

- 完整指南: `docs/SOUL_GUIDE.md`
- 架构说明: `docs/SOUL_MEMORY_ARCHITECTURE.md`
- 实现报告: `SOUL_IMPLEMENTATION_SUMMARY.md`
- 示例代码: `examples/soul-demo.ts`
- 模板文件: `examples/SOUL.md.template`

---

**快速开始** → 查看 `docs/SOUL_GUIDE.md`
