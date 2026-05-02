# Agent Harness 学习指南

基于 `pi-agent-clone` 项目代码的完整学习路径

---

## 目录

1. [项目概述](#项目概述)
2. [核心概念](#核心概念)
3. [架构设计](#架构设计)
4. [学习路径](#学习路径)
5. [实践练习](#实践练习)

---

## 项目概述

`pi-agent-clone` 是一个轻量级AI编码Agent框架，支持多个LLM提供商和工具调用。

### 主要特性
- 🔄 **多轮对话循环** - REACT模式：Reason → Act → Observe
- 🛠️ **工具调用** - 支持并行执行多个工具
- 📡 **多提供商支持** - OpenAI、Anthropic、Gemini、GLM、MiniMax
- 🌊 **流式响应** - 实时显示AI思考和执行过程
- ⚡ **事件驱动** - 完整的事件系统用于监控和调试
- 🛡️ **上下文保护** - 80%阈值自动截断，防止上下文溢出

---

## 核心概念

### 1. 消息类型

```typescript
// 用户消息
interface UserMessage {
  role: "user";
  content: string;
}

// 助手消息
interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
  stopReason?: StopReason;
  usage?: Usage;
}

// 工具执行结果
interface ToolResultMessage {
  role: "tool_result";
  toolCallId: string;
  content: string;
  isError?: boolean;
}
```

### 2. 工具调用

工具定义和处理器：

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

interface ToolHandler {
  definition: ToolDefinition;
  execute(args: Record<string, unknown>): Promise<string>;
}
```

### 3. 流式事件

```typescript
type StreamEvent =
  | { type: "start"; message: AssistantMessage }
  | { type: "text_delta"; text: string }
  | { type: "tool_call_start"; index: number; id: string; name: string }
  | { type: "tool_call_delta"; index: number; arguments: string }
  | { type: "usage"; usage: Usage }
  | { type: "done"; message: AssistantMessage }
  | { type: "error"; error: Error; message: AssistantMessage };
```

### 4. Agent事件

```typescript
type AgentEvent =
  | { type: "turn_start" }
  | { type: "message_start"; message: AssistantMessage }
  | { type: "message_delta"; delta: string }
  | { type: "message_done"; message: AssistantMessage }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_call_result"; toolCallId: string; result: string; isError: boolean }
  | { type: "turn_end" }
  | { type: "agent_end"; reason: "completed" | "error" | "aborted" | "max_iterations" }
  | { type: "error"; error: Error };
```

---

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (交互层)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  命令行解析  │  │   REPL     │  │  事件显示   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Loop (核心)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. 接收用户消息                                       │  │
│  │  2. 检查上下文使用率 (>=80%则截断)                      │  │
│  │  3. 调用LLM获取响应 (streamResponse)                   │  │
│  │  4. 检查是否有工具调用                                 │  │
│  │  5. 执行工具调用 (executeToolCalls)                    │  │
│  │  6. 将结果加入历史，继续循环 (直到完成)                 │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Provider   │  │    Tool      │  │  Type System │
│  Transport   │  │   Handlers   │  │              │
├──────────────┤  ├──────────────┤  ├──────────────┤
│ • OpenAI     │  │ • Terminal   │  │ • Messages   │
│ • Anthropic  │  │ • Read File  │  │ • Tool Calls │
│ • Gemini     │  │ • Write File │  │ • Events     │
│ • GLM        │  │ • ...        │  │              │
│ • MiniMax    │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Context Manager                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Token估算 (中英文混合)                              │  │
│  │  • 80%阈值检测                                         │  │
│  │  • FIFO截断策略 (保留最新消息)                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块详解

#### 1. Agent Loop (`src/agent/loop.ts`)

Agent Loop是整个框架的心脏，实现了REACT循环：

```typescript
class AgentLoop {
  async run(userMessage: string, onEvent?: (event: AgentEvent) => void) {
    // 1. 添加用户消息到历史
    this.messages.push({ role: "user", content: userMessage });

    // 2. 迭代循环 (最多maxIterations次)
    while (iterations < this.config.maxIterations) {
      // 2.1 检查上下文使用率
      const contextInfo = getContextInfo(this.messages, this.config.model);
      if (contextInfo.needsTrim) {
        this.messages = trimMessages(this.messages, this.config.model);
      }

      // 2.2 流式获取LLM响应
      const assistantMessage = await this.streamResponse(emit, totalUsage);

      // 2.3 检查是否需要执行工具
      if (assistantMessage.toolCalls?.length > 0) {
        // 2.4 并行执行所有工具调用
        const toolResults = await this.executeToolCalls(toolCalls, emit);
        // 2.5 将工具结果加入历史
        this.messages.push(...toolResults);
      } else {
        // 没有工具调用，完成
        break;
      }
    }
  }
}
```

**关键设计点：**
- 每次迭代都会累积消息历史
- 工具调用是并行执行的（使用`Promise.all`）
- 支持中途中止（通过`AbortController`）
- 完整的事件回调系统
- **自动上下文管理**：超过80%时自动截断

#### 2. Context Manager (`src/context/manager.ts`)

上下文管理器负责防止对话历史超出模型上下文窗口：

```typescript
// Token估算：考虑中英文混合
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  // 中文: ~0.5 token/char, 英文: ~0.25 token/char
  return Math.ceil(chineseChars * 0.5 + otherChars * 0.25);
}

// 截断消息：保留最新消息
export function trimMessages(
  messages: Message[],
  model: Model,
  threshold: number = 0.8  // 默认80%
): Message[] {
  const maxTokens = Math.floor(model.contextWindow * threshold);
  const estimatedTokens = estimateTotalTokens(messages);

  if (estimatedTokens <= maxTokens) {
    return messages;  // 无需截断
  }

  // 从后往前保留，保留最近的消息
  const kept: Message[] = [];
  let currentTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateMessageTokens(msg);

    if (currentTokens + msgTokens > maxTokens) {
      break;
    }
    kept.unshift(msg);
    currentTokens += msgTokens;
  }

  return kept;
}
```

**设计优势：**
- 简单高效：无需额外依赖
- 准确估算：针对中英文混合优化
- 安全边界：80%阈值留有余量
- 智能保留：优先保留最近消息

#### 3. Provider Transport (`src/provider/`)

每个提供商实现`ProviderTransport`接口：

```typescript
interface ProviderTransport {
  readonly name: ProviderName;
  readonly api: ApiMode;

  stream(options: StreamOptions): AsyncIterable<StreamEvent>;
}
```

**设计优势：**
- 统一的接口，易于扩展新提供商
- 流式输出，实时反馈
- 统一的事件格式，屏蔽底层差异

**示例：OpenAI Transport**
```typescript
class OpenAITransport implements ProviderTransport {
  async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
    // 1. 创建OpenAI客户端
    const client = this.getClient(apiKey, baseURL);

    // 2. 调用流式API
    const stream = await client.chat.completions.create(params, { signal });

    // 3. 转换每个chunk为StreamEvent
    for await (const chunk of stream) {
      yield { type: "text_delta", text: delta.content };
      yield { type: "tool_call_start", ... };
      yield { type: "usage", usage: ... };
    }
  }
}
```

#### 4. Tool Handler (`src/tool/`)

工具实现模式：

**示例1：Terminal 工具**
```typescript
export const terminalTool: ToolHandler = {
  definition: {
    name: "terminal",
    description: "执行shell命令",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的命令" },
        timeout: { type: "number", description: "超时时间(秒)" }
      },
      required: ["command"]
    }
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const { command, timeout = 30 } = args;
    // 执行命令并返回结果
    const { stdout, stderr } = await execFileAsync("sh", ["-c", command], { timeout });
    return stdout + stderr;
  }
};
```

**示例2：Write File 工具**
```typescript
export const writeFileTool: ToolHandler = {
  definition: {
    name: "write_file",
    description: "写入内容到文件。如果文件已存在则覆盖。会自动创建父目录。",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "要写入的文件路径"
        },
        content: {
          type: "string",
          description: "要写入的完整内容"
        }
      },
      required: ["path", "content"]
    }
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const { path, content } = args as { path: string; content: string };

    // 确保目录存在
    const dir = dirname(path);
    await fs.promises.mkdir(dir, { recursive: true });

    // 写入文件
    await fs.promises.writeFile(path, content, 'utf-8');

    return `成功写入文件: ${path}`;
  }
};
```

#### 5. Event Stream (`src/event-stream.ts`)

一个推式异步迭代器实现：

```typescript
class EventStream<T, R> implements AsyncIterable<T> {
  push(event: T): void {
    // 推入事件，唤醒等待的消费者
  }

  result(): Promise<R> {
    // 等待最终结果
  }

  async *[Symbol.asyncIterator]() {
    // 异步迭代器实现
  }
}
```

---

## 学习路径

### 阶段一：理解基础（1-2天）

**学习目标：** 理解类型系统和消息流

1. **阅读顺序：**
   - `src/types.ts` - 理解核心类型定义
   - `src/event-stream.ts` - 理解事件流机制
   - `src/provider/helpers.ts` - 理解消息转换

2. **练习：**
   - 画出消息流转图
   - 手动创建一个简单的消息历史
   - 理解不同`StopReason`的含义

### 阶段二：深入核心（2-3天）

**学习目标：** 掌握Agent Loop和Provider Transport

1. **阅读顺序：**
   - `src/provider/registry.ts` - 理解提供商注册机制
   - `src/provider/openai.ts` - 深入一个完整实现
   - `src/agent/loop.ts` - 核心循环逻辑

2. **关键问题：**
   - 为什么使用异步迭代器而不是回调？
   - 工具调用是如何并行执行的？
   - 如何优雅地中止正在进行的请求？
   - 上下文管理如何防止溢出？

### 阶段三：工具扩展（1-2天）

**学习目标：** 学会创建自定义工具

1. **阅读顺序：**
   - `src/tool/terminal.ts` - 命令执行工具
   - `src/tool/read-file.ts` - 文件读取工具
   - `src/tool/write-file.ts` - 文件写入工具
   - `src/tool/index.ts` - 工具注册

2. **练习：**
   - 创建一个`web_search`工具
   - 创建一个`git_status`工具
   - 为工具添加参数验证

### 阶段四：上下文管理（1天）

**学习目标：** 理解和扩展上下文保护机制

1. **阅读顺序：**
   - `src/context/manager.ts` - 上下文管理器
   - `src/context/index.ts` - 模块导出
   - `src/context/test.ts` - 测试用例

2. **练习：**
   - 修改Token估算算法，提高准确度
   - 实现保留重要消息的截断策略
   - 添加上下文使用统计功能

### 阶段五：集成与部署（1天）

**学习目标：** 理解CLI和配置

1. **阅读顺序：**
   - `src/cli/index.ts`
   - `.env.example`
   - `package.json`

2. **实践：**
   - 配置不同的API密钥
   - 切换不同的模型
   - 实现一个新的CLI命令

---

## 实践练习

### 练习1：创建自定义工具

**目标：** 添加一个`git_status`工具，显示Git仓库状态

```typescript
// src/tool/git.ts
export const gitStatusTool: ToolHandler = {
  definition: {
    name: "git_status",
    description: "显示Git仓库状态",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "仓库路径，默认当前目录"
        }
      }
    }
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    // TODO: 实现git status逻辑
  }
};
```

### 练习2：添加新的Provider

**目标：** 添加对DeepSeek的支持

```typescript
// src/provider/deepseek.ts
export class DeepSeekTransport implements ProviderTransport {
  readonly name = "deepseek" as const;
  readonly api = "openai" as const;  // DeepSeek使用OpenAI兼容API

  async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
    // TODO: 实现流式调用
  }
}
```

### 练习3：实现会话持久化

**目标：** 保存和恢复对话历史

```typescript
// src/persistence.ts
export class SessionPersistence {
  async save(sessionId: string, messages: Message[]): Promise<void> {
    // TODO: 保存到文件或数据库
  }

  async load(sessionId: string): Promise<Message[]> {
    // TODO: 从文件或数据库加载
  }
}
```

### 练习4：添加成本追踪

**目标：** 计算每次对话的成本

```typescript
// src/cost.ts
export function calculateCost(usage: Usage, model: Model): number {
  const inputCost = (usage.inputTokens / 1_000_000) * model.cost!.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * model.cost!.outputPerMillion;
  return inputCost + outputCost;
}
```

### 练习5：改进上下文管理

**目标：** 实现保留重要消息的智能截断

```typescript
// src/context/smart-trimmer.ts
export function smartTrimMessages(
  messages: Message[],
  model: Model,
  getImportance: (msg: Message) => number
): Message[] {
  // 1. 计算每条消息的重要性
  // 2. 按重要性排序
  // 3. 在token预算内保留最重要的消息
}
```

---

## 设计模式与最佳实践

### 1. 依赖注入

```typescript
// 好的设计
class AgentLoop {
  constructor(config: AgentConfig) {
    this.config = config;
  }
}

// 而不是硬编码依赖
class AgentLoop {
  private openai = new OpenAI();  // ❌ 硬编码
}
```

### 2. 事件驱动

```typescript
// 使用事件回调而非直接打印
await agent.run(message, (event) => {
  if (event.type === "message_delta") {
    process.stdout.write(event.delta);
  }
});
```

### 3. 错误处理

```typescript
// 工具结果包含错误信息
return {
  role: "tool_result",
  toolCallId: tc.id,
  content: errMsg,
  isError: true,  // 明确标记
};
```

### 4. 流式处理

```typescript
// 使用异步生成器
async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
  for await (const chunk of apiStream) {
    yield transform(chunk);
  }
}
```

### 5. 防御性编程

```typescript
// 在使用前检查上下文使用情况
const contextInfo = getContextInfo(messages, model);
if (contextInfo.needsTrim) {
  messages = trimMessages(messages, model);
}
```

---

## 常见问题

### Q: 为什么工具调用是并行的？

A: 并行执行可以提高效率，特别是当工具之间没有依赖关系时。如果需要顺序执行，可以修改`executeToolCalls`方法。

### Q: 如何限制工具执行的时间？

A: 在工具实现中使用`timeout`参数，或者在Agent Loop中添加全局超时控制。

### Q: 如何添加对话历史限制？

A: 使用Context Manager在每次调用LLM前检查并截断消息历史，确保在80%上下文窗口内。

### Q: Token估算有多准确？

A: 当前使用启发式算法（中文0.5 token/char，英文0.25 token/char），准确度约80-90%。生产环境可集成tiktoken等精确计数库。

### Q: 如何实现流式输出的缓存？

A: 可以在`StreamEvent`中添加缓存相关的字段，或在Transport层实现缓存逻辑。

### Q: 80%阈值可以调整吗？

A: 可以，调用`trimMessages()`时传入自定义阈值：`trimMessages(messages, model, 0.9)` 表示90%阈值。

---

## 扩展阅读

- [REACT论文](https://arxiv.org/abs/2210.03629) - Reasoning and Acting in Language Models
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use](https://docs.anthropic.com/claude/docs/tool-use)
- [Async Iterators in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for-await...of)
- [Tiktoken Tokenizer](https://github.com/openai/tiktoken) - 精确的Token计数工具

---

## 总结

通过学习这个项目，你将掌握：

✅ AI Agent的核心架构设计
✅ 多提供商LLM集成方案
✅ 工具调用系统的实现
✅ 流式事件处理模式
✅ 上下文窗口管理策略
✅ TypeScript类型系统最佳实践

下一步可以尝试：
