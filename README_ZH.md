# pi-agent-clone

一个轻量级 AI 编码代理框架，支持多 LLM 提供商，灵感来自 pi-mono 的架构。

## 功能特性

- 🔄 **多轮对话循环** - REACT 模式：Reason → Act → Observe
- 🛠️ **工具调用** - 支持并行执行多个工具
- 📡 **多提供商支持** - OpenAI、Anthropic、Gemini、GLM、MiniMax
- 🌊 **流式响应** - 实时显示 AI 思考和执行过程
- ⚡ **事件驱动** - 完整的事件系统用于监控和调试
- 🛡️ **上下文保护** - 80% 阈值自动截断，防止上下文溢出
- 🔧 **内置工具** - terminal、read_file、write_file、git_*、ls

## 安装

```bash
npm install
npm run build
```

## 配置

根据 `.env.example` 创建 `.env` 文件：

```env
OPENAI_API_KEY=你的_openai_api_key
ANTHROPIC_API_KEY=你的_anthropic_api_key
GEMINI_API_KEY=你的_gemini_api_key
GLM_API_KEY=你的_glm_api_key
MINIMAX_API_KEY=你的_minimax_api_key
```

## 使用方法

```bash
# 开发模式
npm run dev

# 构建并运行
npm run build
npm start

# 类型检查
npm run typecheck
```

## 内置工具

| 工具 | 描述 |
|------|------|
| `terminal` | 执行 Shell 命令 |
| `read_file` | 读取文件内容 |
| `write_file` | 写入内容到文件 |
| `git_status` | 显示 Git 仓库状态 |
| `git_log` | 显示提交历史 |
| `git_diff` | 显示文件差异 |
| `git` | 执行任意 Git 命令 |
| `ls` | 列出目录内容 |

详细文档请查看 [TOOLS_REFERENCE.md](.agent-output/artifacts/docs/TOOLS_REFERENCE.md)。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (交互层)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Loop (核心)                        │
│  REACT: Reason → Act → Observe → Repeat                     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Provider   │  │    Tool      │  │   Context    │
│  Transport   │  │   Handlers   │  │   Manager    │
└──────────────┘  └──────────────┘  └──────────────┘
```

## 上下文管理

Agent 包含自动上下文窗口保护：

- **Token 估算**：针对中英文混合内容优化
- **80% 阈值**：接近限制时自动截断
- **FIFO 策略**：默认保留最近的消息

## 智能路由

基于 [FrugalGPT](https://arxiv.org/abs/2305.05176) 的智能模型路由：

```
用户查询 → 分类复杂度（廉价模型）→ 路由到廉价/昂贵模型
```

- **默认配置**：MiniMax M2.7（廉价）→ GLM-5.1（昂贵），阈值=4
- **策略**：`pre-classify`（默认）、`always-cheap`、`always-expensive`

```bash
# 启用路由
pi-agent --router

# 斜杠命令
/router stats          # 查看路由统计
/router test <查询>    # 分类查询但不执行
/router strategy <策略> # 切换路由策略
/router reset          # 重置统计
```

## 文档

- [LEARNING_GUIDE.md](.agent-output/artifacts/docs/LEARNING_GUIDE.md) - 完整学习路径
- [TOOLS_REFERENCE.md](.agent-output/artifacts/docs/TOOLS_REFERENCE.md) - 工具参考文档

## 项目结构

```
pi-agent-clone/
├── src/
│   ├── agent/           # Agent 循环实现
│   ├── cli/             # 命令行界面
│   ├── context/         # 上下文管理
│   ├── provider/        # LLM 提供商传输
│   ├── router/          # 成本感知的模型路由
│   └── tool/            # 内置工具
├── .agent-output/       # Agent 生成的产物
│   └── artifacts/docs/  # 文档
└── package.json
```

## 快速开始

### 1. 基本对话

```typescript
import { AgentLoop } from "./src/index.js";
import { openai } from "./src/provider/registry.js";

const agent = new AgentLoop({
  model: openai("gpt-4o"),
  systemPrompt: "你是一个有帮助的 AI 助手。",
  tools: [],
  maxIterations: 10,
});

const result = await agent.run("你好，请介绍一下你自己");
console.log(result.messages);
```

### 2. 使用工具

```typescript
import { terminalTool, readFileTool, writeFileTool } from "./src/tool/index.js";

const agent = new AgentLoop({
  model: openai("gpt-4o"),
  systemPrompt: "你是一个代码助手，可以使用工具来操作文件和执行命令。",
  tools: [terminalTool, readFileTool, writeFileTool],
  maxIterations: 10,
});

await agent.run("请帮我查看当前目录的文件列表");
```

## 核心概念

### 消息类型

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

### 工具调用

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

### 流式事件

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

## 学习路径

推荐按照以下顺序学习本项目：

### 阶段一：理解基础（1-2天）
- `src/types.ts` - 核心类型定义
- `src/event-stream.ts` - 事件流机制
- `src/provider/helpers.ts` - 消息转换

### 阶段二：深入核心（2-3天）
- `src/provider/registry.ts` - 提供商注册机制
- `src/provider/openai.ts` - 完整实现示例
- `src/agent/loop.ts` - 核心循环逻辑

### 阶段三：工具扩展（1-2天）
- `src/tool/terminal.ts` - 命令执行工具
- `src/tool/read-file.ts` - 文件读取工具
- `src/tool/write-file.ts` - 文件写入工具

### 阶段四：上下文管理（1天）
- `src/context/manager.ts` - 上下文管理器

详细学习指南请参考 [LEARNING_GUIDE.md](.agent-output/artifacts/docs/LEARNING_GUIDE.md)。

## 设计模式

### 1. 依赖注入

```typescript
class AgentLoop {
  constructor(config: AgentConfig) {
    this.config = config;
  }
}
```

### 2. 事件驱动

```typescript
await agent.run(message, (event) => {
  if (event.type === "message_delta") {
    process.stdout.write(event.delta);
  }
});
```

### 3. 流式处理

```typescript
async *stream(options: StreamOptions): AsyncGenerator<StreamEvent> {
  for await (const chunk of apiStream) {
    yield transform(chunk);
  }
}
```

## 常见问题

### Q: 为什么工具调用是并行的？

A: 并行执行可以提高效率，特别是当工具之间没有依赖关系时。

### Q: 如何限制工具执行的时间？

A: 在工具实现中使用 `timeout` 参数。

### Q: 如何添加对话历史限制？

A: 使用 Context Manager 在每次调用 LLM 前检查并截断消息历史。

### Q: Token 估算有多准确？

A: 当前使用启发式算法（中文 0.5 token/char，英文 0.25 token/char），准确度约 80-90%。

## 扩展阅读

- [REACT 论文](https://arxiv.org/abs/2210.03629) - Reasoning and Acting in Language Models
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use](https://docs.anthropic.com/claude/docs/tool-use)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

---

**[English README](README.md)**
