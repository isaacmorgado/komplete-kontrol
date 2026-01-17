# Komplete-Kontrol

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0--alpha.1-green.svg)](package.json)

> AI Coding Agent with Universal Tool Calling and Multi-Modal Orchestration

Komplete-Kontrol is a cross-platform desktop application for orchestrating AI coding agents with advanced mode-switching, universal tool calling, and multi-provider support. Built for developers who demand complete control over their AI-assisted development workflow.

## What is Komplete-Kontrol?

Komplete-Kontrol extends the Maestro foundation with a powerful new subsystem (`src/komplete/`) that adds:

- **Operational Modes**: Switch between architect, code, debug, test, reverse-engineer, and ask modes with specialized configurations for each
- **Universal Tool Calling**: Consistent tool interface across multiple AI providers
- **Multi-Provider Support**: Anthropic, OpenAI, Ollama, Featherless, and custom providers
- **Advanced Context Management**: Intelligent context optimization and token budgeting
- **MCP Integration**: Full Model Context Protocol support for tool extensibility

## Features

### Komplete Subsystem Features

- **Mode System** - Six operational modes (`architect`, `code`, `debug`, `test`, `reverse-engineer`, `ask`) with tailored settings for temperature, token limits, and tool groups per mode
- **Multi-Provider Architecture** - Unified interface for Anthropic, OpenAI, OpenRouter, Groq, Ollama, and Featherless providers with automatic capability detection
- **Universal Tool Calling** - Consistent tool definition and execution across providers with native and emulated tool calling support
- **Context Optimization** - Intelligent context management with token budgeting, message prioritization, and cache-aware optimization
- **Structured Logging** - Context-aware logging with file output, rotation, and performance timing utilities
- **Error Recovery** - Comprehensive error handling with severity classification and recovery suggestions

### Inherited Maestro Features

- **Multi-Agent Management** - Run unlimited agents and terminal sessions in parallel
- **Git Worktrees** - Run AI agents in parallel on isolated branches
- **Auto Run & Playbooks** - Batch-process markdown checklists through AI agents
- **Group Chat** - Coordinate multiple AI agents in a single conversation
- **Mobile Remote Control** - Monitor and control agents from your phone
- **Command Line Interface** - Full CLI for headless operation
- **Keyboard-First Design** - Full keyboard control with customizable shortcuts
- **12 Beautiful Themes** - Dracula, Monokai, Nord, Tokyo Night, and more

## Quick Start

### Installation

Build from source:

```bash
git clone https://github.com/isaacmorgado/komplete-kontrol.git
cd komplete-kontrol
npm install
npm run dev
```

### Requirements

- Node.js 22.0.0 or higher
- At least one supported AI coding agent installed and authenticated:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - Anthropic's AI coding assistant
  - [OpenAI Codex](https://github.com/openai/codex) - OpenAI's coding agent
  - [OpenCode](https://github.com/sst/opencode) - Open-source AI coding assistant
- Git (optional, for git-aware features)

### Configuration

Komplete-Kontrol uses a layered configuration system:

1. **User config**: `~/.komplete-kontrol/config.json`
2. **Project config**: `.komplete-kontrol.json` in project root
3. **Environment variables**: `KOMPLETE_*` prefix

Example configuration:

```json
{
  "defaultMode": "code",
  "toolCallingMethod": "native",
  "providers": {
    "anthropic": {
      "apiKey": "your-api-key",
      "defaultModel": "claude-sonnet-4-20250514"
    }
  }
}
```

## Architecture

```
src/
├── komplete/                # Komplete subsystem (new)
│   ├── core/               # Core orchestration
│   │   ├── agents/         # Agent coordination
│   │   ├── providers/      # AI provider implementations
│   │   ├── modes/          # Mode definitions
│   │   └── context/        # Context management
│   ├── mcp/                # MCP integration
│   ├── tools/              # Tool implementations
│   ├── config/             # Configuration system
│   ├── types/              # Type definitions
│   └── utils/              # Utilities (logger, error-handler)
├── main/                   # Electron main process
├── renderer/               # React frontend
├── web/                    # Web/mobile interface
├── cli/                    # CLI tooling
└── shared/                 # Shared types and utilities
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Development

```bash
# Development with hot reload
npm run dev

# Komplete subsystem development (TypeScript watch mode)
npm run dev:komplete

# Run all tests
npm run test

# Run komplete tests only
npm run test:komplete

# Type checking
npm run lint

# Build for production
npm run build
```

## Essential Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Quick Actions | `Cmd+K` | `Ctrl+K` |
| New Agent | `Cmd+N` | `Ctrl+N` |
| Switch AI/Terminal | `Cmd+J` | `Ctrl+J` |
| Previous/Next Agent | `Cmd+[` / `Cmd+]` | `Ctrl+[` / `Ctrl+]` |
| Toggle Sidebar | `Cmd+B` | `Ctrl+B` |
| New Tab | `Cmd+T` | `Ctrl+T` |
| Usage Dashboard | `Opt+Cmd+U` | `Alt+Ctrl+U` |
| All Shortcuts | `Cmd+/` | `Ctrl+/` |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Deep technical documentation
- [CLAUDE.md](CLAUDE.md) - Quick reference for AI agents
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development setup and contribution guidelines

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, architecture details, and contribution guidelines.

## Credits

Komplete-Kontrol is built on top of [Maestro](https://github.com/pedramamini/Maestro) by Pedram Amini. We extend our gratitude to the Maestro team for creating the excellent foundation that makes this project possible.

## License

[AGPL-3.0 License](LICENSE)

---

**Author**: Isaac Morgado
**Repository**: [github.com/isaacmorgado/komplete-kontrol](https://github.com/isaacmorgado/komplete-kontrol)
