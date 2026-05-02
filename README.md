# pi-agent-clone

A lightweight AI coding agent framework with multi-provider LLM support, inspired by pi-mono's architecture.

## Features

- 🔄 **Multi-turn Conversation Loop** - REACT pattern: Reason → Act → Observe
- 🛠️ **Tool Calling** - Parallel execution of multiple tools
- 📡 **Multi-provider Support** - OpenAI, Anthropic, Gemini, GLM, MiniMax
- 🌊 **Streaming Responses** - Real-time display of AI thinking and execution
- ⚡ **Event-driven** - Complete event system for monitoring and debugging
- 🛡️ **Context Protection** - 80% threshold automatic trimming to prevent overflow
- 🔧 **Built-in Tools** - terminal, read_file, write_file, git_*, ls

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
GLM_API_KEY=your_glm_api_key
MINIMAX_API_KEY=your_minimax_api_key
```

## Usage

```bash
# Development mode
npm run dev

# Build and run
npm run build
npm start

# Type checking
npm run typecheck
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `terminal` | Execute shell commands |
| `read_file` | Read file contents |
| `write_file` | Write content to files |
| `git_status` | Show Git repository status |
| `git_log` | Show commit history |
| `git_diff` | Show file differences |
| `git` | Execute arbitrary Git commands |
| `ls` | List directory contents |

See [TOOLS_REFERENCE.md](.agent-output/artifacts/docs/TOOLS_REFERENCE.md) for detailed documentation.

## Architecture

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

## Context Management

The agent includes automatic context window protection:

- **Token Estimation**: Optimized for mixed Chinese/English content
- **80% Threshold**: Automatically trims when approaching context limit
- **FIFO Strategy**: Preserves recent messages by default

## Documentation

- [LEARNING_GUIDE.md](.agent-output/artifacts/docs/LEARNING_GUIDE.md) - Complete learning path
- [TOOLS_REFERENCE.md](.agent-output/artifacts/docs/TOOLS_REFERENCE.md) - Tool reference documentation

## Project Structure

```
pi-agent-clone/
├── src/
│   ├── agent/           # Agent loop implementation
│   ├── cli/             # Command-line interface
│   ├── context/         # Context management
│   ├── provider/        # LLM provider transports
│   └── tool/            # Built-in tools
├── .agent-output/       # Agent-generated artifacts
│   └── artifacts/docs/  # Documentation
└── package.json
```

## License

MIT
