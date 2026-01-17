/**
 * Interactive Chat Interface for KOMPLETE-KONTROL CLI
 *
 * Provides a REPL-based chat interface with:
 * - Streaming responses
 * - Session persistence
 * - Model routing
 * - Slash command handling
 */

import { createInterface, type Interface } from 'readline';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import type { LoggerLike } from '../utils/logger';
import type { ConfigManager } from '../config';
import type { SessionManager } from '../core/context/session';
import type { ModelRouter } from '../core/providers/router';
import type { ProviderRegistry } from '../core/providers/registry';
import type { CommandRegistry } from '../core/commands';
import type { Message, TextContent, StreamChunk, AIProvider, Session } from '../types';

/**
 * Chat session options
 */
export interface ChatOptions {
  model?: string;
  mode?: string;
  sessionId?: string;
  maxCost?: number;
}

/**
 * Chat interface configuration
 */
export interface ChatConfig {
  logger: LoggerLike;
  configManager: ConfigManager;
  sessionManager: SessionManager;
  modelRouter: ModelRouter;
  providerRegistry: ProviderRegistry;
  commandRegistry: CommandRegistry;
}

/**
 * Interactive Chat class
 */
export class InteractiveChat {
  private config: ChatConfig;
  private rl: Interface | null = null;
  private currentSession: Session | null = null;
  private currentModel: string;
  private currentProvider: AIProvider | null = null;
  private spinner: Ora | null = null;
  private isRunning = false;
  private systemPrompt: string;

  constructor(config: ChatConfig) {
    this.config = config;
    this.currentModel = config.configManager.getValue('defaultModel') || 'ollama/llama3';
    this.systemPrompt = `You are a helpful AI assistant. Be concise and direct in your responses.`;
  }

  /**
   * Start interactive chat session
   */
  async start(options: ChatOptions = {}): Promise<void> {
    this.isRunning = true;

    // Set up model
    if (options.model) {
      this.currentModel = options.model;
    }

    // Get provider
    try {
      this.currentProvider = this.config.modelRouter.getProvider(this.currentModel);
    } catch (error) {
      console.log(chalk.red(`Failed to get provider for model ${this.currentModel}`));
      console.log(chalk.yellow('Falling back to ollama/llama3'));
      this.currentModel = 'ollama/llama3';
      try {
        this.currentProvider = this.config.modelRouter.getProvider(this.currentModel);
      } catch {
        console.log(chalk.red('No providers available. Please configure a provider.'));
        return;
      }
    }

    // Resume or create session
    if (options.sessionId) {
      const session = await this.config.sessionManager.getSession(options.sessionId);
      if (session) {
        this.currentSession = session;
        await this.config.sessionManager.setActiveSession(session.id);
        console.log(chalk.green(`Resumed session: ${session.id}`));
      } else {
        console.log(chalk.yellow(`Session ${options.sessionId} not found, creating new session`));
        this.currentSession = await this.config.sessionManager.createSession(options.mode || 'chat');
        await this.config.sessionManager.setActiveSession(this.currentSession.id);
      }
    } else {
      this.currentSession = await this.config.sessionManager.createSession(options.mode || 'chat');
      await this.config.sessionManager.setActiveSession(this.currentSession.id);
    }

    // Update session model
    if (this.currentSession) {
      this.currentSession.model = this.currentModel;
      await this.config.sessionManager.updateSession(this.currentSession);
    }

    // Print header
    this.printHeader();

    // Create readline interface
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Handle close
    this.rl.on('close', () => {
      this.stop();
    });

    // Start REPL loop
    await this.runLoop();
  }

  /**
   * Stop chat session
   */
  stop(): void {
    this.isRunning = false;
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    console.log(chalk.gray('\nChat session ended.'));
    if (this.currentSession) {
      console.log(chalk.gray(`Session saved: ${this.currentSession.id}`));
    }
  }

  /**
   * Print chat header
   */
  private printHeader(): void {
    const modelName = this.config.modelRouter.getModelName(this.currentModel);
    const providerName = this.currentProvider?.name || 'Unknown';

    console.log('');
    console.log(chalk.cyan('╭─────────────────────────────────────────────────────────╮'));
    console.log(chalk.cyan('│') + chalk.bold('  KOMPLETE-KONTROL Chat                                  ') + chalk.cyan('│'));
    console.log(chalk.cyan('├─────────────────────────────────────────────────────────┤'));
    console.log(chalk.cyan('│') + chalk.gray(`  Model: ${modelName.padEnd(46)}`) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray(`  Provider: ${providerName.padEnd(43)}`) + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.gray(`  Session: ${(this.currentSession?.id || 'N/A').substring(0, 43).padEnd(43)}`) + chalk.cyan('│'));
    console.log(chalk.cyan('╰─────────────────────────────────────────────────────────╯'));
    console.log('');
    console.log(chalk.gray('Commands: /help, /model <model>, /session, /clear, /exit'));
    console.log('');
  }

  /**
   * Run the REPL loop
   */
  private async runLoop(): Promise<void> {
    while (this.isRunning && this.rl) {
      const input = await this.prompt();

      if (input === null) {
        break;
      }

      const trimmed = input.trim();

      if (!trimmed) {
        continue;
      }

      // Handle slash commands
      if (trimmed.startsWith('/')) {
        await this.handleSlashCommand(trimmed);
        continue;
      }

      // Process user message
      await this.processMessage(trimmed);
    }
  }

  /**
   * Prompt for user input
   */
  private prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      if (!this.rl || !this.isRunning) {
        resolve(null);
        return;
      }

      this.rl.question(chalk.green('You: '), (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Handle slash commands
   */
  private async handleSlashCommand(input: string): Promise<void> {
    const parts = input.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        this.showHelp();
        break;

      case 'exit':
      case 'quit':
      case 'q':
        this.stop();
        break;

      case 'model':
        await this.handleModelCommand(args);
        break;

      case 'session':
        await this.handleSessionCommand(args);
        break;

      case 'clear':
        await this.handleClearCommand();
        break;

      case 'history':
        this.showHistory();
        break;

      case 'status':
        this.showStatus();
        break;

      default:
        console.log(chalk.yellow(`Unknown command: /${command}`));
        console.log(chalk.gray('Type /help for available commands'));
    }
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log('');
    console.log(chalk.cyan('Available Commands:'));
    console.log(chalk.gray('  /help              - Show this help'));
    console.log(chalk.gray('  /exit, /quit, /q   - Exit chat'));
    console.log(chalk.gray('  /model <name>      - Switch model (e.g., /model ollama/llama3)'));
    console.log(chalk.gray('  /model list        - List available models'));
    console.log(chalk.gray('  /session           - Show current session info'));
    console.log(chalk.gray('  /session list      - List all sessions'));
    console.log(chalk.gray('  /clear             - Clear conversation history'));
    console.log(chalk.gray('  /history           - Show conversation history'));
    console.log(chalk.gray('  /status            - Show current status'));
    console.log('');
  }

  /**
   * Handle model command
   */
  private async handleModelCommand(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === 'list') {
      // List available providers
      console.log('');
      console.log(chalk.cyan('Available Providers:'));
      const providers = this.config.providerRegistry.list();
      for (const provider of providers) {
        const isActive = provider.prefix === this.config.modelRouter.getPrefix(this.currentModel);
        const marker = isActive ? chalk.green('*') : ' ';
        console.log(`  ${marker} ${chalk.cyan(provider.prefix)}/ - ${provider.name}`);
      }
      console.log('');
      console.log(chalk.gray('Current model: ') + chalk.cyan(this.currentModel));
      console.log(chalk.gray('Usage: /model <prefix>/<model-name>'));
      console.log(chalk.gray('Example: /model ollama/llama3, /model anthropic/claude-3-sonnet'));
      console.log('');
      return;
    }

    const newModel = args[0]!;

    try {
      const provider = this.config.modelRouter.getProvider(newModel);
      this.currentModel = newModel;
      this.currentProvider = provider;

      if (this.currentSession) {
        this.currentSession.model = newModel;
        await this.config.sessionManager.updateSession(this.currentSession);
      }

      console.log(chalk.green(`Switched to model: ${newModel} (${provider.name})`));
    } catch (error) {
      console.log(chalk.red(`Failed to switch model: ${(error as Error).message}`));
    }
  }

  /**
   * Handle session command
   */
  private async handleSessionCommand(args: string[]): Promise<void> {
    if (args[0] === 'list') {
      const sessions = this.config.sessionManager.listSessions();
      console.log('');
      console.log(chalk.cyan('Sessions:'));
      if (sessions.length === 0) {
        console.log(chalk.gray('  No sessions found'));
      } else {
        for (const session of sessions.slice(0, 10)) {
          const isActive = session.id === this.currentSession?.id;
          const marker = isActive ? chalk.green('*') : ' ';
          const date = new Date(session.updated).toLocaleString();
          console.log(`  ${marker} ${chalk.cyan(session.id.substring(0, 30))} - ${session.messages.length} msgs - ${date}`);
        }
        if (sessions.length > 10) {
          console.log(chalk.gray(`  ... and ${sessions.length - 10} more`));
        }
      }
      console.log('');
      return;
    }

    // Show current session info
    if (!this.currentSession) {
      console.log(chalk.yellow('No active session'));
      return;
    }

    console.log('');
    console.log(chalk.cyan('Current Session:'));
    console.log(chalk.gray(`  ID: ${this.currentSession.id}`));
    console.log(chalk.gray(`  Model: ${this.currentSession.model}`));
    console.log(chalk.gray(`  Messages: ${this.currentSession.messages.length}`));
    console.log(chalk.gray(`  Tokens: ${this.currentSession.totalTokens || 0}`));
    console.log(chalk.gray(`  Created: ${new Date(this.currentSession.created).toLocaleString()}`));
    console.log(chalk.gray(`  Updated: ${new Date(this.currentSession.updated).toLocaleString()}`));
    console.log('');
  }

  /**
   * Handle clear command
   */
  private async handleClearCommand(): Promise<void> {
    if (this.currentSession) {
      await this.config.sessionManager.clearMessages(this.currentSession.id);
      this.currentSession.messages = [];
      console.log(chalk.green('Conversation history cleared'));
    }
  }

  /**
   * Show conversation history
   */
  private showHistory(): void {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      console.log(chalk.gray('No conversation history'));
      return;
    }

    console.log('');
    console.log(chalk.cyan('Conversation History:'));
    for (const msg of this.currentSession.messages) {
      const roleColor = msg.role === 'user' ? chalk.green : chalk.blue;
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      console.log(`  ${roleColor(msg.role)}: ${preview}`);
    }
    console.log('');
  }

  /**
   * Show current status
   */
  private showStatus(): void {
    const modelName = this.config.modelRouter.getModelName(this.currentModel);
    const providerName = this.currentProvider?.name || 'Unknown';

    console.log('');
    console.log(chalk.cyan('Status:'));
    console.log(chalk.gray(`  Model: ${modelName}`));
    console.log(chalk.gray(`  Provider: ${providerName}`));
    console.log(chalk.gray(`  Session: ${this.currentSession?.id || 'None'}`));
    console.log(chalk.gray(`  Messages: ${this.currentSession?.messages.length || 0}`));
    console.log(chalk.gray(`  Streaming: ${this.currentProvider?.capabilities.streaming ? 'Yes' : 'No'}`));
    console.log('');
  }

  /**
   * Process user message and get AI response
   */
  private async processMessage(userInput: string): Promise<void> {
    if (!this.currentProvider || !this.currentSession) {
      console.log(chalk.red('No provider or session available'));
      return;
    }

    // Add user message to session
    await this.config.sessionManager.addMessage(this.currentSession.id, {
      role: 'user',
      content: userInput,
    });
    this.currentSession.messages.push({ role: 'user', content: userInput });

    // Build messages array for API
    const messages: Message[] = [
      {
        role: 'system',
        content: { type: 'text', text: this.systemPrompt } as TextContent,
      },
      ...this.currentSession.messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: { type: 'text', text: msg.content } as TextContent,
      })),
    ];

    const modelName = this.config.modelRouter.getModelName(this.currentModel);

    // Check if streaming is supported
    if (this.currentProvider.capabilities.streaming) {
      await this.streamResponse(modelName, messages);
    } else {
      await this.completeResponse(modelName, messages);
    }
  }

  /**
   * Stream response from AI
   */
  private async streamResponse(model: string, messages: Message[]): Promise<void> {
    process.stdout.write(chalk.blue('Assistant: '));

    let fullResponse = '';
    let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;

    try {
      const stream = this.currentProvider!.stream(model, messages, {
        maxTokens: 4096,
        temperature: 0.7,
      });

      for await (const chunk of stream) {
        if (chunk.delta) {
          process.stdout.write(chunk.delta);
          fullResponse += chunk.delta;
        }
        if (chunk.done && chunk.usage) {
          usage = chunk.usage;
        }
      }

      console.log(''); // New line after response

      // Save assistant response to session
      if (this.currentSession && fullResponse) {
        await this.config.sessionManager.addMessage(this.currentSession.id, {
          role: 'assistant',
          content: fullResponse,
        });
        this.currentSession.messages.push({ role: 'assistant', content: fullResponse });

        if (usage) {
          await this.config.sessionManager.updateTokenCount(this.currentSession.id, usage.totalTokens);
        }
      }

      // Show token usage
      if (usage) {
        console.log(chalk.gray(`  [${usage.inputTokens} in / ${usage.outputTokens} out]`));
      }
      console.log('');

    } catch (error) {
      console.log('');
      console.log(chalk.red(`Error: ${(error as Error).message}`));
      this.config.logger.error('Stream error', 'Chat', { error });
    }
  }

  /**
   * Complete response from AI (non-streaming)
   */
  private async completeResponse(model: string, messages: Message[]): Promise<void> {
    this.spinner = ora({
      text: 'Thinking...',
      color: 'cyan',
    }).start();

    try {
      const result = await this.currentProvider!.complete(model, messages, {
        maxTokens: 4096,
        temperature: 0.7,
      });

      this.spinner.stop();

      // Extract text from result
      let responseText = '';
      if (Array.isArray(result.content)) {
        for (const block of result.content) {
          if (block.type === 'text') {
            responseText += (block as TextContent).text;
          }
        }
      } else if (result.content.type === 'text') {
        responseText = (result.content as TextContent).text;
      }

      console.log(chalk.blue('Assistant: ') + responseText);
      console.log('');

      // Save assistant response to session
      if (this.currentSession && responseText) {
        await this.config.sessionManager.addMessage(this.currentSession.id, {
          role: 'assistant',
          content: responseText,
        });
        this.currentSession.messages.push({ role: 'assistant', content: responseText });

        if (result.usage) {
          await this.config.sessionManager.updateTokenCount(this.currentSession.id, result.usage.totalTokens);
        }
      }

      // Show token usage
      if (result.usage) {
        console.log(chalk.gray(`  [${result.usage.inputTokens} in / ${result.usage.outputTokens} out]`));
      }
      console.log('');

    } catch (error) {
      this.spinner?.stop();
      console.log(chalk.red(`Error: ${(error as Error).message}`));
      this.config.logger.error('Complete error', 'Chat', { error });
    }
  }
}

/**
 * Create and start interactive chat
 */
export async function startInteractiveChat(
  config: ChatConfig,
  options: ChatOptions = {}
): Promise<void> {
  const chat = new InteractiveChat(config);
  await chat.start(options);
}
