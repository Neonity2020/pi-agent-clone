# SOUL.md 与 MEMORY.md 架构说明

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Loop                                 │
│                    (REACT Pattern)                              │
│                  Reason → Act → Observe                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    System Prompt Builder                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   SOUL.md    │    │  Provider    │    │  MEMORY.md   │
│              │    │    Info      │    │              │
│  Agent's     │    │  (Model,     │    │  Facts about │
│  Personality │    │   Provider,  │    │  User &      │
│  Identity    │    │   Context)   │    │  Project     │
│              │    │              │    │              │
│  "我是..."   │    │  "当前运行在  │    │  "用户偏好..."│
│  "我喜欢..." │    │   某模型上"   │    │  "项目约定..."│
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Complete System Prompt                        │
│                                                                  │
│  [Base Prompt]                                                   │
│  + SOUL Section (WHO am I)                                       │
│  + Provider Info (WHERE am I running)                           │
│  + MEMORY Section (WHAT do I know)                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LLM Provider                                 │
│                   (OpenAI, Anthropic, etc.)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Response                               │
│                  (with personality traits)                       │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流向图

```
┌─────────┐
│  User   │
└────┬────┘
     │ 1. Send message
     ▼
┌─────────────────────────────────────────┐
│          Agent Loop                     │
│  ┌──────────────────────────────────┐  │
│  │  buildSystemPrompt()             │  │
│  │    ↓                            │  │
│  │  read SOUL.md (~/.pi-agent/)    │  │
│  │    ↓                            │  │
│  │  formatSoulForPrompt()          │  │
│  │    ↓                            │  │
│  │  read MEMORY.md (~/.pi-agent/)  │  │
│  │    ↓                            │  │
│  │  formatMemoryForPrompt()        │  │
│  └──────────────────────────────────┘  │
└────────────┬────────────────────────────┘
             │ 2. Send to LLM with injected context
             ▼
┌─────────────────────────────────────────┐
│            LLM Provider                 │
│  (Process with SOUL + MEMORY context)  │
└────────────┬────────────────────────────┘
             │ 3. Generate response
             ▼
┌─────────────────────────────────────────┐
│           Agent Response                │
│  (Reflects personality from SOUL.md)   │
└────────────┬────────────────────────────┘
             │ 4. May call tools
             ▼
     ┌───────────────┐
     │  Tool Calls   │
     └───────┬───────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐    ┌─────────┐
│  soul_* │    │memory_* │
│  tools  │    │  tools  │
└────┬────┘    └────┬────┘
     │              │
     ▼              ▼
┌─────────┐    ┌─────────┐
│SOUL.md  │    │MEMORY.md│
│ Updated │    │ Updated │
└─────────┘    └─────────┘
     │              │
     └──────┬───────┘
            │ 5. Rebuild System Prompt
            ▼
     ┌──────────────┐
     │ Next Turn    │
     └──────────────┘
```

## 文件系统布局

```
~/.pi-agent/
│
├── SOUL.md              # Agent 的个性与身份
│   我是一个乐观、友好的助手。
│   §
│   我说话使用轻松自然的语气。
│   §
│   我总是提供代码示例。
│
└── MEMORY.md            # 长期记忆事实
    用户使用 pnpm 包管理器。
    §
    项目使用 TypeScript。
    §
    API 密钥存储在 .env 文件中。
```

## System Prompt 实际示例

```markdown
你是一个有帮助的 AI 助手。

══════════════════════════════════════════════
YOUR SOUL (Personality & Identity)
══════════════════════════════════════════════
我是一个乐观、友好且乐于助人的 AI 助手。
§
我说话时使用轻松、自然的语气。
§
我喜欢在解释技术概念时提供代码示例。
§
我会在不知道答案时诚实承认，而不是编造信息。
══════════════════════════════════════════════

The above entries define who you are as an AI assistant. They describe your personality,
communication style, values, and behavioral guidelines. Let these traits guide your responses.
You can evolve your soul using soul_write, soul_read, soul_search, and soul_remove tools.

══════════════════════════════════════════════
CURRENT PROVIDER & MODEL
══════════════════════════════════════════════
Provider: openai
Model: gpt-4o (gpt-4o-2024-05-13)
API mode: openai
Context window: 128000 tokens
Max output: 4096 tokens
══════════════════════════════════════════════

You are currently running on the above provider and model. You can mention this information if the user asks about your identity.

══════════════════════════════════════════════
LONG-TERM MEMORY (persistent across sessions)
══════════════════════════════════════════════
User workflow: when "git push" is requested, first run git status, then intelligent git commit with short English message, then git push
══════════════════════════════════════════════

The above facts are from your long-term memory (MEMORY.md). They persist across conversations.
Use memory_write to save new important facts (user preferences, project conventions, environment details).
Use memory_read to review all memories. Use memory_search to find specific memories.
Use memory_remove to delete outdated entries.
```

## 工具调用示例

### 场景：创建个性和记忆

```typescript
// 用户：帮我设置一下
await agent.run(`
请帮我：
1. 使用 soul_write 添加个性：我是一个幽默的代码助手
2. 使用 memory_write 记录：项目使用 React 和 TypeScript
`);

// Agent 执行：
// 1. 调用 soul_write("我是一个幽默的代码助手")
// 2. 调用 memory_write("项目使用 React 和 TypeScript")
// 3. System Prompt 自动重建
```

### 场景：根据个性回答

```
用户：如何创建一个 React 组件？

Agent（带有个性）：
嘿！让我来给你展示一个 React 组件的创建方法！🎉

```tsx
function Welcome() {
  return <h1>Hello, World!</h1>;
}
```

看，就是这么简单！这个组件会渲染一个 "Hello, World!" 标题。
（个性体现：轻松、友好、提供代码示例）
```

## 关键区别总结

| 维度 | SOUL.md | MEMORY.md |
|------|---------|-----------|
| **本质** | Agent 的"自我认知" | Agent 的"知识库" |
| **内容** | 个性、身份、行为准则 | 事实、偏好、约定 |
| **视角** | 内在（第一人称） | 外在（客观描述） |
| **变化** | 慢（性格不易改变） | 快（持续学习） |
| **优先级** | 高（定义我是谁） | 中（记住我知道什么） |
| **工具** | soul_* | memory_* |
| **比喻** | 演员的"角色设定" | 演员的"剧本笔记" |

## 最佳实践

### 1. 初始化时创建基础个性

```typescript
// 在 Agent 启动时
await agent.run(`
请使用 soul_write 创建我的基础个性：
1. 我是一个友好、专业的技术助手
2. 我总是提供准确、实用的建议
3. 我尊重用户的隐私和偏好
`);
```

### 2. 根据用户反馈调整个性

```typescript
// 用户反馈后
await agent.run(`
用户觉得我太严肃了。请：
1. 使用 soul_search 搜索"严肃"相关的特征
2. 使用 soul_remove 移除这些特征
3. 使用 soul_write 添加"我说话轻松自然"
`);
```

### 3. 定期回顾和优化

```typescript
// 定期维护
await agent.run(`
请使用 soul_read 查看所有个性特征，然后：
1. 分析它们是否协调一致
2. 识别重复或矛盾的特征
3. 建议如何优化
`);
```

### 4. SOUL 和 MEMORY 配合使用

```typescript
// 定义行为规范（SOUL）
await agent.run(`
使用 soul_write：我尊重用户的偏好和习惯。
`);

// 记录具体偏好（MEMORY）
await agent.run(`
使用 memory_write：用户喜欢简短的回答。
`);
```

---

**总结**：SOUL.md 和 MEMORY.md 共同构成了 Agent 的完整记忆系统：
- **SOUL.md** = "我是谁"（身份与个性）
- **MEMORY.md** = "我知道什么"（知识与事实）

两者结合，让 Agent 既有鲜明的个性，又有丰富的知识！
