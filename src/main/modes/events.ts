/**
 * Mode Events
 *
 * Defines events emitted by the mode system for IPC and internal communication.
 *
 * Part of Phase 02: Mode System Integration (Section 7)
 */

import type { ModeConfig, ModeTransition, ModeError, OperationalMode } from './types';

// ============================================================================
// Section 7.1: Event Type Definitions
// ============================================================================

/**
 * Event channel names for mode-related IPC events
 */
export const MODE_EVENT_CHANNELS = {
  /** Emitted when mode changes successfully */
  MODE_CHANGED: 'komplete:mode:changed',

  /** Emitted when a mode change fails */
  MODE_ERROR: 'komplete:mode:error',

  /** Emitted when tool restrictions are updated */
  TOOLS_UPDATED: 'komplete:tools:updated',

  /** Emitted when a custom mode is registered */
  CUSTOM_MODE_REGISTERED: 'komplete:mode:custom-registered',
} as const;

/**
 * Type for event channel values
 */
export type ModeEventChannel = typeof MODE_EVENT_CHANNELS[keyof typeof MODE_EVENT_CHANNELS];

// ============================================================================
// Section 7.2: Event Payload Types
// ============================================================================

/**
 * Payload for mode-changed event
 */
export interface ModeChangedPayload {
  /** Previous mode slug */
  from: OperationalMode;

  /** New mode slug */
  to: OperationalMode;

  /** Full configuration of the new mode */
  config: ModeConfig;

  /** Timestamp of the change */
  timestamp: Date;

  /** Who initiated the change */
  initiatedBy: 'user' | 'agent' | 'system';

  /** Optional reason for the change */
  reason?: string;
}

/**
 * Payload for mode-error event
 */
export interface ModeErrorPayload {
  /** Error type */
  type: ModeError['type'];

  /** Human-readable error message */
  message: string;

  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Payload for tools-updated event
 */
export interface ToolsUpdatedPayload {
  /** Current mode slug */
  mode: OperationalMode;

  /** List of allowed tool names */
  allowedTools: string[];

  /** Tool groups enabled for this mode */
  toolGroups: string[];
}

/**
 * Payload for custom-mode-registered event
 */
export interface CustomModeRegisteredPayload {
  /** Slug of the newly registered mode */
  slug: string;

  /** Display name of the mode */
  displayName: string;

  /** Full configuration of the custom mode */
  config: ModeConfig;
}

// ============================================================================
// Section 7.3: Event Type Map
// ============================================================================

/**
 * Map of event channels to their payload types
 */
export interface ModeEventPayloads {
  [MODE_EVENT_CHANNELS.MODE_CHANGED]: ModeChangedPayload;
  [MODE_EVENT_CHANNELS.MODE_ERROR]: ModeErrorPayload;
  [MODE_EVENT_CHANNELS.TOOLS_UPDATED]: ToolsUpdatedPayload;
  [MODE_EVENT_CHANNELS.CUSTOM_MODE_REGISTERED]: CustomModeRegisteredPayload;
}

// ============================================================================
// Section 7.4: Helper Functions
// ============================================================================

/**
 * Create a mode-changed payload from a ModeTransition
 */
export function createModeChangedPayload(transition: ModeTransition): ModeChangedPayload {
  return {
    from: transition.from,
    to: transition.to,
    config: transition.config,
    timestamp: transition.timestamp,
    initiatedBy: transition.initiatedBy,
    reason: transition.reason,
  };
}

/**
 * Create a mode-error payload from a ModeError
 */
export function createModeErrorPayload(error: ModeError): ModeErrorPayload {
  return {
    type: error.type,
    message: error.message,
    details: error.details,
  };
}

/**
 * Create a tools-updated payload
 */
export function createToolsUpdatedPayload(
  mode: OperationalMode,
  allowedTools: string[],
  toolGroups: string[]
): ToolsUpdatedPayload {
  return {
    mode,
    allowedTools,
    toolGroups,
  };
}

/**
 * Create a custom-mode-registered payload
 */
export function createCustomModeRegisteredPayload(config: ModeConfig): CustomModeRegisteredPayload {
  return {
    slug: config.slug,
    displayName: config.displayName,
    config,
  };
}
