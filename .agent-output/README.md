# Agent 产物目录

此目录用于存储Agent构建过程中生成的所有产物。

## 目录结构

```
.agent-output/
├── artifacts/          # 代码和文件产物
│   ├── code/          # 生成的代码文件
│   ├── config/        # 生成的配置文件
│   ├── scripts/       # 生成的脚本文件
│   └── docs/          # 生成的文档文件
├── logs/              # 日志文件
│   ├── conversations/ # 对话历史日志
│   ├── executions/    # 执行日志
│   └── errors/        # 错误日志
├── cache/             # 缓存文件
│   ├── sessions/      # 会话缓存
│   └── responses/     # API响应缓存
└── temp/              # 临时文件
    └── uploads/       # 上传的临时文件
```

## 说明

- **artifacts/**: Agent创建的有价值产物
  - **code/**: 生成的代码文件（.ts, .js, .py 等）
  - **config/**: 生成的配置文件（.json, .yaml, .toml 等）
  - **scripts/**: 生成的脚本文件（.sh, .bat 等）
  - **docs/**: 生成的文档文件（.md, .txt 等）
- **logs/**: 所有类型的日志记录
- **cache/**: 可安全删除的缓存文件
- **temp/**: 临时工作文件，可定期清理

## .gitignore

建议将此目录添加到 .gitignore，但保留 README.md：
```
.agent-output/*
!.agent-output/README.md
```
