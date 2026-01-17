/**
 * Configuration management system for KOMPLETE-KONTROL CLI
 * 
 * Handles loading, saving, and validating configuration from multiple sources.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import type { Config } from '../types';
import { ConfigError } from '../types';
import { Logger } from '../utils/logger';

/**
 * Environment variable prefix
 */
const ENV_PREFIX = 'KOMPLETE_';

/**
 * Get default configuration paths
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

  // Default configuration paths
  return [
    path.join(process.cwd(), '.kompleterc.json'),
    path.join(process.cwd(), '.kompleterc'),
    path.join(process.env.HOME ?? '', '.kompleterc.json'),
    path.join(process.env.HOME ?? '', '.kompleterc'),
    path.join(process.env.HOME ?? '', '.config', 'komplete-kontrol', 'config.json'),
  ];
}

/**
 * Default configuration paths (computed)
 */
const DEFAULT_CONFIG_PATHS = getDefaultConfigPaths();

/**
 * Configuration schema for validation
 */
const ConfigSchema = z.object({
  providers: z.object({
    openRouter: z.object({
      apiKey: z.string().optional(),
      baseUrl: z.string().url().optional(),
    }).optional(),
    groq: z.object({
      apiKey: z.string().optional(),
    }).optional(),
    openai: z.object({
      apiKey: z.string().optional(),
      baseUrl: z.string().url().optional(),
    }).optional(),
    anthropic: z.object({
      apiKey: z.string().optional(),
    }).optional(),
    ollama: z.object({
      baseUrl: z.string().url().optional(),
    }).optional(),
    featherless: z.object({
      apiKey: z.string().optional(),
    }).optional(),
  }).optional(),

  defaultModel: z.string().default('or/claude-3.5-sonnet'),
  fallbackModels: z.array(z.string()).default([]),

  context: z.object({
    maxTokens: z.number().int().positive().default(200000),
    condensationThreshold: z.number().int().positive().default(150000),
    preserveToolUse: z.boolean().default(true),
  }).default({
    maxTokens: 200000,
    condensationThreshold: 150000,
    preserveToolUse: true,
  }),

  agents: z.object({
    maxParallel: z.number().int().positive().default(4),
    timeoutMs: z.number().int().positive().default(30000),
  }).default({
    maxParallel: 4,
    timeoutMs: 30000,
  }),

  budget: z.object({
    maxCostPerCommand: z.number().positive().default(1.0),
    maxDailyCost: z.number().positive().default(10.0),
    alertThreshold: z.number().positive().default(0.8),
  }).default({
    maxCostPerCommand: 1.0,
    maxDailyCost: 10.0,
    alertThreshold: 0.8,
  }),

  mcp: z.object({
    servers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      command: z.string(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      disabled: z.boolean().optional(),
    })).default([]),
    enabled: z.boolean().default(true),
  }).default({
    servers: [],
    enabled: true,
  }),

  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
  }).default({
    level: 'info',
  }),
});

/**
 * Configuration manager class
 */
export class ConfigManager {
  private config: Config | null = null;
  private configPath: string | null = null;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger();
  }

  /**
   * Find configuration file
   */
  private findConfigPath(): string | null {
    for (const configPath of DEFAULT_CONFIG_PATHS) {
      try {
        if (fs.existsSync(configPath)) {
          return configPath;
        }
      } catch (error) {
        // Continue to next path
      }
    }
    return null;
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(configPath: string): Partial<Config> {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      this.logger.info(`Loaded configuration from ${configPath}`, 'ConfigManager');
      return parsed;
    } catch (error) {
      throw new ConfigError(`Failed to load configuration from ${configPath}`, {
        path: configPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
          errors: error.errors,
        });
      }
      throw error;
    }
  }

  /**
   * Load configuration
   */
  load(configPath?: string): Config {
    const sources: Partial<Config>[] = [];

    // Load from file
    const filePath = configPath ?? this.findConfigPath();
    if (filePath) {
      this.configPath = filePath;
      sources.push(this.loadFromFile(filePath));
    }

    // Load from environment
    sources.push(this.loadFromEnv());

    // Merge and validate
    const merged = this.mergeConfigs(...sources);
    this.config = this.validateConfig(merged);

    this.logger.info('Configuration loaded successfully', 'ConfigManager', {
      configPath: this.configPath,
      defaultModel: this.config.defaultModel,
      providers: Object.keys(this.config.providers || {}),
    });

    return this.config;
  }

  /**
   * Save configuration to file
   */
  async save(config: Partial<Config>, configPath?: string): Promise<void> {
    const filePath: string = (configPath ?? this.configPath ?? DEFAULT_CONFIG_PATHS[0])!;

    try {
      // Merge with existing config
      const merged = this.mergeConfigs(this.config ?? {}, config);
      const validated = this.validateConfig(merged);

      // Ensure directory exists
      const dir: string = path.dirname(filePath);
      if (dir && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to file
      await fs.promises.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8');

      this.config = validated;
      this.configPath = filePath;

      this.logger.info(`Configuration saved to ${filePath}`, 'ConfigManager');
    } catch (error) {
      throw new ConfigError(`Failed to save configuration to ${filePath}`, {
        path: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
   * Get configuration path
   */
  getPath(): string | null {
    return this.configPath;
  }

  /**
   * Reload configuration
   */
  reload(): Config {
    return this.load(this.configPath ?? undefined);
  }

  /**
   * Set configuration value
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
