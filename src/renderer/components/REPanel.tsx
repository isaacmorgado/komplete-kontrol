/**
 * REPanel - Reverse Engineering Panel
 * Main modal for the RE system that orchestrates all RE components
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Theme } from '../types';
import { RECommandPanel, ToolSelector, ExecutionMonitor } from './RE';
import { useLayerStack } from '../contexts/LayerStackContext';
import { MODAL_PRIORITIES } from '../constants/modalPriorities';

interface REPanelProps {
  theme: Theme;
  isOpen: boolean;
  onClose: () => void;
}

interface REIntent {
  command: string;
  target: {
    type: string;
    path?: string;
    url?: string;
    metadata?: Record<string, any>;
  };
  options: {
    depth?: 'quick' | 'moderate' | 'thorough';
    outputFormat?: 'summary' | 'detailed' | 'json';
    parallel?: boolean;
  };
  confidence: number;
}

interface ToolSelection {
  mode: 'workflow' | 'manual';
  workflow?: string;
  tools?: string[];
}

export const REPanel: React.FC<REPanelProps> = ({ theme, isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<'command' | 'tools' | 'execution'>('command');
  const [command, setCommand] = useState('');
  const [intent, setIntent] = useState<REIntent | null>(null);
  const [selection, setSelection] = useState<ToolSelection | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Register with layer stack
  useLayerStack(
    'REPanel',
    isOpen,
    () => {
      handleClose();
    },
    MODAL_PRIORITIES.RE_PANEL || 100
  );

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('command');
      setCommand('');
      setIntent(null);
      setSelection(null);
      setExecutionId(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    // If execution is running, ask for confirmation
    if (executionId && currentStep === 'execution') {
      const confirmed = window.confirm('Execution is still running. Are you sure you want to close?');
      if (!confirmed) return;
    }
    onClose();
  };

  const handleCommandSubmit = async (submittedCommand: string) => {
    setCommand(submittedCommand);
    setIsProcessing(true);

    try {
      // Parse command to get intent
      const result = await (window as any).maestro.re.parseCommand(submittedCommand);

      if (result.success && result.data) {
        setIntent(result.data);
        setCurrentStep('tools');
      } else {
        console.error('Failed to parse command:', result.error);
        alert(`Failed to parse command: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error parsing command:', error);
      alert(`Error: ${error.message || 'Failed to parse command'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToolsSelected = async (toolSelection: ToolSelection) => {
    setSelection(toolSelection);
    setIsProcessing(true);

    try {
      // Create execution plan
      const planResult = await (window as any).maestro.re.plan(command);

      if (!planResult.success || !planResult.data) {
        throw new Error(planResult.error || 'Failed to create execution plan');
      }

      const plan = planResult.data;

      // Execute the plan
      const execResult = await (window as any).maestro.re.execute(plan);

      if (!execResult.success || !execResult.data) {
        throw new Error(execResult.error || 'Failed to start execution');
      }

      setExecutionId(execResult.data.executionId);
      setCurrentStep('execution');
    } catch (error: any) {
      console.error('Error executing plan:', error);
      alert(`Execution error: ${error.message || 'Unknown error'}`);
      setCurrentStep('tools'); // Go back to tool selection
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecutionCancel = () => {
    // Reset to command input
    setCurrentStep('command');
    setExecutionId(null);
    setIntent(null);
    setSelection(null);
  };

  const handleBack = () => {
    if (currentStep === 'tools') {
      setCurrentStep('command');
      setIntent(null);
    } else if (currentStep === 'execution') {
      setCurrentStep('tools');
      setExecutionId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: theme.background,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '1200px',
          height: '80%',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: `1px solid ${theme.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 600,
                color: theme.text,
              }}
            >
              Reverse Engineering
            </h2>
            <div
              style={{
                marginTop: '0.25rem',
                fontSize: '0.85rem',
                color: theme.textSecondary,
              }}
            >
              {currentStep === 'command' && 'Enter a command to analyze your target'}
              {currentStep === 'tools' && 'Select tools and workflows for analysis'}
              {currentStep === 'execution' && 'Monitoring execution progress'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {currentStep !== 'command' && (
              <button
                onClick={handleBack}
                disabled={isProcessing}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: theme.sidebar,
                  color: theme.text,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '6px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.5 : 1,
                  fontSize: '0.9rem',
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textSecondary,
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: theme.sidebar,
          }}
        >
          {currentStep === 'command' && (
            <RECommandPanel
              theme={theme}
              onCommandSubmit={handleCommandSubmit}
              isProcessing={isProcessing}
            />
          )}

          {currentStep === 'tools' && intent && (
            <ToolSelector
              theme={theme}
              intent={intent}
              onToolsSelected={handleToolsSelected}
            />
          )}

          {currentStep === 'execution' && executionId && (
            <ExecutionMonitor
              theme={theme}
              executionId={executionId}
              onCancel={handleExecutionCancel}
            />
          )}
        </div>

        {/* Footer - Step indicator */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            {['command', 'tools', 'execution'].map((step, index) => (
              <div
                key={step}
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor:
                    currentStep === step
                      ? theme.primary
                      : index < ['command', 'tools', 'execution'].indexOf(currentStep)
                      ? theme.success
                      : theme.inputBackground,
                  borderRadius: '2px',
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: theme.textSecondary,
              whiteSpace: 'nowrap',
            }}
          >
            Step {['command', 'tools', 'execution'].indexOf(currentStep) + 1} of 3
          </div>
        </div>
      </div>
    </div>
  );
};
