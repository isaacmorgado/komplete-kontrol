import React, { useState, useEffect } from 'react';
import { Wrench, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import type { Theme } from '../../types';

interface ToolSelectorProps {
  theme: Theme;
  intent: any; // REIntent from parseCommand
  onToolsSelected: (selection: any) => void;
}

interface ToolInfo {
  id: string;
  name: string;
  category: string;
  score: number;
  available: boolean;
  installCommand?: string;
}

interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  successRate: number;
  tools: string[];
}

export const ToolSelector: React.FC<ToolSelectorProps> = ({
  theme,
  intent,
  onToolsSelected
}) => {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [selectedMode, setSelectedMode] = useState<'workflow' | 'manual'>('workflow');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch tool recommendations when intent changes
  useEffect(() => {
    if (!intent) return;

    const fetchRecommendations = async () => {
      setLoading(true);
      try {
        const result = await (window as any).maestro.re.selectTools(intent);
        if (result.success && result.data) {
          setTools(result.data.primaryTools || []);
          setWorkflows(result.data.workflows || []);
          setSelectedMode(result.data.recommendedApproach || 'workflow');
        }
      } catch (error) {
        console.error('Failed to fetch tool recommendations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [intent]);

  const handleModeChange = (mode: 'workflow' | 'manual') => {
    setSelectedMode(mode);
    onToolsSelected({
      mode,
      workflow: mode === 'workflow' ? workflows[0]?.id : null,
      tools: mode === 'manual' ? tools.map(t => t.id) : []
    });
  };

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: theme.colors.textDim,
      }}>
        Loading tool recommendations...
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: theme.colors.bgMain,
    }}>
      {/* Mode Selector */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <button
          onClick={() => handleModeChange('workflow')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            backgroundColor: selectedMode === 'workflow' ? theme.colors.accent : theme.colors.bgSidebar,
            color: selectedMode === 'workflow' ? theme.colors.accentForeground : theme.colors.textMain,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          <Zap size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
          Automated Workflow
        </button>
        <button
          onClick={() => handleModeChange('manual')}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            backgroundColor: selectedMode === 'manual' ? theme.colors.accent : theme.colors.bgSidebar,
            color: selectedMode === 'manual' ? theme.colors.accentForeground : theme.colors.textMain,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          <Wrench size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
          Manual Tool Selection
        </button>
      </div>

      {/* Workflow View */}
      {selectedMode === 'workflow' && workflows.length > 0 && (
        <div>
          <h3 style={{
            fontSize: '0.9rem',
            color: theme.colors.textMain,
            marginBottom: '0.75rem',
            fontWeight: 500,
          }}>
            Recommended Workflows
          </h3>
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              style={{
                backgroundColor: theme.colors.bgSidebar,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                cursor: 'pointer',
              }}
              onClick={() => onToolsSelected({ mode: 'workflow', workflow: workflow.id })}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <span style={{
                  color: theme.colors.textMain,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}>{workflow.name}</span>
                <div style={{
                  padding: '0.125rem 0.5rem',
                  backgroundColor: theme.colors.success + '20',
                  color: theme.colors.success,
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                }}>{Math.round(workflow.successRate * 100)}% success</div>
              </div>
              <p style={{
                color: theme.colors.textDim,
                fontSize: '0.75rem',
                marginBottom: '0.5rem',
              }}>{workflow.description}</p>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.25rem',
              }}>
                {workflow.tools.map((tool) => (
                  <span
                    key={tool}
                    style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: theme.colors.bgActivity,
                      color: theme.colors.textDim,
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                    }}
                  >{tool}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Tool List */}
      {selectedMode === 'manual' && tools.length > 0 && (
        <div>
          <h3 style={{
            fontSize: '0.9rem',
            color: theme.colors.textMain,
            marginBottom: '0.75rem',
            fontWeight: 500,
          }}>
            Recommended Tools
          </h3>
          {tools.map((tool) => (
            <div
              key={tool.id}
              style={{
                backgroundColor: theme.colors.bgSidebar,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '6px',
                padding: '0.75rem',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {expandedTool === tool.id ? <ChevronDown size={16} color={theme.colors.textDim} /> : <ChevronRight size={16} color={theme.colors.textDim} />}
                  <span style={{
                    color: theme.colors.textMain,
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}>{tool.name}</span>
                  <span style={{
                    padding: '0.125rem 0.5rem',
                    backgroundColor: theme.colors.bgActivity,
                    color: theme.colors.textDim,
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                  }}>{tool.category}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    padding: '0.125rem 0.5rem',
                    backgroundColor: theme.colors.accent + '20',
                    color: theme.colors.accent,
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                  }}>{Math.round(tool.score * 100)}% match</div>
                  {tool.available ? (
                    <CheckCircle size={16} color={theme.colors.success} />
                  ) : (
                    <AlertTriangle size={16} color={theme.colors.warning} />
                  )}
                </div>
              </div>

              {expandedTool === tool.id && !tool.available && tool.installCommand && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: theme.colors.bgActivity,
                  borderRadius: '4px',
                }}>
                  <div style={{
                    color: theme.colors.warning,
                    fontSize: '0.75rem',
                    marginBottom: '0.25rem',
                  }}>⚠️ Not installed</div>
                  <div style={{
                    color: theme.colors.textDim,
                    fontSize: '0.7rem',
                    marginBottom: '0.25rem',
                  }}>Install command:</div>
                  <code style={{
                    display: 'block',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: theme.colors.bgMain,
                    color: theme.colors.textMain,
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                  }}>{tool.installCommand}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {tools.length === 0 && workflows.length === 0 && (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: theme.colors.textDim,
          fontSize: '0.85rem',
        }}>
          No tools or workflows found for this intent.
        </div>
      )}
    </div>
  );
};
