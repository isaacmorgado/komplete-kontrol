/**
 * Configuration management system for KOMPLETE-KONTROL CLI
 *
 * Handles loading, saving, and validating configuration from multiple sources.
 *
 * Configuration Priority (highest to lowest):
 * 1. Environment variables (KOMPLETE_*)
 * 2. Project config file (.komplete-kontrol.json in current directory)
 * 3. User config file (~/.komplete-kontrol/config.json)
 * 4. Default values
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { z } from 'zod';
import type { Config, OperationalMode } from '../types';
import { ConfigError } from '../types';
import { Logger } from '../utils/logger';

/**
 * Environment variable prefix
 */
const ENV_PREFIX = 'KOMPLETE_';

/**
 * Get user config directory path
 * Returns ~/.komplete-kontrol on Unix-like systems
 */
function getUserConfigDir(): string {
  const home = os.homedir();
  return path.join(home, '.komplete-kontrol');
}

/**
 * Get user config file path
 * Returns ~/.komplete-kontrol/config.json
 */
function getUserConfigPath(): string {
  return path.join(getUserConfigDir(), 'config.json');
}

/**
 * Get project config file path
 * Returns .komplete-kontrol.json in the current directory
 */
function getProjectConfigPath(): string {
  return path.join(process.cwd(), '.komplete-kontrol.json');
}

/**
 * Get all configuration paths in order of priority (lowest to highest)
 * Can be overridden by KOMPLETE_CONFIG_PATHS environment variable
 */
function getDefaultConfigPaths(): string[] {
  // Check for custom config paths from environment variable
  const customPaths = process.env[`${ENV_PREFIX}CONFIG_PATHS`];
  if (customPaths) {
    try {
      // Parse comma-separated paths
      const paths = customPaths.split(',').map(p => p.trim()).filter(p => p.length > 0);
      if (paths.length > 0) {
        return paths;
      }
    } catch (error) {
      // If parsing fails, use default paths
    }
  }

  // Default configuration paths (in order of priority, lowest first)
  // Later entries override earlier ones during merge
  return [
    getUserConfigPath(),        // ~/.komplete-kontrol/config.json (user defaults)
    getProjectConfigPath(),     // .komplete-kontrol.json (project overrides)
  ];
}

/**
 * Default configuration paths (computed)
 * @internal Exported for testing purposes
 */
export const DEFAULT_CONFIG_PATHS = getDefaultConfigPaths();

// ============================================================================
// Default Configuration Values
// ============================================================================

/**
 * Default mode-specific settings
 */
export const DEFAULT_MODE_SETTINGS: Record<OperationalMode, { temperature: number; maxTokens: number }> = {
  'architect': { temperature: 0.7, maxTokens: 8192 },
  'code': { temperature: 0.3, maxTokens: 4096 },
  'debug': { temperature: 0.2, maxTokens: 4096 },
  'test': { temperature: 0.3, maxTokens: 4096 },
  'reverse-engineer': { temperature: 0.4, maxTokens: 8192 },
  'ask': { temperature: 0.7, maxTokens: 2048 },
};

/**
 * Default models per provider
 */
export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  'anthropic': 'claude-3-5-sonnet-20241022',
  'openai': 'gpt-4o',
  'featherless': 'meta-llama/Meta-Llama-3.1-70B-Instruct',
  'ollama': 'llama3.1',
  'groq': 'llama-3.1-70b-versatile',
  'openRouter': 'anthropic/claude-3.5-sonnet',
};

/**
 * Default context window size
 */
export const DEFAULT_CONTEXT_WINDOW_SIZE = 200000;

/**
 * Default tool calling method
 */
export const DEFAULT_TOOL_CALLING_METHOD: 'native' | 'xml' | 'json' = 'native';

/**
 * Valid operational modes
 */
const OperationalModeSchema = z.enum([
  'architect',
  'code',
  'debug',
  'test',
  'reverse-engineer',
  'ask',
]);

/**
 * Tool calling method schema
 */
const ToolCallingMethodSchema = z.enum(['native', 'xml', 'json']);

/**
 * Provider configuration schema with all supported providers
 */
const ProvidersSchema = z.object({
  openRouter: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    defaultModel: z.string().optional(),
  }).optional(),
  groq: z.object({
    apiKey: z.string().optional(),
    defaultModel: z.string().optional(),
  }).optional(),
  openai: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    organization: z.string().optional(),
    defaultModel: z.string().optional(),
  }).optional(),
  anthropic: z.object({
    apiKey: z.string().optional(),
    defaultModel: z.string().optional(),
  }).optional(),
  ollama: z.object({
    baseUrl: z.string().optional(),  // Not using .url() to allow localhost:port format
    defaultModel: z.string().optional(),
  }).optional(),
  featherless: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    defaultModel: z.string().optional(),
  }).optional(),
}).optional();

/**
 * Mode-specific configuration schema
 */
const ModeConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  preferredModel: z.string().optional(),
  toolGroups: z.array(z.enum(['read', 'edit', 'browser', 'command', 'mcp', 'modes'])).optional(),
}).optional();

/**
 * Configuration schema for validation
 */
const ConfigSchema = z.object({
  // Provider settings (Section 3.3)
  providers: ProvidersSchema,

  // Default mode (Section 3.2)
  defaultMode: OperationalModeSchema.default('code'),

  // Default model per provider (Section 3.2)
  defaultModel: z.string().default('anthropic/claude-3-5-sonnet-20241022'),
  fallbackModels: z.array(z.string()).default([
    'openai/gpt-4o',
    'anthropic/claude-3-haiku-20240307',
  ]),

  // Tool calling method (Section 3.2)
  toolCallingMethod: ToolCallingMethodSchema.default('native'),

  // Mode-specific settings (Section 3.2)
  modes: z.object({
    architect: ModeConfigSchema,
    code: ModeConfigSchema,
    debug: ModeConfigSchema,
    test: ModeConfigSchema,
    'reverse-engineer': ModeConfigSchema,
    ask: ModeConfigSchema,
  }).default({}),

  // Context management
  context: z.object({
    maxTokens: z.number().int().positive().default(DEFAULT_CONTEXT_WINDOW_SIZE),
    condensationThreshold: z.number().int().positive().default(150000),
    preserveToolUse: z.boolean().default(true),
  }).default({
    maxTokens: DEFAULT_CONTEXT_WINDOW_SIZE,
    condensationThreshold: 150000,
    preserveToolUse: true,
  }),

  // Agent settings
  agents: z.object({
    maxParallel: z.number().int().positive().default(4),
    timeoutMs: z.number().int().positive().default(30000),
  }).default({
    maxParallel: 4,
    timeoutMs: 30000,
  }),

  // Cost budgeting
  budget: z.object({
    maxCostPerCommand: z.number().positive().default(1.0),
    maxDailyCost: z.number().positive().default(10.0),
    alertThreshold: z.number().positive().default(0.8),
  }).default({
    maxCostPerCommand: 1.0,
    maxDailyCost: 10.0,
    alertThreshold: 0.8,
  }),

  // MCP settings
  mcp: z.object({
    servers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string(), z.string()).optional(),
      disabled: z.boolean().optional(),
    })).default([]),
    enabled: z.boolean().default(true),
  }).default({
    servers: [],
    enabled: true,
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
  }).default({
    level: 'info',
  }),
});

/**
 * Configuration manager class
 *
 * Handles reading, writing, and merging configuration from multiple sources:
 * - Default values (built-in)
 * - User config file (~/.komplete-kontrol/config.json)
 * - Project config file (.komplete-kontrol.json in current directory)
 * - Environment variables (KOMPLETE_*)
 *
 * Priority: env > project > user > defaults
 */
export class ConfigManager {
  private config: Config | null = null;
  private userConfigPath: string;
  private projectConfigPath: string;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger();
    this.userConfigPath = getUserConfigPath();
    this.projectConfigPath = getProjectConfigPath();
  }

  /**
   * Check if a file exists
   */
  private fileExists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Load configuration from file (returns null if file doesn't exist)
   */
  private loadFromFile(configPath: string, required: boolean = false): Partial<Config> | null {
    if (!this.fileExists(configPath)) {
      if (required) {
        throw new ConfigError(`Configuration file not found: ${configPath}`, {
          path: configPath,
        });
      }
      return null;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      this.logger.debug(`Loaded configuration from ${configPath}`, 'ConfigManager');
      return parsed;
    } catch (error) {
      throw new ConfigError(`Failed to load configuration from ${configPath}`, {
        path: configPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the user config directory path
   */
  getUserConfigDir(): string {
    return getUserConfigDir();
  }

  /**
   * Get the user config file path
   */
  getUserConfigPath(): string {
    return this.userConfigPath;
  }

  /**
   * Get the project config file path
   */
  getProjectConfigPath(): string {
    return this.projectConfigPath;
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnv(): Partial<Config> {
    const envConfig: Partial<Config> = {};

    // Provider API keys
    if (process.env[`${ENV_PREFIX}OPENROUTER_API_KEY`]) {
      envConfig.providers = envConfig.providers || {};
      if (!envConfig.providers.openRouter) {
        envConfig.providers.openRouter = { apiKey: process.env[`${ENV_PREFIX}OPENROUTER_API_KEY`]! };
      } else if (envConfig.providers.openRouter) {
        envConfig.providers.openRouter.apiKey = process.env[`${ENV_PREFIX}OPENROUTER_API_KEY`]!;
      }
    }

    if (process.env[`${ENV_PREFIX}GROQ_API_KEY`]) {
      envConfig.providers = envConfig.providers || {};
      if (!envConfig.providers.groq) {
        envConfig.providers.groq = { apiKey: process.env[`${ENV_PREFIX}GROQ_API_KEY`]! };
      } else if (envConfig.providers.groq) {
        envConfig.providers.groq.apiKey = process.env[`${ENV_PREFIX}GROQ_API_KEY`]!;
      }
    }

    if (process.env[`${ENV_PREFIX}OPENAI_API_KEY`]) {
      envConfig.providers = envConfig.providers || {};
      if (!envConfig.providers.openai) {
        envConfig.providers.openai = { apiKey: process.env[`${ENV_PREFIX}OPENAI_API_KEY`]! };
      } else if (envConfig.providers.openai) {
        envConfig.providers.openai.apiKey = process.env[`${ENV_PREFIX}OPENAI_API_KEY`]!;
      }
    }

    if (process.env[`${ENV_PREFIX}ANTHROPIC_API_KEY`]) {
      envConfig.providers = envConfig.providers || {};
      if (!envConfig.providers.anthropic) {
        envConfig.providers.anthropic = { apiKey: process.env[`${ENV_PREFIX}ANTHROPIC_API_KEY`]! };
      } else if (envConfig.providers.anthropic) {
        envConfig.providers.anthropic.apiKey = process.env[`${ENV_PREFIX}ANTHROPIC_API_KEY`]!;
      }
    }

    if (process.env[`${ENV_PREFIX}OLLAMA_BASE_URL`]) {
      envConfig.providers = envConfig.providers || {};
      if (!envConfig.providers.ollama) {
        envConfig.providers.ollama = { baseUrl: process.env[`${ENV_PREFIX}OLLAMA_BASE_URL`]! };
      } else if (envConfig.providers.ollama) {
        envConfig.providers.ollama.baseUrl = process.env[`${ENV_PREFIX}OLLAMA_BASE_URL`]!;
      }
    }

    if (process.env[`${ENV_PREFIX}FEATHERLESS_API_KEY`]) {
      envConfig.providers = envConfig.providers || {};
      if (!envConfig.providers.featherless) {
        envConfig.providers.featherless = { apiKey: process.env[`${ENV_PREFIX}FEATHERLESS_API_KEY`]! };
      } else if (envConfig.providers.featherless) {
        envConfig.providers.featherless.apiKey = process.env[`${ENV_PREFIX}FEATHERLESS_API_KEY`]!;
      }
    }

    // Default model
    if (process.env[`${ENV_PREFIX}DEFAULT_MODEL`]) {
      envConfig.defaultModel = process.env[`${ENV_PREFIX}DEFAULT_MODEL`];
    }

    // Default mode
    if (process.env[`${ENV_PREFIX}DEFAULT_MODE`]) {
      const mode = process.env[`${ENV_PREFIX}DEFAULT_MODE`]?.toLowerCase();
      if (mode && ['architect', 'code', 'debug', 'test', 'reverse-engineer', 'ask'].includes(mode)) {
        envConfig.defaultMode = mode as OperationalMode;
      }
    }

    // Tool calling method
    if (process.env[`${ENV_PREFIX}TOOL_CALLING_METHOD`]) {
      const method = process.env[`${ENV_PREFIX}TOOL_CALLING_METHOD`]?.toLowerCase();
      if (method && ['native', 'xml', 'json'].includes(method)) {
        envConfig.toolCallingMethod = method as 'native' | 'xml' | 'json';
      }
    }

    // Logging level
    if (process.env[`${ENV_PREFIX}LOG_LEVEL`]) {
      envConfig.logging = envConfig.logging ?? { level: 'info' };
      const level = process.env[`${ENV_PREFIX}LOG_LEVEL`]?.toLowerCase();
      if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
        envConfig.logging.level = level as 'debug' | 'info' | 'warn' | 'error';
      }
    }

    return envConfig;
  }

  /**
   * Merge configurations with priority
   */
  private mergeConfigs(...configs: Partial<Config>[]): Partial<Config> {
    const merged: Partial<Config> = {};

    for (const config of configs) {
      for (const [key, value] of Object.entries(config)) {
        if (value !== undefined && value !== null) {
          if (key in merged && typeof merged[key as keyof Config] === 'object' && !Array.isArray(merged[key as keyof Config])) {
            // Deep merge objects
            merged[key as keyof Config] = {
              ...(merged[key as keyof Config] as Record<string, unknown>),
              ...(value as Record<string, unknown>),
            } as any;
          } else {
            // Override
            merged[key as keyof Config] = value as any;
          }
        }
      }
    }

    return merged;
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: Partial<Config>): Config {
    try {
      return ConfigSchema.parse(config) as Config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigError('Configuration validation failed', {
          errors: error.issues,
        });
      }
      throw error;
    }
  }

  /**
   * Load configuration from all sources with proper priority
   *
   * Priority (highest to lowest):
   * 1. Environment variables (KOMPLETE_*)
   * 2. Project config file (.komplete-kontrol.json in current directory)
   * 3. User config file (~/.komplete-kontrol/config.json)
   * 4. Default values (built-in schema defaults)
   *
   * @param customConfigPath - Optional custom config file path (overrides project config)
   */
  load(customConfigPath?: string): Config {
    const sources: Partial<Config>[] = [];
    const loadedFrom: string[] = [];

    // 1. Load from user config file (~/.komplete-kontrol/config.json)
    const userConfig = this.loadFromFile(this.userConfigPath);
    if (userConfig) {
      sources.push(userConfig);
      loadedFrom.push(`user: ${this.userConfigPath}`);
    }

    // 2. Load from project config file (.komplete-kontrol.json) or custom path
    const projectPath = customConfigPath ?? this.projectConfigPath;
    const projectConfig = this.loadFromFile(projectPath, customConfigPath !== undefined);
    if (projectConfig) {
      sources.push(projectConfig);
      loadedFrom.push(`project: ${projectPath}`);
    }

    // 3. Load from environment variables (highest priority)
    const envConfig = this.loadFromEnv();
    if (Object.keys(envConfig).length > 0) {
      sources.push(envConfig);
      loadedFrom.push('environment');
    }

    // Merge all configs and validate
    const merged = this.mergeConfigs(...sources);
    this.config = this.validateConfig(merged);

    this.logger.info('Configuration loaded successfully', 'ConfigManager', {
      loadedFrom,
      defaultMode: this.config.defaultMode,
      defaultModel: this.config.defaultModel,
      toolCallingMethod: this.config.toolCallingMethod,
      providers: Object.keys(this.config.providers || {}),
    });

    return this.config;
  }

  /**
   * Check if user config file exists
   */
  hasUserConfig(): boolean {
    return this.fileExists(this.userConfigPath);
  }

  /**
   * Check if project config file exists
   */
  hasProjectConfig(): boolean {
    return this.fileExists(this.projectConfigPath);
  }

  /**
   * Initialize user config directory and file with defaults
   */
  async initUserConfig(): Promise<void> {
    const configDir = getUserConfigDir();

    // Create directory if it doesn't exist
    if (!this.fileExists(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      this.logger.info(`Created config directory: ${configDir}`, 'ConfigManager');
    }

    // Create default config file if it doesn't exist
    if (!this.hasUserConfig()) {
      const defaultConfig: Partial<Config> = {
        defaultMode: 'code',
        defaultModel: 'anthropic/claude-3-5-sonnet-20241022',
        toolCallingMethod: 'native',
        providers: {},
        logging: { level: 'info' },
      };

      await fs.promises.writeFile(
        this.userConfigPath,
        JSON.stringify(defaultConfig, null, 2),
        'utf-8',
      );
      this.logger.info(`Created default user config: ${this.userConfigPath}`, 'ConfigManager');
    }
  }

  /**
   * Initialize project config file with defaults
   */
  async initProjectConfig(): Promise<void> {
    if (!this.hasProjectConfig()) {
      const projectConfig: Partial<Config> = {
        defaultMode: 'code',
        // Project config typically only overrides specific settings
      };

      await fs.promises.writeFile(
        this.projectConfigPath,
        JSON.stringify(projectConfig, null, 2),
        'utf-8',
      );
      this.logger.info(`Created project config: ${this.projectConfigPath}`, 'ConfigManager');
    }
  }

  /**
   * Save configuration to user config file
   */
  async saveToUserConfig(config: Partial<Config>): Promise<void> {
    await this.saveToFile(config, this.userConfigPath);
  }

  /**
   * Save configuration to project config file
   */
  async saveToProjectConfig(config: Partial<Config>): Promise<void> {
    await this.saveToFile(config, this.projectConfigPath);
  }

  /**
   * Save configuration to a specific file
   */
  async saveToFile(config: Partial<Config>, filePath: string): Promise<void> {
    try {
      // Load existing config from file if it exists
      const existing = this.loadFromFile(filePath) ?? {};

      // Merge with existing config
      const merged = this.mergeConfigs(existing, config);
      const validated = this.validateConfig(merged);

      // Ensure directory exists
      const dir: string = path.dirname(filePath);
      if (dir && !this.fileExists(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      await fs.promises.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8');

      // Update in-memory config if this was the project config
      if (filePath === this.projectConfigPath && this.config) {
        this.config = this.validateConfig(this.mergeConfigs(this.config, config));
      }

      this.logger.info(`Configuration saved to ${filePath}`, 'ConfigManager');
    } catch (error) {
      throw new ConfigError(`Failed to save configuration to ${filePath}`, {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Legacy save method for backward compatibility
   * @deprecated Use saveToUserConfig or saveToProjectConfig instead
   */
  async save(config: Partial<Config>, configPath?: string): Promise<void> {
    const filePath = configPath ?? this.projectConfigPath;
    await this.saveToFile(config, filePath);
  }

  /**
   * Get all configuration
   */
  getAll(): Config {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Reload configuration from all sources
   */
  reload(): Config {
    return this.load();
  }

  /**
   * Set configuration value in memory (not persisted)
   */
  set<K extends keyof Config>(key: K, value: Config[K]): void {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded. Call load() first.');
    }
    this.config[key] = value;
  }

  /**
   * Get configuration value by key
   */
  getValue<K extends keyof Config>(key: K): Config[K] {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded. Call load() first.');
    }
    return this.config[key];
  }

  /**
   * Get settings for a specific mode
   * Returns merged defaults with mode-specific overrides
   */
  getModeSettings(mode: OperationalMode): { temperature: number; maxTokens: number; preferredModel?: string } {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded. Call load() first.');
    }

    const defaults = DEFAULT_MODE_SETTINGS[mode];
    const modeConfig = this.config.modes?.[mode];

    return {
      temperature: modeConfig?.temperature ?? defaults.temperature,
      maxTokens: modeConfig?.maxTokens ?? defaults.maxTokens,
      preferredModel: modeConfig?.preferredModel ?? this.config.defaultModel,
    };
  }

  /**
   * Get default model for a provider
   */
  getProviderDefaultModel(provider: string): string | undefined {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded. Call load() first.');
    }

    const providerConfig = this.config.providers?.[provider as keyof typeof this.config.providers];
    return providerConfig?.defaultModel ?? DEFAULT_PROVIDER_MODELS[provider];
  }
}

/**
 * Global configuration manager instance
 */
let globalConfigManager: ConfigManager | null = null;

/**
 * Initialize global configuration manager
 */
export function initConfigManager(logger?: Logger): ConfigManager {
  globalConfigManager = new ConfigManager(logger);
  return globalConfigManager;
}

/**
 * Get global configuration manager
 */
export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager();
  }
  return globalConfigManager;
}

/**
 * Load configuration globally
 */
export function loadConfig(configPath?: string): Config {
  return getConfigManager().load(configPath);
}

/**
 * Get configuration globally
 */
export function getConfig(): Config {
  return getConfigManager().getAll();
}
