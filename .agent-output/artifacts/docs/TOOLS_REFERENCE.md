# Agent 工具参考文档

本文档描述了 `pi-agent-clone` 项目中所有可用的内置工具。

---

## 目录

1. [文件操作工具](#文件操作工具)
2. [Git 版本控制工具](#git-版本控制工具)
3. [目录管理工具](#目录管理工具)
4. [通用工具](#通用工具)

---

## 文件操作工具

### read_file

读取文件内容。

**参数：**
- `path` (string, 必需): 要读取的文件路径
- `offset` (number, 可选): 起始行号（1-indexed，默认：1）
- `limit` (number, 可选): 最多读取行数（默认：500）

**返回：** 文件内容（带行号）

**示例：**
```typescript
// 读取整个文件
read_file({ path: "src/index.ts" })

// 读取前100行
read_file({ path: "README.md", limit: 100 })

// 从第50行开始读取
read_file({ path: "data.json", offset: 50, limit: 200 })
```

---

### write_file

写入内容到文件。如果文件已存在则覆盖。会自动创建父目录。

**参数：**
- `path` (string, 必需): 要写入的文件路径
- `content` (string, 必需): 要写入的完整内容

**返回：** 成功消息

**示例：**
```typescript
write_file({
  path: "src/utils/helper.ts",
  content: `export function greet(name: string) {
  return \`Hello, \${name}!\`;
}`
})
```

---

## Git 版本控制工具

### git_status

显示 Git 仓库的工作树状态。

**参数：**
- `path` (string, 可选): 仓库路径（默认：当前目录）

**返回：** 格式化的状态报告，包含：
- 修改的文件数
- 新增的文件数
- 删除的文件数
- 未跟踪的文件数
- 每个文件的状态

**示例：**
```typescript
git_status({ path: "." })
```

**输出示例：**
```
Git Status for: current directory
==================================================

M  src/agent/loop.ts
A  src/context/manager.ts
??  .agent-output/
--------------------------------------------------
Summary:
  • Modified:   1
  • Added:      1
  • Untracked:  1
```

---

### git_log

显示提交历史。

**参数：**
- `path` (string, 可选): 仓库路径（默认：当前目录）
- `max_count` (number, 可选): 最多显示的提交数（默认：10）
- `oneline` (boolean, 可选): 每条提交显示在一行（默认：false）

**返回：** 提交历史列表

**示例：**
```typescript
// 显示最近5条提交，每条一行
git_log({ max_count: 5, oneline: true })

// 显示最近20条提交，详细信息
git_log({ max_count: 20 })
```

**输出示例：**
```
Git Log for: current directory (last 5 commits)
============================================================

a1b2c3d - John Doe, 2 hours ago : Add context manager
e4f5g6h - Jane Smith, yesterday : Fix token estimation
i7j8k9l - Bob Wilson, 3 days ago : Add git tools
------------------------------------------------------------
Total commits: 42
```

---

### git_diff

显示提交或工作树之间的差异。

**参数：**
- `path` (string, 可选): 仓库路径（默认：当前目录）
- `target` (string, 可选): 要比较的提交或引用（如 'HEAD~1'、'main'），未指定则显示未暂存的更改
- `file` (string, 可选): 显示特定文件的差异
- `lines` (number, 可选): 上下文行数（默认：3）

**返回：** 差异报告，包含：
- 完整的 diff 输出
- 添加的行数
- 删除的行数

**示例：**
```typescript
// 显示所有未暂存的更改
git_diff({})

// 显示与上一次提交的差异
git_diff({ target: "HEAD~1" })

// 显示特定文件的差异
git_diff({ file: "src/agent/loop.ts", lines: 5 })

// 显示与 main 分支的差异
git_diff({ target: "main" })
```

---

### git

执行任意 Git 命令。用于其他专用工具未覆盖的操作。

**参数：**
- `command` (string, 必需): 要执行的 Git 命令
- `workdir` (string, 可选): Git 命令的工作目录（默认：当前目录）
- `timeout` (number, 可选): 超时时间（秒，默认：60）

**返回：** 命令输出

**示例：**
```typescript
// 查看所有分支
git({ command: "branch -a" })

// 创建新分支
git({ command: "checkout -b feature/new-tool" })

// 添加文件到暂存区
git({ command: "add src/context/" })

// 提交更改
git({ command: 'commit -m "Add context manager"' })

// 推送到远程
git({ command: "push origin main" })
```

---

## 目录管理工具

### ls

列出目录内容，提供详细信息和多种输出格式。

**参数：**
- `path` (string, 可选): 要列出的目录路径（默认：当前目录）
- `recursive` (boolean, 可选): 递归列出内容（默认：false）
- `maxDepth` (number, 可选): 递归最大深度（默认：3，-1 表示无限）
- `includeHidden` (boolean, 可选): 包含以 `.` 开头的隐藏文件（默认：false）
- `extensions` (array, 可选): 按扩展名过滤文件（如 [".ts", ".js"]）
- `format` (string, 可选): 输出格式 - "tree"（树状）、"json"（结构化）、"table"（表格，默认：tree）

**返回：** 格式化的目录列表

**示例：**
```typescript
// 列出当前目录，树状格式
ls({ path: ".", format: "tree" })

// 列出 src 目录，表格格式
ls({ path: "src", format: "table" })

// 递归列出所有 TypeScript 文件
ls({
  path: "src",
  recursive: true,
  extensions: [".ts"],
  format: "table"
})

// 递归列出目录，最多2层深度
ls({
  path: "src",
  recursive: true,
  maxDepth: 2,
  format: "tree"
})

// 包含隐藏文件
ls({
  path: ".",
  includeHidden: true,
  format: "json"
})
```

**输出示例（tree 格式）：**
```
📂 ./
36.07 KB, 5 files, 2 directories
============================================================

📁 dist (640 B)
📄 package-lock.json (34.01 KB)
📄 package.json (648 B)
📁 src (352 B)
📄 tsconfig.json (471 B)
```

**输出示例（table 格式）：**
```
Directory: src
================================================================================

Summary:
  Files: 8
  Directories: 5
  Total Size: 8.88 KB

Directories:
  📁 agent/
  📁 cli/
  📁 context/
  📁 provider/
  📁 tool/

Files:
  Name                                       Size       Modified
  ----------------------------------------------------------------------
  📁 agent                                    128 B      today
  📁 cli                                      96 B       today
  📄 event-stream.ts                          2.33 KB    today
  📄 index.ts                                 762 B      today
```

**输出示例（json 格式）：**
```json
{
  "path": "src/tool",
  "summary": {
    "totalFiles": 8,
    "directories": 0,
    "totalSize": "15.32 KB"
  },
  "directories": [],
  "files": [
    {
      "name": "terminal.ts",
      "path": "src/tool/terminal.ts",
      "type": "file",
      "size": "1.45 KB",
      "extension": ".ts",
      "modified": "2024-05-02T22:20:00.000Z"
    }
  ]
}
```

---

## 通用工具

### terminal

执行 Shell 命令。用于运行构建、测试、git 命令和其他 Shell 操作。

**参数：**
- `command` (string, 必需): 要执行的 Shell 命令
- `timeout` (number, 可选): 超时时间（秒，默认：30）
- `workdir` (string, 可选): 命令的工作目录

**返回：** 命令输出（stdout + stderr）

**示例：**
```typescript
// 运行构建
terminal({ command: "npm run build" })

// 运行测试
terminal({ command: "npm test" })

// 查看环境变量
terminal({ command: "env" })

// 在特定目录运行命令
terminal({
  command: "ls -la",
  workdir: "/path/to/directory"
})

// 设置更长的超时
terminal({
  command: "npm install",
  timeout: 120
})
```

---

## 工具使用最佳实践

### 1. 文件操作优先使用专用工具

```typescript
// ✅ 好：使用专用工具
read_file({ path: "config.json" })
write_file({ path: "output.txt", content: "Hello" })

// ❌ 避免：使用 terminal
terminal({ command: "cat config.json" })
terminal({ command: "echo 'Hello' > output.txt" })
```

### 2. Git 操作使用专用工具获得更好的输出格式

```typescript
// ✅ 好：使用 git_status 获得格式化输出
git_status({})

// ❌ 避免：使用 git 工具
git({ command: "status" })
```

### 3. 复杂 Git 操作使用 git 工具

```typescript
// ✅ 好：复杂操作使用 git 工具
git({ command: "stash" })
git({ command: "rebase -i HEAD~3" })

// ❌ 不适用：简单操作使用专用工具
git({ command: "status" })  // 应使用 git_status
```

### 4. 目录浏览使用 ls 工具

```typescript
// ✅ 好：使用 ls 获得结构化输出
ls({ path: "src", format: "tree" })

// ❌ 避免：使用 terminal
terminal({ command: "ls -R src" })
```

### 5. 设置合理的超时时间

```typescript
// 快速命令：默认超时即可
terminal({ command: "ls" })

// 耗时操作：增加超时
terminal({ command: "npm install", timeout: 300 })

// Git 操作：通常较长
git({ command: "push origin main", timeout: 120 })
```

### 6. 使用 workdir 指定工作目录

```typescript
// 在特定目录运行命令
terminal({
  command: "npm test",
  workdir: "packages/frontend"
})

git({ command: "status", workdir: "packages/backend" })
```

---

## 工具组合示例

### 示例 1：查看项目结构并读取文件

```typescript
// 1. 列出目录结构
const structure = await ls({ path: "src", format: "tree" });

// 2. 查找特定文件
// 3. 读取文件内容
const content = await read_file({ path: "src/agent/loop.ts" });
```

### 示例 2：Git 工作流

```typescript
// 1. 查看当前状态
const status = await git_status({});

// 2. 查看更改
const diff = await git_diff({});

// 3. 查看提交历史
const log = await git_log({ max_count: 5 });
```

### 示例 3：分析代码库

```typescript
// 1. 递归列出所有 TypeScript 文件
const files = await ls({
  path: "src",
  recursive: true,
  extensions: [".ts"],
  format: "json"
});

// 2. 统计文件数量
// 3. 逐个读取分析
```

---

## 错误处理

所有工具在执行失败时都会返回错误信息：

```typescript
// 文件不存在
read_file({ path: "nonexistent.txt" })
// 返回: "Error: ENOENT: no such file or directory..."

// 非 Git 仓库
git_status({})
// 返回: "Error: fatal: not a git repository..."
```

建议在使用工具前先检查前置条件。

---

## 扩展新工具

要添加新的自定义工具，参考 `src/tool/` 目录下的现有工具实现：

```typescript
import type { ToolHandler } from "../types.js";

export const myTool: ToolHandler = {
  definition: {
    name: "my_tool",
    description: "工具描述",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "参数1" },
      },
      required: ["param1"],
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    // 实现工具逻辑
    return "结果";
  },
};
```

然后在 `src/tool/index.ts` 中导出，并在 Agent 配置中注册。
