/**
 * Cost Optimization Panel Component
 * Displays model recommendations and cost savings
 */

import React, { useState } from "react";

interface ModelInfo {
  id: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  capabilities: string[];
}

interface ProviderSelection {
  model: ModelInfo;
  estimatedCost: number;
  estimatedTokens: number;
  reasoning: string;
}

interface CostOptimizationPanelProps {
  className?: string;
}

export const CostOptimizationPanel: React.FC<CostOptimizationPanelProps> = ({
  className = "",
}) => {
  const [task, setTask] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [selection, setSelection] = useState<ProviderSelection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!task.trim()) return;

    try {
      setAnalyzing(true);
      setError(null);

      // @ts-ignore
      const result = await window.komplete?.cost?.selectModel?.(task);

      if (result?.success) {
        setSelection(result.selection);
      } else {
        setError(result?.error || "Analysis failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAnalyzing(false);
    }
  };

  const getProviderColor = (provider: string) => {
    const colors = {
      anthropic: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
      openai: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      ollama: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    };
    return colors[provider as keyof typeof colors] || "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200";
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return "Free";
    return `$${cost.toFixed(4)}`;
  };

  const exampleTasks = [
    "Implement a user authentication system",
    "Write a unit test for the login component",
    "Refactor the payment processing module",
    "Debug the issue with file uploads",
    "Generate API documentation",
  ];

  return (
    <div className={`p-4 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Cost Optimization
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Intelligent model selection for optimal cost/performance
        </p>
      </div>

      {/* Task Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Task Description
        </label>

        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe your task... (e.g., 'Implement a user login system')"
          rows={4}
          className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          disabled={analyzing}
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !task.trim()}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {analyzing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Analyzing...
              </div>
            ) : (
              "Analyze & Recommend"
            )}
          </button>

          <button
            onClick={() => {
              setTask("");
              setSelection(null);
              setError(null);
            }}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Example Tasks */}
        <div className="mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {exampleTasks.map((example, idx) => (
              <button
                key={idx}
                onClick={() => setTask(example)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {selection && (
        <div className="space-y-6">
          {/* Recommended Model */}
          <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Recommended Model
              </h3>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selection.model.id}
                  </h4>
                  <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${getProviderColor(selection.model.provider)}`}>
                    {selection.model.provider}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCost(selection.estimatedCost)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    estimated cost
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {selection.reasoning}
              </p>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Input Cost</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    ${selection.model.inputCostPer1k.toFixed(4)}/1K
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Output Cost</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    ${selection.model.outputCostPer1k.toFixed(4)}/1K
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Max Tokens</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {selection.model.maxTokens.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Model Capabilities
            </h4>
            <div className="flex flex-wrap gap-2">
              {selection.model.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  {capability}
                </span>
              ))}
            </div>
          </div>

          {/* Estimated Usage */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Estimated Usage
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {selection.estimatedTokens.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Estimated Tokens
                </div>
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ~50-90%
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Cost Savings vs GPT-4
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      {!selection && (
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
            How Cost Optimization Works
          </h4>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Analyzes task complexity and required capabilities</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Selects optimal model balancing cost and capability</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Estimates tokens and cost before execution</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Saves 50-90% on simple tasks vs premium models</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
