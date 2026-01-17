/**
 * Tool Result Handling
 *
 * Processes tool results, transforms them for agents,
 * and handles errors with retry logic.
 */

import { z } from 'zod';
import { Logger, LoggerLike } from '../utils/logger';
import { AgentError } from '../types';
import type { MCPToolResult } from './types';
import type { ToolExecutionResult, ToolExecutionContext } from './agent-executor';

/**
 * Result transformation options
 */
export interface ResultTransformationOptions {
  /**
   * Extract content from result
   */
  extractContent?: boolean;

  /**
   * Format result as string
   */
  formatAsString?: boolean;

  /**
   * Include metadata in result
   */
  includeMetadata?: boolean;

  /**
   * Sanitize result
   */
  sanitize?: boolean;

  /**
   * Max string length
   */
  maxStringLength?: number;
}

/**
 * Transformed result
 */
export interface TransformedResult {
  /**
   * Transformed content
   */
  content: unknown;

  /**
   * Result metadata
   */
  metadata?: {
    /**
     * Original result
     */
    original?: MCPToolResult;

    /**
     * Server ID
     */
    serverId: string;

    /**
     * Tool name
     */
    toolName: string;

    /**
     * Execution duration
     */
    durationMs: number;

    /**
     * Number of attempts
     */
    attempts: number;

    /**
     * Success status
     */
    success: boolean;
  };
}

/**
 * Error handling options
 */
export interface ErrorHandlingOptions {
  /**
   * Retry on error
   */
  retryOnError?: boolean;

  /**
   * Maximum retry attempts
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelayMs?: number;

  /**
   * Throw on error
   */
  throwOnError?: boolean;

  /**
   * Log errors
   */
  logErrors?: boolean;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  /**
   * Whether error was handled
   */
  handled: boolean;

  /**
   * Whether retry is recommended
   */
  retry: boolean;

  /**
   * Fallback result
   */
  fallback?: unknown;

  /**
   * Error message
   */
  errorMessage?: string;

  /**
   * Recovery suggestion
   */
  suggestion?: string;
}

/**
 * Error pattern
 */
export interface ErrorPattern {
  /**
   * Pattern to match (regex)
   */
  pattern: RegExp;

  /**
   * Error type
   */
  type: string;

  /**
   * Whether retry is recommended
   */
  retry: boolean;

  /**
   * Recovery suggestion
   */
  suggestion: string;

  /**
   * Fallback value
   */
  fallback?: unknown;
}

/**
 * Result Handler class
 *
 * Processes tool results, transforms them for agents,
 * and handles errors with retry logic.
 */
export class ResultHandler {
  private config: Required<ResultTransformationOptions>;
  private errorConfig: Required<ErrorHandlingOptions>;
  private logger: LoggerLike;
  private errorPatterns: ErrorPattern[] = [];

  constructor(
    resultConfig?: ResultTransformationOptions,
    errorConfig?: ErrorHandlingOptions,
    logger?: LoggerLike
  ) {
    this.config = {
      extractContent: resultConfig?.extractContent ?? true,
      formatAsString: resultConfig?.formatAsString ?? false,
      includeMetadata: resultConfig?.includeMetadata ?? false,
      sanitize: resultConfig?.sanitize ?? true,
      maxStringLength: resultConfig?.maxStringLength ?? 10000,
    };

    this.errorConfig = {
      retryOnError: errorConfig?.retryOnError ?? true,
      maxRetries: errorConfig?.maxRetries ?? 3,
      retryDelayMs: errorConfig?.retryDelayMs ?? 1000,
      throwOnError: errorConfig?.throwOnError ?? false,
      logErrors: errorConfig?.logErrors ?? true,
    };

    this.logger = logger || new Logger();
    this.logger.info('ResultHandler initialized', 'ResultHandler', {
      resultConfig: this.config,
      errorConfig: this.errorConfig,
    });

    this.initializeErrorPatterns();
  }

  /**
   * Handle tool execution result
   *
   * @param result - Tool execution result
   * @param options - Transformation options
   * @returns Transformed result
   */
  handleResult(
    result: ToolExecutionResult,
    options?: ResultTransformationOptions
  ): TransformedResult {
    const mergedOptions = { ...this.config, ...options };

    this.logger.debug(
      `Handling result from tool: ${result.toolName}`,
      'ResultHandler',
      { success: result.success, durationMs: result.durationMs }
    );

    let content = result.content;

    // Extract content if needed
    if (mergedOptions.extractContent) {
      content = this.extractContent(result);
    }

    // Sanitize content
    if (mergedOptions.sanitize) {
      content = this.sanitizeContent(content, mergedOptions.maxStringLength);
    }

    // Format as string if needed
    if (mergedOptions.formatAsString) {
      content = this.formatAsString(content);
    }

    // Build transformed result
    const transformed: TransformedResult = {
      content,
    };

    // Include metadata if requested
    if (mergedOptions.includeMetadata) {
      transformed.metadata = {
        original: result,
        serverId: result.serverId,
        toolName: result.toolName,
        durationMs: result.durationMs,
        attempts: result.attempts,
        success: result.success,
      };
    }

    return transformed;
  }

  /**
   * Extract content from result
   *
   * @param result - Tool execution result
   * @returns Extracted content
   */
  private extractContent(result: ToolExecutionResult): unknown {
    if (!result.success) {
      return {
        error: result.error?.message || 'Tool execution failed',
        isError: true,
      };
    }

    const content = result.content;

    // Handle different content types
    if (content === null || content === undefined) {
      return { empty: true };
    }

    if (typeof content === 'string') {
      return { text: content };
    }

    if (Array.isArray(content)) {
      return { items: content, count: content.length };
    }

    if (typeof content === 'object') {
      return { data: content };
    }

    return { value: content };
  }

  /**
   * Sanitize content
   *
   * @param content - Content to sanitize
   * @param maxLength - Maximum string length (optional, uses config default if not provided)
   * @returns Sanitized content
   */
  private sanitizeContent(content: unknown, maxLength?: number): unknown {
    if (content === null || content === undefined) {
      return content;
    }

    const maxLen = maxLength ?? this.config.maxStringLength;

    if (typeof content === 'string') {
      // Truncate if too long
      if (content.length > maxLen) {
        return content.slice(0, maxLen) + '... [truncated]';
      }
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((item) => this.sanitizeContent(item, maxLength));
    }

    if (typeof content === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(content)) {
        sanitized[key] = this.sanitizeContent(value, maxLength);
      }
      return sanitized;
    }

    return content;
  }

  /**
   * Format content as string
   *
   * @param content - Content to format
   * @returns Formatted string
   */
  private formatAsString(content: unknown): string {
    if (content === null || content === undefined) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    if (typeof content === 'number' || typeof content === 'boolean') {
      return String(content);
    }

    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }

  /**
   * Handle tool execution error
   *
   * @param error - Error to handle
   * @param context - Execution context
   * @param options - Error handling options
   * @returns Error handling result
   */
  handleError(
    error: Error,
    context?: ToolExecutionContext,
    options?: ErrorHandlingOptions
  ): ErrorHandlingResult {
    const mergedOptions = { ...this.errorConfig, ...options };

    if (mergedOptions.logErrors) {
      this.logger.error(
        `Tool execution error: ${error.message}`,
        'ResultHandler',
        { error: error.stack, context }
      );
    }

    // Match error pattern
    const patternMatch = this.matchErrorPattern(error);

    if (patternMatch) {
      this.logger.debug(
        `Matched error pattern: ${patternMatch.type}`,
        'ResultHandler'
      );

      return {
        handled: true,
        retry: patternMatch.retry,
        fallback: patternMatch.fallback,
        errorMessage: error.message,
        suggestion: patternMatch.suggestion,
      };
    }

    // Default error handling
    return {
      handled: false,
      retry: mergedOptions.retryOnError,
      errorMessage: error.message,
      suggestion: 'Check tool parameters and server availability',
    };
  }

  /**
   * Match error against patterns
   *
   * @param error - Error to match
   * @returns Matched pattern or undefined
   */
  private matchErrorPattern(error: Error): ErrorPattern | undefined {
    const errorMessage = error.message;

    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(errorMessage)) {
        return pattern;
      }
    }

    return undefined;
  }

  /**
   * Initialize default error patterns
   */
  private initializeErrorPatterns(): void {
    // Timeout errors
    this.errorPatterns.push({
      pattern: /timeout|timed out/i,
      type: 'timeout',
      retry: true,
      suggestion: 'Increase timeout or check server responsiveness',
    });

    // Connection errors
    this.errorPatterns.push({
      pattern: /connection|network|econnrefused/i,
      type: 'connection',
      retry: true,
      suggestion: 'Check network connectivity and server status',
    });

    // Authentication errors
    this.errorPatterns.push({
      pattern: /auth|unauthorized|forbidden/i,
      type: 'authentication',
      retry: false,
      suggestion: 'Check authentication credentials and permissions',
    });

    // Not found errors
    this.errorPatterns.push({
      pattern: /not found|does not exist/i,
      type: 'not_found',
      retry: false,
      suggestion: 'Verify the resource exists and is accessible',
      fallback: { notFound: true },
    });

    // Validation errors
    this.errorPatterns.push({
      pattern: /validation|invalid|malformed/i,
      type: 'validation',
      retry: false,
      suggestion: 'Check and correct input parameters',
    });

    // Rate limit errors
    this.errorPatterns.push({
      pattern: /rate limit|too many requests/i,
      type: 'rate_limit',
      retry: true,
      suggestion: 'Reduce request frequency or implement backoff',
    });

    // Server errors (5xx)
    this.errorPatterns.push({
      pattern: /server error|internal error|500|502|503/i,
      type: 'server_error',
      retry: true,
      suggestion: 'Server encountered an error, retry after delay',
    });
  }

  /**
   * Add custom error pattern
   *
   * @param pattern - Error pattern
   */
  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
    this.logger.debug(
      `Added error pattern: ${pattern.type}`,
      'ResultHandler'
    );
  }

  /**
   * Remove error pattern by type
   *
   * @param type - Pattern type to remove
   * @returns Number of patterns removed
   */
  removeErrorPattern(type: string): number {
    const initialLength = this.errorPatterns.length;
    this.errorPatterns = this.errorPatterns.filter((p) => p.type !== type);
    return initialLength - this.errorPatterns.length;
  }

  /**
   * Clear all error patterns
   */
  clearErrorPatterns(): void {
    this.errorPatterns = [];
    this.initializeErrorPatterns();
    this.logger.debug('Error patterns reset to defaults', 'ResultHandler');
  }

  /**
   * Handle tool execution with retry
   *
   * @param executeFn - Function to execute
   * @param context - Execution context
   * @param options - Error handling options
   * @returns Tool execution result
   * @throws {AgentError} If all retries fail and throwOnError is true
   */
  async handleWithRetry<T extends ToolExecutionResult>(
    executeFn: () => Promise<T>,
    context?: ToolExecutionContext,
    options?: ErrorHandlingOptions
  ): Promise<T> {
    const mergedOptions = { ...this.errorConfig, ...options };
    let attempts = 0;
    let lastError: Error | undefined;

    while (attempts <= mergedOptions.maxRetries) {
      attempts++;

      try {
        const result = await executeFn();

        if (result.success) {
          return result;
        }

        // Handle non-success result
        const error = new Error(result.error?.message || 'Tool execution failed');
        const errorResult = this.handleError(error, context, mergedOptions);

        if (!errorResult.retry || attempts > mergedOptions.maxRetries) {
          if (mergedOptions.throwOnError) {
            throw new AgentError(
              errorResult.errorMessage || 'Tool execution failed',
              context?.agentId,
              { attempts, context }
            );
          }
          return result;
        }

        lastError = error;
      } catch (error) {
        lastError = error as Error;
        const errorResult = this.handleError(lastError, context, mergedOptions);

        if (!errorResult.retry || attempts > mergedOptions.maxRetries) {
          if (mergedOptions.throwOnError) {
            throw new AgentError(
              errorResult.errorMessage || lastError.message,
              context?.agentId,
              { attempts, context, error: lastError }
            );
          }

          // Return fallback if available
          if (errorResult.fallback !== undefined) {
            this.logger.warn(
              'Returning fallback result after error',
              'ResultHandler',
              { fallback: errorResult.fallback }
            );
            return {
              success: false,
              error: { message: lastError.message },
              content: errorResult.fallback,
              serverId: context?.agentId || 'unknown',
              toolName: 'unknown',
              attempts,
              durationMs: 0,
            } as T;
          }

          throw lastError;
        }
      }

      // Delay before retry
      if (attempts <= mergedOptions.maxRetries) {
        await this.delay(mergedOptions.retryDelayMs);
      }
    }

    // Should not reach here, but just in case
    throw new AgentError(
      `Tool execution failed after ${attempts} attempts`,
      context?.agentId,
      { attempts, context, error: lastError }
    );
  }

  /**
   * Delay for retry
   *
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get handler statistics
   *
   * @returns Statistics about handler
   */
  getStatistics(): {
    errorPatterns: number;
    resultConfig: ResultTransformationOptions;
    errorConfig: ErrorHandlingOptions;
  } {
    return {
      errorPatterns: this.errorPatterns.length,
      resultConfig: this.config,
      errorConfig: this.errorConfig,
    };
  }
}

/**
 * Schema for result transformation options
 */
export const ResultTransformationOptionsSchema = z.object({
  extractContent: z.boolean().optional(),
  formatAsString: z.boolean().optional(),
  includeMetadata: z.boolean().optional(),
  sanitize: z.boolean().optional(),
  maxStringLength: z.number().min(0).optional(),
});

/**
 * Schema for error handling options
 */
export const ErrorHandlingOptionsSchema = z.object({
  retryOnError: z.boolean().optional(),
  maxRetries: z.number().min(0).optional(),
  retryDelayMs: z.number().min(0).optional(),
  throwOnError: z.boolean().optional(),
  logErrors: z.boolean().optional(),
});

/**
 * Schema for error pattern
 */
export const ErrorPatternSchema = z.object({
  pattern: z.instanceof(RegExp),
  type: z.string(),
  retry: z.boolean(),
  suggestion: z.string(),
  fallback: z.unknown().optional(),
});

/**
 * Global result handler instance
 */
let globalResultHandler: ResultHandler | null = null;

/**
 * Initialize global result handler
 *
 * @param resultConfig - Result transformation configuration
 * @param errorConfig - Error handling configuration
 * @param logger - Optional logger instance
 * @returns The global result handler
 */
export function initResultHandler(
  resultConfig?: ResultTransformationOptions,
  errorConfig?: ErrorHandlingOptions,
  logger?: LoggerLike
): ResultHandler {
  globalResultHandler = new ResultHandler(resultConfig, errorConfig, logger);
  return globalResultHandler;
}

/**
 * Get global result handler
 *
 * @returns The global result handler
 */
export function getResultHandler(): ResultHandler {
  if (!globalResultHandler) {
    globalResultHandler = new ResultHandler();
  }
  return globalResultHandler;
}
