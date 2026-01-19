/**
 * RE Orchestrator
 * Coordinates tool execution, manages workflows, integrates with ProcessManager
 */

import { getIntentParser, REIntent } from './intent-parser';
import { getToolSelector, ToolSelectionResult } from './tool-selector';
import { getREDatabase, REExecution, REWorkflow } from './re-database';
import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ProcessManager } from '../process-manager';

const execAsync = promisify(exec);

export interface REExecutionPlan {
  id: string;
  intent: REIntent;
  selection: ToolSelectionResult;
  workflow?: REWorkflow;
  steps: REExecutionStep[];
  parallelGroups: number[][];
  estimatedDuration: number;
}

export interface REExecutionStep {
  stepNumber: number;
  toolId: string;
  toolName: string;
  command: string;
  args: string[];
  workingDir?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface REExecutionStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  progress: number; // 0-100
  stepResults: REStepResult[];
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface REStepResult {
  stepNumber: number;
  toolId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  exitCode?: number;
  duration?: number;
  artifacts?: string[]; // Paths to generated files
}

export class REOrchestrator extends EventEmitter {
  private parser = getIntentParser();
  private selector = getToolSelector();
  private db = getREDatabase();
  private activeExecutions = new Map<string, REExecutionStatus>();
  private activeProcessSessions = new Map<string, string>(); // executionId -> sessionId mapping
  private processManager: ProcessManager | null = null;

  /**
   * Set ProcessManager instance (called from main process)
   */
  setProcessManager(processManager: ProcessManager): void {
    this.processManager = processManager;
  }

  /**
   * Create execution plan from natural language command
   */
  async plan(input: string): Promise<REExecutionPlan> {
    // Parse intent
    const intent = this.parser.parseCommand(input);

    // Validate intent
    const validation = this.parser.validateIntent(intent);
    if (!validation.valid) {
      throw new Error(`Invalid intent: ${validation.errors.join(', ')}`);
    }

    // Select tools and workflows
    const selection = this.selector.selectTools(intent);

    if (selection.primaryTools.length === 0 && selection.workflows.length === 0) {
      throw new Error(`No tools or workflows found for target type: ${intent.target.type}`);
    }

    // Choose workflow or build manual plan
    let workflow: REWorkflow | undefined;
    let steps: REExecutionStep[];
    let parallelGroups: number[][];

    if (selection.recommendedApproach === 'workflow' && selection.workflows.length > 0) {
      // Use pre-built workflow
      workflow = selection.workflows[0];
      steps = await this.buildWorkflowSteps(workflow, intent);
      parallelGroups = workflow.parallel_steps || [[...Array(steps.length).keys()]];
    } else {
      // Build manual plan from selected tools
      steps = await this.buildManualSteps(selection, intent);
      parallelGroups = [[...Array(steps.length).keys()]]; // All sequential by default
    }

    const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      intent,
      selection,
      workflow,
      steps,
      parallelGroups,
      estimatedDuration: selection.estimatedDuration || 300
    };
  }

  /**
   * Execute a plan
   */
  async execute(plan: REExecutionPlan): Promise<string> {
    const executionId = plan.id;

    // Create execution record in database
    const dbExecutionId = this.db.createExecution({
      workflow_id: plan.workflow?.id || 'manual',
      target_type: plan.intent.target.type,
      target_path: plan.intent.target.path,
      status: 'pending',
      total_steps: plan.steps.length,
      started_at: Date.now()
    });

    // Initialize execution status
    const status: REExecutionStatus = {
      id: executionId,
      status: 'pending',
      currentStep: 0,
      totalSteps: plan.steps.length,
      progress: 0,
      stepResults: plan.steps.map((step, idx) => ({
        stepNumber: idx,
        toolId: step.toolId,
        status: 'pending'
      })),
      startTime: Date.now()
    };

    this.activeExecutions.set(executionId, status);
    this.emit('execution:start', { executionId, plan });

    try {
      // Execute steps according to parallel groups
      for (const group of plan.parallelGroups) {
        await this.executeGroup(group, plan.steps, status);
      }

      // Mark as completed
      status.status = 'completed';
      status.progress = 100;
      status.endTime = Date.now();

      this.db.updateExecution(dbExecutionId, {
        status: 'completed',
        current_step: plan.steps.length,
        completed_at: Date.now(),
        duration_ms: status.endTime - (status.startTime || 0),
        results: status.stepResults
      });

      this.emit('execution:complete', { executionId, status });
    } catch (error: any) {
      status.status = 'failed';
      status.error = error.message;
      status.endTime = Date.now();

      this.db.updateExecution(dbExecutionId, {
        status: 'failed',
        errors: { message: error.message, stack: error.stack },
        completed_at: Date.now()
      });

      this.emit('execution:error', { executionId, error });
      throw error;
    }

    return executionId;
  }

  /**
   * Execute a group of parallel steps
   */
  private async executeGroup(
    stepIndices: number[],
    allSteps: REExecutionStep[],
    status: REExecutionStatus
  ): Promise<void> {
    const promises = stepIndices.map(idx => this.executeStep(allSteps[idx], status));
    await Promise.all(promises);
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: REExecutionStep, status: REExecutionStatus): Promise<void> {
    const stepResult = status.stepResults[step.stepNumber];
    stepResult.status = 'running';

    this.emit('step:start', { executionId: status.id, step });

    const startTime = Date.now();

    try {
      // Execute tool via ProcessManager (integrated)
      const result = await this.executeTool(step, status.id);

      stepResult.status = 'success';
      stepResult.output = result.output;
      stepResult.exitCode = result.exitCode;
      stepResult.duration = Date.now() - startTime;
      stepResult.artifacts = result.artifacts;

      // Update progress
      const completedSteps = status.stepResults.filter(r => r.status === 'success' || r.status === 'failed').length;
      status.progress = Math.round((completedSteps / status.totalSteps) * 100);
      status.currentStep = completedSteps;

      this.emit('step:complete', { executionId: status.id, step, result: stepResult });
    } catch (error: any) {
      stepResult.status = 'failed';
      stepResult.error = error.message;
      stepResult.duration = Date.now() - startTime;

      this.emit('step:error', { executionId: status.id, step, error });
      throw error;
    }
  }

  /**
   * Execute tool command using child_process exec
   * Captures stdout/stderr and exit code
   */
  private async executeTool(step: REExecutionStep, executionId: string): Promise<{
    output: string;
    exitCode: number;
    artifacts: string[];
  }> {
    try {
      // Build full command from tool and args
      const fullCommand = [step.command, ...step.args].join(' ');

      // Execute with timeout and working directory
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: step.workingDir || process.cwd(),
        timeout: step.timeout || 60000, // Default 60s timeout
        env: {
          ...process.env,
          ...step.env
        },
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for output
      });

      // Combine stdout and stderr for output
      const output = [stdout, stderr].filter(Boolean).join('\n');

      // Emit progress events for real-time output
      if (output) {
        this.emit('step:progress', { stepNumber: step.stepNumber, output });
      }

      // Extract artifacts from output (files created, IPs found, etc.)
      const artifacts = this.extractArtifacts(output, step);

      return {
        output,
        exitCode: 0,
        artifacts
      };
    } catch (error: any) {
      // exec throws on non-zero exit codes
      const output = [error.stdout, error.stderr].filter(Boolean).join('\n');

      if (output) {
        this.emit('step:progress', { stepNumber: step.stepNumber, output });
      }

      return {
        output,
        exitCode: error.code || 1,
        artifacts: this.extractArtifacts(output, step)
      };
    }
  }

  /**
   * Extract artifacts from tool output
   * Parses output for file paths, URLs, IPs, and other relevant artifacts
   */
  private extractArtifacts(output: string, step: REExecutionStep): string[] {
    const artifacts: string[] = [];

    // Extract file paths
    const filePathPattern = /[\/\w\-._]+(\.\w{2,5})/g;
    const matches = output.match(filePathPattern);
    if (matches) {
      artifacts.push(...matches);
    }

    // Extract IP addresses
    const ipPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    const ips = output.match(ipPattern);
    if (ips) {
      artifacts.push(...ips);
    }

    // Extract URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = output.match(urlPattern);
    if (urls) {
      artifacts.push(...urls);
    }

    // Extract hex addresses (common in RE output)
    const hexPattern = /\b0x[0-9a-fA-F]+\b/g;
    const hexAddresses = output.match(hexPattern);
    if (hexAddresses) {
      artifacts.push(...hexAddresses);
    }

    return [...new Set(artifacts)]; // Deduplicate
  }

  /**
   * Build steps from workflow
   */
  private async buildWorkflowSteps(workflow: REWorkflow, intent: REIntent): Promise<REExecutionStep[]> {
    const steps: REExecutionStep[] = [];

    for (let i = 0; i < workflow.tool_chain.length; i++) {
      const toolId = workflow.tool_chain[i];
      const tool = this.db.getToolById(toolId);

      if (!tool) {
        console.warn(`Tool ${toolId} not found in database, skipping`);
        continue;
      }

      // Build command for this tool
      const command = this.buildToolCommand(tool.id, tool.binary_name || tool.id, intent);

      steps.push({
        stepNumber: i,
        toolId: tool.id,
        toolName: tool.name,
        command: command.cmd,
        args: command.args,
        timeout: 300000 // 5 minutes default
      });
    }

    return steps;
  }

  /**
   * Build manual steps from selected tools
   */
  private async buildManualSteps(
    selection: ToolSelectionResult,
    intent: REIntent
  ): Promise<REExecutionStep[]> {
    const steps: REExecutionStep[] = [];

    for (let i = 0; i < selection.primaryTools.length; i++) {
      const scoredTool = selection.primaryTools[i];
      const tool = scoredTool.tool;

      const command = this.buildToolCommand(tool.id, tool.binary_name || tool.id, intent);

      steps.push({
        stepNumber: i,
        toolId: tool.id,
        toolName: tool.name,
        command: command.cmd,
        args: command.args,
        timeout: 300000 // 5 minutes
      });
    }

    return steps;
  }

  /**
   * Build command for specific tool
   */
  private buildToolCommand(
    toolId: string,
    binaryName: string,
    intent: REIntent
  ): { cmd: string; args: string[] } {
    const targetPath = intent.target.path || '';

    // Tool-specific command building
    switch (toolId) {
      case 'ghidra':
        return {
          cmd: 'analyzeHeadless',
          args: ['/tmp/ghidra-projects', 'TempProject', '-import', targetPath, '-scriptPath', '.']
        };

      case 'radare2':
        return {
          cmd: 'r2',
          args: ['-q', '-c', 'aaa;pdf', targetPath]
        };

      case 'apktool':
        return {
          cmd: 'apktool',
          args: ['d', targetPath, '-o', '/tmp/apktool-output']
        };

      case 'frida':
        return {
          cmd: 'frida',
          args: ['-l', 'analyze.js', '-f', targetPath]
        };

      case 'mitmproxy':
        return {
          cmd: 'mitmdump',
          args: ['-w', '/tmp/mitmproxy-dump.flow']
        };

      case 'trivy':
        return {
          cmd: 'trivy',
          args: ['image', targetPath]
        };

      default:
        return {
          cmd: binaryName,
          args: targetPath ? [targetPath] : []
        };
    }
  }

  /**
   * Get execution status
   */
  getStatus(executionId: string): REExecutionStatus | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Cancel execution
   */
  async cancel(executionId: string): Promise<void> {
    const status = this.activeExecutions.get(executionId);
    if (!status) {
      throw new Error(`Execution ${executionId} not found`);
    }

    status.status = 'cancelled';
    this.emit('execution:cancelled', { executionId });

    // Kill running process via ProcessManager
    const sessionId = this.activeProcessSessions.get(executionId);
    if (sessionId && this.processManager) {
      try {
        this.processManager.kill(sessionId);
        this.activeProcessSessions.delete(executionId);
      } catch (error) {
        console.error(`Failed to kill session ${sessionId}:`, error);
      }
    }
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit = 10): REExecution[] {
    return this.db.getRecentExecutions(limit);
  }
}

// Singleton instance
let orchestratorInstance: REOrchestrator | null = null;

export function getREOrchestrator(): REOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new REOrchestrator();
  }
  return orchestratorInstance;
}
