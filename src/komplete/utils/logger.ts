/**
 * Logging infrastructure for KOMPLETE-KONTROL CLI
 * 
 * Provides centralized logging with configurable levels and output formats.
 */

import chalk from 'chalk';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: unknown;
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  file?: string;
  colorize: boolean;
  timestamp: boolean;
}

/**
 * Logger class
 */
export class Logger {
  public config: LoggerConfig;
  private logs: LogEntry[] = [];
  private fileHandle?: Bun.FileBlob;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? LogLevel.INFO,
      file: config.file,
      colorize: config.colorize ?? true,
      timestamp: config.timestamp ?? true,
    };

    if (this.config.file) {
      this.initFileLogging();
    }
  }

  /**
   * Initialize file logging
   */
  private initFileLogging(): void {
    try {
      this.fileHandle = Bun.file(this.config.file!);
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
    }
  }

  /**
   * Format log entry
   */
  private formatEntry(entry: LogEntry): string {
    const parts: string[] = [];

    if (this.config.timestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(chalk.gray(timestamp));
    }

    const levelStr = this.formatLevel(entry.level);
    parts.push(levelStr);

    if (entry.context) {
      parts.push(chalk.cyan(`[${entry.context}]`));
    }

    parts.push(entry.message);

    if (entry.data !== undefined) {
      const dataStr = JSON.stringify(entry.data, null, 2);
      parts.push(chalk.gray(dataStr));
    }

    return parts.join(' ');
  }

  /**
   * Format log level
   */
  private formatLevel(level: LogLevel): string {
    if (!this.config.colorize) {
      return LogLevel[level] ?? 'UNKNOWN';
    }

    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray('DEBUG');
      case LogLevel.INFO:
        return chalk.blue('INFO');
      case LogLevel.WARN:
        return chalk.yellow('WARN');
      case LogLevel.ERROR:
        return chalk.red('ERROR');
      default:
        return LogLevel[level] ?? 'UNKNOWN';
    }
  }

  /**
   * Write log entry
   */
  private write(entry: LogEntry): void {
    if (entry.level < this.config.level) {
      return;
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
    if (this.fileHandle) {
      this.fileHandle.write(formatted + '\n');
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: string, data?: unknown): void {
    this.write({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      message,
      context,
      data,
    });
  }

  /**
   * Log info message
   */
  info(message: string, context?: string, data?: unknown): void {
    this.write({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      context,
      data,
    });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: string, data?: unknown): void {
    this.write({
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      context,
      data,
    });
  }

  /**
   * Log error message
   */
  error(message: string, context?: string, data?: unknown): void {
    this.write({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      context,
      data,
    });
  }

  /**
   * Create child logger with context
   */
  child(context: string): ContextLogger {
    return new ContextLogger(this, context);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Close logger
   */
  async close(): Promise<void> {
    // FileBlob in Bun doesn't have a flush method
    // The file handle is automatically managed by Bun
    this.fileHandle = undefined;
  }
}

/**
 * Context logger with pre-set context
 */
export class ContextLogger {
  constructor(
    private parent: Logger,
    private context: string
  ) {}

  /**
   * Log debug message with context
   */
  debug(message: string, data?: unknown): void {
    this.parent.debug(message, this.context, data);
  }

  /**
   * Log info message with context
   */
  info(message: string, data?: unknown): void {
    this.parent.info(message, this.context, data);
  }

  /**
   * Log warning message with context
   */
  warn(message: string, data?: unknown): void {
    this.parent.warn(message, this.context, data);
  }

  /**
   * Log error message with context
   */
  error(message: string, data?: unknown): void {
    this.parent.error(message, this.context, data);
  }

  /**
   * Create child logger with combined context
   */
  child(childContext: string): ContextLogger {
    return new ContextLogger(this.parent, `${this.context}:${childContext}`);
  }
}

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
export function createLogger(context: string): ContextLogger {
  return getLogger().child(context);
}
