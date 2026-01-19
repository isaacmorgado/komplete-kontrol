import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, CheckCircle, XCircle, Clock, ChevronRight, ChevronDown, Terminal } from 'lucide-react';
import type { Theme } from '../../types';

interface ExecutionMonitorProps {
  theme: Theme;
  executionId: string;
  onCancel?: () => void;
}

interface ExecutionStep {
  index: number;
  tool: string;
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  output?: string;
  error?: string;
  result?: any;
}

interface ExecutionStatus {
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  startTime: number;
  endTime?: number;
  results?: any[];
  error?: string;
}

export const ExecutionMonitor: React.FC<ExecutionMonitorProps> = ({
  theme,
  executionId,
  onCancel
}) => {
  const [status, setStatus] = useState<ExecutionStatus | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to execution events
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Fetch initial status
    (async () => {
      const result = await (window as any).maestro.re.getStatus(executionId);
      if (result.success && result.data) {
        setStatus(result.data);
      }
    })();

    // Subscribe to step events
    const onStepStart = (window as any).maestro.re.onStepStart((id: string, stepIndex: number, step: any) => {
      if (id === executionId) {
        setSteps(prev => {
          const updated = [...prev];
          updated[stepIndex] = {
            index: stepIndex,
            tool: step.tool,
            command: step.command,
            status: 'running',
            startTime: Date.now(),
          };
          return updated;
        });
        setExpandedStep(stepIndex); // Auto-expand running step
      }
    });

    const onStepProgress = (window as any).maestro.re.onStepProgress((id: string, stepIndex: number, output: string) => {
      if (id === executionId) {
        setSteps(prev => {
          const updated = [...prev];
          if (updated[stepIndex]) {
            updated[stepIndex].output = (updated[stepIndex].output || '') + output;
          }
          return updated;
        });
      }
    });

    const onStepComplete = (window as any).maestro.re.onStepComplete((id: string, stepIndex: number, result: any) => {
      if (id === executionId) {
        setSteps(prev => {
          const updated = [...prev];
          if (updated[stepIndex]) {
            updated[stepIndex].status = 'completed';
            updated[stepIndex].endTime = Date.now();
            updated[stepIndex].result = result;
          }
          return updated;
        });
      }
    });

    const onStepError = (window as any).maestro.re.onStepError((id: string, stepIndex: number, error: any) => {
      if (id === executionId) {
        setSteps(prev => {
          const updated = [...prev];
          if (updated[stepIndex]) {
            updated[stepIndex].status = 'failed';
            updated[stepIndex].endTime = Date.now();
            updated[stepIndex].error = error.message || 'Unknown error';
          }
          return updated;
        });
      }
    });

    const onExecutionComplete = (window as any).maestro.re.onExecutionComplete((id: string, results: any) => {
      if (id === executionId) {
        setStatus(prev => prev ? {
          ...prev,
          status: 'completed',
          endTime: Date.now(),
          results
        } : null);
      }
    });

    const onExecutionError = (window as any).maestro.re.onExecutionError((id: string, error: any) => {
      if (id === executionId) {
        setStatus(prev => prev ? {
          ...prev,
          status: 'failed',
          endTime: Date.now(),
          error: error.message || 'Execution failed'
        } : null);
      }
    });

    unsubscribers.push(onStepStart, onStepProgress, onStepComplete, onStepError, onExecutionComplete, onExecutionError);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [executionId]);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (expandedStep !== null && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [steps, expandedStep]);

  const handleCancel = async () => {
    try {
      await (window as any).maestro.re.cancel(executionId);
      setStatus(prev => prev ? { ...prev, status: 'cancelled', endTime: Date.now() } : null);
    } catch (error) {
      console.error('Failed to cancel execution:', error);
    }
    onCancel?.();
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} color={theme.colors.success} />;
      case 'failed':
        return <XCircle size={16} color={theme.colors.error} />;
      case 'running':
        return <Play size={16} color={theme.colors.accent} />;
      default:
        return <Clock size={16} color={theme.colors.textDim} />;
    }
  };

  if (!status) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: theme.colors.textDim,
      }}>
        Loading execution status...
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: theme.colors.bgMain,
      height: '100%',
      overflow: 'auto',
    }}>
      {/* Execution Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem',
        backgroundColor: theme.colors.bgSidebar,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '6px',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {getStatusIcon(status.status)}
          <span style={{
            color: theme.colors.textMain,
            fontSize: '0.9rem',
            fontWeight: 500,
          }}>
            {status.status === 'running' ? 'Executing' : status.status === 'completed' ? 'Completed' : status.status === 'failed' ? 'Failed' : 'Cancelled'}
          </span>
          <span style={{
            color: theme.colors.textDim,
            fontSize: '0.8rem',
          }}>
            {status.currentStep}/{status.totalSteps} steps
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            color: theme.colors.textDim,
            fontSize: '0.8rem',
          }}>
            <Clock size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
            {formatDuration(status.startTime, status.endTime)}
          </div>
          {status.status === 'running' && (
            <button
              onClick={handleCancel}
              style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: theme.colors.error,
                color: theme.colors.accentForeground,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              <Square size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: theme.colors.bgActivity,
        borderRadius: '2px',
        marginBottom: '1rem',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${(status.currentStep / status.totalSteps) * 100}%`,
          height: '100%',
          backgroundColor: status.status === 'failed' ? theme.colors.error : status.status === 'completed' ? theme.colors.success : theme.colors.accent,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Execution Steps */}
      <div>
        {steps.map((step) => (
          <div
            key={step.index}
            style={{
              backgroundColor: theme.colors.bgSidebar,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '6px',
              marginBottom: '0.5rem',
              overflow: 'hidden',
            }}
          >
            <div
              onClick={() => setExpandedStep(expandedStep === step.index ? null : step.index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {expandedStep === step.index ? <ChevronDown size={16} color={theme.colors.textDim} /> : <ChevronRight size={16} color={theme.colors.textDim} />}
                {getStatusIcon(step.status)}
                <span style={{
                  color: theme.colors.textMain,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}>
                  Step {step.index + 1}: {step.tool}
                </span>
              </div>
              {step.endTime && step.startTime && (
                <span style={{
                  color: theme.colors.textDim,
                  fontSize: '0.75rem',
                }}>{formatDuration(step.startTime, step.endTime)}</span>
              )}
            </div>

            {expandedStep === step.index && (
              <div style={{
                padding: '0.75rem',
                borderTop: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.bgMain,
              }}>
                <div style={{
                  marginBottom: '0.5rem',
                  color: theme.colors.textDim,
                  fontSize: '0.75rem',
                }}>
                  <Terminal size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                  Command:
                </div>
                <code style={{
                  display: 'block',
                  padding: '0.5rem',
                  backgroundColor: theme.colors.bgActivity,
                  color: theme.colors.textMain,
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  marginBottom: '0.5rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>{step.command}</code>

                {step.output && (
                  <>
                    <div style={{
                      marginTop: '0.5rem',
                      marginBottom: '0.25rem',
                      color: theme.colors.textDim,
                      fontSize: '0.75rem',
                    }}>Output:</div>
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: theme.colors.bgActivity,
                      color: theme.colors.textMain,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      maxHeight: '200px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {step.output}
                      <div ref={outputEndRef} />
                    </div>
                  </>
                )}

                {step.error && (
                  <>
                    <div style={{
                      marginTop: '0.5rem',
                      marginBottom: '0.25rem',
                      color: theme.colors.error,
                      fontSize: '0.75rem',
                    }}>Error:</div>
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: theme.colors.error + '20',
                      color: theme.colors.error,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                    }}>{step.error}</div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Execution Error */}
      {status.error && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          backgroundColor: theme.colors.error + '20',
          border: `1px solid ${theme.colors.error}`,
          borderRadius: '6px',
        }}>
          <div style={{
            color: theme.colors.error,
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '0.25rem',
          }}>
            Execution Failed
          </div>
          <div style={{
            color: theme.colors.error,
            fontSize: '0.75rem',
          }}>{status.error}</div>
        </div>
      )}
    </div>
  );
};
