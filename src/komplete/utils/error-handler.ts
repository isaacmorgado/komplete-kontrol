/**
 * Error handling framework for KOMPLETE-KONTROL CLI
 * 
 * Provides centralized error handling, recovery strategies, and user-friendly error messages.
 */

import chalk from 'chalk';
import { KompleteError, ProviderError, AgentError, ContextError, ConfigError } from '../types';
import { Logger } from './logger';

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
  logger?: Logger;
  verbose?: boolean;
  exitOnCritical?: boolean;
}

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
      return ErrorSeverity.HIGH;
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
      // Provider errors should retry or fallback
      return RecoveryStrategy.RETRY;
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
