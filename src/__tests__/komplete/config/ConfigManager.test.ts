/**
 * Tests for ConfigManager
 *
 * Tests the configuration management system including:
 * - Loading from user config file (~/.komplete-kontrol/config.json)
 * - Loading from project config file (.komplete-kontrol.json)
 * - Environment variable overrides
 * - Config merging (project overrides user overrides defaults)
 * - Default values for modes, models, and providers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: {
    writeFile: vi.fn(),
  },
}));

// Mock os module
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

// Import after mocking
import {
  ConfigManager,
  getConfigManager,
  loadConfig,
  DEFAULT_MODE_SETTINGS,
  DEFAULT_PROVIDER_MODELS,
  DEFAULT_CONTEXT_WINDOW_SIZE,
  DEFAULT_TOOL_CALLING_METHOD,
} from '../../../komplete/config';

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    // Clear all mocks
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env.KOMPLETE_ANTHROPIC_API_KEY;
    delete process.env.KOMPLETE_OPENAI_API_KEY;
    delete process.env.KOMPLETE_DEFAULT_MODEL;
    delete process.env.KOMPLETE_DEFAULT_MODE;
    delete process.env.KOMPLETE_TOOL_CALLING_METHOD;
    delete process.env.KOMPLETE_LOG_LEVEL;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Default Configuration Values', () => {
    it('should have correct default mode settings', () => {
      expect(DEFAULT_MODE_SETTINGS.code).toEqual({
        temperature: 0.3,
        maxTokens: 4096,
      });
      expect(DEFAULT_MODE_SETTINGS.architect).toEqual({
        temperature: 0.7,
        maxTokens: 8192,
      });
      expect(DEFAULT_MODE_SETTINGS.debug).toEqual({
        temperature: 0.2,
        maxTokens: 4096,
      });
    });

    it('should have correct default provider models', () => {
      expect(DEFAULT_PROVIDER_MODELS.anthropic).toBe('claude-3-5-sonnet-20241022');
      expect(DEFAULT_PROVIDER_MODELS.openai).toBe('gpt-4o');
      expect(DEFAULT_PROVIDER_MODELS.featherless).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct');
      expect(DEFAULT_PROVIDER_MODELS.ollama).toBe('llama3.1');
    });

    it('should have correct default context window size', () => {
      expect(DEFAULT_CONTEXT_WINDOW_SIZE).toBe(200000);
    });

    it('should have correct default tool calling method', () => {
      expect(DEFAULT_TOOL_CALLING_METHOD).toBe('native');
    });
  });

  describe('ConfigManager Initialization', () => {
    it('should create a ConfigManager instance', () => {
      const manager = new ConfigManager();
      expect(manager).toBeInstanceOf(ConfigManager);
    });

    it('should return correct user config path', () => {
      const manager = new ConfigManager();
      expect(manager.getUserConfigPath()).toBe('/home/testuser/.komplete-kontrol/config.json');
    });

    it('should return correct project config path', () => {
      const manager = new ConfigManager();
      expect(manager.getProjectConfigPath()).toContain('.komplete-kontrol.json');
    });
  });

  describe('Configuration Loading', () => {
    it('should load with defaults when no config files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.defaultMode).toBe('code');
      expect(config.defaultModel).toBe('anthropic/claude-3-5-sonnet-20241022');
      expect(config.toolCallingMethod).toBe('native');
      expect(config.context.maxTokens).toBe(DEFAULT_CONTEXT_WINDOW_SIZE);
    });

    it('should load and merge user config', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        return pathStr.includes('.komplete-kontrol/config.json');
      });

      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        defaultMode: 'architect',
        providers: {
          anthropic: {
            apiKey: 'test-key',
          },
        },
      }));

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.defaultMode).toBe('architect');
      expect(config.providers?.anthropic?.apiKey).toBe('test-key');
    });

    it('should merge project config over user config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      vi.mocked(fs.readFileSync).mockImplementation((p: fs.PathOrFileDescriptor) => {
        const pathStr = p.toString();
        if (pathStr.includes('.komplete-kontrol/config.json')) {
          return JSON.stringify({
            defaultMode: 'architect',
            defaultModel: 'user-model',
          });
        }
        if (pathStr.includes('.komplete-kontrol.json')) {
          return JSON.stringify({
            defaultMode: 'debug',
          });
        }
        return '{}';
      });

      const manager = new ConfigManager();
      const config = manager.load();

      // Project config should override user config
      expect(config.defaultMode).toBe('debug');
      // User config should still apply for non-overridden values
      expect(config.defaultModel).toBe('user-model');
    });

    it('should apply environment variables with highest priority', () => {
      process.env.KOMPLETE_DEFAULT_MODE = 'test';
      process.env.KOMPLETE_DEFAULT_MODEL = 'env-model';
      process.env.KOMPLETE_ANTHROPIC_API_KEY = 'env-key';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        defaultMode: 'code',
        defaultModel: 'file-model',
      }));

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.defaultMode).toBe('test');
      expect(config.defaultModel).toBe('env-model');
      expect(config.providers?.anthropic?.apiKey).toBe('env-key');
    });
  });

  describe('Environment Variable Support', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should read KOMPLETE_DEFAULT_MODE', () => {
      process.env.KOMPLETE_DEFAULT_MODE = 'architect';

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.defaultMode).toBe('architect');
    });

    it('should read KOMPLETE_TOOL_CALLING_METHOD', () => {
      process.env.KOMPLETE_TOOL_CALLING_METHOD = 'xml';

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.toolCallingMethod).toBe('xml');
    });

    it('should read all provider API keys', () => {
      process.env.KOMPLETE_ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.KOMPLETE_OPENAI_API_KEY = 'openai-key';
      process.env.KOMPLETE_FEATHERLESS_API_KEY = 'featherless-key';
      process.env.KOMPLETE_OLLAMA_BASE_URL = 'http://localhost:11434';

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.providers?.anthropic?.apiKey).toBe('anthropic-key');
      expect(config.providers?.openai?.apiKey).toBe('openai-key');
      expect(config.providers?.featherless?.apiKey).toBe('featherless-key');
      expect(config.providers?.ollama?.baseUrl).toBe('http://localhost:11434');
    });

    it('should read KOMPLETE_LOG_LEVEL', () => {
      process.env.KOMPLETE_LOG_LEVEL = 'debug';

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.logging.level).toBe('debug');
    });
  });

  describe('Mode Settings', () => {
    it('should return correct mode settings with defaults', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ConfigManager();
      manager.load();

      const codeSettings = manager.getModeSettings('code');
      expect(codeSettings.temperature).toBe(0.3);
      expect(codeSettings.maxTokens).toBe(4096);

      const architectSettings = manager.getModeSettings('architect');
      expect(architectSettings.temperature).toBe(0.7);
      expect(architectSettings.maxTokens).toBe(8192);
    });

    it('should merge mode-specific config with defaults', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        modes: {
          code: {
            temperature: 0.5,
            preferredModel: 'custom-model',
          },
        },
      }));

      const manager = new ConfigManager();
      manager.load();

      const settings = manager.getModeSettings('code');
      expect(settings.temperature).toBe(0.5);
      expect(settings.maxTokens).toBe(4096); // Falls back to default
      expect(settings.preferredModel).toBe('custom-model');
    });
  });

  describe('Provider Default Models', () => {
    it('should return default model for provider', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ConfigManager();
      manager.load();

      expect(manager.getProviderDefaultModel('anthropic')).toBe('claude-3-5-sonnet-20241022');
      expect(manager.getProviderDefaultModel('openai')).toBe('gpt-4o');
    });

    it('should return configured model over default', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        providers: {
          anthropic: {
            defaultModel: 'claude-3-haiku',
          },
        },
      }));

      const manager = new ConfigManager();
      manager.load();

      expect(manager.getProviderDefaultModel('anthropic')).toBe('claude-3-haiku');
    });
  });

  describe('Config File Detection', () => {
    it('should detect user config exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return p.toString().includes('.komplete-kontrol/config.json');
      });

      const manager = new ConfigManager();
      expect(manager.hasUserConfig()).toBe(true);
      expect(manager.hasProjectConfig()).toBe(false);
    });

    it('should detect project config exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        // Match project config file (ends with .komplete-kontrol.json and is in cwd)
        return p.toString().endsWith('.komplete-kontrol.json');
      });

      const manager = new ConfigManager();
      expect(manager.hasProjectConfig()).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for invalid mode', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        defaultMode: 'invalid-mode',
      }));

      const manager = new ConfigManager();
      expect(() => manager.load()).toThrow();
    });

    it('should throw error for invalid tool calling method', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        toolCallingMethod: 'invalid',
      }));

      const manager = new ConfigManager();
      expect(() => manager.load()).toThrow();
    });

    it('should accept valid configuration', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        defaultMode: 'architect',
        toolCallingMethod: 'xml',
        context: {
          maxTokens: 100000,
        },
      }));

      const manager = new ConfigManager();
      const config = manager.load();

      expect(config.defaultMode).toBe('architect');
      expect(config.toolCallingMethod).toBe('xml');
      expect(config.context.maxTokens).toBe(100000);
    });
  });

  describe('Global ConfigManager', () => {
    it('should return singleton instance', () => {
      const manager1 = getConfigManager();
      const manager2 = getConfigManager();
      expect(manager1).toBe(manager2);
    });

    it('should load config globally', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = loadConfig();
      expect(config.defaultMode).toBe('code');
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to project file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ConfigManager();
      manager.load();

      await manager.saveToProjectConfig({
        defaultMode: 'debug',
      });

      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should create directory when saving user config', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ConfigManager();
      manager.load();

      await manager.saveToUserConfig({
        providers: {
          anthropic: { apiKey: 'new-key' },
        },
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.komplete-kontrol'),
        { recursive: true },
      );
    });
  });

  describe('Init Methods', () => {
    it('should initialize user config directory and file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const manager = new ConfigManager();
      await manager.initUserConfig();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.komplete-kontrol'),
        { recursive: true },
      );
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should not overwrite existing user config', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => {
        return p.toString().includes('.komplete-kontrol');
      });

      const manager = new ConfigManager();
      await manager.initUserConfig();

      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });
});
