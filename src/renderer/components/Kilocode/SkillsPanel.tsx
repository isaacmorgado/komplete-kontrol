/**
 * Skills Panel Component
 * Displays available skills and allows viewing/editing them
 */

import React, { useEffect, useState } from "react";

interface SkillMetadata {
  name: string;
  description: string;
  path: string;
  source: "global" | "project";
  mode?: string;
  license?: string;
  compatibility?: string;
}

interface SkillContent extends SkillMetadata {
  instructions: string;
}

interface SkillsPanelProps {
  currentMode?: string;
  onSkillSelect?: (skill: SkillContent) => void;
  className?: string;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
  currentMode,
  onSkillSelect,
  className = "",
}) => {
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillContent | null>(null);
  const [filter, setFilter] = useState<"all" | "global" | "project">("all");

  useEffect(() => {
    loadSkills();
  }, [currentMode, filter]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);

      // @ts-ignore - Kilocode APIs
      const result = await window.komplete?.skills?.list(currentMode);

      if (result?.success) {
        let filteredSkills = result.skills || [];

        if (filter !== "all") {
          filteredSkills = filteredSkills.filter((s: SkillMetadata) => s.source === filter);
        }

        setSkills(filteredSkills);
      } else {
        setError(result?.error || "Failed to load skills");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSkillClick = async (skill: SkillMetadata) => {
    try {
      // @ts-ignore
      const result = await window.komplete?.skills?.get(skill.name, currentMode);

      if (result?.success && result.skill) {
        setSelectedSkill(result.skill);
        onSkillSelect?.(result.skill);
      }
    } catch (err) {
      console.error("Failed to load skill:", err);
    }
  };

  const getSourceBadgeColor = (source: string) => {
    return source === "global"
      ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
      : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
  };

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 mb-2">{error}</p>
          <button
            onClick={loadSkills}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            No skills found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {filter === "all"
              ? "No skills available for this mode."
              : `No ${filter} skills found.`}
          </p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Create skills in{" "}
            <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
              ~/.komplete-kontrol/skills/
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Skills
            {currentMode && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                ({currentMode})
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {skills.length} skill{skills.length !== 1 ? "s" : ""} available
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "global" | "project")}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="global">Global</option>
            <option value="project">Project</option>
          </select>

          <button
            onClick={loadSkills}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh skills"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {skills.map((skill) => (
          <div
            key={skill.name}
            onClick={() => handleSkillClick(skill)}
            className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-blue-500 dark:hover:border-blue-400"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  {skill.name}
                  {skill.mode && (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                      {skill.mode}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {skill.description}
                </p>
              </div>

              <div className="flex flex-col gap-1 items-end">
                <span className={`text-xs px-2 py-1 rounded ${getSourceBadgeColor(skill.source)}`}>
                  {skill.source}
                </span>
                {skill.license && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {skill.license}
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {skill.path}
            </div>
          </div>
        ))}
      </div>

      {selectedSkill && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
              {selectedSkill.name}
            </h3>
            <button
              onClick={() => setSelectedSkill(null)}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="prose dark:prose-invert max-w-none text-sm">
            <pre className="whitespace-pre-wrap font-mono bg-white dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
              {selectedSkill.instructions}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
