/**
 * Enhanced Logging Infrastructure for KOMPLETE-KONTROL
 *
 * Provides centralized, structured logging with:
 * - Configurable log levels (debug, info, warn, error)
 * - Rich context support (session ID, agent ID, mode)
 * - File output with configurable log directory
 * - Log rotation (size-based and date-based)
 * - Performance timing utilities
 */

import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ============================================================================
// Types & Enums
// ============================================================================

/**
 * Log levels in order of verbosity (lower = more verbose)
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4, // Suppress all logs
}

/**
 * Log level string type for configuration
 */
export type LogLevelString = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Structured context for log entries
 */
export interface LogContext {
  /** Unique session identifier */
  sessionId?: string;
  /** Agent identifier (e.g., 'claude-code', 'codex') */
  agentId?: string;
  /** Current operational mode (e.g., 'code', 'debug', 'architect') */
  mode?: string;
  /** Component or module name */
  component?: string;
  /** Request or operation identifier */
  requestId?: string;
  /** Parent span ID for distributed tracing */
  parentSpanId?: string;
  /** Current span ID for distributed tracing */
  spanId?: string;
  /** Additional custom context fields */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp of the log entry */
  timestamp: Date;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Structured context */
  context?: LogContext;
  /** Additional data payload */
  data?: unknown;
  /** Error object if applicable */
  error?: Error;
  /** Duration in milliseconds for timed operations */
  durationMs?: number;
}

/**
 * Log rotation configuration
 */
export interface LogRotationConfig {
  /** Enable log rotation */
  enabled: boolean;
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxSizeBytes?: number;
  /** Maximum number of backup files to keep (default: 5) */
  maxFiles?: number;
  /** Enable date-based rotation (rotate daily) */
  dateRotation?: boolean;
}

/**
 * File output configuration
 */
export interface FileOutputConfig {
  /** Enable file output */
  enabled: boolean;
  /** Log directory path (default: ~/.komplete-kontrol/logs) */
  directory?: string;
  /** Log file name (default: komplete.log) */
  filename?: string;
  /** Log rotation configuration */
  rotation?: LogRotationConfig;
  /** JSON format for file output (easier to parse) */
  jsonFormat?: boolean;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Enable colorized console output */
  colorize: boolean;
  /** Include timestamp in output */
  timestamp: boolean;
  /** Default context applied to all log entries */
  defaultContext?: LogContext;
  /** File output configuration */
  file?: FileOutputConfig;
  /** Maximum length of data payload in output (truncate if longer) */
  maxDataLength?: number;
}

/**
 * Performance timer result
 */
export interface TimerResult<T> {
  /** Return value of the timed operation */
  result: T;
  /** Duration in milliseconds */
  durationMs: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LOG_DIR = path.join(os.homedir(), '.komplete-kontrol', 'logs');
const DEFAULT_LOG_FILENAME = 'komplete.log';
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_DATA_LENGTH = 10000;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert string log level to enum
 */
export function parseLogLevel(level: LogLevelString): LogLevel {
  switch (level) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'silent':
      return LogLevel.SILENT;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Convert enum log level to string
 */
export function logLevelToString(level: LogLevel): LogLevelString {
  switch (level) {
    case LogLevel.DEBUG:
      return 'debug';
    case LogLevel.INFO:
      return 'info';
    case LogLevel.WARN:
      return 'warn';
    case LogLevel.ERROR:
      return 'error';
    case LogLevel.SILENT:
      return 'silent';
    default:
      return 'info';
  }
}

/**
 * Ensure directory exists
 */
function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get current date string for log rotation
 */
function getDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Safely stringify data with error handling
 */
function safeStringify(data: unknown, maxLength: number = DEFAULT_MAX_DATA_LENGTH): string {
  try {
    const str = JSON.stringify(data, null, 2);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + '... [truncated]';
    }
    return str;
  } catch {
    return '[Unable to stringify data]';
  }
}

// ============================================================================
// Logger Class
// ============================================================================

/**
 * Enhanced Logger class with structured logging, file output, rotation, and timing
 */
export class Logger {
  public config: LoggerConfig;
  private logs: LogEntry[] = [];
  private fileStream: fs.WriteStream | null = null;
  private currentLogFile: string = '';
  private currentLogDate: string = '';
  private currentFileSize: number = 0;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      colorize: config.colorize ?? true,
      timestamp: config.timestamp ?? true,
      defaultContext: config.defaultContext,
      file: config.file,
      maxDataLength: config.maxDataLength ?? DEFAULT_MAX_DATA_LENGTH,
    };

    if (this.config.file?.enabled) {
      this.initFileLogging();
    }
  }

  // --------------------------------------------------------------------------
  // File Logging
  // --------------------------------------------------------------------------

  /**
   * Initialize file logging with rotation support
   */
  private initFileLogging(): void {
    try {
      const fileConfig = this.config.file!;
      const directory = fileConfig.directory ?? DEFAULT_LOG_DIR;
      const filename = fileConfig.filename ?? DEFAULT_LOG_FILENAME;

      ensureDirectory(directory);

      this.currentLogDate = getDateString();
      this.currentLogFile = this.buildLogFilePath(directory, filename);

      // Get current file size if file exists
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        this.currentFileSize = stats.size;
      }

      this.openFileStream();
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
    }
  }

  /**
   * Build log file path, including date if date rotation is enabled
   */
  private buildLogFilePath(directory: string, filename: string): string {
    const fileConfig = this.config.file;
    if (fileConfig?.rotation?.dateRotation) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      return path.join(directory, `${base}-${this.currentLogDate}${ext}`);
    }
    return path.join(directory, filename);
  }

  /**
   * Open file stream for writing
   */
  private openFileStream(): void {
    this.closeFileStream();
    this.fileStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
    this.fileStream.on('error', (error) => {
      console.error('Log file stream error:', error);
      this.fileStream = null;
    });
  }

  /**
   * Close file stream
   */
  private closeFileStream(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }

  /**
   * Check and perform log rotation if needed
   */
  private checkRotation(): void {
    const fileConfig = this.config.file;
    if (!fileConfig?.rotation?.enabled) return;

    const rotationConfig = fileConfig.rotation;
    let needsRotation = false;

    // Check date-based rotation
    if (rotationConfig.dateRotation) {
      const currentDate = getDateString();
      if (currentDate !== this.currentLogDate) {
        this.currentLogDate = currentDate;
        needsRotation = true;
      }
    }

    // Check size-based rotation
    const maxSize = rotationConfig.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    if (this.currentFileSize >= maxSize) {
      needsRotation = true;
    }

    if (needsRotation) {
      this.rotateLogFile();
    }
  }

  /**
   * Rotate log file
   */
  private rotateLogFile(): void {
    try {
      this.closeFileStream();

      const fileConfig = this.config.file!;
      const directory = fileConfig.directory ?? DEFAULT_LOG_DIR;
      const filename = fileConfig.filename ?? DEFAULT_LOG_FILENAME;
      const maxFiles = fileConfig.rotation?.maxFiles ?? DEFAULT_MAX_FILES;

      // For size-based rotation (non-date), rotate numbered backups
      if (!fileConfig.rotation?.dateRotation) {
        const ext = path.extname(filename);
        const base = path.basename(filename, ext);

        // Delete oldest backup if we're at the limit
        const oldestBackup = path.join(directory, `${base}.${maxFiles}${ext}`);
        if (fs.existsSync(oldestBackup)) {
          fs.unlinkSync(oldestBackup);
        }

        // Shift existing backups
        for (let i = maxFiles - 1; i >= 1; i--) {
          const from = path.join(directory, i === 1 ? filename : `${base}.${i}${ext}`);
          const to = path.join(directory, `${base}.${i + 1}${ext}`);
          if (fs.existsSync(from)) {
            fs.renameSync(from, to);
          }
        }

        // Rename current log to .1
        if (fs.existsSync(this.currentLogFile)) {
          const backup = path.join(directory, `${base}.1${ext}`);
          fs.renameSync(this.currentLogFile, backup);
        }
      }

      // Update current log file path and reset size
      this.currentLogFile = this.buildLogFilePath(directory, filename);
      this.currentFileSize = 0;

      // Clean up old date-based log files if needed
      if (fileConfig.rotation?.dateRotation) {
        this.cleanupOldDateLogs(directory, filename, maxFiles);
      }

      this.openFileStream();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Clean up old date-based log files
   */
  private cleanupOldDateLogs(directory: string, filename: string, maxFiles: number): void {
    try {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const pattern = new RegExp(`^${base}-\\d{4}-\\d{2}-\\d{2}${ext.replace('.', '\\.')}$`);

      const files = fs.readdirSync(directory)
        .filter(f => pattern.test(f))
        .sort()
        .reverse();

      // Delete files beyond maxFiles
      for (let i = maxFiles; i < files.length; i++) {
        fs.unlinkSync(path.join(directory, files[i]));
      }
    } catch (error) {
      console.error('Failed to clean up old log files:', error);
    }
  }

  /**
   * Write to log file
   */
  private writeToFile(entry: LogEntry, formatted: string): void {
    if (!this.fileStream) return;

    this.checkRotation();

    let output: string;
    if (this.config.file?.jsonFormat) {
      // JSON format for easier parsing
      output = JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level],
        message: entry.message,
        context: entry.context,
        data: entry.data,
        error: entry.error ? { name: entry.error.name, message: entry.error.message, stack: entry.error.stack } : undefined,
        durationMs: entry.durationMs,
      }) + '\n';
    } else {
      // Strip ANSI codes from formatted output
       
      output = formatted.replace(/\x1b\[[0-9;]*m/g, '') + '\n';
    }

    try {
      this.fileStream.write(output);
      this.currentFileSize += Buffer.byteLength(output);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Formatting
  // --------------------------------------------------------------------------

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const parts: string[] = [];

    // Timestamp
    if (this.config.timestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(this.config.colorize ? chalk.gray(timestamp) : timestamp);
    }

    // Level
    parts.push(this.formatLevel(entry.level));

    // Context (compact format)
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextParts: string[] = [];
      const { sessionId, agentId, mode, component, requestId, ...rest } = entry.context;

      if (sessionId) contextParts.push(`sid:${sessionId.substring(0, 8)}`);
      if (agentId) contextParts.push(`agent:${agentId}`);
      if (mode) contextParts.push(`mode:${mode}`);
      if (component) contextParts.push(component);
      if (requestId) contextParts.push(`req:${requestId.substring(0, 8)}`);

      // Add any additional context fields
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          contextParts.push(`${key}:${value}`);
        }
      }

      if (contextParts.length > 0) {
        const contextStr = `[${contextParts.join(' ')}]`;
        parts.push(this.config.colorize ? chalk.cyan(contextStr) : contextStr);
      }
    }

    // Message
    parts.push(entry.message);

    // Duration
    if (entry.durationMs !== undefined) {
      const durationStr = `(${entry.durationMs.toFixed(2)}ms)`;
      parts.push(this.config.colorize ? chalk.magenta(durationStr) : durationStr);
    }

    // Data payload
    if (entry.data !== undefined) {
      const dataStr = safeStringify(entry.data, this.config.maxDataLength);
      parts.push(this.config.colorize ? chalk.gray(dataStr) : dataStr);
    }

    // Error
    if (entry.error) {
      const errorStr = `\n  Error: ${entry.error.message}`;
      parts.push(this.config.colorize ? chalk.red(errorStr) : errorStr);
      if (entry.error.stack) {
        const stackStr = entry.error.stack.split('\n').slice(1).join('\n  ');
        parts.push(this.config.colorize ? chalk.gray(`\n  ${stackStr}`) : `\n  ${stackStr}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Format log level with color
   */
  private formatLevel(level: LogLevel): string {
    const levelStr = LogLevel[level] ?? 'UNKNOWN';
    const padded = levelStr.padEnd(5);

    if (!this.config.colorize) {
      return padded;
    }

    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(padded);
      case LogLevel.INFO:
        return chalk.blue(padded);
      case LogLevel.WARN:
        return chalk.yellow(padded);
      case LogLevel.ERROR:
        return chalk.red.bold(padded);
      default:
        return padded;
    }
  }

  // --------------------------------------------------------------------------
  // Core Logging Methods
  // --------------------------------------------------------------------------

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    if (entry.level < this.config.level) {
      return;
    }

    // Merge default context
    if (this.config.defaultContext) {
      entry.context = { ...this.config.defaultContext, ...entry.context };
    }

    const formatted = this.formatEntry(entry);
    this.logs.push(entry);

    // Console output
    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }

    // File output
    if (this.config.file?.enabled && this.fileStream) {
      this.writeToFile(entry, formatted);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext | string, data?: unknown): void {
    const ctx = typeof context === 'string' ? { component: context } : context;
    this.write({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      message,
      context: ctx,
      data,
    });
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext | string, data?: unknown): void {
    const ctx = typeof context === 'string' ? { component: context } : context;
    this.write({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      context: ctx,
      data,
    });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext | string, data?: unknown): void {
    const ctx = typeof context === 'string' ? { component: context } : context;
    this.write({
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      context: ctx,
      data,
    });
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext | string, data?: unknown, error?: Error): void {
    const ctx = typeof context === 'string' ? { component: context } : context;
    this.write({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      context: ctx,
      data,
      error,
    });
  }

  // --------------------------------------------------------------------------
  // Performance Timing Utilities
  // --------------------------------------------------------------------------

  /**
   * Create a timer for measuring operation duration
   * Returns a function to call when the operation completes
   *
   * @example
   * const endTimer = logger.startTimer('Database query');
   * await performQuery();
   * endTimer(); // Logs: "Database query completed (150.23ms)"
   */
  startTimer(operationName: string, context?: LogContext): () => void {
    const startTime = performance.now();
    const startDate = new Date();

    return () => {
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      this.write({
        timestamp: new Date(),
        level: LogLevel.INFO,
        message: `${operationName} completed`,
        context,
        durationMs,
      });
    };
  }

  /**
   * Time a synchronous operation
   *
   * @example
   * const result = logger.time('Parsing config', () => parseConfig(data));
   */
  time<T>(operationName: string, fn: () => T, context?: LogContext): TimerResult<T> {
    const startTime = new Date();
    const startMs = performance.now();

    const result = fn();

    const endMs = performance.now();
    const endTime = new Date();
    const durationMs = endMs - startMs;

    this.write({
      timestamp: endTime,
      level: LogLevel.INFO,
      message: `${operationName} completed`,
      context,
      durationMs,
    });

    return { result, durationMs, startTime, endTime };
  }

  /**
   * Time an asynchronous operation
   *
   * @example
   * const { result, durationMs } = await logger.timeAsync('API call', () => fetch(url));
   */
  async timeAsync<T>(operationName: string, fn: () => Promise<T>, context?: LogContext): Promise<TimerResult<T>> {
    const startTime = new Date();
    const startMs = performance.now();

    const result = await fn();

    const endMs = performance.now();
    const endTime = new Date();
    const durationMs = endMs - startMs;

    this.write({
      timestamp: endTime,
      level: LogLevel.INFO,
      message: `${operationName} completed`,
      context,
      durationMs,
    });

    return { result, durationMs, startTime, endTime };
  }

  /**
   * Time an operation and log errors if it fails
   *
   * @example
   * const result = await logger.timeWithError('Critical operation', async () => {
   *   return await doSomethingRisky();
   * });
   */
  async timeWithError<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: LogContext,
  ): Promise<TimerResult<T>> {
    const startTime = new Date();
    const startMs = performance.now();

    try {
      const result = await fn();

      const endMs = performance.now();
      const endTime = new Date();
      const durationMs = endMs - startMs;

      this.write({
        timestamp: endTime,
        level: LogLevel.INFO,
        message: `${operationName} completed`,
        context,
        durationMs,
      });

      return { result, durationMs, startTime, endTime };
    } catch (err) {
      const endMs = performance.now();
      const endTime = new Date();
      const durationMs = endMs - startMs;

      this.write({
        timestamp: endTime,
        level: LogLevel.ERROR,
        message: `${operationName} failed`,
        context,
        durationMs,
        error: err instanceof Error ? err : new Error(String(err)),
      });

      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Child Logger & Context
  // --------------------------------------------------------------------------

  /**
   * Create child logger with inherited context
   */
  child(context: LogContext | string): ContextLogger {
    const ctx = typeof context === 'string' ? { component: context } : context;
    return new ContextLogger(this, ctx);
  }

  /**
   * Set default context for all log entries
   */
  setDefaultContext(context: LogContext): void {
    this.config.defaultContext = { ...this.config.defaultContext, ...context };
  }

  /**
   * Clear default context
   */
  clearDefaultContext(): void {
    this.config.defaultContext = undefined;
  }

  // --------------------------------------------------------------------------
  // Log Management
  // --------------------------------------------------------------------------

  /**
   * Get all logs in memory
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs filtered by context field
   */
  getLogsByContext(field: keyof LogContext, value: string): LogEntry[] {
    return this.logs.filter(log => log.context?.[field] === value);
  }

  /**
   * Clear logs from memory
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel | LogLevelString): void {
    this.config.level = typeof level === 'string' ? parseLogLevel(level) : level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Check if a level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  /**
   * Get log file path (if file logging is enabled)
   */
  getLogFilePath(): string | null {
    return this.config.file?.enabled ? this.currentLogFile : null;
  }

  /**
   * Flush and close the logger
   */
  async close(): Promise<void> {
    this.closeFileStream();
  }
}

// ============================================================================
// Context Logger
// ============================================================================

/**
 * Child logger with pre-set context
 */
export class ContextLogger {
  constructor(
    private parent: Logger,
    private context: LogContext,
  ) {}

  /**
   * Log debug message with context
   */
  debug(message: string, data?: unknown, additionalContext?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...additionalContext }, data);
  }

  /**
   * Log info message with context
   */
  info(message: string, data?: unknown, additionalContext?: LogContext): void {
    this.parent.info(message, { ...this.context, ...additionalContext }, data);
  }

  /**
   * Log warning message with context
   */
  warn(message: string, data?: unknown, additionalContext?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...additionalContext }, data);
  }

  /**
   * Log error message with context
   */
  error(message: string, data?: unknown, error?: Error, additionalContext?: LogContext): void {
    this.parent.error(message, { ...this.context, ...additionalContext }, data, error);
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operationName: string): () => void {
    return this.parent.startTimer(operationName, this.context);
  }

  /**
   * Time a synchronous operation
   */
  time<T>(operationName: string, fn: () => T): TimerResult<T> {
    return this.parent.time(operationName, fn, this.context);
  }

  /**
   * Time an asynchronous operation
   */
  async timeAsync<T>(operationName: string, fn: () => Promise<T>): Promise<TimerResult<T>> {
    return this.parent.timeAsync(operationName, fn, this.context);
  }

  /**
   * Time an operation and log errors if it fails
   */
  async timeWithError<T>(operationName: string, fn: () => Promise<T>): Promise<TimerResult<T>> {
    return this.parent.timeWithError(operationName, fn, this.context);
  }

  /**
   * Create child logger with combined context
   */
  child(childContext: LogContext | string): ContextLogger {
    const ctx = typeof childContext === 'string' ? { component: childContext } : childContext;
    return new ContextLogger(this.parent, { ...this.context, ...ctx });
  }

  /**
   * Get the full context
   */
  getContext(): LogContext {
    return { ...this.context };
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Initialize global logger
 */
export function initLogger(config: Partial<LoggerConfig> = {}): Logger {
  globalLogger = new Logger(config);
  return globalLogger;
}

/**
 * Get global logger
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

/**
 * Create logger for specific context
 */
export function createLogger(context: LogContext | string): ContextLogger {
  return getLogger().child(context);
}

/**
 * Create logger with session, agent, and mode context
 */
export function createSessionLogger(sessionId: string, agentId: string, mode?: string): ContextLogger {
  return getLogger().child({ sessionId, agentId, mode });
}
