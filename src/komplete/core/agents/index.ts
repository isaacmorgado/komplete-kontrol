/**
 * Agent System for KOMPLETE-KONTROL CLI
 *
 * Core agent system providing registry, lifecycle management, orchestration,
 * communication, and coordination capabilities.
 *
 * This module exports all components of the agent system:
 * - AgentRegistry: Agent registration and discovery
 * - AgentLifecycleManager: Agent lifecycle management
 * - AgentOrchestrator: Multi-agent orchestration
 * - AgentCommunicationManager: Agent communication
 * - AgentCoordinationManager: Agent coordination primitives
 */

// Test agents
export {
  GENERAL_AGENT,
  CODER_AGENT,
  REVERSE_ENGINEER_AGENT,
  TEST_AGENTS,
  initializeTestAgents,
  getTestAgent,
} from './test-agents';

// Vision agents (Phase 3)
export {
  VISION_CAPTURE_AGENT,
  SCREENSHOT_TO_CODE_AGENT,
  NETWORK_ANALYSIS_AGENT,
  UI_UX_ANALYSIS_AGENT,
  FULLSTACK_WEB_AGENT,
  VISION_AGENTS,
  initializeVisionAgents,
  getVisionAgent,
} from './vision-agents';

// Registry
export {
  AgentRegistry,
  type AgentRegistrationOptions,
  type AgentFilterOptions,
  type AgentStatistics,
  initAgentRegistry,
  getAgentRegistry,
} from './registry';

// Lifecycle
export {
  AgentLifecycleManager,
  AgentLifecycleState,
  AgentLifecycleEvent,
  type AgentLifecycleEventHandler,
  type AgentExecutionContext,
  type AgentInstance,
  type AgentLifecycleManagerConfig,
  initAgentLifecycleManager,
  getAgentLifecycleManager,
} from './lifecycle';

// Orchestrator
export {
  AgentOrchestrator,
  TaskPriority,
  TaskStatus,
  type OrchestratedTask,
  AgentSelectionStrategy,
  type AgentSelectionCriteria,
  type AgentOrchestratorConfig,
  initAgentOrchestrator,
  getAgentOrchestrator,
} from './orchestrator';

// Communication
export {
  AgentCommunicationManager,
  MessageType,
  MessagePriority,
  type AgentMessage,
  type MessageHandler,
  type MessageFilter,
  type CommunicationChannelConfig,
  initAgentCommunicationManager,
  getAgentCommunicationManager,
} from './communication';

// Coordination
export {
  AgentCoordinationManager,
  TaskQueue,
  QueuePriority,
  type QueueItem,
  type QueueStatistics,
  type TaskQueueConfig,
  SharedState,
  type SharedStateConfig,
  Barrier,
  type BarrierConfig,
  Semaphore,
  type SemaphoreConfig,
  initAgentCoordinationManager,
  getAgentCoordinationManager,
} from './coordination';

// Executor
export {
  AgentExecutor,
  type AgentExecutorConfig,
  type ExecutionContext,
  type ExecutionResult,
  type ToolCallRecord,
  initAgentExecutor,
  getAgentExecutor,
} from './executor';

// MCP Integration
export {
  AgentMCPIntegration,
  initAgentMCPIntegration,
  getAgentMCPIntegration,
  type ToolCapabilityMatch,
  type AgentMCPIntegrationConfig,
} from './mcp-integration';

// Coordination Patterns
export {
  CoordinationPatterns,
  AgentRole,
  CoordinationPattern,
  type TeamConfig,
  type SwarmConfig,
  type HierarchicalConfig,
  type PipelineConfig,
  type PatternConfig,
  type PatternExecutionResult,
  initCoordinationPatterns,
  getCoordinationPatterns,
} from './patterns';

// Workflows
export {
  Workflows,
  WorkflowStepType,
  WorkflowState,
  type WorkflowStep,
  type WorkflowConfig,
  type WorkflowExecutionContext,
  type WorkflowExecutionResult,
  type WorkflowExecutor,
  initWorkflows,
  getWorkflows,
} from './workflows';

// Teams
export {
  Teams,
  type AgentCapability,
  type AgentProfile,
  type TeamMember,
  type TeamChannel,
  type TeamFormationRequest,
  type TeamFormationResult,
  initTeams,
  getTeams,
} from './teams';

// Hierarchy
export {
  Hierarchy,
  HierarchyTaskStatus,
  HierarchyTaskPriority,
  DelegationStrategy,
  type Task,
  type AgentLoad,
  type AgentReport,
  type HierarchyConfig,
  type TaskDelegationRequest,
  initHierarchy,
  getHierarchy,
} from './hierarchy';
