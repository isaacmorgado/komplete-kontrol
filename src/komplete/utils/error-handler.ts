/**
 * Error handling framework for KOMPLETE-KONTROL CLI
 * 
 * Provides centralized error handling, recovery strategies, and user-friendly error messages.
 */

import chalk from 'chalk';
import { KompleteError, ProviderError, AgentError, ContextError, ConfigError, ToolError, ModeError } from '../types';
import { Logger, LoggerLike } from './logger';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error recovery strategy
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  ABORT = 'abort',
  CONTINUE = 'continue',
}

/**
 * Error context
 */
interface ErrorContext {
  operation?: string;
  component?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Error handler configuration
 */
interface ErrorHandlerConfig {
  logger?: LoggerLike;
  verbose?: boolean;
  exitOnCritical?: boolean;
}

/**
 * Recovery suggestion for an error
 */
export interface RecoverySuggestion {
  /** Short description of the action to take */
  action: string;
  /** Detailed explanation of why this helps */
  explanation: string;
  /** Whether this can be auto-applied */
  autoApplicable: boolean;
  /** Command or code snippet to apply the fix (if applicable) */
  command?: string;
  /** Priority (1 = highest, try first) */
  priority: number;
}

/**
 * Error code to recovery suggestions mapping
 */
const ERROR_RECOVERY_SUGGESTIONS: Record<string, RecoverySuggestion[]> = {
  // Provider errors
  PROVIDER_ERROR: [
    {
      action: 'Check API key configuration',
      explanation: 'Ensure your API key is valid and properly set in the configuration file or environment variables.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Try a fallback provider',
      explanation: 'Switch to an alternative provider if available in your configuration.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Retry the request',
      explanation: 'The error may be transient. Wait a moment and retry.',
      autoApplicable: true,
      priority: 3,
    },
  ],
  RATE_LIMIT_ERROR: [
    {
      action: 'Wait and retry',
      explanation: 'You have exceeded the rate limit. Wait for the cooldown period before retrying.',
      autoApplicable: true,
      command: 'sleep 60',
      priority: 1,
    },
    {
      action: 'Use a different model',
      explanation: 'Switch to a model with higher rate limits or lower usage.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Upgrade your API plan',
      explanation: 'Consider upgrading to a higher tier with increased rate limits.',
      autoApplicable: false,
      priority: 3,
    },
  ],
  AUTH_ERROR: [
    {
      action: 'Verify API key',
      explanation: 'Check that your API key is correctly set and has not expired.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Regenerate API key',
      explanation: 'Generate a new API key from the provider dashboard.',
      autoApplicable: false,
      priority: 2,
    },
    {
      action: 'Check environment variables',
      explanation: 'Ensure KOMPLETE_*_API_KEY environment variables are properly exported.',
      autoApplicable: false,
      command: 'export KOMPLETE_OPENAI_API_KEY=your-key',
      priority: 3,
    },
  ],

  // Tool errors
  TOOL_ERROR: [
    {
      action: 'Check tool parameters',
      explanation: 'Verify the parameters passed to the tool match its expected schema.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Retry with different arguments',
      explanation: 'The tool may have failed due to invalid or edge-case input.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Check tool availability',
      explanation: 'Ensure the tool is properly registered and its dependencies are installed.',
      autoApplicable: false,
      priority: 3,
    },
  ],
  TOOL_TIMEOUT: [
    {
      action: 'Increase timeout',
      explanation: 'The tool took longer than expected. Consider increasing the timeout setting.',
      autoApplicable: true,
      priority: 1,
    },
    {
      action: 'Simplify the operation',
      explanation: 'Break down the operation into smaller, faster steps.',
      autoApplicable: false,
      priority: 2,
    },
    {
      action: 'Check resource availability',
      explanation: 'Ensure system resources (CPU, memory, network) are not constrained.',
      autoApplicable: false,
      priority: 3,
    },
  ],
  TOOL_NOT_FOUND: [
    {
      action: 'Check tool name spelling',
      explanation: 'Verify the tool name is spelled correctly and matches registration.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Register the tool',
      explanation: 'The tool may not be registered. Add it to your tool configuration.',
      autoApplicable: false,
      priority: 2,
    },
    {
      action: 'Check MCP server status',
      explanation: 'If this is an MCP tool, ensure the MCP server is running.',
      autoApplicable: false,
      command: 'kk mcp status',
      priority: 3,
    },
  ],

  // Mode errors
  MODE_ERROR: [
    {
      action: 'Verify mode name',
      explanation: 'Ensure the mode name is valid: architect, code, debug, test, reverse-engineer, or ask.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Check mode configuration',
      explanation: 'Verify the mode is properly configured in your config file.',
      autoApplicable: false,
      priority: 2,
    },
    {
      action: 'Reset to default mode',
      explanation: 'Fall back to the default mode (code) if the requested mode is unavailable.',
      autoApplicable: true,
      command: 'kk mode code',
      priority: 3,
    },
  ],
  MODE_TRANSITION_ERROR: [
    {
      action: 'Complete pending operations',
      explanation: 'Finish any ongoing operations before switching modes.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Force mode switch',
      explanation: 'Use --force flag to switch modes regardless of pending state.',
      autoApplicable: false,
      command: 'kk mode <mode> --force',
      priority: 2,
    },
  ],

  // Config errors
  CONFIG_ERROR: [
    {
      action: 'Validate configuration file',
      explanation: 'Check your config file for syntax errors or invalid values.',
      autoApplicable: false,
      command: 'kk config validate',
      priority: 1,
    },
    {
      action: 'Reset to defaults',
      explanation: 'Initialize a fresh configuration with default values.',
      autoApplicable: true,
      command: 'kk config init --force',
      priority: 2,
    },
    {
      action: 'Check file permissions',
      explanation: 'Ensure the config file is readable and writable.',
      autoApplicable: false,
      priority: 3,
    },
  ],

  // Context errors
  CONTEXT_ERROR: [
    {
      action: 'Clear context',
      explanation: 'Start fresh with a new context if the current one is corrupted.',
      autoApplicable: true,
      command: 'kk context clear',
      priority: 1,
    },
    {
      action: 'Reduce context size',
      explanation: 'The context may have exceeded limits. Try condensing it.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Check session validity',
      explanation: 'Ensure the session ID is valid and the session exists.',
      autoApplicable: false,
      priority: 3,
    },
  ],

  // Agent errors
  AGENT_ERROR: [
    {
      action: 'Check agent configuration',
      explanation: 'Verify the agent is properly configured with valid settings.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Restart agent',
      explanation: 'Stop and restart the agent to clear any stuck state.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Check agent dependencies',
      explanation: 'Ensure all required tools and providers are available for the agent.',
      autoApplicable: false,
      priority: 3,
    },
  ],

  // Network errors
  NETWORK_ERROR: [
    {
      action: 'Check internet connection',
      explanation: 'Verify you have a stable internet connection.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Retry the request',
      explanation: 'Network issues are often transient. Try again.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Check firewall settings',
      explanation: 'Ensure outbound connections to API endpoints are not blocked.',
      autoApplicable: false,
      priority: 3,
    },
  ],

  // Default recovery suggestions for unknown errors
  UNKNOWN_ERROR: [
    {
      action: 'Check error details',
      explanation: 'Review the error message and stack trace for more information.',
      autoApplicable: false,
      priority: 1,
    },
    {
      action: 'Retry the operation',
      explanation: 'The error may be transient. Try the operation again.',
      autoApplicable: true,
      priority: 2,
    },
    {
      action: 'Report the issue',
      explanation: 'If the error persists, report it with full details.',
      autoApplicable: false,
      priority: 3,
    },
  ],
};

/**
 * Error handler class
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorCounts: Map<string, number> = new Map();
  private maxRetries: number = 3;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      logger: config.logger,
      verbose: config.verbose ?? false,
      exitOnCritical: config.exitOnCritical ?? true,
    };
  }

  /**
   * Get error severity
   */
  private getSeverity(error: Error | KompleteError): ErrorSeverity {
    if (error instanceof ProviderError) {
      // Check for specific provider error codes
      if (error.code === 'AUTH_ERROR') {
        return ErrorSeverity.CRITICAL;
      }
      return ErrorSeverity.HIGH;
    }
    if (error instanceof ToolError) {
      if (error.code === 'TOOL_NOT_FOUND') {
        return ErrorSeverity.MEDIUM;
      }
      return ErrorSeverity.MEDIUM;
    }
    if (error instanceof ModeError) {
      return ErrorSeverity.MEDIUM;
    }
    if (error instanceof AgentError) {
      return ErrorSeverity.MEDIUM;
    }
    if (error instanceof ContextError) {
      return ErrorSeverity.MEDIUM;
    }
    if (error instanceof ConfigError) {
      return ErrorSeverity.HIGH;
    }
    return ErrorSeverity.LOW;
  }

  /**
   * Determine recovery strategy
   */
  private determineRecovery(error: Error | KompleteError): RecoveryStrategy {
    if (error instanceof ProviderError) {
      // Rate limit errors should retry with backoff
      if (error.code === 'RATE_LIMIT_ERROR') {
        return RecoveryStrategy.RETRY;
      }
      // Auth errors should abort
      if (error.code === 'AUTH_ERROR') {
        return RecoveryStrategy.ABORT;
      }
      // Other provider errors should try fallback
      return RecoveryStrategy.FALLBACK;
    }
    if (error instanceof ToolError) {
      // Tool not found should abort
      if (error.code === 'TOOL_NOT_FOUND') {
        return RecoveryStrategy.ABORT;
      }
      // Tool timeout should retry
      if (error.code === 'TOOL_TIMEOUT') {
        return RecoveryStrategy.RETRY;
      }
      // Other tool errors should continue
      return RecoveryStrategy.CONTINUE;
    }
    if (error instanceof ModeError) {
      // Mode transition errors should fallback to default mode
      return RecoveryStrategy.FALLBACK;
    }
    if (error instanceof AgentError) {
      // Agent errors should continue with other agents
      return RecoveryStrategy.CONTINUE;
    }
    if (error instanceof ContextError) {
      // Context errors should abort
      return RecoveryStrategy.ABORT;
    }
    if (error instanceof ConfigError) {
      // Config errors should abort
      return RecoveryStrategy.ABORT;
    }
    return RecoveryStrategy.ABORT;
  }

  /**
   * Get recovery suggestions for an error
   * @param error The error to get suggestions for
   * @returns Array of recovery suggestions sorted by priority
   */
  getRecoverySuggestions(error: Error | KompleteError): RecoverySuggestion[] {
    let code = 'UNKNOWN_ERROR';

    if (error instanceof KompleteError) {
      code = error.code;
    }

    // Get suggestions for the error code, or fall back to unknown error suggestions
    const suggestions = ERROR_RECOVERY_SUGGESTIONS[code] ?? ERROR_RECOVERY_SUGGESTIONS['UNKNOWN_ERROR'];

    // Sort by priority (lower = higher priority)
    return [...suggestions].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get auto-applicable recovery suggestions
   * @param error The error to get suggestions for
   * @returns Array of auto-applicable recovery suggestions
   */
  getAutoApplicableSuggestions(error: Error | KompleteError): RecoverySuggestion[] {
    return this.getRecoverySuggestions(error).filter((s) => s.autoApplicable);
  }

  /**
   * Format recovery suggestions for display
   */
  private formatRecoverySuggestions(suggestions: RecoverySuggestion[]): string {
    if (suggestions.length === 0) {
      return '';
    }

    const lines: string[] = [chalk.cyan.bold('\nRecovery Suggestions:')];

    suggestions.forEach((suggestion, index) => {
      lines.push(chalk.yellow(`  ${index + 1}. ${suggestion.action}`));
      lines.push(chalk.gray(`     ${suggestion.explanation}`));
      if (suggestion.command) {
        lines.push(chalk.green(`     Command: ${suggestion.command}`));
      }
      if (suggestion.autoApplicable) {
        lines.push(chalk.blue(`     [Auto-recoverable]`));
      }
    });

    return lines.join('\n');
  }

  /**
   * Format error message for display
   */
  private formatError(error: Error | KompleteError, context?: ErrorContext): string {
    const lines: string[] = [];

    // Error header
    if (error instanceof KompleteError) {
      lines.push(chalk.red.bold(`Error: ${error.name}`));
      lines.push(chalk.red(`Code: ${error.code}`));
    } else {
      lines.push(chalk.red.bold(`Error: ${error.name}`));
    }

    // Error message
    lines.push(chalk.white(error.message));

    // Context information
    if (context) {
      if (context.operation) {
        lines.push(chalk.gray(`Operation: ${context.operation}`));
      }
      if (context.component) {
        lines.push(chalk.gray(`Component: ${context.component}`));
      }
      if (context.timestamp) {
        lines.push(chalk.gray(`Time: ${context.timestamp.toISOString()}`));
      }
    }

    // Stack trace in verbose mode
    if (this.config.verbose && error.stack) {
      lines.push('');
      lines.push(chalk.gray('Stack trace:'));
      lines.push(chalk.gray(error.stack));
    }

    // Details for KompleteError
    if (error instanceof KompleteError && error.details && this.config.verbose) {
      lines.push('');
      lines.push(chalk.gray('Details:'));
      lines.push(chalk.gray(JSON.stringify(error.details, null, 2)));
    }

    return lines.join('\n');
  }

  /**
   * Track error occurrence
   */
  private trackError(error: Error | KompleteError): void {
    const key = error.constructor.name;
    const count = this.errorCounts.get(key) ?? 0;
    this.errorCounts.set(key, count + 1);
  }

  /**
   * Log error
   */
  private logError(error: Error | KompleteError, context?: ErrorContext): void {
    if (this.config.logger) {
      const severity = this.getSeverity(error);
      const logData = {
        name: error.name,
        message: error.message,
        context,
        ...(error instanceof KompleteError && { code: error.code, details: error.details }),
      };

      switch (severity) {
        case ErrorSeverity.LOW:
          this.config.logger.debug('Error occurred', 'ErrorHandler', logData);
          break;
        case ErrorSeverity.MEDIUM:
          this.config.logger.warn(error.message, 'ErrorHandler', logData);
          break;
        case ErrorSeverity.HIGH:
        case ErrorSeverity.CRITICAL:
          this.config.logger.error(error.message, 'ErrorHandler', logData);
          break;
      }
    }
  }

  /**
   * Handle error
   */
  async handle(error: Error | KompleteError, context?: ErrorContext): Promise<RecoveryStrategy> {
    // Track error
    this.trackError(error);

    // Log error
    this.logError(error, context);

    // Format and display error
    console.error('\n' + this.formatError(error, context) + '\n');

    // Determine recovery strategy
    const strategy = this.determineRecovery(error);

    // Get and display recovery suggestions
    const suggestions = this.getRecoverySuggestions(error);
    const suggestionsOutput = this.formatRecoverySuggestions(suggestions);
    if (suggestionsOutput) {
      console.log(suggestionsOutput);
    }

    // Display recovery info
    this.displayRecoveryInfo(strategy, error);

    // Exit on critical errors
    const severity = this.getSeverity(error);
    if (severity === ErrorSeverity.CRITICAL && this.config.exitOnCritical) {
      process.exit(1);
    }

    return strategy;
  }

  /**
   * Display recovery information
   */
  private displayRecoveryInfo(strategy: RecoveryStrategy, error: Error | KompleteError): void {
    const messages: Record<RecoveryStrategy, string> = {
      [RecoveryStrategy.RETRY]: chalk.yellow('Retrying operation...'),
      [RecoveryStrategy.FALLBACK]: chalk.yellow('Falling back to alternative method...'),
      [RecoveryStrategy.ABORT]: chalk.red('Operation aborted.'),
      [RecoveryStrategy.CONTINUE]: chalk.yellow('Continuing with available resources...'),
    };

    console.log(messages[strategy]);
    console.log();
  }

  /**
   * Retry operation with exponential backoff
   */
  async retry<T>(
    operation: () => Promise<T>,
    context?: ErrorContext,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | KompleteError | null = null;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error | KompleteError;

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(chalk.yellow(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`));
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    await this.handle(lastError!, context);
    throw lastError;
  }

  /**
   * Wrap async function with error handling
   */
  wrap<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context?: ErrorContext
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const strategy = await this.handle(error as Error | KompleteError, context);
        if (strategy === RecoveryStrategy.ABORT) {
          throw error;
        }
        throw error;
      }
    };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Clear error statistics
   */
  clearStats(): void {
    this.errorCounts.clear();
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null;

/**
 * Initialize global error handler
 */
export function initErrorHandler(config: ErrorHandlerConfig = {}): ErrorHandler {
  globalErrorHandler = new ErrorHandler(config);
  return globalErrorHandler;
}

/**
 * Get global error handler
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * Handle error globally
 */
export async function handleError(error: Error | KompleteError, context?: ErrorContext): Promise<RecoveryStrategy> {
  return getErrorHandler().handle(error, context);
}

/**
 * Retry operation globally
 */
export async function retry<T>(
  operation: () => Promise<T>,
  context?: ErrorContext,
  maxRetries?: number
): Promise<T> {
  return getErrorHandler().retry(operation, context, maxRetries);
}

/**
 * Wrap async function globally
 */
export function wrap<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ErrorContext
): (...args: T) => Promise<R> {
  return getErrorHandler().wrap(fn, context);
}

/**
 * Get recovery suggestions for an error
 */
export function getRecoverySuggestions(error: Error | KompleteError): RecoverySuggestion[] {
  return getErrorHandler().getRecoverySuggestions(error);
}

/**
 * Get auto-applicable recovery suggestions for an error
 */
export function getAutoApplicableSuggestions(error: Error | KompleteError): RecoverySuggestion[] {
  return getErrorHandler().getAutoApplicableSuggestions(error);
}

/**
 * Register custom recovery suggestions for an error code
 * @param errorCode The error code to register suggestions for
 * @param suggestions Array of recovery suggestions
 */
export function registerRecoverySuggestions(errorCode: string, suggestions: RecoverySuggestion[]): void {
  ERROR_RECOVERY_SUGGESTIONS[errorCode] = suggestions;
}

/**
 * Add recovery suggestions to an existing error code
 * @param errorCode The error code to add suggestions to
 * @param suggestions Array of recovery suggestions to add
 */
export function addRecoverySuggestions(errorCode: string, suggestions: RecoverySuggestion[]): void {
  const existing = ERROR_RECOVERY_SUGGESTIONS[errorCode] ?? [];
  ERROR_RECOVERY_SUGGESTIONS[errorCode] = [...existing, ...suggestions].sort((a, b) => a.priority - b.priority);
}
