# Neonity Agent Web UI

> 一个现代化的 AI 智能体 Web 界面，基于 **Next.js 16 + React 19** 构建，支持多模型、流式输出和丰富的交互体验。

[English](./README_EN.md) | [中文](./README.md)

---

## ✨ 特性亮点

- 🤖 **多模型支持** - 统一接入 7+ 主流大模型 (GPT-4o、Claude、Gemini、GLM、MiniMax 等)
- ⚡ **实时流式输出** - SSE 流式响应，逐字显示类似 ChatGPT
- 🔧 **14 个内置工具** - 文件操作、Git 管理、终端执行、记忆管理等
- 🎨 **精美的深色主题** - 渐变背景、圆角卡片、柔和边框
- 💬 **完整聊天功能** - 消息列表、思考块展示、工具调用可视化
- 🌐 **中英文切换** - 支持多语言 (?lang=zh)

---

## 🏗️ 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Next.js 16.2.4 (App Router) |
| UI 框架 | React 19.1.0 |
| 开发语言 | TypeScript 6.0.0 |
| 样式方案 | 原生 CSS (CSS Variables) |
| Markdown | react-markdown + remark-gfm |
| 核心 Agent | neonity-agent |

---

## 📁 项目结构

```
website/
├── app/
│   ├── api/chat/            # Chat API 端点 (SSE 流式响应)
│   ├── chat/                # 聊天页面
│   ├── globals.css          # 全局样式
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # 首页
├── components/
│   ├── chat/
│   │   ├── chat-container.tsx      # 聊天容器
│   │   ├── chat-input.tsx          # 输入框组件
│   │   ├── message-item.tsx        # 消息项
│   │   ├── message-list.tsx        # 消息列表
│   │   ├── model-selector.tsx      # 模型选择器
│   │   ├── thinking-block.tsx      # 思考块展示
│   │   └── tool-call-display.tsx   # 工具调用显示
│   ├── hero.tsx            # 首页 Hero 区域
│   └── feature-grid.tsx    # 功能网格
└── lib/
    ├── agent-bridge.ts     # Agent 核心桥接
    ├── models.ts           # 模型配置
    └── sse.ts              # SSE 工具函数
```

---

## 🚀 快速开始

### 环境要求

- Node.js (支持 TypeScript)
- pnpm / npm / yarn

### 安装依赖

```bash
cd website
pnpm install
# 或
npm install
```

### 配置环境变量

在 `website/` 目录下创建 `.env` 文件：

```env
# 智谱 GLM
GLM_API_KEY=your_glm_api_key

# MiniMax
MINIMAX_API_KEY=your_minimax_api_key

# OpenAI (可选)
OPENAI_API_KEY=your_openai_api_key

# Anthropic (可选)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google Gemini (可选)
GOOGLE_API_KEY=your_google_api_key
```

### 启动开发服务器

```bash
pnpm dev
# 或
npm run dev
```

打开 http://localhost:3000 查看效果。

### 生产构建

```bash
pnpm build
pnpm start
```

---

## 💡 核心功能

### 1. Chat API 路由

位于 `app/api/chat/route.ts`，使用 **Server-Sent Events (SSE)** 实现流式响应。

**事件类型**：
- `session` - Session 信息
- `message_delta` - 消息增量
- `message_done` - 消息完成
- `tool_call_start` - 工具调用开始
- `tool_call_result` - 工具调用结果
- `agent_end` - Agent 执行结束
- `error` - 错误信息

### 2. 内置工具

| 工具 | 功能 |
|------|------|
| `readFile` | 读取文件内容 |
| `writeFile` | 写入文件内容 |
| `ls` | 列出目录内容 |
| `git` | 执行 Git 命令 |
| `gitStatus` | 查看 Git 状态 |
| `gitLog` | 查看 Git 日志 |
| `gitDiff` | 查看 Git 差异 |
| `terminal` | 执行终端命令 |
| `memoryWrite` | 保存记忆 |
| `memoryRead` | 读取记忆 |
| `memorySearch` | 搜索记忆 |
| `memoryRemove` | 删除记忆 |
| `soulWrite` | 保存灵魂设定 |
| `soulRead` | 读取灵魂设定 |

### 3. 支持的模型

| 模型 ID | 名称 | 提供商 | 上下文窗口 | 最大输出 |
|---------|------|--------|-----------|---------|
| gpt-4o | GPT-4o | OpenAI | 128K | 16K |
| gpt-4o-mini | GPT-4o Mini | OpenAI | 128K | 16K |
| claude-sonnet-4-20250514 | Claude Sonnet 4 | Anthropic | 200K | 16K |
| gemini-2.5-flash | Gemini 2.5 Flash | Google | 1M | 64K |
| glm-5.1 | GLM-5.1 | 智谱 GLM | 128K | 4K |
| glm-4.7 | GLM-4.7 | 智谱 GLM | 128K | 4K |
| MiniMax-M2.7 | MiniMax M2.7 | MiniMax | 1M | 16K |

---

## 🎨 UI 设计

### 配色方案

```
背景色:   #07090f (深空黑)
面板色:   #0f1423 (深蓝灰)
文本色:   #f4f7ff (亮白)
强调色:   #6b8cff (蓝色)
辅助色:   #9fa8c2 (灰蓝)
```

### 设计特点

- 径向渐变背景
- 圆角卡片设计 (border-radius: .8rem)
- 柔和的边框线条
- 响应式布局 (clamp 字体大小)

---

## 📊 代码统计

| 指标 | 数值 |
|------|------|
| React 组件数 | 9 |
| API 路由数 | 1 |
| 支持模型数 | 7 |
| 内置工具数 | 14 |

---

## 🔮 未来规划

- [ ] 增加更多模型支持
- [ ] 优化移动端体验
- [ ] 添加代码编辑器集成
- [ ] 支持文件拖拽上传
- [ ] 多用户支持
- [ ] 历史记录持久化
- [ ] 插件系统
- [ ] 协作功能

---

## 📄 License

MIT License - 详见项目仓库。

---

**项目仓库**: https://github.com/neonity2020/neonity-agent
