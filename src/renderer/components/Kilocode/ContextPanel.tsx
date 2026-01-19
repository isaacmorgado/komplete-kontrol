/**
 * Context Panel Component
 * Displays memory entries and context management
 */

import React, { useState, useEffect } from "react";

interface MemoryEntry {
  id: string;
  sessionId: string;
  workspacePath: string;
  memoryType: "summary" | "key_fact" | "pattern" | "decision";
  content: string;
  tokensSaved: number;
  relevanceScore: number;
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
}

interface ContextPanelProps {
  workspacePath: string;
  className?: string;
}

export const ContextPanel: React.FC<ContextPanelProps> = ({
  workspacePath,
  className = "",
}) => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryEntry | null>(null);
  const [filter, setFilter] = useState<"all" | "summary" | "key_fact" | "pattern" | "decision">("all");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadMemories();
    loadStats();
  }, [workspacePath, filter]);

  const loadMemories = async () => {
    try {
      setLoading(true);
      setError(null);

      // @ts-ignore
      const result = await window.komplete?.context?.retrieveMemory?.(
        "",
        workspacePath,
        1000
      );

      if (result?.success) {
        let filteredMemories = result.memories || [];

        if (filter !== "all") {
          filteredMemories = filteredMemories.filter((m: MemoryEntry) => m.memoryType === filter);
        }

        setMemories(filteredMemories);
      } else {
        setError(result?.error || "Failed to load memories");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // @ts-ignore
      const result = await window.komplete?.context?.getMemoryStats?.(workspacePath);

      if (result?.success) {
        setStats(result.stats);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    const colors = {
      summary: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
      key_fact: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      pattern: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
      decision: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200";
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      summary: "Summary",
      key_fact: "Key Fact",
      pattern: "Pattern",
      decision: "Decision",
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div className={`p-4 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Context Memory
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Persistent context storage and retrieval
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {memories.length}
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              Total Memories
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {memories.reduce((sum, m) => sum + m.tokensSaved, 0).toLocaleString()}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">
              Tokens Saved
            </div>
          </div>

          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {memories.reduce((sum, m) => sum + m.accessCount, 0)}
            </div>
            <div className="text-sm text-purple-700 dark:text-purple-300">
              Total Accesses
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="summary">Summaries</option>
            <option value="key_fact">Key Facts</option>
            <option value="pattern">Patterns</option>
            <option value="decision">Decisions</option>
          </select>
        </div>

        <button
          onClick={loadMemories}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Memories List */}
      {!loading && memories.length === 0 && (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            No memories found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Context will be automatically condensed as you work
          </p>
        </div>
      )}

      {!loading && memories.length > 0 && (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div
              key={memory.id}
              onClick={() => setSelectedMemory(memory)}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-1 rounded ${getTypeColor(memory.memoryType)}`}>
                      {getTypeLabel(memory.memoryType)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(memory.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                    {memory.content}
                  </p>
                </div>

                <div className="ml-4 text-right">
                  <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                    -{memory.tokensSaved.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    tokens saved
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {memory.accessCount}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Memory Detail Modal */}
      {selectedMemory && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMemory(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Memory Details
                </h3>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className={`text-xs px-2 py-1 rounded ${getTypeColor(selectedMemory.memoryType)}`}>
                    {getTypeLabel(selectedMemory.memoryType)}
                  </span>
                </div>

                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm">{selectedMemory.content}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Tokens Saved:</span>
                    <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                      {selectedMemory.tokensSaved.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Access Count:</span>
                    <span className="ml-2 font-semibold">{selectedMemory.accessCount}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Created:</span>
                    <span className="ml-2">{formatDate(selectedMemory.createdAt)}</span>
                  </div>

                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Relevance Score:</span>
                    <span className="ml-2 font-semibold">
                      {selectedMemory.relevanceScore.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
