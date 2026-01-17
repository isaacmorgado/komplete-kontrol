/**
 * Komplete IPC Handlers
 *
 * This module handles IPC calls for Komplete-Kontrol specific operations:
 * - Modes: operational mode management (architect, code, debug, test, reverse-engineer, ask)
 * - Tools: tool availability and configuration
 * - Providers: AI provider management
 * - Config: configuration get/set operations
 *
 * Part of Phase 01: Foundation & Infrastructure (Section 5: IPC Bridge Extensions)
 * Updated in Phase 02: Mode System Integration (Section 6: IPC Handlers for Modes)
 */

import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';
import {
  getConfigManager,
  DEFAULT_PROVIDER_MODELS,
  DEFAULT_TOOL_CALLING_METHOD,
  DEFAULT_CONTEXT_WINDOW_SIZE,
} from '../../../komplete/config';
import type {
  OperationalMode,
  ToolGroup,
  OperationalModeConfig,
  ModeSpecificConfig,
  Config,
} from '../../../komplete/types';
import { Logger, LogLevel } from '../../../komplete/utils/logger';

// Import Mode Controller from the modes module
import {
  ModeController,
  getModeController,
  initModeController,
  isModeControllerInitialized,
} from '../../modes/controller';
import { MODE_DEFINITIONS, TOOL_GROUPS, ALWAYS_AVAILABLE_TOOLS } from '../../modes/definitions';
import { ALL_OPERATIONAL_MODES, ALL_TOOL_GROUPS as ALL_TOOL_GROUPS_FROM_TYPES } from '../../modes/types';
import type { ModeTransition, ModeError } from '../../modes/types';

/**
 * Interface for Komplete settings store
 */
interface KompleteSettings {
  currentMode?: OperationalMode;
  modeOverrides?: Record<string, ModeSpecificConfig>;
  [key: string]: unknown;
}

/**
 * Dependencies required for Komplete handlers
 */
export interface KompleteHandlerDependencies {
  settingsStore: Store<KompleteSettings>;
}

/**
 * Default operational mode configurations
 */
const DEFAULT_MODE_CONFIGS: Record<OperationalMode, OperationalModeConfig> = {
  architect: {
    slug: 'architect',
    displayName: 'Architect',
    roleDefinition: 'High-level design and planning mode. Focus on architecture decisions, system design, and planning.',
    toolGroups: ['read', 'browser', 'mcp'] as ToolGroup[],
    temperature: 0.7,
    maxTokens: 8192,
  },
  code: {
    slug: 'code',
    displayName: 'Code',
    roleDefinition: 'Code generation and modification mode. Focus on writing, editing, and refactoring code.',
    toolGroups: ['read', 'edit', 'command', 'mcp'] as ToolGroup[],
    temperature: 0.3,
    maxTokens: 4096,
  },
  debug: {
    slug: 'debug',
    displayName: 'Debug',
    roleDefinition: 'Debugging and troubleshooting mode. Focus on identifying and fixing issues.',
    toolGroups: ['read', 'edit', 'command', 'mcp'] as ToolGroup[],
    temperature: 0.2,
    maxTokens: 4096,
  },
  test: {
    slug: 'test',
    displayName: 'Test',
    roleDefinition: 'Test generation and execution mode. Focus on writing and running tests.',
    toolGroups: ['read', 'edit', 'command', 'mcp'] as ToolGroup[],
    temperature: 0.3,
    maxTokens: 4096,
  },
  'reverse-engineer': {
    slug: 'reverse-engineer',
    displayName: 'Reverse Engineer',
    roleDefinition: 'Reverse engineering and analysis mode. Focus on understanding existing code and systems.',
    toolGroups: ['read', 'browser', 'command', 'mcp'] as ToolGroup[],
    temperature: 0.4,
    maxTokens: 8192,
  },
  ask: {
    slug: 'ask',
    displayName: 'Ask',
    roleDefinition: 'Q&A and information retrieval mode. Focus on answering questions and providing information.',
    toolGroups: ['read', 'browser', 'mcp'] as ToolGroup[],
    temperature: 0.7,
    maxTokens: 2048,
  },
};

/**
 * All available operational modes
 */
const ALL_MODES: OperationalMode[] = [
  'architect',
  'code',
  'debug',
  'test',
  'reverse-engineer',
  'ask',
];

/**
 * All available tool groups
 */
const ALL_TOOL_GROUPS: ToolGroup[] = [
  'read',
  'edit',
  'browser',
  'command',
  'mcp',
  'modes',
];

/**
 * Default tools per tool group
 */
const DEFAULT_TOOLS_BY_GROUP: Record<ToolGroup, string[]> = {
  read: ['Read', 'Glob', 'Grep', 'LS'],
  edit: ['Write', 'Edit', 'MultiEdit'],
  browser: ['WebFetch', 'WebSearch'],
  command: ['Bash', 'KillShell'],
  mcp: ['mcp'],
  modes: ['SwitchMode'],
};

/**
 * Available AI providers
 */
const AVAILABLE_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', prefix: 'anthropic' as const },
  { id: 'openai', name: 'OpenAI', prefix: 'oai' as const },
  { id: 'openrouter', name: 'OpenRouter', prefix: 'or' as const },
  { id: 'groq', name: 'Groq', prefix: 'g' as const },
  { id: 'ollama', name: 'Ollama', prefix: 'ollama' as const },
  { id: 'featherless', name: 'Featherless', prefix: 'fl' as const },
];

// Logger instance for komplete handlers
const logger = new Logger({
  level: LogLevel.INFO,
  colorize: true,
  timestamp: true,
  defaultContext: { component: 'KompleteHandlers' },
});

/**
 * Register all Komplete-related IPC handlers.
 */
export function registerKompleteHandlers(deps: KompleteHandlerDependencies): void {
  const { settingsStore } = deps;

  // Initialize Mode Controller if not already initialized
  if (!isModeControllerInitialized()) {
    const savedMode = settingsStore.get('currentMode');
    const initialMode = savedMode && ALL_OPERATIONAL_MODES.includes(savedMode)
      ? savedMode
      : 'code';
    initModeController(undefined, initialMode);
  }

  const modeController = getModeController();

  // Set up event listeners for mode changes to broadcast to renderer
  modeController.on('mode-changed', (transition: ModeTransition) => {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('komplete:mode:changed', transition);
    }
  });

  modeController.on('mode-error', (error: ModeError) => {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('komplete:mode:error', error);
    }
  });

  // ============ Mode Handlers (Section 6.1) ============

  // Get current operational mode
  ipcMain.handle('komplete:mode:get-current', async () => {
    const config = modeController.getCurrentMode();
    logger.debug('Getting current mode', 'komplete:mode:get-current', { mode: config.slug });
    return {
      mode: config.slug,
      config,
    };
  });

  // Switch operational mode (with validation)
  ipcMain.handle(
    'komplete:mode:switch',
    async (_event, mode: OperationalMode) => {
      if (!ALL_OPERATIONAL_MODES.includes(mode)) {
        logger.warn('Invalid mode requested', 'komplete:mode:switch', { requestedMode: mode });
        return {
          success: false,
          error: `Invalid mode: ${mode}. Valid modes are: ${ALL_OPERATIONAL_MODES.join(', ')}`,
        };
      }

      try {
        const transition = await modeController.switchMode(mode, 'user');

        // Persist the mode preference
        settingsStore.set('currentMode', mode);

        logger.info('Mode switched', 'komplete:mode:switch', {
          from: transition.from,
          to: transition.to,
        });

        return {
          success: true,
          previousMode: transition.from,
          currentMode: transition.to,
          config: transition.config,
        };
      } catch (error) {
        logger.warn('Mode switch failed', 'komplete:mode:switch', {
          requestedMode: mode,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  // Get all available modes
  ipcMain.handle('komplete:mode:get-all', async () => {
    const allModes = modeController.getAllModes();
    const currentConfig = modeController.getCurrentMode();
    const configs: Record<string, typeof currentConfig> = {};

    for (const mode of allModes) {
      configs[mode.slug] = mode;
    }

    logger.debug('Getting all modes', 'komplete:mode:get-all');
    return {
      modes: allModes.map(m => m.slug),
      configs,
      currentMode: currentConfig.slug,
    };
  });

  // Get mode configuration by slug
  ipcMain.handle('komplete:mode:get-config', async (_event, mode: OperationalMode) => {
    const config = modeController.getModeConfig(mode);
    if (!config) {
      return {
        success: false,
        error: `Mode not found: ${mode}`,
      };
    }
    return {
      success: true,
      config,
    };
  });

  // Get mode history
  ipcMain.handle('komplete:mode:get-history', async () => {
    const history = modeController.getModeHistory();
    return {
      history,
      switchCount: modeController.getSwitchCount(),
    };
  });

  // ============ Tool Handlers ============

  // Get available tools for current mode
  ipcMain.handle('komplete:tools:get-available', async () => {
    const currentConfig = modeController.getCurrentMode();
    const availableTools = modeController.getAllowedTools();

    logger.debug('Getting available tools', 'komplete:tools:get-available', {
      mode: currentConfig.slug,
      toolCount: availableTools.length,
    });

    return {
      mode: currentConfig.slug,
      toolGroups: currentConfig.toolGroups,
      tools: availableTools,
      allToolGroups: ALL_TOOL_GROUPS,
      toolsByGroup: TOOL_GROUPS,
    };
  });

  // ============ Provider Handlers ============

  // List available providers
  ipcMain.handle('komplete:providers:list', async () => {
    // Try to get configured providers from ConfigManager
    const configuredProviders: Record<string, boolean> = {};

    try {
      const configManager = getConfigManager();
      const config = configManager.getAll();
      if (config.providers) {
        for (const [key, value] of Object.entries(config.providers)) {
          // A provider is considered configured if it has an API key or base URL
          configuredProviders[key] = !!(value?.apiKey || value?.baseUrl);
        }
      }
    } catch {
      // Config not loaded yet, that's fine
      logger.debug('Config not loaded, returning unconfigured providers', 'komplete:providers:list');
    }

    const providers = AVAILABLE_PROVIDERS.map((provider) => ({
      ...provider,
      configured: configuredProviders[provider.id] ?? false,
      defaultModel: DEFAULT_PROVIDER_MODELS[provider.id],
    }));

    logger.debug('Listing providers', 'komplete:providers:list', {
      providerCount: providers.length,
    });

    return {
      providers,
      defaultProvider: 'anthropic',
    };
  });

  // ============ Config Handlers ============

  // Get configuration value
  ipcMain.handle('komplete:config:get', async (_event, key: string) => {
    logger.debug('Getting config value', 'komplete:config:get', { key });

    try {
      const configManager = getConfigManager();

      // Special handling for nested keys (e.g., 'providers.anthropic.apiKey')
      if (key.includes('.')) {
        const parts = key.split('.');
        let value: unknown = configManager.getAll();
        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = (value as Record<string, unknown>)[part];
          } else {
            return { success: true, value: undefined };
          }
        }
        return { success: true, value };
      }

      // Direct key access
      const config = configManager.getAll();
      const value = (config as unknown as Record<string, unknown>)[key];
      return { success: true, value };
    } catch (error) {
      // If config not loaded, return defaults for known keys
      const defaults: Record<string, unknown> = {
        defaultMode: 'code',
        defaultModel: 'anthropic/claude-3-5-sonnet-20241022',
        toolCallingMethod: DEFAULT_TOOL_CALLING_METHOD,
        contextWindowSize: DEFAULT_CONTEXT_WINDOW_SIZE,
      };

      if (key in defaults) {
        return { success: true, value: defaults[key] };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get config value',
      };
    }
  });

  // Set configuration value
  ipcMain.handle('komplete:config:set', async (_event, key: string, value: unknown) => {
    logger.info('Setting config value', 'komplete:config:set', { key });

    try {
      const configManager = getConfigManager();

      // Build partial config object from key path
      if (key.includes('.')) {
        const parts = key.split('.');
        const partialConfig: Record<string, unknown> = {};
        let current = partialConfig;

        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;

        await configManager.saveToUserConfig(partialConfig as Partial<Config>);
      } else {
        // Direct key setting
        const partialConfig: Partial<Config> = { [key]: value } as Partial<Config>;
        await configManager.saveToUserConfig(partialConfig);
      }

      // Reload config to reflect changes
      configManager.reload();

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set config value';
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to set config value', 'komplete:config:set', undefined, errorObj);
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  logger.info('Komplete IPC handlers registered', 'registerKompleteHandlers');
}
