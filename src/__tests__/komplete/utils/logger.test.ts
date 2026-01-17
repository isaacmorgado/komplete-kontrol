/**
 * Tests for Enhanced Logger
 *
 * Tests the logging infrastructure including:
 * - Log levels (debug, info, warn, error)
 * - Structured context support (session ID, agent ID, mode)
 * - File output with configurable directory
 * - Log rotation (size-based and date-based)
 * - Performance timing utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 0 })),
  createWriteStream: vi.fn(() => ({
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  })),
  readdirSync: vi.fn(() => []),
  unlinkSync: vi.fn(),
  renameSync: vi.fn(),
}));

// Mock os module
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

// Mock chalk to avoid ANSI codes in test output
vi.mock('chalk', () => {
  const mockFn = (s: string) => s;
  const createMock = () => {
    const fn = Object.assign((s: string) => s, {
      bold: mockFn,
    });
    return fn;
  };
  return {
    default: {
      gray: createMock(),
      blue: createMock(),
      yellow: createMock(),
      red: createMock(),
      cyan: createMock(),
      magenta: createMock(),
    },
  };
});

// Import after mocking
import {
  Logger,
  ContextLogger,
  LogLevel,
  LogContext,
  LoggerConfig,
  parseLogLevel,
  logLevelToString,
  initLogger,
  getLogger,
  createLogger,
  createSessionLogger,
} from '../../../komplete/utils/logger';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Spy on console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe('LogLevel', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.SILENT).toBe(4);
    });

    it('should convert string to LogLevel via parseLogLevel', () => {
      expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
      expect(parseLogLevel('info')).toBe(LogLevel.INFO);
      expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
      expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
      expect(parseLogLevel('silent')).toBe(LogLevel.SILENT);
    });

    it('should default to INFO for unknown level', () => {
      expect(parseLogLevel('unknown' as any)).toBe(LogLevel.INFO);
    });

    it('should convert LogLevel to string via logLevelToString', () => {
      expect(logLevelToString(LogLevel.DEBUG)).toBe('debug');
      expect(logLevelToString(LogLevel.INFO)).toBe('info');
      expect(logLevelToString(LogLevel.WARN)).toBe('warn');
      expect(logLevelToString(LogLevel.ERROR)).toBe('error');
      expect(logLevelToString(LogLevel.SILENT)).toBe('silent');
    });
  });

  describe('Logger Initialization', () => {
    it('should create a Logger instance with default config', () => {
      const logger = new Logger();
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.config.level).toBe(LogLevel.INFO);
      expect(logger.config.colorize).toBe(true);
      expect(logger.config.timestamp).toBe(true);
    });

    it('should accept custom configuration', () => {
      const logger = new Logger({
        level: LogLevel.DEBUG,
        colorize: false,
        timestamp: false,
      });
      expect(logger.config.level).toBe(LogLevel.DEBUG);
      expect(logger.config.colorize).toBe(false);
      expect(logger.config.timestamp).toBe(false);
    });

    it('should accept default context', () => {
      const logger = new Logger({
        defaultContext: {
          sessionId: 'test-session',
          agentId: 'test-agent',
        },
      });
      expect(logger.config.defaultContext?.sessionId).toBe('test-session');
    });
  });

  describe('Basic Logging Methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should respect log level filtering', () => {
      const warnLogger = new Logger({ level: LogLevel.WARN });

      warnLogger.debug('Debug');
      warnLogger.info('Info');
      warnLogger.warn('Warn');
      warnLogger.error('Error');

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    it('should suppress all logs with SILENT level', () => {
      const silentLogger = new Logger({ level: LogLevel.SILENT });

      silentLogger.debug('Debug');
      silentLogger.info('Info');
      silentLogger.warn('Warn');
      silentLogger.error('Error');

      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('Context Support', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should accept string context (component)', () => {
      logger.info('Message', 'MyComponent');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should accept structured context', () => {
      const context: LogContext = {
        sessionId: 'abc123',
        agentId: 'claude-code',
        mode: 'code',
        component: 'TestComponent',
      };
      logger.info('Message', context);
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should merge default context with provided context', () => {
      const loggerWithDefault = new Logger({
        level: LogLevel.DEBUG,
        defaultContext: {
          sessionId: 'default-session',
        },
      });

      loggerWithDefault.info('Message', { agentId: 'test-agent' });

      const logs = loggerWithDefault.getLogs();
      expect(logs[0].context?.sessionId).toBe('default-session');
      expect(logs[0].context?.agentId).toBe('test-agent');
    });

    it('should allow setting default context', () => {
      logger.setDefaultContext({ sessionId: 'new-session' });
      logger.info('Test');

      const logs = logger.getLogs();
      expect(logs[0].context?.sessionId).toBe('new-session');
    });

    it('should allow clearing default context', () => {
      logger.setDefaultContext({ sessionId: 'session-1' });
      logger.clearDefaultContext();
      logger.info('Test');

      const logs = logger.getLogs();
      expect(logs[0].context).toBeUndefined();
    });
  });

  describe('Data Payload', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should accept data payload', () => {
      logger.info('Message', 'Context', { key: 'value' });
      const logs = logger.getLogs();
      expect(logs[0].data).toEqual({ key: 'value' });
    });

    it('should handle various data types', () => {
      logger.info('String', 'ctx', 'string data');
      logger.info('Number', 'ctx', 42);
      logger.info('Boolean', 'ctx', true);
      logger.info('Array', 'ctx', [1, 2, 3]);
      logger.info('Null', 'ctx', null);
      logger.info('Undefined', 'ctx', undefined);

      expect(logger.getLogs()).toHaveLength(6);
    });
  });

  describe('Error Logging', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should log error objects', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', 'ErrorHandler', { additional: 'data' }, error);

      const logs = logger.getLogs();
      expect(logs[0].error).toBe(error);
    });

    it('should include error stack in output', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', 'ErrorHandler', undefined, error);

      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Child Logger (ContextLogger)', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should create child logger with context', () => {
      const child = logger.child({ sessionId: 'child-session' });
      expect(child).toBeInstanceOf(ContextLogger);
    });

    it('should create child logger from string context', () => {
      const child = logger.child('ComponentName');
      expect(child).toBeInstanceOf(ContextLogger);
    });

    it('should inherit context in child logger', () => {
      const child = logger.child({ sessionId: 'parent-session' });
      child.info('Child message');

      const logs = logger.getLogs();
      expect(logs[0].context?.sessionId).toBe('parent-session');
    });

    it('should allow nested child loggers', () => {
      const child1 = logger.child({ sessionId: 'session-1' });
      const child2 = child1.child({ agentId: 'agent-1' });

      child2.info('Nested message');

      const logs = logger.getLogs();
      expect(logs[0].context?.sessionId).toBe('session-1');
      expect(logs[0].context?.agentId).toBe('agent-1');
    });

    it('should support all log methods in child logger', () => {
      const child = logger.child('TestComponent');

      child.debug('Debug');
      child.info('Info');
      child.warn('Warn');
      child.error('Error');

      expect(logger.getLogs()).toHaveLength(4);
    });

    it('should return context from child logger', () => {
      const child = logger.child({ sessionId: 'test', agentId: 'agent' });
      const context = child.getContext();

      expect(context.sessionId).toBe('test');
      expect(context.agentId).toBe('agent');
    });
  });

  describe('Performance Timing Utilities', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should create timer with startTimer', () => {
      const endTimer = logger.startTimer('Test operation');
      expect(typeof endTimer).toBe('function');

      endTimer();

      const logs = logger.getLogs();
      expect(logs[0].message).toContain('Test operation completed');
      expect(logs[0].durationMs).toBeDefined();
      expect(logs[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should time synchronous operations', () => {
      const result = logger.time('Sync operation', () => {
        // Simple computation
        let sum = 0;
        for (let i = 0; i < 1000; i++) sum += i;
        return sum;
      });

      expect(result.result).toBe(499500);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);

      const logs = logger.getLogs();
      expect(logs[0].durationMs).toBeDefined();
    });

    it('should time asynchronous operations', async () => {
      const result = await logger.timeAsync('Async operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });

      expect(result.result).toBe('async result');
      expect(result.durationMs).toBeGreaterThanOrEqual(10);

      const logs = logger.getLogs();
      expect(logs[0].durationMs).toBeGreaterThanOrEqual(10);
    });

    it('should time with error handling', async () => {
      const result = await logger.timeWithError('Successful operation', async () => {
        return 'success';
      });

      expect(result.result).toBe('success');
    });

    it('should log errors in timeWithError', async () => {
      const testError = new Error('Test failure');

      await expect(
        logger.timeWithError('Failing operation', async () => {
          throw testError;
        })
      ).rejects.toThrow('Test failure');

      const logs = logger.getLogs();
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].message).toContain('Failing operation failed');
      expect(logs[0].error).toBeDefined();
    });

    it('should support timing in child logger', async () => {
      const child = logger.child({ sessionId: 'timer-session' });

      const endTimer = child.startTimer('Child timer');
      endTimer();

      const logs = logger.getLogs();
      expect(logs[0].context?.sessionId).toBe('timer-session');
      expect(logs[0].durationMs).toBeDefined();
    });
  });

  describe('Log Management', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should get all logs', () => {
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('should get logs by level', () => {
      logger.debug('Debug 1');
      logger.info('Info 1');
      logger.debug('Debug 2');
      logger.warn('Warn 1');

      const debugLogs = logger.getLogsByLevel(LogLevel.DEBUG);
      expect(debugLogs).toHaveLength(2);
    });

    it('should get logs by context field', () => {
      logger.info('Msg 1', { sessionId: 'session-a' });
      logger.info('Msg 2', { sessionId: 'session-b' });
      logger.info('Msg 3', { sessionId: 'session-a' });

      const sessionALogs = logger.getLogsByContext('sessionId', 'session-a');
      expect(sessionALogs).toHaveLength(2);
    });

    it('should clear logs', () => {
      logger.info('Test 1');
      logger.info('Test 2');

      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();

      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('Level Management', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.INFO });
    });

    it('should get current level', () => {
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it('should set level with enum', () => {
      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it('should set level with string', () => {
      logger.setLevel('debug');
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it('should check if level is enabled', () => {
      logger.setLevel(LogLevel.WARN);

      expect(logger.isLevelEnabled(LogLevel.DEBUG)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.INFO)).toBe(false);
      expect(logger.isLevelEnabled(LogLevel.WARN)).toBe(true);
      expect(logger.isLevelEnabled(LogLevel.ERROR)).toBe(true);
    });
  });

  describe('File Output', () => {
    it('should initialize file logging when enabled', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      new Logger({
        file: {
          enabled: true,
          directory: '/tmp/logs',
          filename: 'test.log',
        },
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/logs', { recursive: true });
      expect(fs.createWriteStream).toHaveBeenCalled();
    });

    it('should get log file path when file logging is enabled', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const logger = new Logger({
        file: {
          enabled: true,
          directory: '/tmp/logs',
          filename: 'test.log',
        },
      });

      const logPath = logger.getLogFilePath();
      // File path should be set after initialization
      expect(logPath).toBeTruthy();
      expect(logPath).toContain('test.log');
    });

    it('should return null for log path when file logging disabled', () => {
      const logger = new Logger();
      expect(logger.getLogFilePath()).toBeNull();
    });

    it('should use default log directory when not specified', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      new Logger({
        file: {
          enabled: true,
        },
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.komplete-kontrol/logs'),
        { recursive: true }
      );
    });
  });

  describe('Log Rotation', () => {
    it('should support date-based rotation', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const logger = new Logger({
        file: {
          enabled: true,
          directory: '/tmp/logs',
          filename: 'app.log',
          rotation: {
            enabled: true,
            dateRotation: true,
          },
        },
      });

      const logPath = logger.getLogFilePath();
      // Should include date in filename
      expect(logPath).toBeTruthy();
      expect(logPath).toContain('app-');
      expect(logPath).toContain('.log');
    });

    it('should support size-based rotation config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const logger = new Logger({
        file: {
          enabled: true,
          directory: '/tmp/logs',
          filename: 'app.log',
          rotation: {
            enabled: true,
            maxSizeBytes: 1024 * 1024, // 1MB
            maxFiles: 3,
          },
        },
      });

      const logPath = logger.getLogFilePath();
      expect(logPath).toBeTruthy();
      expect(logPath).toContain('app.log');
    });
  });

  describe('Global Logger', () => {
    it('should initialize global logger', () => {
      const logger = initLogger({ level: LogLevel.DEBUG });
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should get global logger', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should create logger with context', () => {
      const contextLogger = createLogger('TestComponent');
      expect(contextLogger).toBeInstanceOf(ContextLogger);
    });

    it('should create session logger', () => {
      const sessionLogger = createSessionLogger('session-123', 'claude-code', 'code');
      expect(sessionLogger).toBeInstanceOf(ContextLogger);

      const context = sessionLogger.getContext();
      expect(context.sessionId).toBe('session-123');
      expect(context.agentId).toBe('claude-code');
      expect(context.mode).toBe('code');
    });
  });

  describe('Close Method', () => {
    it('should close logger without errors', async () => {
      const logger = new Logger();
      await expect(logger.close()).resolves.not.toThrow();
    });

    it('should close file stream when file logging is enabled', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const mockEnd = vi.fn();
      vi.mocked(fs.createWriteStream).mockReturnValue({
        write: vi.fn(),
        end: mockEnd,
        on: vi.fn(),
      } as any);

      const logger = new Logger({
        file: {
          enabled: true,
          directory: '/tmp/logs',
        },
      });

      await logger.close();
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('JSON Format for File Output', () => {
    it('should support JSON format configuration', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const logger = new Logger({
        file: {
          enabled: true,
          directory: '/tmp/logs',
          jsonFormat: true,
        },
      });

      expect(logger.config.file?.jsonFormat).toBe(true);
    });
  });

  describe('Max Data Length', () => {
    it('should use default max data length', () => {
      const logger = new Logger();
      expect(logger.config.maxDataLength).toBe(10000);
    });

    it('should accept custom max data length', () => {
      const logger = new Logger({ maxDataLength: 500 });
      expect(logger.config.maxDataLength).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({ level: LogLevel.DEBUG });
    });

    it('should handle empty message', () => {
      expect(() => logger.info('')).not.toThrow();
    });

    it('should handle very long message', () => {
      const longMessage = 'a'.repeat(100000);
      expect(() => logger.info(longMessage)).not.toThrow();
    });

    it('should handle special characters', () => {
      expect(() => logger.info('Special: éàü ™ © ® 日本語')).not.toThrow();
    });

    it('should handle null context gracefully', () => {
      expect(() => logger.info('Message', null as any)).not.toThrow();
    });

    it('should handle circular reference in data', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      // Should not throw, but may log truncated data
      expect(() => logger.info('Message', 'ctx', circular)).not.toThrow();
    });

    it('should handle rapid consecutive calls', () => {
      for (let i = 0; i < 1000; i++) {
        logger.debug(`Message ${i}`);
      }
      expect(logger.getLogs()).toHaveLength(1000);
    });
  });
});
