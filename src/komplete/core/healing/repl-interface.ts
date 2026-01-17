/**
 * REPL Interface
 *
 * Interactive Read-Eval-Print Loop for code execution with
 * runtime supervision, error handling, and state management.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../../utils/logger';
import type { ExecutionResult, ErrorInfo } from './loop';

/**
 * REPL mode
 */
export enum REPLMode {
  /**
   * Interactive mode - user input required
   */
  INTERACTIVE = 'interactive',

  /**
   * Batch mode - execute multiple statements
   */
  BATCH = 'batch',

  /**
   * Script mode - execute full script
   */
  SCRIPT = 'script',

  /**
   * Debug mode - step-by-step execution
   */
  DEBUG = 'debug',
}

/**
 * REPL state
 */
export interface REPLState {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Current mode
   */
  mode: REPLMode;

  /**
   * Execution context
   */
  context: Record<string, unknown>;

  /**
   * Command history
   */
  history: string[];

  /**
   * Current line number
   */
  lineNumber: number;

  /**
   * Is running
   */
  isRunning: boolean;

  /**
   * Last result
   */
  lastResult?: unknown;

  /**
   * Last error
   */
  lastError?: ErrorInfo;

  /**
   * Start time
   */
  startTime: number;

  /**
   * Variables in scope
   */
  variables: Map<string, unknown>;

  /**
   * Breakpoints (for debug mode)
   */
  breakpoints: Set<number>;
}

/**
 * REPL command
 */
export interface REPLCommand {
  /**
   * Command name
   */
  name: string;

  /**
   * Command aliases
   */
  aliases: string[];

  /**
   * Command description
   */
  description: string;

  /**
   * Command handler
   */
  handler: (args: string[], state: REPLState) => Promise<unknown>;
}

/**
 * REPL options
 */
export interface REPLOptions {
  /**
   * Initial mode
   */
  mode?: REPLMode;

  /**
   * Enable history
   */
  enableHistory?: boolean;

  /**
   * History size
   */
  historySize?: number;

  /**
   * Timeout (ms)
   */
  timeout?: number;

  /**
   * Working directory
   */
  workingDirectory?: string;

  /**
   * Language
   */
  language?: string;

  /**
   * Auto-save session
   */
  autoSave?: boolean;

  /**
   * Show prompts
   */
  showPrompts?: boolean;

  /**
   * Custom commands
   */
  customCommands?: REPLCommand[];
}

/**
 * REPL result
 */
export interface REPLResult {
  /**
   * Success
   */
  success: boolean;

  /**
   * Result value
   */
  value?: unknown;

  /**
   * Error
   */
  error?: ErrorInfo;

  /**
   * Execution time
   */
  executionTime: number;

  /**
   * Output
   */
  output: string;
}

/**
 * REPL Interface class
 *
 * Provides interactive REPL for code execution with supervision.
 */
export class REPLInterface {
  private logger: LoggerLike;
  private state: REPLState;
  private options: Required<REPLOptions>;
  private commands: Map<string, REPLCommand> = new Map();
  private isInitialized: boolean = false;

  constructor(options: REPLOptions = {}) {
    this.logger = new Logger();

    this.options = {
      mode: options.mode || REPLMode.INTERACTIVE,
      enableHistory: options.enableHistory ?? true,
      historySize: options.historySize || 1000,
      timeout: options.timeout || 30000,
      workingDirectory: options.workingDirectory || process.cwd(),
      language: options.language || 'typescript',
      autoSave: options.autoSave ?? true,
      showPrompts: options.showPrompts ?? true,
      customCommands: options.customCommands || [],
    };

    this.state = this.createInitialState();
    this.registerBuiltinCommands();
    this.registerCustomCommands();

    this.logger.info('REPLInterface initialized', 'REPLInterface');
  }

  /**
   * Initialize REPL
   *
   * @returns Success
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      this.state.isRunning = true;
      this.state.startTime = Date.now();
      this.isInitialized = true;

      this.logger.info('REPL session started', 'REPLInterface', {
        sessionId: this.state.sessionId,
        mode: this.state.mode,
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize REPL', 'REPLInterface', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Execute code in REPL
   *
   * @param code - Code to execute
   * @returns REPL result
   */
  async execute(code: string): Promise<REPLResult> {
    const startTime = Date.now();

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Add to history
      if (this.options.enableHistory) {
        this.addToHistory(code);
      }

      // Increment line number
      this.state.lineNumber++;

      // Check for REPL commands
      if (code.trim().startsWith('.')) {
        return await this.executeCommand(code.trim());
      }

      // Execute code
      const result = await this.executeCode(code);

      // Update state
      this.state.lastResult = result.value;

      return result;
    } catch (error) {
      const errorInfo: ErrorInfo = {
        message: (error as Error).message,
        type: (error as Error).name,
        timestamp: Date.now(),
      };

      this.state.lastError = errorInfo;

      return {
        success: false,
        error: errorInfo,
        executionTime: Date.now() - startTime,
        output: '',
      };
    }
  }

  /**
   * Execute batch of statements
   *
   * @param statements - Array of code statements
   * @returns Array of results
   */
  async executeBatch(statements: string[]): Promise<REPLResult[]> {
    const results: REPLResult[] = [];

    for (const statement of statements) {
      const result = await this.execute(statement);
      results.push(result);

      // Stop on error
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute script
   *
   * @param script - Full script
   * @returns Execution result
   */
  async executeScript(script: string): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Write script to temporary file
      const ext = this.getExtension(this.options.language);
      const tempFile = `/tmp/repl-script-${Date.now()}${ext}`;
      await Bun.write(tempFile, script);

      // Execute the script
      const proc = Bun.spawn({
        cmd: ['bun', 'run', tempFile],
        cwd: this.options.workingDirectory,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      const exitCode = await proc.exited;

      // Clean up
      await Bun.file(tempFile).delete();

      const executionTime = Date.now() - startTime;

      return {
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        stdout: '',
        stderr: (error as Error).message,
        executionTime,
        error: error as Error,
      };
    }
  }

  /**
   * Get REPL state
   *
   * @returns Current state
   */
  getState(): REPLState {
    return { ...this.state };
  }

  /**
   * Get command history
   *
   * @param limit - Maximum number of items
   * @returns History array
   */
  getHistory(limit?: number): string[] {
    if (limit) {
      return this.state.history.slice(-limit);
    }
    return [...this.state.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.history = [];
    this.logger.debug('History cleared', 'REPLInterface');
  }

  /**
   * Set variable in REPL context
   *
   * @param name - Variable name
   * @param value - Variable value
   */
  setVariable(name: string, value: unknown): void {
    this.state.variables.set(name, value);
    this.state.context[name] = value;
  }

  /**
   * Get variable from REPL context
   *
   * @param name - Variable name
   * @returns Variable value or undefined
   */
  getVariable(name: string): unknown {
    return this.state.variables.get(name);
  }

  /**
   * Get all variables
   *
   * @returns Map of variables
   */
  getAllVariables(): Map<string, unknown> {
    return new Map(this.state.variables);
  }

  /**
   * Add breakpoint (debug mode)
   *
   * @param lineNumber - Line number
   */
  addBreakpoint(lineNumber: number): void {
    this.state.breakpoints.add(lineNumber);
    this.logger.debug(`Breakpoint added at line ${lineNumber}`, 'REPLInterface');
  }

  /**
   * Remove breakpoint
   *
   * @param lineNumber - Line number
   */
  removeBreakpoint(lineNumber: number): void {
    this.state.breakpoints.delete(lineNumber);
    this.logger.debug(`Breakpoint removed at line ${lineNumber}`, 'REPLInterface');
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.state.breakpoints.clear();
    this.logger.debug('All breakpoints cleared', 'REPLInterface');
  }

  /**
   * Change REPL mode
   *
   * @param mode - New mode
   */
  setMode(mode: REPLMode): void {
    this.state.mode = mode;
    this.logger.info(`REPL mode changed to ${mode}`, 'REPLInterface');
  }

  /**
   * Reset REPL state
   */
  reset(): void {
    this.state = this.createInitialState();
    this.logger.info('REPL state reset', 'REPLInterface');
  }

  /**
   * Stop REPL
   */
  stop(): void {
    this.state.isRunning = false;
    this.isInitialized = false;
    this.logger.info('REPL session stopped', 'REPLInterface');
  }

  /**
   * Create initial state
   *
   * @returns Initial REPL state
   */
  private createInitialState(): REPLState {
    return {
      sessionId: `repl_${Date.now()}`,
      mode: this.options.mode,
      context: {},
      history: [],
      lineNumber: 0,
      isRunning: false,
      startTime: Date.now(),
      variables: new Map(),
      breakpoints: new Set(),
    };
  }

  /**
   * Execute code
   *
   * @param code - Code to execute
   * @returns REPL result
   */
  private async executeCode(code: string): Promise<REPLResult> {
    const startTime = Date.now();

    try {
      // Create isolated execution context
      const func = new Function(...Object.keys(this.state.context), `return ${code}`);
      const result = func(...Object.values(this.state.context));

      return {
        success: true,
        value: result,
        executionTime: Date.now() - startTime,
        output: String(result),
      };
    } catch (error) {
      // If expression evaluation fails, try as statement
      try {
        const func = new Function(...Object.keys(this.state.context), code);
        func(...Object.values(this.state.context));

        return {
          success: true,
          executionTime: Date.now() - startTime,
          output: '',
        };
      } catch (statementError) {
        const errorInfo: ErrorInfo = {
          message: (statementError as Error).message,
          type: (statementError as Error).name,
          timestamp: Date.now(),
        };

        return {
          success: false,
          error: errorInfo,
          executionTime: Date.now() - startTime,
          output: '',
        };
      }
    }
  }

  /**
   * Execute REPL command
   *
   * @param commandLine - Command line
   * @returns REPL result
   */
  private async executeCommand(commandLine: string): Promise<REPLResult> {
    const startTime = Date.now();

    const parts = commandLine.slice(1).split(/\s+/);
    const commandName = parts[0]!.toLowerCase();
    const args = parts.slice(1);

    const command = this.commands.get(commandName);

    if (!command) {
      return {
        success: false,
        error: {
          message: `Unknown command: ${commandName}`,
          type: 'CommandError',
          timestamp: Date.now(),
        },
        executionTime: Date.now() - startTime,
        output: '',
      };
    }

    try {
      const result = await command.handler(args, this.state);

      return {
        success: true,
        value: result,
        executionTime: Date.now() - startTime,
        output: String(result || ''),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: (error as Error).message,
          type: (error as Error).name,
          timestamp: Date.now(),
        },
        executionTime: Date.now() - startTime,
        output: '',
      };
    }
  }

  /**
   * Add code to history
   *
   * @param code - Code to add
   */
  private addToHistory(code: string): void {
    this.state.history.push(code);

    // Trim history if needed
    if (this.state.history.length > this.options.historySize) {
      this.state.history = this.state.history.slice(-this.options.historySize);
    }
  }

  /**
   * Register builtin commands
   */
  private registerBuiltinCommands(): void {
    // .help command
    this.commands.set('help', {
      name: 'help',
      aliases: ['h', '?'],
      description: 'Show available commands',
      handler: async () => {
        const commands = Array.from(this.commands.values());
        return commands.map((cmd) => `${cmd.name}: ${cmd.description}`).join('\n');
      },
    });

    // .clear command
    this.commands.set('clear', {
      name: 'clear',
      aliases: ['c'],
      description: 'Clear REPL state',
      handler: async () => {
        this.reset();
        return 'REPL state cleared';
      },
    });

    // .history command
    this.commands.set('history', {
      name: 'history',
      aliases: ['hist'],
      description: 'Show command history',
      handler: async (args) => {
        const limit = args[0] ? parseInt(args[0], 10) : undefined;
        return this.getHistory(limit).join('\n');
      },
    });

    // .vars command
    this.commands.set('vars', {
      name: 'vars',
      aliases: ['variables'],
      description: 'Show all variables',
      handler: async () => {
        const vars = Array.from(this.state.variables.entries());
        return vars.map(([name, value]) => `${name} = ${JSON.stringify(value)}`).join('\n');
      },
    });

    // .mode command
    this.commands.set('mode', {
      name: 'mode',
      aliases: ['m'],
      description: 'Change REPL mode',
      handler: async (args) => {
        if (args.length === 0) {
          return `Current mode: ${this.state.mode}`;
        }

        const mode = args[0]!.toLowerCase() as REPLMode;
        if (Object.values(REPLMode).includes(mode)) {
          this.setMode(mode);
          return `Mode changed to: ${mode}`;
        }

        return `Invalid mode: ${args[0]}`;
      },
    });

    // .break command (debug mode)
    this.commands.set('break', {
      name: 'break',
      aliases: ['b', 'breakpoint'],
      description: 'Add breakpoint at line',
      handler: async (args) => {
        if (args.length === 0) {
          return 'Usage: .break <line>';
        }

        const lineNumber = parseInt(args[0]!, 10);
        this.addBreakpoint(lineNumber);
        return `Breakpoint added at line ${lineNumber}`;
      },
    });

    // .exit command
    this.commands.set('exit', {
      name: 'exit',
      aliases: ['quit', 'q'],
      description: 'Exit REPL',
      handler: async () => {
        this.stop();
        return 'REPL stopped';
      },
    });
  }

  /**
   * Register custom commands
   */
  private registerCustomCommands(): void {
    for (const command of this.options.customCommands) {
      this.commands.set(command.name, command);

      // Register aliases
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }
  }

  /**
   * Get file extension for language
   *
   * @param language - Language name
   * @returns File extension
   */
  private getExtension(language: string): string {
    const extMap: Record<string, string> = {
      typescript: '.ts',
      javascript: '.js',
      python: '.py',
      go: '.go',
      rust: '.rs',
      java: '.java',
    };

    return extMap[language.toLowerCase()] || '.ts';
  }
}

/**
 * Schema for REPL options
 */
export const REPLOptionsSchema = z.object({
  mode: z.nativeEnum(REPLMode).optional(),
  enableHistory: z.boolean().optional(),
  historySize: z.number().min(1).max(10000).optional(),
  timeout: z.number().min(1000).optional(),
  workingDirectory: z.string().optional(),
  language: z.string().optional(),
  autoSave: z.boolean().optional(),
  showPrompts: z.boolean().optional(),
  customCommands: z.array(z.any()).optional(),
});

/**
 * Global REPL interface instance
 */
let globalREPLInterface: REPLInterface | null = null;

/**
 * Initialize global REPL interface
 *
 * @param options - Options
 * @returns The global REPL interface
 */
export function initREPLInterface(options?: REPLOptions): REPLInterface {
  globalREPLInterface = new REPLInterface(options);
  return globalREPLInterface;
}

/**
 * Get global REPL interface
 *
 * @returns The global REPL interface
 */
export function getREPLInterface(): REPLInterface {
  if (!globalREPLInterface) {
    globalREPLInterface = new REPLInterface();
  }
  return globalREPLInterface;
}
