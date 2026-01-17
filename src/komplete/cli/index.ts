/**
 * CLI Framework for KOMPLETE-KONTROL CLI
 *
 * Provides command-line interface using yargs with subcommands and options.
 */

import yargs, { type Argv } from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { Logger, LogLevel } from '../utils/logger';
import { ConfigManager } from '../config';
import { handleError, ErrorHandler } from '../utils/error-handler';
import {
  getAgentRegistry,
  getAgentLifecycleManager,
  AgentLifecycleState,
  initializeTestAgents,
} from '../core/agents';
import {
  SessionManager,
  createSessionManager,
  ContextWindow,
  createContextWindow,
  TokenCounter,
  TokenBudget,
  createTokenBudget,
  TokenTracker,
  createTokenTracker,
  MemoryFileHandler,
  createMemoryFileHandler,
  type ContextMessage,
  type Session,
} from '../core/context';
import type { Message, MessageRole, MessageContent, TextContent } from '../types';
import {
  CommandRegistry,
  createCommandRegistry,
  CommandParser,
  type CommandListOptions,
} from '../core/commands';
import { startInteractiveChat } from './chat';
import {
  getProviderRegistry,
  getModelRouter,
  initializeProviders,
  type ParsedModel,
} from '../core/providers';
import {
  getMCPRegistry,
  createMCPClient,
  connectToMCPServer,
  type MCPServerState,
  type MCPTool,
} from '../mcp';
import {
  createZeroDriftCapturer,
  createDOMExtractor,
  type CaptureOptions,
  type ExtractionOptions,
} from '../integrations/vision';
import {
  createHARAnalyzer,
  type HARFile,
} from '../integrations/network';
import {
  createScreenshotToCodeConverter,
  type CodeStack,
  type GenerateCodeOptions,
} from '../integrations/screenshot-to-code';
import * as fs from 'node:fs/promises';

/**
 * CLI configuration
 */
interface CLIConfig {
  logger: Logger;
  configManager: ConfigManager;
  sessionManager?: SessionManager;
  tokenBudget?: TokenBudget;
  tokenTracker?: TokenTracker;
  memoryFileHandler?: MemoryFileHandler;
  commandRegistry?: CommandRegistry;
  providerRegistry?: ReturnType<typeof getProviderRegistry>;
  modelRouter?: ReturnType<typeof getModelRouter>;
  mcpRegistry?: ReturnType<typeof getMCPRegistry>;
}

/**
 * CLI class
 */
export class CLI {
  private config: CLIConfig;
  private initialized: boolean = false;

  constructor(config: CLIConfig) {
    this.config = config;
    
    // Initialize context managers if not provided
    if (!this.config.sessionManager) {
      this.config.sessionManager = createSessionManager();
    }
    if (!this.config.tokenBudget) {
      this.config.tokenBudget = createTokenBudget();
    }
    if (!this.config.tokenTracker) {
      this.config.tokenTracker = createTokenTracker();
    }
    if (!this.config.memoryFileHandler) {
      this.config.memoryFileHandler = createMemoryFileHandler();
    }
    if (!this.config.commandRegistry) {
      const errorHandler = new ErrorHandler({ logger: this.config.logger });
      const parser = new CommandParser(this.config.logger, errorHandler);
      this.config.commandRegistry = createCommandRegistry(
        this.config.logger,
        errorHandler,
        parser
      );
    }
    // Initialize provider registry if not provided
    if (!this.config.providerRegistry) {
      this.config.providerRegistry = getProviderRegistry();
    }
    // Initialize model router if not provided
    if (!this.config.modelRouter) {
      this.config.modelRouter = getModelRouter(undefined, this.config.logger);
    }
    // Initialize MCP registry if not provided
    if (!this.config.mcpRegistry) {
      this.config.mcpRegistry = getMCPRegistry();
    }
  }

  /**
   * Initialize CLI components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize session manager
    try {
      await this.config.sessionManager!.initialize();
      this.config.logger.info('Session manager initialized', 'CLI', {
        sessionCount: this.config.sessionManager!.listSessions().length,
      });
    } catch (error) {
      this.config.logger.error('Failed to initialize session manager', 'CLI', { error });
    }

    // Initialize command registry
    try {
      await this.config.commandRegistry!.initialize();
      this.config.logger.info('Command registry initialized', 'CLI', {
        commandCount: this.config.commandRegistry!.listCommands().length,
      });
    } catch (error) {
      this.config.logger.error('Failed to initialize command registry', 'CLI', { error });
    }

    this.initialized = true;
  }

  /**
   * Parse and execute CLI command
   */
  async parse(): Promise<void> {
    await this.buildYargs().parseAsync();
  }

  /**
   * Build yargs instance with all commands
   */
  private buildYargs(): Argv {
    return yargs(hideBin(process.argv))
      .scriptName('komplete-kontrol')
      .version('1.0.0')
      .alias('v', 'version')
      .help('help')
      .alias('h', 'help')
      .wrap(Math.min(120, process.stdout.columns || 80))
      .strict()
      .fail((msg, err) => {
        if (err) {
          handleError(err, { operation: 'CLI' });
        } else {
          console.error(chalk.red(msg));
        }
        process.exit(1);
      })
      // Global options
      .option('verbose', {
        alias: 'V',
        type: 'boolean',
        description: 'Enable verbose output',
        global: true,
      })
      .option('quiet', {
        alias: 'q',
        type: 'boolean',
        description: 'Suppress non-error output',
        global: true,
      })
      .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to configuration file',
        global: true,
      })
      .option('log-level', {
        type: 'string',
        choices: ['debug', 'info', 'warn', 'error'] as const,
        description: 'Set log level',
        global: true,
      })
      // Chat command
      .command(
        'chat',
        'Start an interactive chat session',
        (yargs) => {
          return yargs
            .option('model', {
              alias: 'm',
              type: 'string',
              description: 'Model to use (e.g., or/claude-3.5-sonnet)',
            })
            .option('mode', {
              type: 'string',
              choices: ['general', 'coder', 'intense-research', 'reverse-engineer', 'spark'] as const,
              description: 'Agent mode to use',
            })
            .option('session', {
              alias: 's',
              type: 'string',
              description: 'Session ID to resume',
            })
            .option('max-cost', {
              type: 'number',
              description: 'Maximum cost for this command',
            });
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
          await this.handleChat(argv as any);
        }
      )
      // Agent command
      .command(
        'agent',
        'Manage and interact with agents',
        (yargs) => {
          return yargs
            .command('list', 'List available agents', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleAgentList();
            })
            .command('info <agent-id>', 'Show agent information', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleAgentInfo(argv as any);
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Config command
      .command(
        'config',
        'Manage configuration',
        (yargs) => {
          return yargs
            .command('show', 'Show current configuration', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleConfigShow();
            })
            .command('set <key> <value>', 'Set configuration value', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleConfigSet(argv as any);
            })
            .command('get <key>', 'Get configuration value', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleConfigGet(argv as any);
            })
            .command('init', 'Initialize configuration file', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleConfigInit();
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Provider command
      .command(
        'provider',
        'Manage AI providers',
        (yargs) => {
          return yargs
            .command('list', 'List available providers', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleProviderList();
            })
            .command('test <provider>', 'Test provider connection', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleProviderTest(argv as any);
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Session command
      .command(
        'session',
        'Manage sessions',
        (yargs) => {
          return yargs
            .command('create', 'Create a new session', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleSessionCreate(argv as any);
            })
            .command('list', 'List sessions', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleSessionList();
            })
            .command('show <session-id>', 'Show session details', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleSessionShow(argv as any);
            })
            .command('delete <session-id>', 'Delete a session', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleSessionDelete(argv as any);
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // MCP command
      .command(
        'mcp',
        'Manage MCP servers',
        (yargs) => {
          return yargs
            .command('list', 'List MCP servers', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleMCPList();
            })
            .command('start <server-id>', 'Start MCP server', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleMCPStart(argv as any);
            })
            .command('stop <server-id>', 'Stop MCP server', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleMCPStop(argv as any);
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Context command
      .command(
        'context',
        'Manage context and memory',
        (yargs) => {
          return yargs
            .command('show <session-id>', 'Show context for session', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleContextShow(argv as any);
            })
            .command('clear <session-id>', 'Clear context for session', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleContextClear(argv as any);
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Memory command
      .command(
        'memory',
        'Manage .memory.md files',
        (yargs) => {
          return yargs
            .command('show', 'Show current memory file', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleMemoryShow();
            })
            .command('edit', 'Edit memory file', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleMemoryEdit();
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Budget command
      .command(
        'budget',
        'Manage cost budget',
        (yargs) => {
          return yargs
            .command('show', 'Show budget status', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleBudgetShow();
            })
            .command('reset', 'Reset daily budget', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleBudgetReset();
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Parallel command
      .command(
        'parallel',
        'Execute parallel tasks',
        (yargs) => {
          return yargs
            .option('tasks', {
              alias: 't',
              type: 'string',
              description: 'Comma-separated task descriptions',
            })
            .option('file', {
              alias: 'f',
              type: 'string',
              description: 'File containing task definitions',
            })
            .demandOption(['tasks', 'file'], 'Please provide either --tasks or --file');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
          await this.handleParallel(argv as any);
        }
      )
      // Debug command
      .command(
        'debug',
        'Debug and troubleshooting tools',
        (yargs) => {
          return yargs
            .command('logs', 'Show recent logs', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleDebugLogs();
            })
            .command('status', 'Show system status', {}, async (argv) => {
              await this.applyGlobalOptions(argv as any);
              await this.handleDebugStatus();
            })
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Vision command
      .command(
        'vision',
        'Vision capture and DOM extraction tools',
        (yargs) => {
          return yargs
            .command(
              'capture <url>',
              'Capture page with zero-drift (screenshot + DOM)',
              (yargs) => {
                return yargs
                  .positional('url', {
                    type: 'string',
                    description: 'URL to capture',
                  })
                  .option('output', {
                    alias: 'o',
                    type: 'string',
                    description: 'Output file (JSON)',
                  })
                  .option('width', {
                    alias: 'w',
                    type: 'number',
                    description: 'Viewport width',
                    default: 1920,
                  })
                  .option('height', {
                    alias: 'h',
                    type: 'number',
                    description: 'Viewport height',
                    default: 1080,
                  })
                  .option('wait-idle', {
                    type: 'boolean',
                    description: 'Wait for network idle',
                    default: true,
                  })
                  .option('accessibility', {
                    type: 'boolean',
                    description: 'Include accessibility tree',
                    default: false,
                  });
              },
              async (argv) => {
                await this.applyGlobalOptions(argv as any);
                await this.handleVisionCapture(argv as any);
              }
            )
            .command(
              'extract <html-file>',
              'Extract DOM elements with quality scoring',
              (yargs) => {
                return yargs
                  .positional('html-file', {
                    type: 'string',
                    description: 'Path to HTML file',
                  })
                  .option('output', {
                    alias: 'o',
                    type: 'string',
                    description: 'Output file (JSON)',
                  })
                  .option('min-quality', {
                    type: 'number',
                    description: 'Minimum quality score (0-100)',
                    default: 60,
                  })
                  .option('max-elements', {
                    type: 'number',
                    description: 'Maximum elements to extract',
                    default: 50,
                  })
                  .option('focus-types', {
                    type: 'string',
                    description: 'Comma-separated element types to focus on',
                  });
              },
              async (argv) => {
                await this.applyGlobalOptions(argv as any);
                await this.handleVisionExtract(argv as any);
              }
            )
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Network command
      .command(
        'network',
        'Network analysis and HAR file tools',
        (yargs) => {
          return yargs
            .command(
              'analyze <har-file>',
              'Analyze HAR file for APIs, performance, and traffic',
              (yargs) => {
                return yargs
                  .positional('har-file', {
                    type: 'string',
                    description: 'Path to HAR file',
                  })
                  .option('output', {
                    alias: 'o',
                    type: 'string',
                    description: 'Output file (JSON)',
                  })
                  .option('show-endpoints', {
                    type: 'boolean',
                    description: 'Show discovered API endpoints',
                    default: true,
                  })
                  .option('show-performance', {
                    type: 'boolean',
                    description: 'Show performance metrics',
                    default: true,
                  })
                  .option('show-resources', {
                    type: 'boolean',
                    description: 'Show resource type breakdown',
                    default: false,
                  });
              },
              async (argv) => {
                await this.applyGlobalOptions(argv as any);
                await this.handleNetworkAnalyze(argv as any);
              }
            )
            .demandCommand(1, 'Please specify a subcommand');
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
        }
      )
      // Screenshot-to-Code command
      .command(
        'screenshot-to-code <url>',
        'Convert screenshot to code using AI',
        (yargs) => {
          return yargs
            .positional('url', {
              type: 'string',
              description: 'URL to capture and convert',
            })
            .option('output', {
              alias: 'o',
              type: 'string',
              description: 'Output file for generated code',
            })
            .option('stack', {
              alias: 's',
              type: 'string',
              description: 'Target stack',
              choices: ['html_tailwind', 'html_css', 'react_tailwind', 'vue_tailwind', 'ionic_tailwind'],
              default: 'html_tailwind',
            })
            .option('model', {
              alias: 'm',
              type: 'string',
              description: 'Model to use (must support vision)',
            })
            .option('instructions', {
              alias: 'i',
              type: 'string',
              description: 'Additional instructions for code generation',
            })
            .option('responsive', {
              type: 'boolean',
              description: 'Make the code responsive',
              default: true,
            })
            .option('accessibility', {
              type: 'boolean',
              description: 'Include accessibility features',
              default: true,
            })
            .option('width', {
              alias: 'w',
              type: 'number',
              description: 'Viewport width for capture',
              default: 1920,
            })
            .option('height', {
              alias: 'h',
              type: 'number',
              description: 'Viewport height for capture',
              default: 1080,
            });
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
          await this.handleScreenshotToCode(argv as any);
        }
      )
      // Slash command
      .command(
        'slash <command>',
        'Execute a slash command',
        (yargs) => {
          return yargs
            .positional('command', {
              type: 'string',
              description: 'Slash command to execute (e.g., help, context-show, session-list)',
            })
            .option('args', {
              alias: 'a',
              type: 'string',
              description: 'Arguments to pass to command',
            });
        },
        async (argv) => {
          await this.applyGlobalOptions(argv as any);
          await this.handleSlashCommand(argv as any);
        }
      );
  }

  /**
   * Apply global options
   */
  private async applyGlobalOptions(argv: any): Promise<void> {
    // Set log level
    if (argv.logLevel) {
      const levelMap: Record<string, LogLevel> = {
        debug: LogLevel.DEBUG,
        info: LogLevel.INFO,
        warn: LogLevel.WARN,
        error: LogLevel.ERROR,
      };
      this.config.logger.config.level = levelMap[argv.logLevel] ?? this.config.logger.config.level;
    }

    // Verbose mode
    if (argv.verbose) {
      this.config.logger.config.level = LogLevel.DEBUG;
    }

    // Quiet mode
    if (argv.quiet) {
      this.config.logger.config.level = LogLevel.ERROR;
    }

    // Load custom config
    if (argv.config) {
      await this.config.configManager.load(argv.config);
    } else if (!this.config.configManager.getAll()) {
      // Try to load default config
      try {
        await this.config.configManager.load();
      } catch (error) {
        // Config not found, continue with defaults
      }
    }
  }

  /**
   * Handle chat command
   */
  private async handleChat(argv: any): Promise<void> {
    this.config.logger.info('Starting chat session', 'CLI', {
      model: argv.model,
      mode: argv.mode,
      session: argv.session,
    });

    // Start interactive chat with all necessary dependencies
    await startInteractiveChat(
      {
        logger: this.config.logger,
        configManager: this.config.configManager,
        sessionManager: this.config.sessionManager!,
        modelRouter: this.config.modelRouter!,
        providerRegistry: this.config.providerRegistry!,
        commandRegistry: this.config.commandRegistry!,
      },
      {
        model: argv.model,
        mode: argv.mode,
        sessionId: argv.session,
        maxCost: argv.maxCost,
      }
    );
  }

  /**
   * Handle agent list command
   */
  private async handleAgentList(): Promise<void> {
    this.config.logger.info('Listing agents', 'CLI');

    const registry = getAgentRegistry();
    const lifecycleManager = getAgentLifecycleManager();

    const agents = registry.list();
    const stats = registry.getStatistics();

    console.log(chalk.cyan('Available Agents:'));
    console.log(chalk.gray(`Total: ${stats.totalAgents} | Active: ${stats.activeAgents} | Paused: ${stats.pausedAgents}\n`));

    if (agents.length === 0) {
      console.log(chalk.yellow('No agents registered'));
      return;
    }

    for (const agent of agents) {
      const state = lifecycleManager.getState(agent.id);
      const isActive = lifecycleManager.isActive(agent.id);

      const statusColor = isActive ? chalk.green : chalk.yellow;
      const statusText = state || 'unknown';

      console.log(`  ${chalk.cyan(agent.id)}`);
      console.log(`    ${chalk.gray('Name:')} ${agent.name}`);
      console.log(`    ${chalk.gray('Description:')} ${agent.description}`);
      console.log(`    ${chalk.gray('Capabilities:')} ${agent.capabilities.join(', ')}`);
      console.log(`    ${chalk.gray('Status:')} ${statusColor(statusText)}`);

      if (agent.dependencies && agent.dependencies.length > 0) {
        console.log(`    ${chalk.gray('Dependencies:')} ${agent.dependencies.join(', ')}`);
      }

      console.log('');
    }
  }

  /**
   * Handle agent info command
   */
  private async handleAgentInfo(argv: any): Promise<void> {
    this.config.logger.info('Showing agent info', 'CLI', { agentId: argv.agentId });

    const registry = getAgentRegistry();
    const lifecycleManager = getAgentLifecycleManager();

    const agent = registry.get(argv.agentId);

    if (!agent) {
      console.log(chalk.red(`Agent '${argv.agentId}' not found`));
      return;
    }

    const state = lifecycleManager.getState(agent.id);
    const instance = lifecycleManager.getInstance(agent.id);

    console.log(chalk.cyan(`Agent: ${agent.id}`));
    console.log('');
    console.log(`  ${chalk.gray('Name:')} ${agent.name}`);
    console.log(`  ${chalk.gray('Description:')} ${agent.description}`);
    console.log(`  ${chalk.gray('Capabilities:')} ${agent.capabilities.join(', ')}`);
    console.log(`  ${chalk.gray('System Prompt:')} ${agent.systemPrompt.substring(0, 100)}${agent.systemPrompt.length > 100 ? '...' : ''}`);
    console.log(`  ${chalk.gray('Status:')} ${state || 'unknown'}`);
    console.log(`  ${chalk.gray('Active:')} ${instance?.isActive ? chalk.green('Yes') : chalk.red('No')}`);

    if (agent.dependencies && agent.dependencies.length > 0) {
      console.log(`  ${chalk.gray('Dependencies:')} ${agent.dependencies.join(', ')}`);
    }

    if (instance) {
      console.log('');
      console.log(chalk.cyan('Execution Context:'));
      console.log(`  ${chalk.gray('Task History:')} ${instance.context.taskHistory.length} tasks`);
      console.log(`  ${chalk.gray('Context Data:')} ${instance.context.contextData.size} entries`);

      if (instance.context.currentTask) {
        console.log('');
        console.log(chalk.cyan('Current Task:'));
        console.log(`  ${chalk.gray('Description:')} ${instance.context.currentTask.description}`);
        if (instance.context.currentTask.requiredCapability) {
          console.log(`  ${chalk.gray('Required Capability:')} ${instance.context.currentTask.requiredCapability}`);
        }
      }
    }

    if (instance?.error) {
      console.log('');
      console.log(chalk.red('Error:'));
      console.log(`  ${instance.error.message}`);
    }
  }

  /**
   * Handle config show command
   */
  private async handleConfigShow(): Promise<void> {
    this.config.logger.info('Showing configuration', 'CLI');

    const config = this.config.configManager.getAll();
    console.log(chalk.cyan('Current Configuration:'));
    console.log(JSON.stringify(config, null, 2));
  }

  /**
   * Handle config set command
   */
  private async handleConfigSet(argv: any): Promise<void> {
    this.config.logger.info('Setting configuration', 'CLI', { key: argv.key, value: argv.value });

    // TODO: Implement config set
    console.log(chalk.yellow('Config set not yet implemented'));
  }

  /**
   * Handle config get command
   */
  private async handleConfigGet(argv: any): Promise<void> {
    this.config.logger.info('Getting configuration', 'CLI', { key: argv.key });

    // TODO: Implement config get
    console.log(chalk.yellow('Config get not yet implemented'));
  }

  /**
   * Handle config init command
   */
  private async handleConfigInit(): Promise<void> {
    this.config.logger.info('Initializing configuration', 'CLI');

    // TODO: Implement config init
    console.log(chalk.yellow('Config init not yet implemented'));
  }

  /**
   * Handle provider list command
   */
  private async handleProviderList(): Promise<void> {
    this.config.logger.info('Listing providers', 'CLI');

    console.log(chalk.cyan('Registered Providers:'));
    
    const providers = this.config.providerRegistry!.list();
    
    if (providers.length === 0) {
      console.log(chalk.yellow('No providers registered'));
      console.log('');
      console.log(chalk.gray('To register providers, ensure your configuration has API keys set.'));
      console.log(chalk.gray('Use: komplete-kontrol config show'));
      return;
    }

    for (const provider of providers) {
      const statusColor = provider.capabilities.streaming ? chalk.green : chalk.gray;
      const toolsStatus = provider.capabilities.tools ? chalk.green('Yes') : chalk.gray('No');
      const visionStatus = provider.capabilities.vision ? chalk.green('Yes') : chalk.gray('No');
      
      console.log('');
      console.log(`  ${chalk.cyan(provider.name)} [${chalk.gray(provider.prefix)}]`);
      console.log(`    ${chalk.gray('Streaming:')} ${statusColor(provider.capabilities.streaming ? 'Yes' : 'No')}`);
      console.log(`    ${chalk.gray('Tools:')} ${toolsStatus}`);
      console.log(`    ${chalk.gray('Vision:')} ${visionStatus}`);
      console.log(`    ${chalk.gray('Max Tokens:')} ${provider.capabilities.maxTokens.toLocaleString()}`);
      console.log(`    ${chalk.gray('Priority:')} ${provider.priority}`);
      console.log(`    ${chalk.gray('Registered:')} ${provider.registeredAt.toLocaleString()}`);
    }

    console.log('');
    console.log(chalk.gray('Model format: <prefix>/<model-name>'));
    console.log(chalk.gray('Examples:'));
    console.log(chalk.gray('  oai/gpt-4o'));
    console.log(chalk.gray('  anthropic/claude-3.5-sonnet'));
    console.log(chalk.gray('  ollama/llama3'));
  }

  /**
   * Handle provider test command
   */
  private async handleProviderTest(argv: any): Promise<void> {
    this.config.logger.info('Testing provider', 'CLI', { provider: argv.provider });

    console.log(chalk.cyan(`Testing provider: ${argv.provider}`));
    
    try {
      // Parse the provider prefix
      let prefix: string;
      if (argv.provider.includes('/')) {
        const parsed = this.config.modelRouter!.parseModel(argv.provider);
        prefix = parsed.prefix;
      } else {
        prefix = argv.provider;
      }

      // Get the provider from registry
      const provider = this.config.providerRegistry!.get(prefix as any);
      
      if (!provider) {
        console.log(chalk.red(`Provider '${argv.provider}' is not registered`));
        console.log('');
        console.log(chalk.gray('Available providers:'));
        const providers = this.config.providerRegistry!.list();
        providers.forEach(p => {
          console.log(chalk.gray(`  ${p.prefix} - ${p.name}`));
        });
        return;
      }

      console.log('');
      console.log(chalk.cyan(`Provider: ${provider.name}`));
      console.log(chalk.gray(`Prefix: ${provider.prefix}`));
      console.log(chalk.gray(`Streaming: ${provider.capabilities.streaming ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`Tools: ${provider.capabilities.tools ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`Vision: ${provider.capabilities.vision ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`Max Tokens: ${provider.capabilities.maxTokens.toLocaleString()}`));
      
      // Test token counting
      console.log('');
      console.log(chalk.cyan('Testing token counting...'));
      const testMessages: Message[] = [
        { role: 'user', content: { type: 'text', text: 'Hello, world!' } },
      ];
      const tokenCount = await provider.countTokens(testMessages);
      console.log(chalk.green(`✓ Token count: ${tokenCount}`));
      
      console.log('');
      console.log(chalk.green('Provider test successful!'));
      
    } catch (error) {
      console.log('');
      console.log(chalk.red(`Provider test failed: ${(error as Error).message}`));
      this.config.logger.error('Provider test failed', 'CLI', { error });
    }
  }

  /**
   * Handle session list command
   */
  private async handleSessionList(): Promise<void> {
    this.config.logger.info('Listing sessions', 'CLI');

    console.log(chalk.cyan('Sessions:'));
    
    const sessions = this.config.sessionManager!.listSessions();
    
    if (sessions.length === 0) {
      console.log(chalk.yellow('No sessions found'));
      return;
    }

    console.log(chalk.gray(`Total: ${sessions.length}\n`));

    const activeSession = this.config.sessionManager!.getActiveSession();

    sessions.forEach((session: Session, index: number) => {
      const isActive = activeSession?.id === session.id;
      const statusColor = isActive ? chalk.green : chalk.gray;
      console.log(`  ${chalk.cyan(`${index + 1}. ${session.id}`)}`);
      console.log(`    ${chalk.gray('Agent:')} ${session.agent || 'N/A'}`);
      console.log(`    ${chalk.gray('Model:')} ${session.model || 'N/A'}`);
      console.log(`    ${chalk.gray('Created:')} ${new Date(session.created).toLocaleString()}`);
      console.log(`    ${chalk.gray('Updated:')} ${new Date(session.updated).toLocaleString()}`);
      console.log(`    ${chalk.gray('Status:')} ${statusColor(isActive ? 'Active' : 'Inactive')}`);
      console.log(`    ${chalk.gray('Messages:')} ${session.messages.length}`);
      console.log(`    ${chalk.gray('Tokens:')} ${session.totalTokens ?? 0}`);
      console.log('');
    });
  }

  /**
   * Handle session show command
   */
  private async handleSessionShow(argv: any): Promise<void> {
    this.config.logger.info('Showing session', 'CLI', { sessionId: argv.sessionId });

    console.log(chalk.cyan(`Session: ${argv.sessionId}`));
    
    const session = await this.config.sessionManager!.getSession(argv.sessionId);
    
    if (!session) {
      console.log(chalk.red(`Session '${argv.sessionId}' not found`));
      return;
    }

    const activeSession = this.config.sessionManager!.getActiveSession();
    const isActive = activeSession?.id === session.id;

    console.log('');
    console.log(`  ${chalk.gray('Agent:')} ${session.agent || 'N/A'}`);
    console.log(`  ${chalk.gray('Model:')} ${session.model || 'N/A'}`);
    console.log(`  ${chalk.gray('Created:')} ${new Date(session.created).toLocaleString()}`);
    console.log(`  ${chalk.gray('Updated:')} ${new Date(session.updated).toLocaleString()}`);
    console.log(`  ${chalk.gray('Active:')} ${isActive ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`  ${chalk.gray('Messages:')} ${session.messages.length}`);
    console.log(`  ${chalk.gray('Total Tokens:')} ${session.totalTokens ?? 0}`);
    console.log('');
    console.log(chalk.cyan('Messages:'));
    
    session.messages.forEach((msg: { role: string; content: string }, index: number) => {
      const roleColor = msg.role === 'user' ? chalk.green :
                      msg.role === 'assistant' ? chalk.blue :
                      msg.role === 'system' ? chalk.yellow : chalk.gray;
      const preview = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
      console.log(`  ${index + 1}. ${roleColor(msg.role)}: ${preview}`);
    });
  }

  /**
   * Handle session create command
   */
  private async handleSessionCreate(argv: any): Promise<void> {
    this.config.logger.info('Creating session', 'CLI');

    console.log(chalk.cyan('Creating new session'));
    
    try {
      const session = await this.config.sessionManager!.createSession('New Session');
      console.log(chalk.green(`Session '${session.id}' created successfully`));
      console.log(chalk.gray(`Use 'session show ${session.id}' to view details`));
    } catch (error) {
      console.log(chalk.red(`Failed to create session: ${(error as Error).message}`));
    }
  }

  /**
   * Handle session delete command
   */
  private async handleSessionDelete(argv: any): Promise<void> {
    this.config.logger.info('Deleting session', 'CLI', { sessionId: argv.sessionId });

    console.log(chalk.cyan(`Deleting session: ${argv.sessionId}`));
    
    try {
      await this.config.sessionManager!.deleteSession(argv.sessionId);
      console.log(chalk.green(`Session '${argv.sessionId}' deleted successfully`));
    } catch (error) {
      console.log(chalk.red(`Failed to delete session '${argv.sessionId}': ${(error as Error).message}`));
    }
  }

  /**
   * Handle MCP list command
   */
  private async handleMCPList(): Promise<void> {
    this.config.logger.info('Listing MCP servers', 'CLI');

    const registry = getMCPRegistry();
    const servers = registry.list();
    const stats = registry.getStatistics();

    console.log(chalk.cyan('MCP Servers:'));
    console.log(chalk.gray(`Total: ${stats.totalServers} | Active: ${stats.activeServers}\n`));

    if (servers.length === 0) {
      console.log(chalk.yellow('No MCP servers registered'));
      console.log('');
      console.log(chalk.gray('To register servers, add them to your configuration file.'));
      console.log(chalk.gray('Example:'));
      console.log(chalk.gray('  mcp:'));
      console.log(chalk.gray('    servers:'));
      console.log(chalk.gray('      - id: echo-server'));
      console.log(chalk.gray('        name: Echo Server'));
      console.log(chalk.gray('        command: bun'));
      console.log(chalk.gray('        args: ["run", "src/mcp/servers/echo-server.ts"]'));
      return;
    }

    for (const server of servers) {
      const statusColor = server.status === 'running' ? chalk.green :
                       server.status === 'error' ? chalk.red :
                       chalk.gray;
      const statusText = server.status.toUpperCase();

      console.log(`  ${chalk.cyan(server.id)}`);
      console.log(`    ${chalk.gray('Name:')} ${server.config.name}`);
      console.log(`    ${chalk.gray('Command:')} ${server.config.command}`);
      if (server.config.args && server.config.args.length > 0) {
        console.log(`    ${chalk.gray('Args:')} ${server.config.args.join(' ')}`);
      }
      console.log(`    ${chalk.gray('Status:')} ${statusColor(statusText)}`);
      console.log(`    ${chalk.gray('Tools:')} ${server.tools.length}`);

      if (server.tools.length > 0) {
        for (const tool of server.tools) {
          console.log(`      ${chalk.gray('-')} ${tool.name}: ${tool.description}`);
        }
      }

      if (server.status === 'running' && server.pid) {
        console.log(`    ${chalk.gray('PID:')} ${server.pid}`);
      }

      if (server.lastError) {
        console.log(`    ${chalk.red('Error:')} ${server.lastError}`);
      }

      console.log('');
    }
  }

  /**
   * Handle MCP start command
   */
  private async handleMCPStart(argv: any): Promise<void> {
    this.config.logger.info('Starting MCP server', 'CLI', { serverId: argv.serverId });

    const registry = getMCPRegistry();
    const server = registry.get(argv.serverId);

    if (!server) {
      console.log(chalk.red(`MCP server '${argv.serverId}' not found`));
      console.log('');
      console.log(chalk.gray('Available servers:'));
      const servers = registry.list();
      if (servers.length === 0) {
        console.log(chalk.gray('  None'));
      } else {
        servers.forEach((s) => {
          console.log(chalk.gray(`  ${s.id} - ${s.config.name}`));
        });
      }
      return;
    }

    if (server.status === 'running') {
      console.log(chalk.yellow(`MCP server '${argv.serverId}' is already running`));
      console.log('');
      console.log(chalk.gray(`PID: ${server.pid}`));
      console.log(chalk.gray(`Tools: ${server.tools.length}`));
      return;
    }

    console.log(chalk.cyan(`Starting MCP server: ${argv.serverId}`));

    try {
      const client = await connectToMCPServer(argv.serverId, 30000, this.config.logger);

      console.log(chalk.green(`MCP server '${argv.serverId}' started successfully`));
      console.log('');
      console.log(chalk.gray('Server Information:'));
      console.log(chalk.gray(`  Name: ${server.config.name}`));
      console.log(chalk.gray(`  PID: ${client.getServerConfig()?.command}`));
      console.log(chalk.gray(`  Tools: ${client.getToolCount()}`));
      console.log('');
      console.log(chalk.gray('Available Tools:'));
      const tools = client.listTools();
      for (const tool of tools) {
        console.log(chalk.gray(`  ${tool.name}: ${tool.description}`));
      }

    } catch (error) {
      console.log('');
      console.log(chalk.red(`Failed to start MCP server '${argv.serverId}'`));
      console.log(chalk.red(`Error: ${(error as Error).message}`));
      this.config.logger.error('Failed to start MCP server', 'CLI', { error });
    }
  }

  /**
   * Handle MCP stop command
   */
  private async handleMCPStop(argv: any): Promise<void> {
    this.config.logger.info('Stopping MCP server', 'CLI', { serverId: argv.serverId });

    const registry = getMCPRegistry();
    const server = registry.get(argv.serverId);

    if (!server) {
      console.log(chalk.red(`MCP server '${argv.serverId}' not found`));
      return;
    }

    if (server.status !== 'running') {
      console.log(chalk.yellow(`MCP server '${argv.serverId}' is not running`));
      console.log(chalk.gray(`Current status: ${server.status}`));
      return;
    }

    console.log(chalk.cyan(`Stopping MCP server: ${argv.serverId}`));

    try {
      const client = createMCPClient({ serverId: argv.serverId }, this.config.logger);
      await client.disconnect();

      console.log(chalk.green(`MCP server '${argv.serverId}' stopped successfully`));

    } catch (error) {
      console.log('');
      console.log(chalk.red(`Failed to stop MCP server '${argv.serverId}'`));
      console.log(chalk.red(`Error: ${(error as Error).message}`));
      this.config.logger.error('Failed to stop MCP server', 'CLI', { error });
    }
  }

  /**
   * Handle context show command
   */
  private async handleContextShow(argv: any): Promise<void> {
    this.config.logger.info('Showing context', 'CLI', { sessionId: argv.sessionId });

    console.log(chalk.cyan(`Context for session: ${argv.sessionId}`));
    
    const session = await this.config.sessionManager!.getSession(argv.sessionId);
    
    if (!session) {
      console.log(chalk.red(`Session '${argv.sessionId}' not found`));
      return;
    }

    const contextWindow = createContextWindow({ maxTokens: 200000 });

    // Add session messages to context window
    session.messages.forEach(msg => {
      // Convert string content to MessageContent format
      const textContent: TextContent = { type: 'text', text: msg.content };
      contextWindow.addMessage({
        role: msg.role as MessageRole,
        content: textContent,
      });
    });

    // Calculate stats manually
    const messages = contextWindow.getMessages();
    const totalMessages = messages.length;
    const currentSize = contextWindow.getCurrentSize();
    const maxTokens = 200000; // Default max size
    const utilizationPercent = (currentSize / maxTokens) * 100;
    
    console.log('');
    console.log(`  ${chalk.gray('Current Size:')} ${currentSize.toLocaleString()} tokens`);
    console.log(`  ${chalk.gray('Max Size:')} ${maxTokens.toLocaleString()} tokens`);
    console.log(`  ${chalk.gray('Message Count:')} ${totalMessages}`);
    console.log(`  ${chalk.gray('Utilization:')} ${utilizationPercent.toFixed(1)}%`);
    console.log('');
    console.log(chalk.cyan('Messages:'));
    
    messages.forEach((msg: Message, index: number) => {
      const roleColor = msg.role === 'user' ? chalk.green :
                      msg.role === 'assistant' ? chalk.blue :
                      msg.role === 'system' ? chalk.yellow : chalk.gray;
      const preview = this.extractTextPreview(msg.content, 80);
      console.log(`  ${index + 1}. ${roleColor(msg.role)}: ${preview}`);
    });
  }

  /**
   * Handle context clear command
   */
  private async handleContextClear(argv: any): Promise<void> {
    this.config.logger.info('Clearing context', 'CLI', { sessionId: argv.sessionId });

    console.log(chalk.cyan(`Clearing context for session: ${argv.sessionId}`));
    
    const session = await this.config.sessionManager!.getSession(argv.sessionId);
    
    if (!session) {
      console.log(chalk.red(`Session '${argv.sessionId}' not found`));
      return;
    }

    // Clear messages from session
    await this.config.sessionManager!.clearMessages(argv.sessionId);
    
    console.log(chalk.green(`Context cleared for session '${argv.sessionId}'`));
  }

  /**
   * Handle memory show command
   */
  private async handleMemoryShow(): Promise<void> {
    this.config.logger.info('Showing memory file', 'CLI');

    console.log(chalk.cyan('.memory.md file:'));
    
    try {
      await this.config.memoryFileHandler!.load();
      const memoryFile = this.config.memoryFileHandler!.getMemory();
      
      console.log('');
      console.log(chalk.cyan('Frontmatter:'));
      console.log(`  ${chalk.gray('Version:')} ${memoryFile.frontmatter.version}`);
      console.log(`  ${chalk.gray('Created:')} ${new Date(memoryFile.frontmatter.created).toLocaleString()}`);
      console.log(`  ${chalk.gray('Updated:')} ${new Date(memoryFile.frontmatter.updated).toLocaleString()}`);
      console.log(`  ${chalk.gray('Project:')} ${memoryFile.frontmatter.project || 'N/A'}`);
      if (memoryFile.frontmatter.tags && memoryFile.frontmatter.tags.length > 0) {
        console.log(`  ${chalk.gray('Tags:')} ${memoryFile.frontmatter.tags.join(', ')}`);
      }
      console.log('');
      console.log(chalk.cyan('Sections:'));
      
      memoryFile.sections.forEach(section => {
        const priorityIndicator = section.priority ? ` [${section.priority}]` : '';
        console.log(`  ${chalk.cyan(section.name)}${priorityIndicator}`);
        if (section.content) {
          const preview = section.content.substring(0, 100) + (section.content.length > 100 ? '...' : '');
          console.log(`    ${chalk.gray(preview)}`);
        }
      });
      
    } catch (error) {
      console.log(chalk.yellow('No .memory.md file found in current directory'));
    }
  }

  /**
   * Handle memory edit command
   */
  private async handleMemoryEdit(): Promise<void> {
    this.config.logger.info('Editing memory file', 'CLI');

    console.log(chalk.cyan('Opening .memory.md for editing'));
    
    try {
      await this.config.memoryFileHandler!.load();
      const memoryFile = this.config.memoryFileHandler!.getMemory();
      
      console.log('');
      console.log(chalk.cyan('Current .memory.md sections:'));
      
      if (memoryFile.sections.length === 0) {
        console.log(chalk.yellow('No sections found. Creating default sections...'));
        // Create default sections for new memory file
        this.config.memoryFileHandler!.addSection('Project Context', 'Describe project context here...', 10);
        this.config.memoryFileHandler!.addSection('Key Decisions', 'Document key decisions made during development...', 10);
        this.config.memoryFileHandler!.addSection('Notes', 'Add any notes or reminders here...', 5);
        await this.config.memoryFileHandler!.save();
        console.log(chalk.green('Default sections created'));
      } else {
        memoryFile.sections.forEach(section => {
          const priorityIndicator = section.priority ? ` [${section.priority}]` : '';
          console.log(`  ${chalk.cyan(section.name)}${priorityIndicator}`);
        });
      }
      console.log('');
      console.log(chalk.yellow('To edit the memory file, modify .memory.md directly in your editor'));
      console.log(chalk.yellow('Or use memory add/update commands (coming soon)'));
    } catch (error) {
      console.log(chalk.red(`Error: ${(error as Error).message}`));
    }
  }

  /**
   * Handle budget show command
   */
  private async handleBudgetShow(): Promise<void> {
    this.config.logger.info('Showing budget status', 'CLI');

    console.log(chalk.cyan('Budget Status:'));
    
    const budgetStatus = this.config.tokenBudget!.getStatus();
    const config = this.config.tokenBudget!.getConfig();
    
    console.log('');
    console.log(chalk.cyan('Session Budget:'));
    console.log(`  ${chalk.gray('Limit:')} ${config.limit.toLocaleString()} tokens`);
    console.log(`  ${chalk.gray('Used:')} ${budgetStatus.used.toLocaleString()} tokens`);
    console.log(`  ${chalk.gray('Remaining:')} ${budgetStatus.remaining.toLocaleString()} tokens`);
    console.log(`  ${chalk.gray('Utilization:')} ${budgetStatus.percentUsed.toFixed(1)}%`);
    console.log(`  ${chalk.gray('Near Limit:')} ${budgetStatus.isNearLimit ? chalk.yellow('Yes') : chalk.gray('No')}`);
    console.log(`  ${chalk.gray('Over Budget:')} ${budgetStatus.isOverBudget ? chalk.red('Yes') : chalk.gray('No')}`);
  }

  /**
   * Handle budget reset command
   */
  private async handleBudgetReset(): Promise<void> {
    this.config.logger.info('Resetting budget', 'CLI');

    console.log(chalk.cyan('Resetting daily budget'));
    
    await this.config.tokenBudget!.reset();
    
    console.log(chalk.green('Budget reset successfully'));
  }

  /**
   * Handle parallel command
   */
  private async handleParallel(argv: any): Promise<void> {
    this.config.logger.info('Executing parallel tasks', 'CLI', {
      tasks: argv.tasks,
      file: argv.file,
    });

    console.log(chalk.cyan('Executing parallel tasks'));
    // TODO: Implement parallel execution
    console.log(chalk.yellow('Parallel execution not yet implemented'));
  }

  /**
   * Handle debug logs command
   */
  private async handleDebugLogs(): Promise<void> {
    this.config.logger.info('Showing logs', 'CLI');

    const logs = this.config.logger.getLogs();
    console.log(chalk.cyan('Recent Logs:'));
    logs.slice(-20).forEach((log) => {
      console.log(`[${log.timestamp.toISOString()}] ${LogLevel[log.level]}: ${log.message}`);
    });
  }

  /**
   * Handle debug status command
   */
  private async handleDebugStatus(): Promise<void> {
    this.config.logger.info('Showing system status', 'CLI');

    console.log(chalk.cyan('System Status:'));
    console.log(`  Version: 1.0.0`);
    console.log(`  Config path: ${this.config.configManager.getPath() || 'Not loaded'}`);
    console.log(`  Log level: ${LogLevel[this.config.logger.config.level]}`);
    console.log(chalk.yellow('Full status not yet implemented'));
  }

  /**
   * Handle vision capture command
   */
  private async handleVisionCapture(argv: any): Promise<void> {
    this.config.logger.info('Capturing page', 'CLI', { url: argv.url });

    console.log(chalk.cyan(`Capturing page: ${argv.url}`));
    console.log(chalk.gray(`Resolution: ${argv.width}x${argv.height}`));

    try {
      const capturer = createZeroDriftCapturer(this.config.logger);
      await capturer.initialize();

      const options: CaptureOptions = {
        url: argv.url,
        width: argv.width,
        height: argv.height,
        waitForIdle: argv.waitIdle,
        includeAccessibility: argv.accessibility,
      };

      console.log('');
      console.log(chalk.gray('Capturing...'));

      const result = await capturer.capture(options);

      // Shutdown is handled automatically or via close method if exists
      if ('close' in capturer && typeof (capturer as any).close === 'function') {
        await (capturer as any).close();
      }

      const output = {
        url: result.metadata.url,
        timestamp: result.metadata.timestamp,
        viewport: result.metadata.viewport,
        contentHash: result.metadata.contentHash,
        screenshot: result.screenshot,
        dom: result.dom,
        accessibilityTree: result.accessibilityTree,
      };

      if (argv.output) {
        await fs.writeFile(argv.output, JSON.stringify(output, null, 2));
        console.log(chalk.green(`✓ Capture saved to ${argv.output}`));
      } else {
        console.log('');
        console.log(chalk.cyan('Capture Result:'));
        console.log(`  ${chalk.gray('URL:')} ${result.metadata.url}`);
        console.log(`  ${chalk.gray('Timestamp:')} ${new Date(result.metadata.timestamp).toLocaleString()}`);
        console.log(`  ${chalk.gray('Viewport:')} ${result.metadata.viewport.width}x${result.metadata.viewport.height}`);
        console.log(`  ${chalk.gray('Content Hash:')} ${result.metadata.contentHash.substring(0, 16)}...`);
        console.log(`  ${chalk.gray('DOM Size:')} ${result.dom.length.toLocaleString()} bytes`);
        console.log(`  ${chalk.gray('Screenshot:')} ${result.screenshot.length.toLocaleString()} bytes (base64)`);
        if (result.accessibilityTree) {
          console.log(`  ${chalk.gray('Accessibility:')} ${JSON.stringify(result.accessibilityTree).length.toLocaleString()} bytes`);
        }
        console.log('');
        console.log(chalk.gray('Use --output to save to file'));
      }

    } catch (error) {
      console.log('');
      console.log(chalk.red(`Capture failed: ${(error as Error).message}`));
      this.config.logger.error('Vision capture failed', 'CLI', { error });
    }
  }

  /**
   * Handle vision extract command
   */
  private async handleVisionExtract(argv: any): Promise<void> {
    this.config.logger.info('Extracting DOM', 'CLI', { file: argv.htmlFile });

    console.log(chalk.cyan(`Extracting elements from: ${argv.htmlFile}`));
    console.log(chalk.gray(`Min Quality: ${argv.minQuality}, Max Elements: ${argv.maxElements}`));

    try {
      const htmlContent = await fs.readFile(argv.htmlFile, 'utf-8');

      const extractor = createDOMExtractor(this.config.logger);

      const options: ExtractionOptions = {
        minQuality: argv.minQuality,
        maxElements: argv.maxElements,
      };

      if (argv.focusTypes) {
        options.focusTypes = argv.focusTypes.split(',').map((t: string) => t.trim());
      }

      console.log('');
      console.log(chalk.gray('Extracting...'));

      const result = await extractor.extract(htmlContent, options);

      const output = {
        pageQuality: result.pageQuality,
        totalElements: result.elements.length,
        elements: result.elements,
        metadata: result.metadata,
      };

      if (argv.output) {
        await fs.writeFile(argv.output, JSON.stringify(output, null, 2));
        console.log(chalk.green(`✓ Extraction saved to ${argv.output}`));
      } else {
        console.log('');
        console.log(chalk.cyan('Extraction Result:'));
        console.log(`  ${chalk.gray('Page Quality:')} ${result.pageQuality.toFixed(1)}/100`);
        console.log(`  ${chalk.gray('Total Elements:')} ${result.elements.length}`);
        console.log('');
        console.log(chalk.cyan('Top Elements:'));

        result.elements.slice(0, 10).forEach((elem, index) => {
          const typeColor = elem.type === 'button' ? chalk.blue :
                          elem.type === 'a' ? chalk.cyan :
                          elem.type === 'input' ? chalk.magenta : chalk.gray;

          console.log(`  ${index + 1}. ${typeColor(elem.type)} [${chalk.yellow(elem.qualityScore.toFixed(1))}]`);
          console.log(`     ${chalk.gray('Selector:')} ${elem.selector}`);
          const textPreview = elem.text.substring(0, 60) + (elem.text.length > 60 ? '...' : '');
          if (elem.text) {
            console.log(`     ${chalk.gray('Text:')} ${textPreview}`);
          }
          if (elem.metadata.role) {
            console.log(`     ${chalk.gray('Role:')} ${elem.metadata.role}`);
          }
          console.log('');
        });

        if (result.elements.length > 10) {
          console.log(chalk.gray(`... and ${result.elements.length - 10} more elements`));
          console.log('');
        }

        console.log(chalk.gray('Use --output to save full results to file'));
      }

    } catch (error) {
      console.log('');
      console.log(chalk.red(`Extraction failed: ${(error as Error).message}`));
      this.config.logger.error('DOM extraction failed', 'CLI', { error });
    }
  }

  /**
   * Handle network analyze command
   */
  private async handleNetworkAnalyze(argv: any): Promise<void> {
    this.config.logger.info('Analyzing HAR file', 'CLI', { file: argv.harFile });

    console.log(chalk.cyan(`Analyzing HAR file: ${argv.harFile}`));

    try {
      const harContent = await fs.readFile(argv.harFile, 'utf-8');
      const harFile: HARFile = JSON.parse(harContent);

      const analyzer = createHARAnalyzer(this.config.logger);

      console.log('');
      console.log(chalk.gray('Analyzing...'));

      const result = await analyzer.analyze(harFile);

      const output = {
        endpoints: result.endpoints,
        performance: result.performance,
        resourceTypes: result.resourceTypes,
        domains: result.domains,
      };

      if (argv.output) {
        await fs.writeFile(argv.output, JSON.stringify(output, null, 2));
        console.log(chalk.green(`✓ Analysis saved to ${argv.output}`));
      } else {
        console.log('');
        console.log(chalk.cyan('Analysis Result:'));

        // Performance metrics
        if (argv.showPerformance) {
          console.log('');
          console.log(chalk.cyan('Performance:'));
          console.log(`  ${chalk.gray('Total Requests:')} ${result.performance.totalRequests}`);
          console.log(`  ${chalk.gray('Total Size:')} ${(result.performance.totalSize / 1024 / 1024).toFixed(2)} MB`);
          console.log(`  ${chalk.gray('Avg Response Time:')} ${result.performance.avgResponseTime.toFixed(0)}ms`);

          if (result.performance.timingBreakdown) {
            console.log('');
            console.log(chalk.cyan('  Timing Breakdown:'));
            console.log(`    ${chalk.gray('DNS:')} ${result.performance.timingBreakdown.dns.toFixed(0)}ms`);
            console.log(`    ${chalk.gray('Connect:')} ${result.performance.timingBreakdown.connect.toFixed(0)}ms`);
            console.log(`    ${chalk.gray('SSL:')} ${result.performance.timingBreakdown.ssl.toFixed(0)}ms`);
            console.log(`    ${chalk.gray('Send:')} ${result.performance.timingBreakdown.send.toFixed(0)}ms`);
            console.log(`    ${chalk.gray('Wait:')} ${result.performance.timingBreakdown.wait.toFixed(0)}ms`);
            console.log(`    ${chalk.gray('Receive:')} ${result.performance.timingBreakdown.receive.toFixed(0)}ms`);
          }

          if (result.performance.slowestRequests.length > 0) {
            console.log('');
            console.log(chalk.cyan('  Slowest Requests:'));
            result.performance.slowestRequests.slice(0, 5).forEach((req, i) => {
              console.log(`    ${i + 1}. ${chalk.gray(req.url.substring(0, 60))}${req.url.length > 60 ? '...' : ''}`);
              console.log(`       ${chalk.yellow(req.time.toFixed(0))}ms`);
            });
          }

          if (result.performance.failedRequests.length > 0) {
            console.log('');
            console.log(chalk.cyan('  Failed Requests:'));
            result.performance.failedRequests.slice(0, 5).forEach((req, i) => {
              console.log(`    ${i + 1}. ${chalk.red(req.status.toString())} ${chalk.gray(req.url.substring(0, 60))}${req.url.length > 60 ? '...' : ''}`);
            });
          }
        }

        // API endpoints
        if (argv.showEndpoints && result.endpoints.length > 0) {
          console.log('');
          console.log(chalk.cyan('API Endpoints:'));
          result.endpoints.slice(0, 10).forEach((endpoint, index) => {
            const methodColor = endpoint.method === 'GET' ? chalk.green :
                              endpoint.method === 'POST' ? chalk.blue :
                              endpoint.method === 'PUT' ? chalk.yellow :
                              endpoint.method === 'DELETE' ? chalk.red : chalk.gray;

            console.log(`  ${index + 1}. ${methodColor(endpoint.method)} ${endpoint.pattern}`);
            console.log(`     ${chalk.gray('Count:')} ${endpoint.count}, ${chalk.gray('Avg Time:')} ${endpoint.avgResponseTime.toFixed(0)}ms`);
            console.log(`     ${chalk.gray('Status:')} ${endpoint.statusCodes.join(', ')}, ${chalk.gray('Type:')} ${endpoint.contentType}`);
            console.log('');
          });

          if (result.endpoints.length > 10) {
            console.log(chalk.gray(`... and ${result.endpoints.length - 10} more endpoints`));
            console.log('');
          }
        }

        // Resource types
        if (argv.showResources) {
          console.log('');
          console.log(chalk.cyan('Resource Types:'));
          Object.entries(result.resourceTypes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([type, count]) => {
              console.log(`  ${chalk.gray(type)}: ${count}`);
            });
        }

        // Domains
        console.log('');
        console.log(chalk.cyan('Domains:'));
        result.domains.slice(0, 10).forEach((domain) => {
          console.log(`  ${chalk.gray(domain)}`);
        });

        if (result.domains.length > 10) {
          console.log(chalk.gray(`... and ${result.domains.length - 10} more domains`));
        }

        console.log('');
        console.log(chalk.gray('Use --output to save full results to file'));
      }

    } catch (error) {
      console.log('');
      console.log(chalk.red(`Analysis failed: ${(error as Error).message}`));
      this.config.logger.error('HAR analysis failed', 'CLI', { error });
    }
  }

  /**
   * Handle screenshot-to-code command
   */
  private async handleScreenshotToCode(argv: any): Promise<void> {
    this.config.logger.info('Screenshot-to-code conversion', 'CLI', {
      url: argv.url,
      stack: argv.stack,
    });

    console.log(chalk.cyan(`Converting ${argv.url} to code`));
    console.log(chalk.gray(`Stack: ${argv.stack}, Resolution: ${argv.width}x${argv.height}`));

    try {
      // Step 1: Capture screenshot
      console.log('');
      console.log(chalk.gray('Step 1/2: Capturing screenshot...'));

      const capturer = createZeroDriftCapturer(this.config.logger);
      await capturer.initialize();

      const capture = await capturer.capture({
        url: argv.url,
        width: argv.width,
        height: argv.height,
        waitForIdle: true,
      });

      if ('close' in capturer && typeof (capturer as any).close === 'function') {
        await (capturer as any).close();
      }

      console.log(chalk.green('✓ Screenshot captured'));

      // Step 2: Generate code
      console.log('');
      console.log(chalk.gray('Step 2/2: Generating code with AI...'));

      // Get vision-capable provider
      const modelString = argv.model || 'anthropic/claude-3.5-sonnet';
      const parsed = this.config.modelRouter!.parseModel(modelString);
      const provider = this.config.providerRegistry!.get(parsed.prefix as any);

      if (!provider) {
        throw new Error(`Provider '${parsed.prefix}' not found`);
      }

      if (!provider.getCapabilities().vision) {
        throw new Error(`Provider '${parsed.prefix}' does not support vision`);
      }

      const converter = createScreenshotToCodeConverter(provider, this.config.logger);

      const options: GenerateCodeOptions = {
        stack: argv.stack as CodeStack,
        model: parsed.model,
        instructions: argv.instructions,
        responsive: argv.responsive,
        includeAccessibility: argv.accessibility,
      };

      const result = await converter.generateCodeFromCapture(capture, options);

      console.log(chalk.green('✓ Code generated'));

      // Output result
      if (argv.output) {
        await fs.writeFile(argv.output, result.code);
        console.log('');
        console.log(chalk.green(`✓ Code saved to ${argv.output}`));
        console.log('');
        console.log(chalk.gray('Generation Stats:'));
        console.log(`  ${chalk.gray('Stack:')} ${result.stack}`);
        console.log(`  ${chalk.gray('Model:')} ${result.model}`);
        console.log(`  ${chalk.gray('Code Size:')} ${result.code.length.toLocaleString()} bytes`);
        console.log(`  ${chalk.gray('Duration:')} ${result.metadata.durationMs.toLocaleString()}ms`);
        if (result.metadata.tokenUsage) {
          console.log(`  ${chalk.gray('Tokens:')} ${result.metadata.tokenUsage.input + result.metadata.tokenUsage.output} (${result.metadata.tokenUsage.input} in, ${result.metadata.tokenUsage.output} out)`);
        }
      } else {
        console.log('');
        console.log(chalk.cyan('Generated Code:'));
        console.log('');
        console.log(result.code);
        console.log('');
        console.log(chalk.gray('Use --output to save to file'));
      }
    } catch (error) {
      console.log('');
      console.log(chalk.red(`Conversion failed: ${(error as Error).message}`));
      this.config.logger.error('Screenshot-to-code failed', 'CLI', { error });
    }
  }

  /**
   * Extract text preview from message content
   */
  private extractTextPreview(content: Message['content'], maxLength: number): string {
    const text = this.extractTextContent(content);
    return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  /**
   * Extract text content from message content
   */
  private extractTextContent(content: Message['content']): string {
    // Helper function to extract text from a single MessageContent item
    const extractFromItem = (item: string | { type: string; [key: string]: any }): string => {
      // Handle string case (legacy support)
      if (typeof item === 'string') {
        return item;
      }

      // Type guards for MessageContent subtypes
      if (item.type === 'text') {
        return item.text || '';
      }
      if (item.type === 'image') {
        return '[Image]';
      }
      if (item.type === 'tool_use') {
        return `Tool: ${item.name || 'unknown'}`;
      }
      if (item.type === 'tool_result') {
        const resultContent = item.content;
        if (typeof resultContent === 'string') {
          return `Result: ${resultContent}`;
        }
        if (Array.isArray(resultContent)) {
          return `Result: ${resultContent.map(extractFromItem).join(' ')}`;
        }
        return 'Result';
      }

      return '';
    };

    // Handle array of MessageContent
    if (Array.isArray(content)) {
      return content.map(extractFromItem).join(' ');
    }

    // Handle single MessageContent (object)
    if (typeof content === 'object' && content !== null) {
      return extractFromItem(content);
    }

    // Handle string content
    return content;
  }

  /**
   * Handle slash command
   */
  private async handleSlashCommand(argv: any): Promise<void> {
    const commandName = argv.command;
    const args = argv.args ? argv.args.split(' ') : [];

    this.config.logger.info('Executing slash command', 'CLI', { command: commandName, args });

    console.log(chalk.cyan(`Executing slash command: ${commandName}`));

    try {
      const resolution = this.config.commandRegistry!.resolveCommand(commandName);
      const result = await this.config.commandRegistry!.executeCommand(
        resolution.command,
        {
          cwd: process.cwd(),
          sessionId: this.config.sessionManager!.getActiveSession()?.id,
          arguments: resolution.arguments,
        }
      );

      if (result.success) {
        console.log(chalk.green('Command executed successfully'));
        if (result.output) {
          console.log(result.output);
        }
      } else {
        console.log(chalk.red(`Command failed: ${result.error}`));
      }

      if (result.metadata) {
        this.config.logger.debug('Command metadata', 'CLI', result.metadata);
      }
    } catch (error) {
      console.log(chalk.red(`Error executing command: ${(error as Error).message}`));
      this.config.logger.error('Slash command error', 'CLI', { error });
    }
  }
}

/**
 * Create CLI instance
 */
export function createCLI(logger?: Logger, configManager?: ConfigManager): CLI {
  const cliLogger = logger ?? new Logger();
  const cliConfigManager = configManager ?? new ConfigManager(cliLogger);
  return new CLI({ logger: cliLogger, configManager: cliConfigManager });
}

/**
 * Run CLI
 */
export async function runCLI(): Promise<void> {
  console.log('[DEBUG] runCLI called');
  const logger = new Logger();
  const configManager = new ConfigManager(logger);

  try {
    await configManager.load();
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not load configuration. Using defaults.'));
  }

  // Initialize test agents
  try {
    await initializeTestAgents();
    logger.info('Test agents initialized', 'CLI');
  } catch (error) {
    logger.warn('Failed to initialize test agents', 'CLI', { error });
  }

  // Initialize providers with configuration
  try {
    const config = configManager.getAll();
    await initializeProviders(
      {
        openai: {
          apiKey: config.openai?.apiKey || process.env.OPENAI_API_KEY,
          baseUrl: config.openai?.baseUrl,
          defaultModel: config.openai?.defaultModel,
        },
        anthropic: {
          apiKey: config.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
          baseUrl: config.anthropic?.baseUrl,
          defaultModel: config.anthropic?.defaultModel,
        },
        ollama: {
          baseUrl: config.ollama?.baseUrl || 'http://localhost:11434',
          defaultModel: config.ollama?.defaultModel,
        },
      },
      logger
    );
    logger.info('Providers initialized', 'CLI');
  } catch (error) {
    logger.warn('Failed to initialize providers', 'CLI', { error });
  }

  // Load MCP servers from configuration
  try {
    const config = configManager.getAll();
    const mcpRegistry = getMCPRegistry();
    if (config.mcp?.servers && config.mcp.servers.length > 0) {
      mcpRegistry.loadFromConfig(config.mcp.servers);
      logger.info('MCP servers loaded from configuration', 'CLI', {
        count: config.mcp.servers.length,
      });
    }
  } catch (error) {
    logger.warn('Failed to load MCP servers from configuration', 'CLI', { error });
  }

  const cli = createCLI(logger, configManager);
  await cli.initialize();
  await cli.parse();
}
