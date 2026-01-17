# Komplete Subsystem

The Komplete subsystem extends Maestro with advanced AI agent capabilities: operational modes, multi-provider architecture, universal tool calling, context optimization, and self-healing loops.

## Quick Start

```typescript
import { ConfigManager, getDefaultConfig } from './config';
import { createLogger } from './utils/logger';
import { AnthropicProvider } from './core/providers/anthropic';
import { ContextWindow } from './core/context/window';

// Initialize configuration
const config = new ConfigManager();
await config.load();

// Create a logger
const logger = createLogger({ name: 'my-agent' });

// Initialize a provider
const provider = new AnthropicProvider({
  apiKey: config.get('providers.anthropic.apiKey'),
  model: 'claude-3-5-sonnet-20241022',
});

// Create a context window
const context = new ContextWindow({ maxTokens: 200000 });
```

## Directory Structure

```
src/komplete/
├── types/                    # Type definitions
├── config/                   # Configuration management
├── utils/                    # Logging and error handling
├── core/                     # Core functionality
│   ├── providers/            # AI provider implementations
│   ├── agents/               # Agent management
│   ├── context/              # Context optimization
│   ├── tasks/                # Task planning and execution
│   ├── commands/             # Slash command system
│   ├── healing/              # Self-healing capabilities
│   ├── indexing/             # Codebase indexing
│   └── hooks/                # Event hooks
├── mcp/                      # Model Context Protocol
├── integrations/             # External integrations
└── cli/                      # Komplete CLI
```

## Core Modules

### Types (`types/`)

Central type definitions for the entire subsystem.

| File | Description |
|------|-------------|
| `index.ts` | Core types: Message, Tool, ToolCall, Agent, Provider interfaces |
| `globals.d.ts` | Bun type declarations for Node.js compatibility |
| `bun-shim.ts` | Node.js fallback implementations for Bun APIs |

**Key Types:**

```typescript
// Operational modes
type OperationalMode = 'architect' | 'code' | 'debug' | 'test' | 'reverse-engineer' | 'ask';

// Agent states
enum AgentState { Idle, Thinking, Executing, Error, Complete }

// Tool groups
type ToolGroup = 'read' | 'edit' | 'browser' | 'command' | 'mcp' | 'modes';
```

### Configuration (`config/`)

Layered configuration system with environment variable support.

**Priority (highest to lowest):**
1. Environment variables (`KOMPLETE_*`)
2. Project config (`.komplete-kontrol.json`)
3. User config (`~/.komplete-kontrol/config.json`)
4. Default values

```typescript
import { ConfigManager } from './config';

const config = new ConfigManager();
await config.load();

// Access configuration
const mode = config.get('defaultMode');           // 'code'
const apiKey = config.get('providers.anthropic.apiKey');
const temperature = config.getModeSettings('architect').temperature;  // 0.7

// Save configuration
await config.set('defaultMode', 'debug');
await config.saveToUserConfig();
```

**Default Mode Settings:**

| Mode | Temperature | Max Tokens |
|------|-------------|------------|
| `architect` | 0.7 | 8192 |
| `code` | 0.3 | 4096 |
| `debug` | 0.2 | 4096 |
| `test` | 0.3 | 4096 |
| `reverse-engineer` | 0.4 | 8192 |
| `ask` | 0.7 | 2048 |

### Utilities (`utils/`)

#### Logger (`logger.ts`)

Structured logging with context, file output, rotation, and timing.

```typescript
import { createLogger, createSessionLogger, LogLevel } from './utils/logger';

// Create a logger with context
const logger = createLogger({
  name: 'agent',
  level: LogLevel.DEBUG,
  fileOutput: {
    directory: '~/.komplete-kontrol/logs',
    maxSizeMB: 10,
    maxFiles: 5,
  },
});

// Log with context
logger.info('Processing request', { sessionId: 'abc123', agentId: 'agent-1' });

// Performance timing
const result = await logger.timeAsync('api-call', async () => {
  return await provider.complete(messages);
});
// Logs: "api-call completed in 1234ms"

// Child logger with inherited context
const childLogger = logger.child({ component: 'parser' });
```

#### Error Handler (`error-handler.ts`)

Error classification, severity assessment, and recovery suggestions.

```typescript
import { ErrorHandler, KompleteError, ProviderError } from './utils/error-handler';

const handler = new ErrorHandler({ logger });

try {
  await provider.complete(messages);
} catch (error) {
  const result = handler.handle(error);
  // result.severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  // result.strategy: 'RETRY' | 'FALLBACK' | 'ABORT' | 'CONTINUE'
  // result.suggestions: RecoverySuggestion[]
}

// Error types
throw new ProviderError('Rate limit exceeded', 'RATE_LIMIT_ERROR', { provider: 'anthropic' });
throw new ToolError('Tool execution failed', 'TOOL_TIMEOUT', { tool: 'read_file' });
throw new ModeError('Invalid mode transition', 'MODE_TRANSITION_ERROR');
```

### Providers (`core/providers/`)

Multi-provider AI architecture with unified interface.

#### Base Provider

```typescript
import { BaseProvider } from './core/providers/base';

class MyProvider extends BaseProvider {
  readonly name = 'my-provider';

  async complete(messages: Message[], options?: CompletionOptions): Promise<CompletionResult> {
    // Implementation
  }

  async *streamComplete(messages: Message[], options?: CompletionOptions): AsyncGenerator<StreamChunk> {
    // Streaming implementation
  }
}
```

#### Available Providers

| Provider | File | Native Tool Calling |
|----------|------|---------------------|
| Anthropic | `anthropic.ts` | Yes |
| OpenAI | `openai.ts` | Yes |
| Ollama | `ollama.ts` | Limited |

#### Advanced Features (`providers/advanced/`)

| Feature | File | Description |
|---------|------|-------------|
| Caching | `caching.ts` | In-memory response cache |
| Persistent Cache | `persistent-cache.ts` | SQLite-backed cache |
| Rate Limiter | `rate-limiter.ts` | Token bucket rate limiting |
| Load Balancer | `load-balancer.ts` | Multi-provider load distribution |
| Fallback | `fallback.ts` | Provider fallback chains |
| Cost Tracker | `cost-tracker.ts` | Usage cost tracking |
| Token Counter | `token-counter.ts` | Accurate token counting |
| Streaming | `streaming.ts` | Streaming utilities |
| Embeddings | `embeddings.ts` | Embedding generation |

```typescript
import { CachedProvider, RateLimitedProvider, FallbackProvider } from './core/providers/advanced';

// Wrap with caching
const cached = new CachedProvider(provider, { ttlMs: 60000 });

// Wrap with rate limiting
const limited = new RateLimitedProvider(cached, { tokensPerSecond: 10000 });

// Wrap with fallback
const resilient = new FallbackProvider([
  { provider: anthropicProvider, weight: 0.8 },
  { provider: openaiProvider, weight: 0.2 },
]);
```

### Agents (`core/agents/`)

Agent orchestration, communication, and lifecycle management.

| File | Description |
|------|-------------|
| `executor.ts` | Agent execution engine |
| `registry.ts` | Agent registry and lookup |
| `orchestrator.ts` | Multi-agent orchestration |
| `coordination.ts` | Coordination patterns |
| `communication.ts` | Inter-agent messaging |
| `hierarchy.ts` | Hierarchical agent structures |
| `lifecycle.ts` | Agent state machine |
| `teams.ts` | Agent team management |
| `workflows.ts` | Multi-step workflow execution |
| `mcp-integration.ts` | MCP tool integration |
| `patterns.ts` | Common agent patterns |

### Context Management (`core/context/`)

Intelligent context window management and optimization.

```typescript
import { ContextWindow } from './core/context/window';
import { ContextOptimizer } from './core/context/optimization';

// Create context window
const context = new ContextWindow({
  maxTokens: 200000,
  reserveTokens: 4096,  // Reserve for response
});

// Add messages
context.addMessage({ role: 'user', content: 'Hello' });
context.addMessage({ role: 'assistant', content: 'Hi there!' });

// Optimize when approaching limit
const optimizer = new ContextOptimizer({
  strategy: 'summarize',  // 'truncate' | 'summarize' | 'prioritize' | 'hybrid'
});

await optimizer.optimize(context);
```

| File | Description |
|------|-------------|
| `window.ts` | Context window management |
| `optimization.ts` | Optimization strategies |
| `condensation.ts` | Message condensation |
| `enhanced-condensation.ts` | Advanced condensation with LLM |
| `memory.ts` | Working memory management |
| `memory-file.ts` | File-based memory persistence |
| `session.ts` | Session context |
| `multi-session.ts` | Cross-session management |
| `tokens.ts` | Token counting utilities |
| `tool-selection.ts` | Dynamic tool selection |
| `contextignore.ts` | `.contextignore` file support |

### Self-Healing (`core/healing/`)

Autonomous error detection, diagnosis, and correction.

```typescript
import { SelfHealingLoop } from './core/healing/loop';

const loop = new SelfHealingLoop({
  maxAttempts: 3,
  validateOutput: true,
  linterIntegration: true,
});

const result = await loop.execute(async () => {
  return await agent.generateCode(task);
});
// Automatically retries with error context if validation fails
```

| File | Description |
|------|-------------|
| `loop.ts` | Main self-healing loop |
| `validation.ts` | Output validation |
| `suggestions.ts` | Fix suggestions |
| `patterns.ts` | Error pattern matching |
| `stderr-parser.ts` | Stderr analysis |
| `linter-integration.ts` | ESLint/TypeScript integration |
| `repl-interface.ts` | Interactive debugging |
| `runtime-supervisor.ts` | Runtime error supervision |
| `shadow-mode.ts` | Shadow execution testing |

### MCP Integration (`mcp/`)

Model Context Protocol client and server implementations.

```typescript
import { MCPClient } from './mcp/client';
import { MCPRegistry } from './mcp/registry';

// Discover and connect to MCP servers
const registry = new MCPRegistry();
await registry.discover();

const client = await registry.connect('my-server');

// Call MCP tools
const result = await client.callTool('search', { query: 'example' });
```

| File | Description |
|------|-------------|
| `client.ts` | MCP client implementation |
| `registry.ts` | Server registry |
| `discovery.ts` | Auto-discovery of servers |
| `stdio-bridge.ts` | STDIO transport |
| `result-handler.ts` | Result processing |
| `agent-executor.ts` | MCP-enabled execution |

### Codebase Indexing (`core/indexing/`)

Code structure analysis for intelligent context inclusion.

```typescript
import { StructureAnalyzer } from './core/indexing/structure';
import { ContextStuffer } from './core/indexing/context-stuffing';

// Analyze codebase structure
const analyzer = new StructureAnalyzer();
const structure = await analyzer.analyze('./src');

// Intelligent context inclusion
const stuffer = new ContextStuffer({ maxTokens: 50000 });
const relevantContext = await stuffer.getRelevantContext(
  'How does authentication work?',
  structure
);
```

### Integrations (`integrations/`)

External system integrations.

#### Vision (`integrations/vision/`)

```typescript
import { ZeroDriftCapture } from './integrations/vision/zero-drift-capture';
import { DOMExtractor } from './integrations/vision/dom-extractor';

// Capture stable screenshots
const capture = new ZeroDriftCapture({ threshold: 0.95 });
const screenshot = await capture.capture(page);

// Extract DOM structure
const extractor = new DOMExtractor();
const dom = await extractor.extract(page);
```

#### Screenshot to Code (`integrations/screenshot-to-code/`)

```typescript
import { ScreenshotToCodeConverter } from './integrations/screenshot-to-code/converter';

const converter = new ScreenshotToCodeConverter({ provider });
const code = await converter.convert(screenshotPath, {
  framework: 'react',
  styling: 'tailwind',
});
```

### CLI (`cli/`)

Command-line interface for the Komplete subsystem.

```bash
# Run komplete CLI
npm run dev:komplete

# Interactive chat mode
npx komplete chat --mode code --provider anthropic

# With specific model
npx komplete chat --model claude-3-5-sonnet-20241022
```

## IPC Bridge

The subsystem exposes a `window.komplete` API for renderer access.

```typescript
// In renderer process
await window.komplete.modes.getCurrent();      // Get current mode
await window.komplete.modes.switch('debug');   // Switch mode
await window.komplete.modes.getAll();          // List all modes

await window.komplete.tools.getAvailable();    // Get tools for current mode
await window.komplete.providers.list();        // List available providers

await window.komplete.config.get('defaultMode');
await window.komplete.config.set('defaultMode', 'architect');
```

## Testing

```bash
# Run all komplete tests
npm run test:komplete

# Watch mode
npm run test:komplete:watch

# Coverage report
npm run test:komplete -- --coverage
```

**Test Coverage:**

| Module | Tests | Status |
|--------|-------|--------|
| `config/` | 30 | Passing |
| `utils/logger.ts` | 63 | Passing |
| `utils/error-handler.ts` | 55 | Passing |
| Total | 148+ | All Passing |

## Related Documentation

- **[ARCHITECTURE.md](../../ARCHITECTURE.md#komplete-subsystem)** - Deep technical architecture
- **[CLAUDE.md](../../CLAUDE.md)** - Quick reference guide
- **[CONTRIBUTING.md](../../CONTRIBUTING.md)** - Development setup

## Development

### Adding a New Provider

1. Create `src/komplete/core/providers/my-provider.ts`
2. Extend `BaseProvider`
3. Implement `complete()` and optionally `streamComplete()`
4. Register in `src/komplete/core/providers/registry.ts`
5. Add configuration in `src/komplete/config/index.ts`

### Adding a New Mode

1. Add mode to `OperationalMode` type in `types/index.ts`
2. Add default settings in `config/index.ts` `DEFAULT_MODE_SETTINGS`
3. Configure tool groups in IPC handlers

### Adding a New Tool Group

1. Add group to `ToolGroup` type in `types/index.ts`
2. Define default tools in `src/main/ipc/handlers/komplete.ts`
3. Update mode configurations as needed

## License

AGPL-3.0 - See [LICENSE](../../LICENSE) for details.
