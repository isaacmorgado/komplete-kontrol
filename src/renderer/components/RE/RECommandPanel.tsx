import React, { useState, useEffect } from 'react';
import { Search, Sparkles, AlertCircle } from 'lucide-react';
import type { Theme } from '../../types';

interface RECommandPanelProps {
  theme: Theme;
  onCommandSubmit: (command: string) => void;
  isProcessing?: boolean;
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

export const RECommandPanel: React.FC<RECommandPanelProps> = ({
  theme,
  onCommandSubmit,
  isProcessing = false
}) => {
  const [input, setInput] = useState('');
  const [intent, setIntent] = useState<REIntent | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse command in real-time as user types
  useEffect(() => {
    if (!input.trim()) {
      setIntent(null);
      setParseError(null);
      return;
    }

    const parseCommand = async () => {
      try {
        const result = await (window as any).maestro.re.parseCommand(input);
        if (result.success && result.data) {
          setIntent(result.data);
          setParseError(null);
        } else {
          setIntent(null);
          setParseError(result.error || 'Failed to parse command');
        }
      } catch (error: any) {
        setIntent(null);
        setParseError(error.message || 'Parse error');
      }
    };

    const debounce = setTimeout(parseCommand, 300);
    return () => clearTimeout(debounce);
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onCommandSubmit(input.trim());
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return theme.colors.success;
    if (confidence >= 0.5) return theme.colors.warning;
    return theme.colors.error;
  };

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: theme.colors.bgMain,
      borderBottom: `1px solid ${theme.colors.border}`,
    }}>
      {/* Command Input */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '0.75rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: theme.colors.bgActivity,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          padding: '0.5rem 0.75rem',
        }}>
          <Search size={18} color={theme.colors.textDim} style={{ marginRight: '0.5rem' }} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder="reverse engineer myapp.apk"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: theme.colors.textMain,
              fontSize: '0.9rem',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            style={{
              marginLeft: '0.5rem',
              padding: '0.25rem 0.75rem',
              backgroundColor: intent && intent.confidence >= 0.5 ? theme.colors.accent : theme.colors.bgActivity,
              color: theme.colors.accentForeground,
              border: 'none',
              borderRadius: '6px',
              cursor: input.trim() && !isProcessing ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isProcessing ? 1 : 0.5,
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            {isProcessing ? 'Processing...' : 'Analyze'}
          </button>
        </div>
      </form>

      {/* Intent Preview */}
      {intent && (
        <div style={{
          backgroundColor: theme.colors.bgSidebar,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '6px',
          padding: '0.75rem',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.5rem',
          }}>
            <Sparkles size={16} color={theme.colors.accent} style={{ marginRight: '0.5rem' }} />
            <span style={{
              color: theme.colors.textMain,
              fontSize: '0.85rem',
              fontWeight: 500,
            }}>
              Detected Intent
            </span>
            <div style={{
              marginLeft: 'auto',
              padding: '0.125rem 0.5rem',
              backgroundColor: getConfidenceColor(intent.confidence) + '20',
              color: getConfidenceColor(intent.confidence),
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}>
              {Math.round(intent.confidence * 100)}% confidence
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: theme.colors.textDim }}>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: theme.colors.textMain, fontWeight: 500 }}>Target: </span>
              <span style={{ fontFamily: 'monospace' }}>{intent.target.type}</span>
              {intent.target.path && ` (${intent.target.path})`}
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: theme.colors.textMain, fontWeight: 500 }}>Depth: </span>
              <span>{intent.options.depth || 'moderate'}</span>
            </div>
            {intent.options.parallel && (
              <div style={{ color: theme.colors.success }}>
                ⚡ Parallel execution enabled
              </div>
            )}
          </div>
        </div>
      )}

      {/* Parse Error */}
      {parseError && !intent && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: theme.colors.error + '20',
          border: `1px solid ${theme.colors.error}`,
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          fontSize: '0.8rem',
          color: theme.colors.error,
        }}>
          <AlertCircle size={16} style={{ marginRight: '0.5rem' }} />
          <span>{parseError}</span>
        </div>
      )}

      {/* Low Confidence Warning */}
      {intent && intent.confidence < 0.5 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: theme.colors.warning + '20',
          border: `1px solid ${theme.colors.warning}`,
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          fontSize: '0.8rem',
          color: theme.colors.warning,
          marginTop: '0.5rem',
        }}>
          <AlertCircle size={16} style={{ marginRight: '0.5rem' }} />
          <span>Low confidence - please be more specific</span>
        </div>
      )}
    </div>
  );
};
