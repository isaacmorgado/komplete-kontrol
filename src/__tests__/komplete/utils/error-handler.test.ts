/**
 * Tests for Error Handler
 *
 * Tests the error handling infrastructure including:
 * - Error severity classification
 * - Recovery strategy determination
 * - Error types (KompleteError, ProviderError, ToolError, ModeError, etc.)
 * - Recovery suggestions
 * - Error statistics tracking
 * - Retry with exponential backoff
 * - Error wrapping
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
      green: createMock(),
      white: mockFn,
    },
  };
});

// Import after mocking
import {
  ErrorHandler,
  ErrorSeverity,
  RecoveryStrategy,
  RecoverySuggestion,
  initErrorHandler,
  getErrorHandler,
  handleError,
  retry,
  wrap,
  getRecoverySuggestions,
  getAutoApplicableSuggestions,
  registerRecoverySuggestions,
  addRecoverySuggestions,
} from '../../../komplete/utils/error-handler';

import {
  KompleteError,
  ProviderError,
  AgentError,
  ContextError,
  ConfigError,
  ToolError,
  ModeError,
} from '../../../komplete/types';

describe('Error Handler', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    };
    // Reset global error handler
    initErrorHandler({ exitOnCritical: false });
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
    vi.clearAllMocks();
  });

  describe('ErrorHandler class', () => {
    describe('constructor', () => {
      it('should create an error handler with default config', () => {
        const handler = new ErrorHandler();
        expect(handler).toBeInstanceOf(ErrorHandler);
      });

      it('should create an error handler with custom config', () => {
        const handler = new ErrorHandler({
          verbose: true,
          exitOnCritical: false,
        });
        expect(handler).toBeInstanceOf(ErrorHandler);
      });
    });

    describe('handle()', () => {
      it('should handle KompleteError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new KompleteError('Test error', 'TEST_ERROR');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.ABORT);
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should handle ProviderError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ProviderError('Provider failed', 'openai', 'PROVIDER_ERROR');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.FALLBACK);
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should handle ProviderError with RATE_LIMIT_ERROR', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ProviderError('Rate limited', 'openai', 'RATE_LIMIT_ERROR');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.RETRY);
      });

      it('should handle ProviderError with AUTH_ERROR', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ProviderError('Auth failed', 'openai', 'AUTH_ERROR');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.ABORT);
      });

      it('should handle ToolError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ToolError('Tool failed', 'file_read', 'TOOL_ERROR');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.CONTINUE);
      });

      it('should handle ToolError with TOOL_NOT_FOUND', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ToolError('Tool not found', 'unknown_tool', 'TOOL_NOT_FOUND');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.ABORT);
      });

      it('should handle ToolError with TOOL_TIMEOUT', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ToolError('Tool timeout', 'slow_tool', 'TOOL_TIMEOUT');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.RETRY);
      });

      it('should handle ModeError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ModeError('Mode switch failed', 'code', 'architect', 'MODE_ERROR');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.FALLBACK);
      });

      it('should handle AgentError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new AgentError('Agent failed', 'agent-1');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.CONTINUE);
      });

      it('should handle ContextError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ContextError('Context corrupted');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.ABORT);
      });

      it('should handle ConfigError', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new ConfigError('Invalid config');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.ABORT);
      });

      it('should handle standard Error', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new Error('Standard error');

        const strategy = await handler.handle(error);

        expect(strategy).toBe(RecoveryStrategy.ABORT);
      });

      it('should handle error with context', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        const error = new KompleteError('Test error', 'TEST_ERROR');

        await handler.handle(error, {
          operation: 'test_operation',
          component: 'test_component',
          timestamp: new Date(),
          metadata: { key: 'value' },
        });

        expect(consoleSpy.error).toHaveBeenCalled();
      });
    });

    describe('getRecoverySuggestions()', () => {
      it('should return suggestions for ProviderError', () => {
        const handler = new ErrorHandler();
        const error = new ProviderError('Provider failed', 'openai', 'PROVIDER_ERROR');

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toBeDefined();
        expect(suggestions[0].explanation).toBeDefined();
        expect(suggestions[0].priority).toBe(1);
      });

      it('should return suggestions for ToolError', () => {
        const handler = new ErrorHandler();
        const error = new ToolError('Tool failed', 'file_read', 'TOOL_ERROR');

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toContain('parameter');
      });

      it('should return suggestions for ModeError', () => {
        const handler = new ErrorHandler();
        const error = new ModeError('Mode switch failed', 'code', 'architect', 'MODE_ERROR');

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toContain('mode');
      });

      it('should return suggestions for ConfigError', () => {
        const handler = new ErrorHandler();
        const error = new ConfigError('Invalid config', { path: '/config' });

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toContain('config');
      });

      it('should return suggestions for RATE_LIMIT_ERROR', () => {
        const handler = new ErrorHandler();
        const error = new ProviderError('Rate limited', 'openai', 'RATE_LIMIT_ERROR');

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toContain('Wait');
      });

      it('should return suggestions for AUTH_ERROR', () => {
        const handler = new ErrorHandler();
        const error = new ProviderError('Auth failed', 'openai', 'AUTH_ERROR');

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toContain('API key');
      });

      it('should return default suggestions for unknown errors', () => {
        const handler = new ErrorHandler();
        const error = new KompleteError('Unknown error', 'COMPLETELY_UNKNOWN_CODE');

        const suggestions = handler.getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].action).toContain('Check error');
      });

      it('should return suggestions sorted by priority', () => {
        const handler = new ErrorHandler();
        const error = new ProviderError('Provider failed', 'openai', 'PROVIDER_ERROR');

        const suggestions = handler.getRecoverySuggestions(error);

        for (let i = 1; i < suggestions.length; i++) {
          expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i - 1].priority);
        }
      });
    });

    describe('getAutoApplicableSuggestions()', () => {
      it('should return only auto-applicable suggestions', () => {
        const handler = new ErrorHandler();
        const error = new ProviderError('Rate limited', 'openai', 'RATE_LIMIT_ERROR');

        const suggestions = handler.getAutoApplicableSuggestions(error);

        expect(suggestions.every((s) => s.autoApplicable)).toBe(true);
      });

      it('should filter out non-auto-applicable suggestions', () => {
        const handler = new ErrorHandler();
        const error = new ProviderError('Auth failed', 'openai', 'AUTH_ERROR');

        const allSuggestions = handler.getRecoverySuggestions(error);
        const autoSuggestions = handler.getAutoApplicableSuggestions(error);

        expect(autoSuggestions.length).toBeLessThanOrEqual(allSuggestions.length);
      });
    });

    describe('retry()', () => {
      it('should retry operation on failure', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });
        let attempts = 0;

        const operation = vi.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        });

        const result = await handler.retry(operation, undefined, 3);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(3);
      });

      it('should throw after max retries exhausted', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

        await expect(handler.retry(operation, undefined, 2)).rejects.toThrow('Persistent failure');
        expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });

      it('should succeed immediately if operation succeeds first time', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        const operation = vi.fn().mockResolvedValue('immediate success');

        const result = await handler.retry(operation);

        expect(result).toBe('immediate success');
        expect(operation).toHaveBeenCalledTimes(1);
      });
    });

    describe('wrap()', () => {
      it('should wrap function and handle errors', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        const fn = vi.fn().mockRejectedValue(new KompleteError('Test error', 'TEST_ERROR'));
        const wrapped = handler.wrap(fn);

        await expect(wrapped()).rejects.toThrow('Test error');
        expect(consoleSpy.error).toHaveBeenCalled();
      });

      it('should return result when function succeeds', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        const fn = vi.fn().mockResolvedValue('success');
        const wrapped = handler.wrap(fn);

        const result = await wrapped();

        expect(result).toBe('success');
      });

      it('should pass arguments to wrapped function', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        const fn = vi.fn().mockImplementation(async (a: number, b: string) => `${a}-${b}`);
        const wrapped = handler.wrap(fn);

        const result = await wrapped(42, 'test');

        expect(result).toBe('42-test');
        expect(fn).toHaveBeenCalledWith(42, 'test');
      });
    });

    describe('getErrorStats()', () => {
      it('should track error occurrences', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        await handler.handle(new ProviderError('Error 1', 'openai'));
        await handler.handle(new ProviderError('Error 2', 'anthropic'));
        await handler.handle(new ToolError('Error 3', 'tool1'));

        const stats = handler.getErrorStats();

        expect(stats['ProviderError']).toBe(2);
        expect(stats['ToolError']).toBe(1);
      });
    });

    describe('clearStats()', () => {
      it('should clear error statistics', async () => {
        const handler = new ErrorHandler({ exitOnCritical: false });

        await handler.handle(new ProviderError('Error 1', 'openai'));
        await handler.handle(new ToolError('Error 2', 'tool1'));

        handler.clearStats();
        const stats = handler.getErrorStats();

        expect(Object.keys(stats).length).toBe(0);
      });
    });
  });

  describe('Error Types', () => {
    describe('KompleteError', () => {
      it('should create error with code', () => {
        const error = new KompleteError('Test message', 'TEST_CODE');

        expect(error.name).toBe('KompleteError');
        expect(error.message).toBe('Test message');
        expect(error.code).toBe('TEST_CODE');
      });

      it('should create error with details', () => {
        const error = new KompleteError('Test message', 'TEST_CODE', { key: 'value' });

        expect(error.details).toEqual({ key: 'value' });
      });
    });

    describe('ProviderError', () => {
      it('should create error with provider info', () => {
        const error = new ProviderError('API failed', 'openai', 'API_ERROR', { status: 500 });

        expect(error.name).toBe('ProviderError');
        expect(error.provider).toBe('openai');
        expect(error.code).toBe('API_ERROR');
        expect(error.details).toEqual({ status: 500 });
      });
    });

    describe('ToolError', () => {
      it('should create error with tool info', () => {
        const error = new ToolError('Tool failed', 'file_read', 'TOOL_ERROR', { path: '/test' });

        expect(error.name).toBe('ToolError');
        expect(error.toolName).toBe('file_read');
        expect(error.code).toBe('TOOL_ERROR');
        expect(error.details).toEqual({ toolName: 'file_read', path: '/test' });
      });
    });

    describe('ModeError', () => {
      it('should create error with mode info', () => {
        const error = new ModeError('Mode switch failed', 'code', 'architect', 'MODE_ERROR');

        expect(error.name).toBe('ModeError');
        expect(error.fromMode).toBe('code');
        expect(error.toMode).toBe('architect');
        expect(error.code).toBe('MODE_ERROR');
      });

      it('should handle undefined fromMode', () => {
        const error = new ModeError('Mode switch failed', undefined, 'architect', 'MODE_ERROR');

        expect(error.fromMode).toBeUndefined();
        expect(error.toMode).toBe('architect');
      });
    });

    describe('AgentError', () => {
      it('should create error with agent ID', () => {
        const error = new AgentError('Agent failed', 'agent-123');

        expect(error.name).toBe('AgentError');
        expect(error.agentId).toBe('agent-123');
        expect(error.code).toBe('AGENT_ERROR');
      });
    });

    describe('ContextError', () => {
      it('should create context error', () => {
        const error = new ContextError('Context corrupted');

        expect(error.name).toBe('ContextError');
        expect(error.code).toBe('CONTEXT_ERROR');
      });
    });

    describe('ConfigError', () => {
      it('should create config error', () => {
        const error = new ConfigError('Invalid config');

        expect(error.name).toBe('ConfigError');
        expect(error.code).toBe('CONFIG_ERROR');
      });
    });
  });

  describe('Global Functions', () => {
    describe('initErrorHandler()', () => {
      it('should initialize global error handler', () => {
        const handler = initErrorHandler({ verbose: true });

        expect(handler).toBeInstanceOf(ErrorHandler);
      });
    });

    describe('getErrorHandler()', () => {
      it('should return global error handler', () => {
        const handler = getErrorHandler();

        expect(handler).toBeInstanceOf(ErrorHandler);
      });

      it('should create handler if none exists', () => {
        const handler = getErrorHandler();

        expect(handler).toBeInstanceOf(ErrorHandler);
      });
    });

    describe('handleError()', () => {
      it('should handle error using global handler', async () => {
        const error = new ProviderError('Test error', 'openai');

        const strategy = await handleError(error);

        expect(strategy).toBe(RecoveryStrategy.FALLBACK);
      });
    });

    describe('retry()', () => {
      it('should retry using global handler', async () => {
        let attempts = 0;
        const operation = async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return 'success';
        };

        const result = await retry(operation);

        expect(result).toBe('success');
        expect(attempts).toBe(2);
      });
    });

    describe('wrap()', () => {
      it('should wrap function using global handler', async () => {
        const fn = async (x: number) => x * 2;
        const wrapped = wrap(fn);

        const result = await wrapped(5);

        expect(result).toBe(10);
      });
    });

    describe('getRecoverySuggestions()', () => {
      it('should get suggestions using global handler', () => {
        const error = new ToolError('Tool failed', 'test_tool', 'TOOL_ERROR');

        const suggestions = getRecoverySuggestions(error);

        expect(suggestions.length).toBeGreaterThan(0);
      });
    });

    describe('getAutoApplicableSuggestions()', () => {
      it('should get auto-applicable suggestions using global handler', () => {
        const error = new ProviderError('Rate limited', 'openai', 'RATE_LIMIT_ERROR');

        const suggestions = getAutoApplicableSuggestions(error);

        expect(suggestions.every((s) => s.autoApplicable)).toBe(true);
      });
    });

    describe('registerRecoverySuggestions()', () => {
      it('should register custom recovery suggestions', () => {
        const customSuggestions: RecoverySuggestion[] = [
          {
            action: 'Custom action',
            explanation: 'Custom explanation',
            autoApplicable: true,
            priority: 1,
          },
        ];

        registerRecoverySuggestions('CUSTOM_ERROR', customSuggestions);

        const error = new KompleteError('Custom error', 'CUSTOM_ERROR');
        const suggestions = getRecoverySuggestions(error);

        expect(suggestions[0].action).toBe('Custom action');
      });
    });

    describe('addRecoverySuggestions()', () => {
      it('should add suggestions to existing error code', () => {
        const originalError = new ProviderError('Error', 'openai', 'PROVIDER_ERROR');
        const originalCount = getRecoverySuggestions(originalError).length;

        addRecoverySuggestions('PROVIDER_ERROR', [
          {
            action: 'New suggestion',
            explanation: 'New explanation',
            autoApplicable: false,
            priority: 99,
          },
        ]);

        const newCount = getRecoverySuggestions(originalError).length;
        expect(newCount).toBe(originalCount + 1);
      });

      it('should create new entry if error code does not exist', () => {
        const newSuggestions: RecoverySuggestion[] = [
          {
            action: 'Brand new action',
            explanation: 'Brand new explanation',
            autoApplicable: true,
            priority: 1,
          },
        ];

        addRecoverySuggestions('BRAND_NEW_ERROR', newSuggestions);

        const error = new KompleteError('New error', 'BRAND_NEW_ERROR');
        const suggestions = getRecoverySuggestions(error);

        expect(suggestions[0].action).toBe('Brand new action');
      });
    });
  });

  describe('Recovery Strategy', () => {
    it('should have correct enum values', () => {
      expect(RecoveryStrategy.RETRY).toBe('retry');
      expect(RecoveryStrategy.FALLBACK).toBe('fallback');
      expect(RecoveryStrategy.ABORT).toBe('abort');
      expect(RecoveryStrategy.CONTINUE).toBe('continue');
    });
  });

  describe('Error Severity', () => {
    it('should have correct enum values', () => {
      expect(ErrorSeverity.LOW).toBe('low');
      expect(ErrorSeverity.MEDIUM).toBe('medium');
      expect(ErrorSeverity.HIGH).toBe('high');
      expect(ErrorSeverity.CRITICAL).toBe('critical');
    });
  });
});
