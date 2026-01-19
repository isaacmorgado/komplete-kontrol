/**
 * Semantic Search Panel Component
 * Interface for semantic code search
 */

import React, { useState, useEffect } from "react";

interface SearchResult {
  filePath: string;
  chunkText: string;
  startLine: number;
  endLine: number;
  score: number;
  language: string;
}

interface IndexingProgress {
  total: number;
  processed: number;
  failed: number;
  currentFile?: string;
  status: "idle" | "indexing" | "completed" | "error";
  error?: string;
}

interface SemanticSearchPanelProps {
  workspacePath: string;
  className?: string;
}

export const SemanticSearchPanel: React.FC<SemanticSearchPanelProps> = ({
  workspacePath,
  className = "",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState<IndexingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(10);
  const [minScore, setMinScore] = useState(0.7);

  useEffect(() => {
    checkIndexStatus();
  }, [workspacePath]);

  useEffect(() => {
    // Listen for indexing progress
    // @ts-ignore
    const unsubscribe = window.komplete?.semanticSearch?.onProgress((prog: IndexingProgress) => {
      setProgress(prog);
      if (prog.status === "completed" || prog.status === "error") {
        setIndexing(false);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const checkIndexStatus = async () => {
    try {
      // @ts-ignore
      const result = await window.komplete?.semanticSearch?.getStatus(workspacePath);
      if (result?.success) {
        setIndexing(result.status?.isIndexing || false);
      }
    } catch (err) {
      console.error("Failed to check index status:", err);
    }
  };

  const startIndexing = async () => {
    try {
      setIndexing(true);
      setError(null);

      const config = {
        embedder: {
          provider: "openai",
          model: "text-embedding-3-small",
          dimensions: 1536,
        },
      };

      // @ts-ignore
      const result = await window.komplete?.semanticSearch?.startIndex?.(workspacePath, config);

      if (!result?.success) {
        setError(result?.error || "Failed to start indexing");
        setIndexing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIndexing(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      setSearching(true);
      setError(null);
      setResults([]);

      // @ts-ignore
      const result = await window.komplete?.semanticSearch?.search?.(
        workspacePath,
        query,
        { maxResults, minScore }
      );

      if (result?.success) {
        setResults(result.results || []);
      } else {
        setError(result?.error || "Search failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSearching(false);
    }
  };

  const clearIndex = async () => {
    if (!confirm("Are you sure you want to clear the index?")) return;

    try {
      // @ts-ignore
      const result = await window.komplete?.semanticSearch?.clearIndex?.(workspacePath);

      if (!result?.success) {
        setError(result?.error || "Failed to clear index");
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "text-green-600 dark:text-green-400";
    if (score >= 0.8) return "text-blue-600 dark:text-blue-400";
    if (score >= 0.7) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  return (
    <div className={`p-4 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Semantic Code Search
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Search your codebase by meaning, not just keywords
        </p>
      </div>

      {/* Indexing Status */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Index Status
          </h3>

          {!indexing && !progress && (
            <button
              onClick={startIndexing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Start Indexing
            </button>
          )}

          {!indexing && progress?.status === "completed" && (
            <button
              onClick={clearIndex}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Clear Index
            </button>
          )}
        </div>

        {(indexing || progress) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {progress?.status === "indexing" ? "Indexing..." : progress?.status}
              </span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {progress?.processed || 0} / {progress?.total || 0}
              </span>
            </div>

            {progress?.total && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(progress.processed / progress.total) * 100}%`,
                  }}
                />
              </div>
            )}

            {progress?.currentFile && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {progress.currentFile}
              </p>
            )}

            {progress?.error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {progress.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Search Form */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search Query
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g., 'function to authenticate users'"
              className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={searching}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {searching ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Searching...
                </div>
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Results
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              min={1}
              max={100}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Score ({minScore.toFixed(2)})
            </label>
            <input
              type="range"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              min={0}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Results ({results.length})
            </h3>
          </div>

          {results.map((result, idx) => (
            <div
              key={idx}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      {result.filePath}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Lines {result.startLine}-{result.endLine}
                    </span>
                  </div>

                  {result.language && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                      {result.language}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <div className={`text-lg font-semibold ${getScoreColor(result.score)}`}>
                    {(result.score * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    similarity
                  </div>
                </div>
              </div>

              <pre className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                {result.chunkText}
              </pre>
            </div>
          ))}
        </div>
      )}

      {!searching && results.length === 0 && query && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No results found. Try adjusting your search query or lowering the minimum score.
        </div>
      )}
    </div>
  );
};
