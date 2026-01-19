# 🗂️ Project Structure: .

**Generated**: 2026-01-18 20:22:49
**Purpose**: Quick navigation reference for Claude (token-efficient)

---

## 📁 Directory Tree

```
/Users/imorgado/Desktop/Komplete-Kontrol/komplete-kontrol
├── 📁 .claude/
├── 📄 checkpoint-state.json
├── 📄 file-changes.json
├── 📄 health.json
└── 📄 project-index.md
├── 📁 .github/
└── 📁 instructions/
│   └── 📄 memory.instruction.md
├── 📄 .gitignore
├── 📄 .npmrc
├── 📄 .prettierignore
├── 📄 .prettierrc
├── 📄 AGENT_SUPPORT.md
├── 📄 ARCHITECTURE.md
├── 📁 Auto Run Docs/
└── 📁 Wizard-2026-01-17/
│   ├── 📄 Phase-01-Foundation-Skills-System.md
│   ├── 📄 Phase-02-MCP-Multi-Transport.md
│   ├── 📄 Phase-03-Permission-System-Enhancements.md
│   ├── 📄 Phase-04-Mid-Session-Model-Switching.md
│   ├── 📄 Phase-05-LSP-Integration.md
│   ├── 📄 Phase-06-ChatGPT-Subscription-OAuth.md
│   ├── 📄 Phase-07-Skill-Activation-Integration.md
│   ├── 📄 Phase-08-Provider-Unification.md
│   ├── 📄 Phase-09-UI-Integration.md
│   ├── 📄 Phase-10-Testing-Documentation.md
│   └── 📁 Working/
│   │   └── 📄 sample-skill.md
├── 📄 BACKBURNER.md
├── 📄 CLAUDE-AGENTS.md
├── 📄 CLAUDE-FEATURES.md
├── 📄 CLAUDE-IPC.md
├── 📄 CLAUDE-PATTERNS.md
├── 📄 CLAUDE-PERFORMANCE.md
├── 📄 CLAUDE-SESSION.md
├── 📄 CLAUDE-WIZARD.md
├── 📄 CLAUDE.md
├── 📄 CONSTITUTION.md
├── 📄 CONTRIBUTING.md
├── 📄 FORK_IMPLEMENTATION_PLAN.md
├── 📄 LICENSE
├── 📄 RE-PHASE-1-IMPLEMENTATION-SUMMARY.md
├── 📄 RE-PHASE-2-UI-INTEGRATION-COMPLETE.md
├── 📄 RE-PHASE-3-TESTING-COMPLETE.md
├── 📄 RE-QUICKSTART.md
├── 📄 RE-SYSTEM-COMPLETE.md
├── 📄 README.md
├── 📄 SECURITY.md
├── 📄 SKILLS-QUICKSTART.md
├── 📄 SKILLS-SYSTEM-IMPLEMENTATION.md
├── 📄 SKILLS-TEST-REPORT.md
├── 📄 TESTING-SUMMARY.md
├── 📄 THEMES.md
├── 📁 docs/
├── 📁 about/
│   └── 📄 overview.md
├── 📄 achievements.md
├── 📁 assets/
│   ├── 📄 icon.ico
│   ├── 📄 icon.png
│   ├── 📄 made-with-maestro.svg
│   └── 📄 maestro-app-icon.png
├── 📄 autorun-playbooks.md
├── 📄 cli.md
├── 📄 configuration.md
├── 📄 context-management.md
├── 📄 docs.json
├── 📄 document-graph.md
├── 📄 features.md
├── 📄 general-usage.md
├── 📄 getting-started.md
├── 📄 git-worktrees.md
├── 📄 group-chat.md
├── 📄 history.md
├── 📄 index.md
├── 📄 installation.md
├── 📄 keyboard-shortcuts.md
├── 📄 mcp-server.md
├── 📄 openspec-commands.md
├── 📄 playbook-exchange.md
├── 📄 provider-nuances.md
├── 📄 releases.md
├── 📄 remote-access.md
├── 📁 screenshots/
│   ├── 📄 achievements-share.png
│   ├── 📄 achievements.png
│   ├── 📄 autorun-1.png
│   ├── 📄 autorun-2.png
│   ├── 📄 autorun-expanded.png
│   ├── 📄 cmd-k-1.png
│   ├── 📄 command-interpreter.png
│   ├── 📄 context-warnings-config.png
│   ├── 📄 context-warnings.png
│   ├── 📄 document-graph-last-graph.png
│   ├── 📄 document-graph.png
│   ├── 📄 file-viewer.png
│   ├── 📄 git-diff.png
│   ├── 📄 git-logs.png
│   ├── 📄 git-worktree-configuration.png
│   ├── 📄 git-worktree-list.png
│   ├── 📄 git-worktree-remove.png
│   ├── 📄 git-worktree-right-click.png
│   ├── 📄 git-worktrees.png
│   ├── 📄 group-chat-over-ssh.png
│   ├── 📄 group-chat.png
│   ├── 📄 history-1.png
│   ├── 📄 history-2.png
│   ├── 📄 history-3.png
│   ├── 📄 history-4.png
│   ├── 📄 input-toggles-defaults.png
│   ├── 📄 input-toggles.png
│   ├── 📄 leaderboard.png
│   ├── 📄 maestro-intro.png
│   ├── 📄 maestro-sessions.png
│   ├── 📄 main-screen.png
│   ├── 📄 mobile-chat.png
│   ├── 📄 mobile-groups.png
│   ├── 📄 mobile-history.png
│   ├── 📄 openspec-commands.png
│   ├── 📄 playbook-exchange-details.png
│   ├── 📄 playbook-exchange-list.png
│   ├── 📄 prompt-composer-button.png
│   ├── 📄 prompt-composer.png
│   ├── 📄 session-tracking.png
│   ├── 📄 shortcuts-modal.png
│   ├── 📄 shortcuts-settings.png
│   ├── 📄 speckit-commands.png
│   ├── 📄 ssh-agents-mapping.png
│   ├── 📄 ssh-agents-servers.png
│   ├── 📄 ssh-agents-status.png
│   ├── 📄 symphony-active.png
│   ├── 📄 symphony-create-agent.png
│   ├── 📄 symphony-details.png
│   ├── 📄 symphony-history.png
│   ├── 📄 symphony-list.png
│   ├── 📄 symphony-stats.png
│   ├── 📄 tab-close-center.png
│   ├── 📄 tab-close-cmd-k.png
│   ├── 📄 tab-close-left.png
│   ├── 📄 tab-close-right.png
│   ├── 📄 tab-menu.png
│   ├── 📄 tab-merge.png
│   ├── 📄 tab-search.png
│   ├── 📄 tab-send.png
│   ├── 📄 themes.png
│   ├── 📄 usage-dashboard.png
│   ├── 📄 wizard-doc-generation.png
│   └── 📄 wizard-inline.png
├── 📄 screenshots.md
├── 📄 slash-commands.md
├── 📄 speckit-commands.md
├── 📄 ssh-remote-execution.md
├── 📄 symphony.md
├── 📄 troubleshooting.md
└── 📄 usage-dashboard.md
├── 📁 e2e/
├── 📄 autorun-batch.spec.ts
├── 📄 autorun-editing.spec.ts
├── 📄 autorun-sessions.spec.ts
├── 📄 autorun-setup.spec.ts
└── 📁 fixtures/
│   └── 📄 electron-app.ts
├── 📄 eslint.config.mjs
├── 📄 maestro-re.db
├── 📄 package-lock.json
├── 📄 package.json
├── 📄 playwright.config.ts
├── 📄 postcss.config.mjs
├── 📁 scripts/
├── 📄 build-cli.mjs
├── 📄 fix-unused-vars.mjs
├── 📄 generate-prompts.mjs
├── 📄 notarize.js
├── 📄 refresh-openspec.mjs
├── 📄 refresh-speckit.mjs
├── 📄 set-version.mjs
└── 📄 sync-release-notes.mjs
├── 📁 src/
├── 📁 __tests__/
│   ├── 📁 cli/
│   │   ├── 📁 commands/
│   │   ├── 📁 output/
│   │   └── 📁 services/
│   ├── 📁 e2e/
│   │   └── 📄 WebServerSync.e2e.test.ts
│   ├── 📁 fixtures/
│   │   └── 📄 maestro-test-image.png
│   ├── 📁 integration/
│   │   ├── 📄 AutoRunBatchProcessing.test.tsx
│   │   ├── 📄 AutoRunRightPanel.test.tsx
│   │   ├── 📄 AutoRunSessionList.test.tsx
│   │   ├── 📄 InlineWizardFlow.test.tsx
│   │   ├── 📄 RemoteControlSync.test.ts
│   │   ├── 📄 group-chat-integration.test.ts
│   │   ├── 📄 group-chat-test-utils.ts
│   │   ├── 📄 group-chat.integration.test.ts
│   │   ├── 📁 kilocode/
│   │   └── 📄 provider-integration.test.ts
│   ├── 📁 kilocode/
│   │   └── 📄 index.ts
│   ├── 📁 komplete/
│   │   ├── 📁 config/
│   │   ├── 📁 core/
│   │   └── 📁 utils/
│   ├── 📁 main/
│   │   ├── 📄 agent-capabilities.test.ts
│   │   ├── 📄 agent-detector.test.ts
│   │   ├── 📄 agent-session-storage.test.ts
│   │   ├── 📄 autorun-folder-validation.test.ts
│   │   ├── 📄 autorun-ipc.test.ts
│   │   ├── 📄 autorun-watcher.test.ts
│   │   ├── 📁 debug-package/
│   │   ├── 📄 documentGraph-watcher.test.ts
│   │   ├── 📁 group-chat/
│   │   ├── 📄 group-chat-images.test.ts
│   │   ├── 📁 ipc/
│   │   ├── 📄 openspec-manager.test.ts
│   │   ├── 📁 parsers/
│   │   ├── 📄 power-manager.test.ts
│   │   ├── 📄 process-manager.test.ts
│   │   ├── 📄 ssh-remote-manager.test.ts
│   │   ├── 📄 stats-db.test.ts
│   │   ├── 📄 themes.test.ts
│   │   ├── 📄 tunnel-manager.test.ts
│   │   ├── 📄 update-checker.test.ts
│   │   ├── 📁 utils/
│   │   └── 📁 web-server/
│   ├── 📁 performance/
│   │   ├── 📄 AutoRunLargeDocument.test.tsx
│   │   ├── 📄 AutoRunManyDocuments.test.tsx
│   │   ├── 📄 AutoRunMemoryLeaks.test.tsx
│   │   ├── 📄 AutoRunRapidInteractions.test.tsx
│   │   └── 📄 ThinkingStreamPerformance.test.tsx
│   ├── 📁 renderer/
│   │   ├── 📁 components/
│   │   ├── 📁 constants/
│   │   ├── 📁 contexts/
│   │   ├── 📄 fonts-and-sizing.test.ts
│   │   ├── 📁 hooks/
│   │   ├── 📁 services/
│   │   ├── 📁 types/
│   │   └── 📁 utils/
│   ├── 📄 setup.ts
│   ├── 📁 shared/
│   │   ├── 📄 cli-activity.test.ts
│   │   ├── 📄 emojiUtils.test.ts
│   │   ├── 📄 formatters.test.ts
│   │   ├── 📄 gitUtils.test.ts
│   │   ├── 📄 group-chat-types.test.ts
│   │   ├── 📄 history.test.ts
│   │   ├── 📄 pathUtils.test.ts
│   │   ├── 📄 performance-metrics.test.ts
│   │   ├── 📄 stringUtils.test.ts
│   │   ├── 📄 synopsis.test.ts
│   │   ├── 📄 templateVariables.test.ts
│   │   ├── 📄 theme-types.test.ts
│   │   ├── 📄 treeUtils.test.ts
│   │   └── 📄 uuid.test.ts
│   ├── 📁 unit/
│   │   ├── 📁 context-management/
│   │   ├── 📁 cost-optimization/
│   │   ├── 📁 semantic-search/
│   │   └── 📁 skills/
│   └── 📁 web/
│   │   ├── 📄 App.test.tsx
│   │   ├── 📁 components/
│   │   ├── 📁 hooks/
│   │   ├── 📁 mobile/
│   │   └── 📁 utils/
├── 📁 cli/
│   ├── 📁 commands/
│   │   ├── 📄 clean-playbooks.ts
│   │   ├── 📄 list-agents.ts
│   │   ├── 📄 list-groups.ts
│   │   ├── 📄 list-playbooks.ts
│   │   ├── 📄 run-playbook.ts
│   │   ├── 📄 show-agent.ts
│   │   └── 📄 show-playbook.ts
│   ├── 📄 index.ts
│   ├── 📁 output/
│   │   ├── 📄 formatter.ts
│   │   └── 📄 jsonl.ts
│   └── 📁 services/
│   │   ├── 📄 agent-spawner.ts
│   │   ├── 📄 batch-processor.ts
│   │   ├── 📄 playbooks.ts
│   │   └── 📄 storage.ts
├── 📁 generated/
│   └── 📄 prompts.ts
├── 📁 komplete/
│   ├── 📄 README.md
│   ├── 📁 cli/
│   │   ├── 📄 chat.ts
│   │   └── 📄 index.ts
│   ├── 📁 config/
│   │   └── 📄 index.ts
│   ├── 📁 core/
│   │   ├── 📁 agents/
│   │   ├── 📁 commands/
│   │   ├── 📁 context/
│   │   ├── 📁 healing/
│   │   ├── 📁 hooks/
│   │   ├── 📁 indexing/
│   │   ├── 📁 intelligence/
│   │   ├── 📁 memory/
│   │   ├── 📁 providers/
│   │   ├── 📁 swarm/
│   │   └── 📁 tasks/
│   ├── 📁 integrations/
│   │   ├── 📄 index.ts
│   │   ├── 📁 network/
│   │   ├── 📁 screenshot-to-code/
│   │   ├── 📁 vision/
│   │   └── 📄 vision-workflow.ts
│   ├── 📁 mcp/
│   │   ├── 📄 agent-executor.ts
│   │   ├── 📄 client.ts
│   │   ├── 📄 discovery.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 registry.ts
│   │   ├── 📄 result-handler.ts
│   │   ├── 📁 servers/
│   │   ├── 📄 stdio-bridge.ts
│   │   └── 📄 types.ts
│   ├── 📁 types/
│   │   ├── 📄 bun-shim.ts
│   │   ├── 📄 globals.d.ts
│   │   └── 📄 index.ts
│   └── 📁 utils/
│   │   ├── 📄 error-handler.ts
│   │   └── 📄 logger.ts
├── 📁 main/
│   ├── 📄 agent-capabilities.ts
│   ├── 📄 agent-detector.ts
│   ├── 📄 agent-session-storage.ts
│   ├── 📁 auto/
│   ├── 📄 auto-updater.ts
│   ├── 📁 bridges/
│   │   ├── 📁 python/
│   │   └── 📁 rust/
│   ├── 📄 constants.ts
│   ├── 📁 context-management/
│   │   ├── 📄 ContextManager.ts
│   │   ├── 📄 ConversationCondenser.ts
│   │   ├── 📄 MemoryBank.ts
│   │   ├── 📄 index.ts
│   │   └── 📄 types.ts
│   ├── 📁 cost-optimization/
│   │   ├── 📄 CostRouter.ts
│   │   ├── 📄 index.ts
│   │   └── 📄 types.ts
│   ├── 📁 database/
│   │   └── 📄 migrations.ts
│   ├── 📁 debug-package/
│   │   ├── 📁 __tests__/
│   │   ├── 📁 collectors/
│   │   ├── 📄 index.ts
│   │   └── 📄 packager.ts
│   ├── 📁 group-chat/
│   │   ├── 📄 group-chat-agent.ts
│   │   ├── 📄 group-chat-log.ts
│   │   ├── 📄 group-chat-moderator.ts
│   │   ├── 📄 group-chat-router.ts
│   │   ├── 📄 group-chat-storage.ts
│   │   └── 📄 session-recovery.ts
│   ├── 📁 handoffs/
│   ├── 📄 history-manager.ts
│   ├── 📄 index.ts
│   ├── 📁 ipc/
│   │   └── 📁 handlers/
│   ├── 📁 modes/
│   │   ├── 📄 controller.ts
│   │   ├── 📄 definitions.ts
│   │   ├── 📄 events.ts
│   │   ├── 📄 index.ts
│   │   ├── 📁 prompts/
│   │   ├── 📁 tools/
│   │   └── 📄 types.ts
│   ├── 📄 openspec-manager.ts
│   ├── 📁 parsers/
│   │   ├── 📄 agent-output-parser.ts
│   │   ├── 📄 claude-output-parser.ts
│   │   ├── 📄 codex-output-parser.ts
│   │   ├── 📄 error-patterns.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 opencode-output-parser.ts
│   │   └── 📄 usage-aggregator.ts
│   ├── 📄 power-manager.ts
│   ├── 📄 preload.ts
│   ├── 📄 process-manager.ts
│   ├── 📁 re/
│   │   ├── 📄 index.ts
│   │   ├── 📄 intent-parser.ts
│   │   ├── 📄 ipc-handlers.ts
│   │   ├── 📄 orchestrator.ts
│   │   ├── 📄 re-database.sql
│   │   ├── 📄 re-database.ts
│   │   ├── 📄 seed-database.ts
│   │   ├── 📄 tool-selector.ts
│   │   └── 📁 workflows/
│   ├── 📁 semantic-search/
│   │   ├── 📄 CodeIndexManager.ts
│   │   ├── 📁 embedders/
│   │   ├── 📄 index.ts
│   │   ├── 📁 processors/
│   │   ├── 📄 types.ts
│   │   └── 📁 vector-store/
│   ├── 📁 skills/
│   │   ├── 📄 SkillsManager.ts
│   │   ├── 📄 index.ts
│   │   └── 📄 types.ts
│   ├── 📄 speckit-manager.ts
│   ├── 📄 ssh-remote-manager.ts
│   ├── 📄 stats-db.ts
│   ├── 📁 storage/
│   │   ├── 📄 claude-session-storage.ts
│   │   ├── 📄 codex-session-storage.ts
│   │   ├── 📄 index.ts
│   │   └── 📄 opencode-session-storage.ts
│   ├── 📄 themes.ts
│   ├── 📁 tools/
│   │   ├── 📄 index.ts
│   │   ├── 📄 registry.ts
│   │   └── 📄 types.ts
│   ├── 📄 tunnel-manager.ts
│   ├── 📄 update-checker.ts
│   ├── 📁 utils/
│   │   ├── 📄 agent-args.ts
│   │   ├── 📄 cliDetection.ts
│   │   ├── 📄 context-groomer.ts
│   │   ├── 📄 execFile.ts
│   │   ├── 📄 ipcHandler.ts
│   │   ├── 📄 logger.ts
│   │   ├── 📄 networkUtils.ts
│   │   ├── 📄 pricing.ts
│   │   ├── 📄 remote-fs.ts
│   │   ├── 📄 remote-git.ts
│   │   ├── 📄 shell-escape.ts
│   │   ├── 📄 shellDetector.ts
│   │   ├── 📄 ssh-command-builder.ts
│   │   ├── 📄 ssh-config-parser.ts
│   │   ├── 📄 ssh-remote-resolver.ts
│   │   ├── 📄 statsCache.ts
│   │   ├── 📄 stripAnsi.ts
│   │   ├── 📄 terminalFilter.ts
│   │   └── 📄 wslDetector.ts
│   ├── 📁 web-server/
│   │   ├── 📁 handlers/
│   │   ├── 📁 routes/
│   │   └── 📁 services/
│   └── 📄 web-server.ts
├── 📁 prompts/
│   ├── 📄 autorun-default.md
│   ├── 📄 autorun-synopsis.md
│   ├── 📄 commit-command.md
│   ├── 📄 context-grooming.md
│   ├── 📄 context-summarize.md
│   ├── 📄 context-transfer.md
│   ├── 📄 group-chat-moderator-synthesis.md
│   ├── 📄 group-chat-moderator-system.md
│   ├── 📄 group-chat-participant-request.md
│   ├── 📄 group-chat-participant.md
│   ├── 📄 image-only-default.md
│   ├── 📄 index.ts
│   ├── 📄 maestro-system-prompt.md
│   ├── 📁 openspec/
│   │   ├── 📄 index.ts
│   │   ├── 📄 metadata.json
│   │   ├── 📄 openspec.apply.md
│   │   ├── 📄 openspec.archive.md
│   │   ├── 📄 openspec.help.md
│   │   ├── 📄 openspec.implement.md
│   │   └── 📄 openspec.proposal.md
│   ├── 📁 speckit/
│   │   ├── 📄 index.ts
│   │   ├── 📄 metadata.json
│   │   ├── 📄 speckit.analyze.md
│   │   ├── 📄 speckit.checklist.md
│   │   ├── 📄 speckit.clarify.md
│   │   ├── 📄 speckit.constitution.md
│   │   ├── 📄 speckit.help.md
│   │   ├── 📄 speckit.implement.md
│   │   ├── 📄 speckit.plan.md
│   │   ├── 📄 speckit.specify.md
│   │   ├── 📄 speckit.tasks.md
│   │   └── 📄 speckit.taskstoissues.md
│   ├── 📄 wizard-document-generation.md
│   ├── 📄 wizard-inline-iterate-generation.md
│   ├── 📄 wizard-inline-iterate.md
│   ├── 📄 wizard-inline-new.md
│   ├── 📄 wizard-inline-system.md
│   ├── 📄 wizard-system-continuation.md
│   └── 📄 wizard-system.md
├── 📁 renderer/
│   ├── 📄 App.tsx
│   ├── 📁 assets/
│   │   ├── 📄 conductor-dark.png
│   │   ├── 📄 conductor-light.png
│   │   ├── 📄 icon-wand.png
│   │   └── 📄 pedram-avatar.png
│   ├── 📄 assets.d.ts
│   ├── 📁 components/
│   │   ├── 📄 AICommandsPanel.tsx
│   │   ├── 📄 AboutModal.tsx
│   │   ├── 📄 AchievementCard.tsx
│   │   ├── 📄 AgentErrorModal.tsx
│   │   ├── 📄 AgentPromptComposerModal.tsx
│   │   ├── 📄 AgentSessionsBrowser.tsx
│   │   ├── 📄 AgentSessionsModal.tsx
│   │   ├── 📄 AppModals.tsx
│   │   ├── 📄 AppOverlays.tsx
│   │   ├── 📁 AutoModeStatus/
│   │   ├── 📄 AutoRun.tsx
│   │   ├── 📄 AutoRunDocumentSelector.tsx
│   │   ├── 📄 AutoRunExpandedModal.tsx
│   │   ├── 📄 AutoRunLightbox.tsx
│   │   ├── 📄 AutoRunSearchBar.tsx
│   │   ├── 📄 AutoRunSetupModal.tsx
│   │   ├── 📄 AutoRunnerHelpModal.tsx
│   │   ├── 📄 BatchRunnerModal.tsx
│   │   ├── 📄 CollapsibleJsonViewer.tsx
│   │   ├── 📄 ConfirmModal.tsx
│   │   ├── 📄 ContextWarningSash.tsx
│   │   ├── 📄 CreateGroupModal.tsx
│   │   ├── 📄 CreatePRModal.tsx
│   │   ├── 📄 CreateWorktreeModal.tsx
│   │   ├── 📄 CustomThemeBuilder.tsx
│   │   ├── 📄 DebugPackageModal.tsx
│   │   ├── 📄 DebugWizardModal.tsx
│   │   ├── 📄 DeleteAgentConfirmModal.tsx
│   │   ├── 📄 DeleteGroupChatModal.tsx
│   │   ├── 📄 DeleteWorktreeModal.tsx
│   │   ├── 📁 DocumentGraph/
│   │   ├── 📄 DocumentsPanel.tsx
│   │   ├── 📄 EditGroupChatModal.tsx
│   │   ├── 📄 EmptyStateView.tsx
│   │   ├── 📄 ErrorBoundary.tsx
│   │   ├── 📄 ExecutionQueueBrowser.tsx
│   │   ├── 📄 ExecutionQueueIndicator.tsx
│   │   ├── 📄 FileExplorerPanel.tsx
│   │   ├── 📄 FilePreview.tsx
│   │   ├── 📄 FileSearchModal.tsx
│   │   ├── 📄 FirstRunCelebration.tsx
│   │   ├── 📄 FontConfigurationPanel.tsx
│   │   ├── 📄 GistPublishModal.tsx
│   │   ├── 📄 GitDiffViewer.tsx
│   │   ├── 📄 GitLogViewer.tsx
│   │   ├── 📄 GitStatusWidget.tsx
│   │   ├── 📄 GitWorktreeSection.tsx
│   │   ├── 📄 GroupChatHeader.tsx
│   │   ├── 📄 GroupChatHistoryPanel.tsx
│   │   ├── 📄 GroupChatInfoOverlay.tsx
│   │   ├── 📄 GroupChatInput.tsx
│   │   ├── 📄 GroupChatList.tsx
│   │   ├── 📄 GroupChatMessages.tsx
│   │   ├── 📄 GroupChatPanel.tsx
│   │   ├── 📄 GroupChatParticipants.tsx
│   │   ├── 📄 GroupChatRightPanel.tsx
│   │   ├── 📄 HistoryDetailModal.tsx
│   │   ├── 📄 HistoryHelpModal.tsx
│   │   ├── 📄 HistoryPanel.tsx
│   │   ├── 📄 ImageDiffViewer.tsx
│   │   ├── 📁 InlineWizard/
│   │   ├── 📄 InputArea.tsx
│   │   ├── 📄 KeyboardMasteryCelebration.tsx
│   │   ├── 📁 Kilocode/
│   │   ├── 📄 LeaderboardRegistrationModal.tsx
│   │   ├── 📄 LightboxModal.tsx
│   │   ├── 📄 LogFilterControls.tsx
│   │   ├── 📄 LogViewer.tsx
│   │   ├── 📄 MaestroSilhouette.tsx
│   │   ├── 📄 MainPanel.tsx
│   │   ├── 📄 MarkdownRenderer.tsx
│   │   ├── 📄 MarketplaceModal.tsx
│   │   ├── 📄 MergeProgressModal.tsx
│   │   ├── 📄 MergeProgressOverlay.tsx
│   │   ├── 📄 MergeSessionModal.tsx
│   │   ├── 📄 MermaidRenderer.tsx
│   │   ├── 📁 ModeSelector/
│   │   ├── 📁 ModelProfileEditor/
│   │   ├── 📄 NewGroupChatModal.tsx
│   │   ├── 📄 NewInstanceModal.tsx
│   │   ├── 📄 NotificationsPanel.tsx
│   │   ├── 📄 OpenSpecCommandsPanel.tsx
│   │   ├── 📄 ParticipantCard.tsx
│   │   ├── 📄 PlaybookDeleteConfirmModal.tsx
│   │   ├── 📄 PlaybookNameModal.tsx
│   │   ├── 📄 PlaygroundPanel.tsx
│   │   ├── 📄 ProcessMonitor.tsx
│   │   ├── 📄 PromptComposerModal.tsx
│   │   ├── 📄 QRCode.tsx
│   │   ├── 📄 QueuedItemsList.tsx
│   │   ├── 📄 QuickActionsModal.tsx
│   │   ├── 📄 QuitConfirmModal.tsx
│   │   ├── 📁 RE/
│   │   ├── 📄 REPanel.tsx
│   │   ├── 📄 RenameGroupChatModal.tsx
│   │   ├── 📄 RenameGroupModal.tsx
│   │   ├── 📄 RenameSessionModal.tsx
│   │   ├── 📄 RenameTabModal.tsx
│   │   ├── 📄 ResetTasksConfirmModal.tsx
│   │   ├── 📄 RightPanel.tsx
│   │   ├── 📄 SendToAgentModal.tsx
│   │   ├── 📄 SessionActivityGraph.tsx
│   │   ├── 📄 SessionItem.tsx
│   │   ├── 📄 SessionList.tsx
│   │   ├── 📄 SessionListItem.tsx
│   │   ├── 📄 SettingCheckbox.tsx
│   │   ├── 📁 Settings/
│   │   ├── 📄 SettingsModal.tsx
│   │   ├── 📄 ShortcutEditor.tsx
│   │   ├── 📄 ShortcutsHelpModal.tsx
│   │   ├── 📄 SpecKitCommandsPanel.tsx
│   │   ├── 📄 StandingOvationOverlay.tsx
│   │   ├── 📄 SummarizeProgressModal.tsx
│   │   ├── 📄 SummarizeProgressOverlay.tsx
│   │   ├── 📄 TabBar.tsx
│   │   ├── 📄 TabSwitcherModal.tsx
│   │   ├── 📄 TemplateAutocompleteDropdown.tsx
│   │   ├── 📄 TerminalOutput.tsx
│   │   ├── 📄 ThemePicker.tsx
│   │   ├── 📄 ThinkingStatusPill.tsx
│   │   ├── 📄 Toast.tsx
│   │   ├── 📄 ToggleButtonGroup.tsx
│   │   ├── 📄 ToolCallCard.tsx
│   │   ├── 📁 ToolCallViewer/
│   │   ├── 📄 TransferErrorModal.tsx
│   │   ├── 📄 TransferProgressModal.tsx
│   │   ├── 📄 UpdateCheckModal.tsx
│   │   ├── 📁 UsageDashboard/
│   │   ├── 📁 Wizard/
│   │   ├── 📄 WorktreeConfigModal.tsx
│   │   ├── 📁 shared/
│   │   └── 📁 ui/
│   ├── 📁 constants/
│   │   ├── 📄 agentIcons.ts
│   │   ├── 📄 app.ts
│   │   ├── 📄 colorblindPalettes.ts
│   │   ├── 📄 conductorBadges.ts
│   │   ├── 📄 keyboardMastery.ts
│   │   ├── 📄 modalPriorities.ts
│   │   ├── 📄 shortcuts.ts
│   │   └── 📄 themes.ts
│   ├── 📁 contexts/
│   │   ├── 📄 AutoRunContext.tsx
│   │   ├── 📄 GitStatusContext.tsx
│   │   ├── 📄 GroupChatContext.tsx
│   │   ├── 📄 InlineWizardContext.tsx
│   │   ├── 📄 InputContext.tsx
│   │   ├── 📄 LayerStackContext.tsx
│   │   ├── 📄 ModalContext.tsx
│   │   ├── 📄 SessionContext.tsx
│   │   ├── 📄 ToastContext.tsx
│   │   └── 📄 UILayoutContext.tsx
│   ├── 📁 docs/
│   │   └── 📄 app-tsx-inventory.md
│   ├── 📄 global.d.ts
│   ├── 📁 hooks/
│   │   ├── 📁 agent/
│   │   ├── 📁 batch/
│   │   ├── 📁 git/
│   │   ├── 📄 index.ts
│   │   ├── 📁 input/
│   │   ├── 📁 keyboard/
│   │   ├── 📁 re/
│   │   ├── 📁 remote/
│   │   ├── 📁 session/
│   │   ├── 📁 settings/
│   │   ├── 📁 ui/
│   │   ├── 📄 useInlineWizard.ts
│   │   ├── 📄 useStats.ts
│   │   └── 📁 utils/
│   ├── 📄 index.css
│   ├── 📄 index.html
│   ├── 📄 main.tsx
│   ├── 📁 public/
│   │   └── 📄 icon.png
│   ├── 📁 services/
│   │   ├── 📄 contextGroomer.ts
│   │   ├── 📄 contextSummarizer.ts
│   │   ├── 📄 git.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 inlineWizardConversation.ts
│   │   ├── 📄 inlineWizardDocumentGeneration.ts
│   │   ├── 📄 ipcWrapper.ts
│   │   ├── 📄 openspec.ts
│   │   ├── 📄 process.ts
│   │   ├── 📄 speckit.ts
│   │   └── 📄 wizardIntentParser.ts
│   ├── 📄 slashCommands.ts
│   ├── 📁 types/
│   │   ├── 📄 contextMerge.ts
│   │   ├── 📄 fileTree.ts
│   │   ├── 📄 index.ts
│   │   └── 📄 layer.ts
│   ├── 📁 utils/
│   │   ├── 📄 confetti.ts
│   │   ├── 📄 contextExtractor.ts
│   │   ├── 📄 contextUsage.ts
│   │   ├── 📄 documentStats.ts
│   │   ├── 📄 existingDocsDetector.ts
│   │   ├── 📄 fileExplorer.ts
│   │   ├── 📄 formatters.ts
│   │   ├── 📄 gitDiffParser.ts
│   │   ├── 📄 groupChatExport.ts
│   │   ├── 📄 ids.ts
│   │   ├── 📄 logger.ts
│   │   ├── 📄 markdownConfig.ts
│   │   ├── 📄 markdownLinkParser.ts
│   │   ├── 📄 participantColors.ts
│   │   ├── 📄 remarkFileLinks.ts
│   │   ├── 📄 remarkFrontmatterTable.ts
│   │   ├── 📄 search.ts
│   │   ├── 📄 sessionHelpers.ts
│   │   ├── 📄 sessionValidation.ts
│   │   ├── 📄 shortcutFormatter.ts
│   │   ├── 📄 tabExport.ts
│   │   ├── 📄 tabHelpers.ts
│   │   ├── 📄 templateVariables.ts
│   │   ├── 📄 textProcessing.ts
│   │   ├── 📄 theme.tsx
│   │   └── 📄 tokenCounter.ts
│   ├── 📄 wdyr.dev.ts
│   └── 📄 wdyr.ts
├── 📁 shared/
│   ├── 📄 cli-activity.ts
│   ├── 📄 emojiUtils.ts
│   ├── 📄 formatters.ts
│   ├── 📄 gitUtils.ts
│   ├── 📄 group-chat-types.ts
│   ├── 📄 history.ts
│   ├── 📄 index.ts
│   ├── 📄 logger-types.ts
│   ├── 📄 marketplace-types.ts
│   ├── 📄 pathUtils.ts
│   ├── 📄 performance-metrics.ts
│   ├── 📄 stats-types.ts
│   ├── 📄 stringUtils.ts
│   ├── 📄 synopsis.ts
│   ├── 📄 templateVariables.ts
│   ├── 📄 theme-types.ts
│   ├── 📄 themes.ts
│   ├── 📄 treeUtils.ts
│   ├── 📄 types.ts
│   └── 📄 uuid.ts
├── 📁 types/
│   └── 📄 vite-raw.d.ts
└── 📁 web/
│   ├── 📄 App.tsx
│   ├── 📁 components/
│   │   ├── 📄 Badge.tsx
│   │   ├── 📄 Button.tsx
│   │   ├── 📄 Card.tsx
│   │   ├── 📄 Input.tsx
│   │   ├── 📄 PullToRefresh.tsx
│   │   ├── 📄 ThemeProvider.tsx
│   │   └── 📄 index.ts
│   ├── 📁 hooks/
│   │   ├── 📄 index.ts
│   │   ├── 📄 useCommandHistory.ts
│   │   ├── 📄 useDeviceColorScheme.ts
│   │   ├── 📄 useKeyboardVisibility.ts
│   │   ├── 📄 useLongPressMenu.ts
│   │   ├── 📄 useMobileAutoReconnect.ts
│   │   ├── 📄 useMobileKeyboardHandler.ts
│   │   ├── 📄 useMobileSessionManagement.ts
│   │   ├── 📄 useMobileViewState.ts
│   │   ├── 📄 useNotifications.ts
│   │   ├── 📄 useOfflineQueue.ts
│   │   ├── 📄 usePullToRefresh.ts
│   │   ├── 📄 useSessions.ts
│   │   ├── 📄 useSlashCommandAutocomplete.ts
│   │   ├── 📄 useSwipeGestures.ts
│   │   ├── 📄 useSwipeUp.ts
│   │   ├── 📄 useUnreadBadge.ts
│   │   ├── 📄 useVoiceInput.ts
│   │   └── 📄 useWebSocket.ts
│   ├── 📄 index.css
│   ├── 📄 index.html
│   ├── 📄 index.ts
│   ├── 📄 main.tsx
│   ├── 📁 mobile/
│   │   ├── 📄 AllSessionsView.tsx
│   │   ├── 📄 App.tsx
│   │   ├── 📄 AutoRunIndicator.tsx
│   │   ├── 📄 CommandHistoryDrawer.tsx
│   │   ├── 📄 CommandInputBar.tsx
│   │   ├── 📄 CommandInputButtons.tsx
│   │   ├── 📄 ConnectionStatusIndicator.tsx
│   │   ├── 📄 MessageHistory.tsx
│   │   ├── 📄 MobileHistoryPanel.tsx
│   │   ├── 📄 MobileMarkdownRenderer.tsx
│   │   ├── 📄 OfflineQueueBanner.tsx
│   │   ├── 📄 QuickActionsMenu.tsx
│   │   ├── 📄 RecentCommandChips.tsx
│   │   ├── 📄 ResponseViewer.tsx
│   │   ├── 📄 SessionPillBar.tsx
│   │   ├── 📄 SessionStatusBanner.tsx
│   │   ├── 📄 SlashCommandAutocomplete.tsx
│   │   ├── 📄 TabBar.tsx
│   │   ├── 📄 TabSearchModal.tsx
│   │   ├── 📄 constants.ts
│   │   └── 📄 index.tsx
│   ├── 📁 public/
│   │   ├── 📁 icons/
│   │   ├── 📄 manifest.json
│   │   └── 📄 sw.js
│   └── 📁 utils/
│   │   ├── 📄 config.ts
│   │   ├── 📄 cssCustomProperties.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 logger.ts
│   │   ├── 📄 serviceWorker.ts
│   │   └── 📄 viewState.ts
├── 📄 symphony-registry.json
├── 📄 tailwind.config.mjs
├── 📄 test-re-integration.js
├── 📄 test-re-seed.js
├── 📄 test-skills-integration.md
├── 📄 test-skills-system.js
├── 📄 tsconfig.cli.json
├── 📄 tsconfig.json
├── 📄 tsconfig.lint.json
├── 📄 tsconfig.main.json
├── 📄 vite.config.mts
├── 📄 vite.config.web.mts
├── 📄 vitest.config.mts
├── 📄 vitest.integration.config.ts
└── 📄 vitest.performance.config.mts
```

---

## 📋 Important Files

### Configuration
• ./node_modules/.package-lock.json
• ./.claude/file-changes.json
• ./.claude/checkpoint-state.json
• ./.claude/health.json
• ./tsconfig.cli.json
• ./tsconfig.lint.json
• ./docs/docs.json
• ./package-lock.json
• ./package.json
• ./tsconfig.main.json
• ./tsconfig.json
• ./symphony-registry.json

### Documentation
• ./README.md
• ./build/README.md
• ./CLAUDE.md
• ./ARCHITECTURE.md
• ./CONSTITUTION.md
• ./RE-PHASE-1-IMPLEMENTATION-SUMMARY.md
• ./ARCHITECTURE.md
• ./RE-PHASE-2-UI-INTEGRATION-COMPLETE.md
• ./SKILLS-TEST-REPORT.md
• ./CLAUDE-SESSION.md
• ./TESTING-SUMMARY.md
• ./CLAUDE-AGENTS.md
• ./.claude/project-index.md
• ./RE-PHASE-3-TESTING-COMPLETE.md
• ./test-skills-integration.md
• ./docs/slash-commands.md
• ./docs/remote-access.md
• ./docs/playbook-exchange.md
• ./docs/releases.md
• ./docs/cli.md
• ./docs/troubleshooting.md
• ./docs/keyboard-shortcuts.md
• ./docs/general-usage.md
• ./docs/history.md
• ./docs/openspec-commands.md
• ./docs/context-management.md
• ./docs/achievements.md
• ./docs/group-chat.md
• ./docs/mcp-server.md
• ./docs/provider-nuances.md
• ./docs/getting-started.md
• ./docs/speckit-commands.md
• ./docs/screenshots.md
• ./docs/index.md
• ./docs/configuration.md
• ./docs/ssh-remote-execution.md
• ./docs/usage-dashboard.md
• ./docs/features.md
• ./docs/git-worktrees.md
• ./docs/installation.md
• ./docs/autorun-playbooks.md
• ./docs/document-graph.md
• ./docs/symphony.md
• ./README.md
• ./BACKBURNER.md
• ./CLAUDE-IPC.md
• ./CLAUDE-PATTERNS.md
• ./CONTRIBUTING.md
• ./SKILLS-QUICKSTART.md
• ./CLAUDE-WIZARD.md
• ./THEMES.md
• ./AGENT_SUPPORT.md
• ./build/README.md
• ./RE-SYSTEM-COMPLETE.md
• ./CLAUDE-FEATURES.md
• ./SKILLS-SYSTEM-IMPLEMENTATION.md
• ./FORK_IMPLEMENTATION_PLAN.md
• ./RE-QUICKSTART.md
• ./CLAUDE.md
• ./SECURITY.md
• ./CLAUDE-PERFORMANCE.md

### Entry Points
• ./src/renderer/main.tsx
• ./src/web/main.tsx
• ./dist/renderer/index.html
• ./dist/web/index.html
• ./dist/prompts/index.js
• ./dist/main/index.js
• ./node_modules/pako/index.js
• ./node_modules/queue-microtask/index.js
• ./node_modules/queue-microtask/index.d.ts
• ./node_modules/is-plain-obj/index.js
• ./node_modules/is-plain-obj/index.d.ts
• ./node_modules/forwarded-parse/index.js
• ./node_modules/forwarded-parse/index.d.ts
• ./node_modules/lzma-native/index.js
• ./node_modules/plist/index.js
• ./node_modules/pend/index.js
• ./node_modules/fd-slicer/index.js
• ./node_modules/callsites/index.js
• ./node_modules/callsites/index.d.ts
• ./node_modules/hast-util-heading-rank/index.js
• ./node_modules/hast-util-heading-rank/index.d.ts
• ./node_modules/is-extendable/index.js
• ./node_modules/agentkeepalive/index.js
• ./node_modules/agentkeepalive/index.d.ts
• ./node_modules/zod/index.d.cts
• ./node_modules/zod/index.js
• ./node_modules/zod/index.cjs
• ./node_modules/zod/index.d.ts
• ./node_modules/pg-int8/index.js
• ./node_modules/node-gyp-build/index.js
• ./node_modules/zwitch/index.js
• ./node_modules/zwitch/index.d.ts
• ./node_modules/humanize-ms/index.js
• ./node_modules/define-data-property/index.js
• ./node_modules/define-data-property/index.d.ts
• ./node_modules/is-bigint/index.js
• ./node_modules/is-bigint/index.d.ts
• ./node_modules/fs-constants/index.js
• ./node_modules/which-boxed-primitive/index.js
• ./node_modules/which-boxed-primitive/index.d.ts
• ./node_modules/light-my-request/index.js
• ./node_modules/pirates/index.d.ts
• ./node_modules/hosted-git-info/index.js
• ./node_modules/tldts/index.ts
• ./node_modules/globals/index.js
• ./node_modules/globals/index.d.ts
• ./node_modules/micromark-core-commonmark/index.js
• ./node_modules/micromark-core-commonmark/index.d.ts
• ./node_modules/micromark-core-commonmark/index.d.ts.map
• ./node_modules/pino-std-serializers/index.js
• ./node_modules/pino-std-serializers/index.d.ts
• ./node_modules/lodash/index.js
• ./node_modules/has-unicode/index.js
• ./node_modules/lodash.flatten/index.js
• ./node_modules/quick-lru/index.js
• ./node_modules/quick-lru/index.d.ts
• ./node_modules/browserslist/index.js
• ./node_modules/browserslist/index.d.ts
• ./node_modules/micromark-util-sanitize-uri/index.js
• ./node_modules/micromark-util-sanitize-uri/index.d.ts
• ./node_modules/micromark-util-sanitize-uri/index.d.ts.map
• ./node_modules/process-nextick-args/index.js
• ./node_modules/shebang-regex/index.js
• ./node_modules/shebang-regex/index.d.ts
• ./node_modules/pino/index.html
• ./node_modules/redent/index.js
• ./node_modules/redent/index.d.ts
• ./node_modules/thenify/index.js
• ./node_modules/path-is-absolute/index.js
• ./node_modules/http-cache-semantics/index.js
• ./node_modules/require-in-the-middle/index.js
• ./node_modules/functions-have-names/index.js
• ./node_modules/is-array-buffer/index.js
• ./node_modules/is-array-buffer/index.d.ts
• ./node_modules/has-property-descriptors/index.js
• ./node_modules/csstype/index.js.flow
• ./node_modules/csstype/index.d.ts
• ./node_modules/mdast-util-gfm-autolink-literal/index.js
• ./node_modules/mdast-util-gfm-autolink-literal/index.d.ts
• ./node_modules/toidentifier/index.js
• ./node_modules/extend/index.js
• ./node_modules/string.prototype.trimend/index.js
• ./node_modules/wcwidth/index.js
• ./node_modules/make-dir/index.js
• ./node_modules/make-dir/index.d.ts
• ./node_modules/stylis/index.js
• ./node_modules/micromark-extension-gfm-autolink-literal/index.js
• ./node_modules/micromark-extension-gfm-autolink-literal/index.d.ts
• ./node_modules/mimic-fn/index.js
• ./node_modules/mimic-fn/index.d.ts
• ./node_modules/strip-ansi/index.js
• ./node_modules/strip-ansi/index.d.ts
• ./node_modules/prebuild-install/index.js
• ./node_modules/fast-json-stringify/index.js
• ./node_modules/react-is/index.js
• ./node_modules/is-typed-array/index.js
• ./node_modules/is-typed-array/index.d.ts
• ./node_modules/tmp-promise/index.js
• ./node_modules/tmp-promise/index.test-d.ts
• ./node_modules/tmp-promise/index.d.ts
• ./node_modules/character-reference-invalid/index.js
• ./node_modules/character-reference-invalid/index.d.ts
• ./node_modules/function.prototype.name/index.js
• ./node_modules/dotenv-expand/index.d.ts
• ./node_modules/mnemonist/index.js
• ./node_modules/mnemonist/index.d.ts
• ./node_modules/istanbul-reports/index.js
• ./node_modules/flatted/index.js
• ./node_modules/unist-util-stringify-position/index.js
• ./node_modules/unist-util-stringify-position/index.d.ts
• ./node_modules/loose-envify/index.js
• ./node_modules/es-errors/index.js
• ./node_modules/es-errors/index.d.ts
• ./node_modules/is-obj/index.js
• ./node_modules/is-obj/index.d.ts
• ./node_modules/has-proto/index.js
• ./node_modules/has-proto/index.d.ts
• ./node_modules/unist-util-visit-parents/index.js
• ./node_modules/unist-util-visit-parents/index.d.ts
• ./node_modules/lodash.union/index.js
• ./node_modules/string.prototype.trimstart/index.js
• ./node_modules/micromark-util-normalize-identifier/index.js
• ./node_modules/micromark-util-normalize-identifier/index.d.ts
• ./node_modules/micromark-util-normalize-identifier/index.d.ts.map
• ./node_modules/bail/index.js
• ./node_modules/bail/index.d.ts
• ./node_modules/text-decoder/index.js
• ./node_modules/p-cancelable/index.js
• ./node_modules/p-cancelable/index.d.ts
• ./node_modules/require-main-filename/index.js
• ./node_modules/node-addon-api/index.js
• ./node_modules/ms/index.js
• ./node_modules/gray-matter/index.js
• ./node_modules/content-disposition/index.js
• ./node_modules/possible-typed-array-names/index.js
• ./node_modules/possible-typed-array-names/index.d.ts
• ./node_modules/call-bind/index.js
• ./node_modules/html-void-elements/index.js
• ./node_modules/html-void-elements/index.d.ts
• ./node_modules/playwright-core/index.js
• ./node_modules/playwright-core/index.mjs
• ./node_modules/playwright-core/index.d.ts
• ./node_modules/min-indent/index.js
• ./node_modules/escape-string-regexp/index.js
• ./node_modules/escape-string-regexp/index.d.ts
• ./node_modules/indent-string/index.js
• ./node_modules/indent-string/index.d.ts
• ./node_modules/has-tostringtag/index.js
• ./node_modules/has-tostringtag/index.d.ts
• ./node_modules/mz/index.js
• ./node_modules/stream-shift/index.js
• ./node_modules/strip-json-comments/index.js
• ./node_modules/strip-json-comments/index.d.ts
• ./node_modules/lru-cache/index.js
• ./node_modules/use-sync-external-store/index.js
• ./node_modules/stringify-entities/index.js
• ./node_modules/stringify-entities/index.d.ts
• ./node_modules/mdast-util-gfm-footnote/index.js
• ./node_modules/mdast-util-gfm-footnote/index.d.ts
• ./node_modules/minipass-pipeline/index.js
• ./node_modules/type-fest/index.d.ts
• ./node_modules/commander/index.js
• ./node_modules/require-directory/index.js
• ./node_modules/proxy-addr/index.js
• ./node_modules/depd/index.js
• ./node_modules/array.prototype.flat/index.js
• ./node_modules/string.prototype.trim/index.js
• ./node_modules/duplexify/index.js
• ./node_modules/ci-info/index.js
• ./node_modules/ci-info/index.d.ts
• ./node_modules/property-information/index.js
• ./node_modules/property-information/index.d.ts
• ./node_modules/escalade/index.d.mts
• ./node_modules/escalade/index.d.ts
• ./node_modules/7zip-bin/index.js
• ./node_modules/7zip-bin/index.d.ts
• ./node_modules/chai/index.js
• ./node_modules/side-channel-list/index.js
• ./node_modules/side-channel-list/index.d.ts
• ./node_modules/fast-json-stable-stringify/index.js
• ./node_modules/fast-json-stable-stringify/index.d.ts
• ./node_modules/object.values/index.js
• ./node_modules/deep-extend/index.js
• ./node_modules/detect-libc/index.d.ts
• ./node_modules/balanced-match/index.js
• ./node_modules/path-exists/index.js
• ./node_modules/path-exists/index.d.ts
• ./node_modules/progress/index.js
• ./node_modules/unist-util-position/index.js
• ./node_modules/unist-util-position/index.d.ts
• ./node_modules/resolve/index.js
• ./node_modules/resolve/index.mjs
• ./node_modules/retry/index.js
• ./node_modules/micromark-extension-frontmatter/index.js
• ./node_modules/micromark-extension-frontmatter/index.d.ts
• ./node_modules/micromark-factory-label/index.js
• ./node_modules/micromark-factory-label/index.d.ts
• ./node_modules/micromark-factory-label/index.d.ts.map
• ./node_modules/data-view-byte-offset/index.js
• ./node_modules/data-view-byte-offset/index.d.ts
• ./node_modules/call-bind-apply-helpers/index.js
• ./node_modules/call-bind-apply-helpers/index.d.ts
• ./node_modules/object-hash/index.js
• ./node_modules/concurrently/index.js
• ./node_modules/concurrently/index.mjs
• ./node_modules/base64-js/index.js
• ./node_modules/base64-js/index.d.ts
• ./node_modules/node-api-version/index.js
• ./node_modules/is-number-object/index.js
• ./node_modules/is-number-object/index.d.ts
• ./node_modules/tldts-core/index.ts
• ./node_modules/nanoid/index.d.cts
• ./node_modules/nanoid/index.browser.js
• ./node_modules/nanoid/index.js
• ./node_modules/nanoid/index.browser.cjs
• ./node_modules/nanoid/index.cjs
• ./node_modules/nanoid/index.d.ts
• ./node_modules/inline-style-parser/index.d.ts
• ./node_modules/buffer-crc32/index.d.ts
• ./node_modules/is-potential-custom-element-name/index.js
• ./node_modules/micromark-util-types/index.js
• ./node_modules/micromark-util-types/index.d.ts
• ./node_modules/hast-util-whitespace/index.js
• ./node_modules/hast-util-whitespace/index.d.ts
• ./node_modules/cli-truncate/index.js
• ./node_modules/cli-truncate/index.d.ts
• ./node_modules/remark-parse/index.js
• ./node_modules/remark-parse/index.d.ts
• ./node_modules/is-alphabetical/index.js
• ./node_modules/is-alphabetical/index.d.ts
• ./node_modules/extract-zip/index.js
• ./node_modules/extract-zip/index.d.ts
• ./node_modules/postcss-js/index.js
• ./node_modules/postcss-js/index.mjs
• ./node_modules/wrap-ansi/index.js
• ./node_modules/wrap-ansi/index.d.ts
• ./node_modules/micromark-util-html-tag-name/index.js
• ./node_modules/micromark-util-html-tag-name/index.d.ts
• ./node_modules/micromark-util-html-tag-name/index.d.ts.map
• ./node_modules/own-keys/index.js
• ./node_modules/own-keys/index.d.ts
• ./node_modules/y18n/index.mjs
• ./node_modules/gensync/index.js
• ./node_modules/gensync/index.js.flow
• ./node_modules/prettier/index.cjs
• ./node_modules/prettier/index.mjs
• ./node_modules/prettier/index.d.ts
• ./node_modules/reflect.getprototypeof/index.js
• ./node_modules/is-generator-function/index.js
• ./node_modules/is-generator-function/index.d.ts
• ./node_modules/async-function/index.d.mts
• ./node_modules/async-function/index.js
• ./node_modules/async-function/index.mjs
• ./node_modules/async-function/index.d.ts
• ./node_modules/unist-util-is/index.js
• ./node_modules/unist-util-is/index.d.ts
• ./node_modules/unist-util-is/index.d.ts.map
• ./node_modules/micromark-factory-whitespace/index.js
• ./node_modules/micromark-factory-whitespace/index.d.ts
• ./node_modules/micromark-factory-whitespace/index.d.ts.map
• ./node_modules/is-negative-zero/index.js
• ./node_modules/is-negative-zero/index.d.ts
• ./node_modules/ignore/index.js
• ./node_modules/ignore/index.d.ts
• ./node_modules/file-uri-to-path/index.js
• ./node_modules/file-uri-to-path/index.d.ts
• ./node_modules/extend-shallow/index.js
• ./node_modules/normalize-url/index.js
• ./node_modules/normalize-url/index.d.ts
• ./node_modules/debounce-fn/index.js
• ./node_modules/debounce-fn/index.d.ts
• ./node_modules/resolve-alpn/index.js
• ./node_modules/vitest/index.d.cts
• ./node_modules/vitest/index.cjs
• ./node_modules/assertion-error/index.js
• ./node_modules/assertion-error/index.d.ts
• ./node_modules/hast-util-from-parse5/index.js
• ./node_modules/hast-util-from-parse5/index.d.ts
• ./node_modules/micromark-util-decode-string/index.js
• ./node_modules/micromark-util-decode-string/index.d.ts
• ./node_modules/micromark-util-decode-string/index.d.ts.map
• ./node_modules/sonic-boom/index.js
• ./node_modules/remark-gfm/index.js
• ./node_modules/remark-gfm/index.d.ts
• ./node_modules/hachure-fill/index.d.ts
• ./node_modules/picomatch/index.js
• ./node_modules/safe-buffer/index.js
• ./node_modules/safe-buffer/index.d.ts
• ./node_modules/is-symbol/index.js
• ./node_modules/is-symbol/index.d.ts
• ./node_modules/lowercase-keys/index.js
• ./node_modules/lowercase-keys/index.d.ts
• ./node_modules/function-bind/index.js
• ./node_modules/hast-util-raw/index.js
• ./node_modules/hast-util-raw/index.d.ts
• ./node_modules/is-glob/index.js
• ./node_modules/is-async-function/index.js
• ./node_modules/is-async-function/index.d.ts
• ./node_modules/minipass-flush/index.js
• ./node_modules/is-weakref/index.js
• ./node_modules/is-weakref/index.d.ts
• ./node_modules/is-fullwidth-code-point/index.js
• ./node_modules/is-fullwidth-code-point/index.d.ts
• ./node_modules/env-paths/index.js
• ./node_modules/env-paths/index.d.ts
• ./node_modules/ora/index.js
• ./node_modules/ora/index.d.ts
• ./node_modules/truncate-utf8-bytes/index.js
• ./node_modules/jsonfile/index.js
• ./node_modules/is-ci/index.js
• ./node_modules/cytoscape/index.d.ts
• ./node_modules/is-date-object/index.js
• ./node_modules/is-date-object/index.d.ts
• ./node_modules/array-includes/index.js
• ./node_modules/date-fns/index.d.cts
• ./node_modules/date-fns/index.js
• ./node_modules/date-fns/index.cjs
• ./node_modules/date-fns/index.d.ts
• ./node_modules/postgres-interval/index.js
• ./node_modules/postgres-interval/index.d.ts
• ./node_modules/anymatch/index.js
• ./node_modules/anymatch/index.d.ts
• ./node_modules/micromark-extension-gfm/index.js
• ./node_modules/micromark-extension-gfm/index.d.ts
• ./node_modules/color-name/index.js
• ./node_modules/es-define-property/index.js
• ./node_modules/es-define-property/index.d.ts
• ./node_modules/decamelize/index.js
• ./node_modules/crc/index.js
• ./node_modules/classnames/index.js
• ./node_modules/classnames/index.d.ts
• ./node_modules/avvio/index.d.ts
• ./node_modules/async/index.js
• ./node_modules/chokidar/index.js
• ./node_modules/p-locate/index.js
• ./node_modules/p-locate/index.d.ts
• ./node_modules/get-intrinsic/index.js
• ./node_modules/object.entries/index.js
• ./node_modules/arg/index.js
• ./node_modules/arg/index.d.ts
• ./node_modules/unified/index.js
• ./node_modules/unified/index.d.ts
• ./node_modules/es-to-primitive/index.js
• ./node_modules/es-to-primitive/index.d.ts
• ./node_modules/es-abstract/index.js
• ./node_modules/decompress-response/index.js
• ./node_modules/decompress-response/index.d.ts
• ./node_modules/simple-get/index.js
• ./node_modules/js-yaml/index.js
• ./node_modules/whatwg-url/index.js
• ./node_modules/call-bound/index.js
• ./node_modules/call-bound/index.d.ts
• ./node_modules/typed-array-length/index.js
• ./node_modules/typed-array-length/index.d.ts
• ./node_modules/scheduler/index.js
• ./node_modules/eslint-plugin-react-hooks/index.js
• ./node_modules/eslint-plugin-react-hooks/index.d.ts
• ./node_modules/strip-ansi-cjs/index.js
• ./node_modules/strip-ansi-cjs/index.d.ts
• ./node_modules/pify/index.js
• ./node_modules/archiver/index.js
• ./node_modules/js-tiktoken/index.js
• ./node_modules/js-tiktoken/index.d.ts
• ./node_modules/events-universal/index.js
• ./node_modules/micromark-extension-gfm-strikethrough/index.js
• ./node_modules/micromark-extension-gfm-strikethrough/index.d.ts
• ./node_modules/remark-stringify/index.js
• ./node_modules/remark-stringify/index.d.ts
• ./node_modules/minipass-sized/index.js
• ./node_modules/set-function-name/index.js
• ./node_modules/set-function-name/index.d.ts
• ./node_modules/parent-module/index.js
• ./node_modules/strip-indent/index.js
• ./node_modules/strip-indent/index.d.ts
• ./node_modules/err-code/index.js
• ./node_modules/err-code/index.umd.js
• ./node_modules/is-binary-path/index.js
• ./node_modules/is-binary-path/index.d.ts
• ./node_modules/hasown/index.js
• ./node_modules/hasown/index.d.ts
• ./node_modules/side-channel-weakmap/index.js
• ./node_modules/side-channel-weakmap/index.d.ts
• ./node_modules/ccount/index.js
• ./node_modules/ccount/index.d.ts
• ./node_modules/tar-stream/index.js
• ./node_modules/run-parallel/index.js
• ./node_modules/p-limit/index.js
• ./node_modules/p-limit/index.d.ts
• ./node_modules/data-view-buffer/index.js
• ./node_modules/data-view-buffer/index.d.ts
• ./node_modules/mime-types/index.js
• ./node_modules/typed-array-byte-length/index.js
• ./node_modules/typed-array-byte-length/index.d.ts
• ./node_modules/undici-types/index.d.ts
• ./node_modules/github-from-package/index.js
• ./node_modules/micromark-factory-title/index.js
• ./node_modules/micromark-factory-title/index.d.ts
• ./node_modules/micromark-factory-title/index.d.ts.map
• ./node_modules/json-schema-traverse/index.js
• ./node_modules/markdown-table/index.js
• ./node_modules/markdown-table/index.d.ts
• ./node_modules/markdown-table/index.d.ts.map
• ./node_modules/end-of-stream/index.js
• ./node_modules/natural-compare/index.js
• ./node_modules/postgres-date/index.js
• ./node_modules/minimist/index.js
• ./node_modules/decode-named-character-reference/index.js
• ./node_modules/decode-named-character-reference/index.dom.d.ts
• ./node_modules/decode-named-character-reference/index.dom.js
• ./node_modules/decode-named-character-reference/index.d.ts
• ./node_modules/decode-named-character-reference/index.dom.d.ts.map
• ./node_modules/decode-named-character-reference/index.d.ts.map
• ./node_modules/on-exit-leak-free/index.js
• ./node_modules/mdast-util-find-and-replace/index.js
• ./node_modules/mdast-util-find-and-replace/index.d.ts
• ./node_modules/mdast-util-find-and-replace/index.d.ts.map
• ./node_modules/pkg-up/index.js
• ./node_modules/pkg-up/index.d.ts
• ./node_modules/regexp.prototype.flags/index.js
• ./node_modules/is-stream/index.js
• ./node_modules/is-stream/index.d.ts
• ./node_modules/hastscript/index.js
• ./node_modules/hastscript/index.d.ts
• ./node_modules/hastscript/index.d.ts.map
• ./node_modules/playwright/index.js
• ./node_modules/playwright/index.mjs
• ./node_modules/playwright/index.d.ts
• ./node_modules/split2/index.js
• ./node_modules/iterator.prototype/index.js
• ./node_modules/universalify/index.js
• ./node_modules/onetime/index.js
• ./node_modules/onetime/index.d.ts
• ./node_modules/fast-decode-uri-component/index.js
• ./node_modules/find-up/index.js
• ./node_modules/find-up/index.d.ts
• ./node_modules/chalk/index.d.ts
• ./node_modules/micromark-util-classify-character/index.js
• ./node_modules/micromark-util-classify-character/index.d.ts
• ./node_modules/micromark-util-classify-character/index.d.ts.map
• ./node_modules/micromark-util-decode-numeric-character-reference/index.js
• ./node_modules/micromark-util-decode-numeric-character-reference/index.d.ts
• ./node_modules/micromark-util-decode-numeric-character-reference/index.d.ts.map
• ./node_modules/ansi-regex/index.js
• ./node_modules/ansi-regex/index.d.ts
• ./node_modules/mdast-util-mdxjs-esm/index.js
• ./node_modules/mdast-util-mdxjs-esm/index.d.ts
• ./node_modules/mimic-response/index.js
• ./node_modules/matcher/index.js
• ./node_modules/matcher/index.d.ts
• ./node_modules/siginfo/index.js
• ./node_modules/import-in-the-middle/index.js
• ./node_modules/import-in-the-middle/index.d.ts
• ./node_modules/has-flag/index.js
• ./node_modules/has-flag/index.d.ts
• ./node_modules/supports-color/index.js
• ./node_modules/wrap-ansi-cjs/index.js
• ./node_modules/unbox-primitive/index.js
• ./node_modules/unbox-primitive/index.d.ts
• ./node_modules/html-escaper/index.js
• ./node_modules/is-shared-array-buffer/index.js
• ./node_modules/is-shared-array-buffer/index.d.ts
• ./node_modules/micromark-util-chunked/index.js
• ./node_modules/micromark-util-chunked/index.d.ts
• ./node_modules/micromark-util-chunked/index.d.ts.map
• ./node_modules/fs-minipass/index.js
• ./node_modules/react-markdown/index.js
• ./node_modules/react-markdown/index.d.ts
• ./node_modules/react-markdown/index.d.ts.map
• ./node_modules/delaunator/index.js
• ./node_modules/canvas/index.js
• ./node_modules/canvas/index.d.ts
• ./node_modules/supports-preserve-symlinks-flag/index.js
• ./node_modules/quick-format-unescaped/index.js
• ./node_modules/typed-array-byte-offset/index.js
• ./node_modules/typed-array-byte-offset/index.d.ts
• ./node_modules/color-convert/index.js
• ./node_modules/path-key/index.js
• ./node_modules/path-key/index.d.ts
• ./node_modules/eventemitter3/index.js
• ./node_modules/eventemitter3/index.mjs
• ./node_modules/eventemitter3/index.d.ts
• ./node_modules/istanbul-lib-report/index.js
• ./node_modules/readdirp/index.js
• ./node_modules/readdirp/index.d.ts
• ./node_modules/longest-streak/index.js
• ./node_modules/longest-streak/index.d.ts
• ./node_modules/micromark-util-resolve-all/index.js
• ./node_modules/micromark-util-resolve-all/index.d.ts
• ./node_modules/micromark-util-resolve-all/index.d.ts.map
• ./node_modules/utf8-byte-length/index.js
• ./node_modules/array-buffer-byte-length/index.js
• ./node_modules/array-buffer-byte-length/index.d.ts
• ./node_modules/brace-expansion/index.js
• ./node_modules/fill-range/index.js
• ./node_modules/aproba/index.js
• ./node_modules/json-stable-stringify-without-jsonify/index.js
• ./node_modules/lodash.difference/index.js
• ./node_modules/binary-extensions/index.js
• ./node_modules/binary-extensions/index.d.ts
• ./node_modules/get-caller-file/index.js
• ./node_modules/get-caller-file/index.js.map
• ./node_modules/get-caller-file/index.d.ts
• ./node_modules/astral-regex/index.js
• ./node_modules/astral-regex/index.d.ts
• ./node_modules/react-dom/index.js
• ./node_modules/micromark-factory-space/index.js
• ./node_modules/micromark-factory-space/index.d.ts
• ./node_modules/micromark-factory-space/index.d.ts.map
• ./node_modules/word-wrap/index.js
• ./node_modules/word-wrap/index.d.ts
• ./node_modules/path-parse/index.js
• ./node_modules/remark-rehype/index.js
• ./node_modules/remark-rehype/index.d.ts
• ./node_modules/remark-rehype/index.d.ts.map
• ./node_modules/has-symbols/index.js
• ./node_modules/has-symbols/index.d.ts
• ./node_modules/mdast-util-to-markdown/index.js
• ./node_modules/mdast-util-to-markdown/index.d.ts
• ./node_modules/defaults/index.js
• ./node_modules/mdast-util-gfm-table/index.js
• ./node_modules/mdast-util-gfm-table/index.d.ts
• ./node_modules/mdast-util-to-string/index.js
• ./node_modules/mdast-util-to-string/index.d.ts
• ./node_modules/cacheable-lookup/index.d.ts
• ./node_modules/kind-of/index.js
• ./node_modules/vfile-location/index.js
• ./node_modules/vfile-location/index.d.ts
• ./node_modules/string.prototype.repeat/index.js
• ./node_modules/mdast-util-from-markdown/index.js
• ./node_modules/mdast-util-from-markdown/index.d.ts
• ./node_modules/arraybuffer.prototype.slice/index.js
• ./node_modules/ieee754/index.js
• ./node_modules/ieee754/index.d.ts
• ./node_modules/internal-slot/index.js
• ./node_modules/internal-slot/index.d.ts
• ./node_modules/set-proto/index.js
• ./node_modules/set-proto/index.d.ts
• ./node_modules/web-namespaces/index.js
• ./node_modules/web-namespaces/index.d.ts
• ./node_modules/json-buffer/index.js
• ./node_modules/which-builtin-type/index.js
• ./node_modules/which-builtin-type/index.d.ts
• ./node_modules/safe-array-concat/index.js
• ./node_modules/safe-array-concat/index.d.ts
• ./node_modules/minizlib/index.js
• ./node_modules/array.prototype.tosorted/index.js
• ./node_modules/semver/index.js
• ./node_modules/at-least-node/index.js
• ./node_modules/is-lambda/index.js
• ./node_modules/istanbul-lib-coverage/index.js
• ./node_modules/http-errors/index.js
• ./node_modules/minipass-collect/index.js
• ./node_modules/rfdc/index.js
• ./node_modules/rfdc/index.test-d.ts
• ./node_modules/rfdc/index.d.ts
• ./node_modules/is-finalizationregistry/index.js
• ./node_modules/is-finalizationregistry/index.d.ts
• ./node_modules/define-properties/index.js
• ./node_modules/vite/index.d.cts
• ./node_modules/vite/index.cjs
• ./node_modules/strip-bom-string/index.js
• ./node_modules/node-abi/index.js
• ./node_modules/clean-stack/index.js
• ./node_modules/clean-stack/index.d.ts
• ./node_modules/robust-predicates/index.js
• ./node_modules/robust-predicates/index.d.ts
• ./node_modules/is-weakset/index.js
• ./node_modules/is-weakset/index.d.ts
• ./node_modules/trough/index.js
• ./node_modules/trough/index.d.ts
• ./node_modules/trough/index.d.ts.map
• ./node_modules/micromark-factory-destination/index.js
• ./node_modules/micromark-factory-destination/index.d.ts
• ./node_modules/micromark-factory-destination/index.d.ts.map
• ./node_modules/micromark-extension-gfm-task-list-item/index.js
• ./node_modules/micromark-extension-gfm-task-list-item/index.d.ts
• ./node_modules/micromark-util-combine-extensions/index.js
• ./node_modules/micromark-util-combine-extensions/index.d.ts
• ./node_modules/micromark-util-combine-extensions/index.d.ts.map
• ./node_modules/safe-stable-stringify/index.js
• ./node_modules/safe-stable-stringify/index.d.ts
• ./node_modules/ajv-keywords/index.js
• ./node_modules/ansi-styles/index.js
• ./node_modules/ansi-styles/index.d.ts
• ./node_modules/aggregate-error/index.js
• ./node_modules/aggregate-error/index.d.ts
• ./node_modules/is-core-module/index.js
• ./node_modules/is-map/index.js
• ./node_modules/is-map/index.d.ts
• ./node_modules/fast-uri/index.js
• ./node_modules/sumchecker/index.js
• ./node_modules/sumchecker/index.test-d.ts
• ./node_modules/sumchecker/index.d.ts
• ./node_modules/forwarded/index.js
• ./node_modules/safe-regex2/index.js
• ./node_modules/js-tokens/index.js
• ./node_modules/dlv/index.js
• ./node_modules/parse-entities/index.js
• ./node_modules/parse-entities/index.d.ts
• ./node_modules/negotiator/index.js
• ./node_modules/acorn-jsx/index.js
• ./node_modules/acorn-jsx/index.d.ts
• ./node_modules/hast-util-to-jsx-runtime/index.js
• ./node_modules/hast-util-to-jsx-runtime/index.d.ts
• ./node_modules/atomic-sleep/index.js
• ./node_modules/fast-content-type-parse/index.js
• ./node_modules/json-schema-ref-resolver/index.js
• ./node_modules/tr46/index.js
• ./node_modules/micromark-extension-gfm-table/index.js
• ./node_modules/micromark-extension-gfm-table/index.d.ts
• ./node_modules/process-warning/index.js
• ./node_modules/is-number/index.js
• ./node_modules/console-control-strings/index.js
• ./node_modules/fs.realpath/index.js
• ./node_modules/fast-fifo/index.js
• ./node_modules/compare-version/index.js
• ./node_modules/stop-iteration-iterator/index.js
• ./node_modules/stop-iteration-iterator/index.d.ts
• ./node_modules/postcss-import/index.js
• ./node_modules/shell-quote/index.js
• ./node_modules/yocto-queue/index.js
• ./node_modules/yocto-queue/index.d.ts
• ./node_modules/lodash.merge/index.js
• ./node_modules/remark-frontmatter/index.js
• ./node_modules/remark-frontmatter/index.d.ts
• ./node_modules/serialize-error/index.js
• ./node_modules/serialize-error/index.d.ts
• ./node_modules/micromark/index.js
• ./node_modules/micromark/index.d.ts
• ./node_modules/micromark/index.d.ts.map
• ./node_modules/has-bigints/index.js
• ./node_modules/has-bigints/index.d.ts
• ./node_modules/space-separated-tokens/index.js
• ./node_modules/space-separated-tokens/index.d.ts
• ./node_modules/postcss-nested/index.js
• ./node_modules/postcss-nested/index.d.ts
• ./node_modules/mdn-data/index.js
• ./node_modules/side-channel/index.js
• ./node_modules/side-channel/index.d.ts
• ./node_modules/concat-map/index.js
• ./node_modules/pump/index.js
• ./node_modules/app-builder-bin/index.js
• ./node_modules/app-builder-bin/index.d.ts
• ./node_modules/get-stream/index.js
• ./node_modules/get-stream/index.d.ts
• ./node_modules/vfile/index.js
• ./node_modules/vfile/index.d.ts
• ./node_modules/jszip/index.d.ts
• ./node_modules/update-browserslist-db/index.js
• ./node_modules/update-browserslist-db/index.d.ts
• ./node_modules/set-function-length/index.js
• ./node_modules/set-function-length/index.d.ts
• ./node_modules/es-shim-unscopables/index.js
• ./node_modules/es-shim-unscopables/index.d.ts
• ./node_modules/restore-cursor/index.js
• ./node_modules/restore-cursor/index.d.ts
• ./node_modules/safe-regex-test/index.js
• ./node_modules/safe-regex-test/index.d.ts
• ./node_modules/mdast-util-mdx-jsx/index.js
• ./node_modules/mdast-util-mdx-jsx/index.d.ts
• ./node_modules/cose-base/index.js
• ./node_modules/thenify-all/index.js
• ./node_modules/simple-concat/index.js
• ./node_modules/which-module/index.js
• ./node_modules/get-symbol-description/index.js
• ./node_modules/get-symbol-description/index.d.ts
• ./node_modules/lodash.isplainobject/index.js
• ./node_modules/convert-source-map/index.js
• ./node_modules/estree-util-is-identifier-name/index.js
• ./node_modules/estree-util-is-identifier-name/index.d.ts
• ./node_modules/mdast-util-phrasing/index.js
• ./node_modules/mdast-util-phrasing/index.d.ts
• ./node_modules/pg-types/index.js
• ./node_modules/pg-types/index.test-d.ts
• ./node_modules/pg-types/index.d.ts
• ./node_modules/github-slugger/index.js
• ./node_modules/github-slugger/index.d.ts
• ./node_modules/any-promise/index.js
• ./node_modules/any-promise/index.d.ts
• ./node_modules/async-exit-hook/index.js
• ./node_modules/obliterator/index.js
• ./node_modules/obliterator/index.d.ts
• ./node_modules/camelcase-css/index.js
• ./node_modules/cliui/index.mjs
• ./node_modules/micromark-util-character/index.js
• ./node_modules/micromark-util-character/index.d.ts
• ./node_modules/micromark-util-character/index.d.ts.map
• ./node_modules/is-hexadecimal/index.js
• ./node_modules/is-hexadecimal/index.d.ts
• ./node_modules/zip-stream/index.js
• ./node_modules/mdast-util-gfm-task-list-item/index.js
• ./node_modules/mdast-util-gfm-task-list-item/index.d.ts
• ./node_modules/object-assign/index.js
• ./node_modules/electron-store/index.js
• ./node_modules/electron-store/index.d.ts
• ./node_modules/filelist/index.js
• ./node_modules/filelist/index.d.ts
• ./node_modules/lodash.escaperegexp/index.js
• ./node_modules/get-proto/index.js
• ./node_modules/get-proto/index.d.ts
• ./node_modules/generator-function/index.d.mts
• ./node_modules/generator-function/index.js
• ./node_modules/generator-function/index.mjs
• ./node_modules/generator-function/index.d.ts
• ./node_modules/form-data/index.d.ts
• ./node_modules/slice-ansi/index.js
• ./node_modules/thread-stream/index.js
• ./node_modules/thread-stream/index.d.ts
• ./node_modules/cross-spawn/index.js
• ./node_modules/is-data-view/index.js
• ./node_modules/is-data-view/index.d.ts
• ./node_modules/prop-types/index.js
• ./node_modules/mime/index.js
• ./node_modules/micromark-util-encode/index.js
• ./node_modules/micromark-util-encode/index.d.ts
• ./node_modules/micromark-util-encode/index.d.ts.map
• ./node_modules/abstract-logging/index.js
• ./node_modules/yargs/index.cjs
• ./node_modules/yargs/index.mjs
• ./node_modules/section-matter/index.js
• ./node_modules/bluebird-lst/index.js
• ./node_modules/bluebird-lst/index.d.ts
• ./node_modules/asynckit/index.js
• ./node_modules/event-target-shim/index.d.ts
• ./node_modules/tar-fs/index.js
• ./node_modules/rehype-slug/index.js
• ./node_modules/rehype-slug/index.d.ts
• ./node_modules/lodash.isequal/index.js
• ./node_modules/comma-separated-tokens/index.js
• ./node_modules/comma-separated-tokens/index.d.ts
• ./node_modules/is-boolean-object/index.js
• ./node_modules/is-boolean-object/index.d.ts
• ./node_modules/which-collection/index.js
• ./node_modules/which-collection/index.d.ts
• ./node_modules/is-regex/index.js
• ./node_modules/is-regex/index.d.ts
• ./node_modules/vfile-message/index.js
• ./node_modules/vfile-message/index.d.ts
• ./node_modules/classcat/index.js
• ./node_modules/classcat/index.cjs
• ./node_modules/classcat/index.d.ts
• ./node_modules/import-fresh/index.js
• ./node_modules/import-fresh/index.d.ts
• ./node_modules/cookie/index.js
• ./node_modules/mdast-util-gfm/index.js
• ./node_modules/mdast-util-gfm/index.d.ts
• ./node_modules/to-regex-range/index.js
• ./node_modules/delegates/index.js
• ./node_modules/zustand/index.js
• ./node_modules/zustand/index.d.ts
• ./node_modules/dayjs/index.d.ts
• ./node_modules/module-details-from-path/index.js
• ./node_modules/hast-util-to-parse5/index.js
• ./node_modules/hast-util-to-parse5/index.d.ts
• ./node_modules/hast-util-to-parse5/index.d.ts.map
• ./node_modules/object-keys/index.js
• ./node_modules/lowlight/index.js
• ./node_modules/gopd/index.js
• ./node_modules/gopd/index.d.ts
• ./node_modules/is-unicode-supported/index.js
• ./node_modules/is-unicode-supported/index.d.ts
• ./node_modules/safe-push-apply/index.js
• ./node_modules/safe-push-apply/index.d.ts
• ./node_modules/escape-html/index.js
• ./node_modules/for-each/index.js
• ./node_modules/for-each/index.d.ts
• ./node_modules/gitdiff-parser/index.js
• ./node_modules/gitdiff-parser/index.d.ts
• ./node_modules/why-is-node-running/index.js
• ./node_modules/statuses/index.js
• ./node_modules/micromark-extension-gfm-tagfilter/index.js
• ./node_modules/micromark-extension-gfm-tagfilter/index.d.ts
• ./node_modules/which-typed-array/index.js
• ./node_modules/which-typed-array/index.d.ts
• ./node_modules/promise-retry/index.js
• ./node_modules/array.prototype.findlast/index.js
• ./node_modules/find-my-way/index.js
• ./node_modules/find-my-way/index.d.ts
• ./node_modules/string-width/index.js
• ./node_modules/string-width/index.d.ts
• ./node_modules/is-interactive/index.js
• ./node_modules/is-interactive/index.d.ts
• ./node_modules/rehype-raw/index.js
• ./node_modules/rehype-raw/index.d.ts
• ./node_modules/streamx/index.js
• ./node_modules/trim-lines/index.js
• ./node_modules/trim-lines/index.d.ts
• ./node_modules/unist-util-visit/index.js
• ./node_modules/unist-util-visit/index.d.ts
• ./node_modules/hast-util-parse-selector/index.js
• ./node_modules/hast-util-parse-selector/index.d.ts
• ./node_modules/stackback/index.js
• ./node_modules/is-callable/index.js
• ./node_modules/mdast-util-to-hast/index.js
• ./node_modules/mdast-util-to-hast/index.d.ts
• ./node_modules/is-decimal/index.js
• ./node_modules/is-decimal/index.d.ts
• ./node_modules/fault/index.js
• ./node_modules/is-weakmap/index.js
• ./node_modules/is-weakmap/index.d.ts
• ./node_modules/yauzl/index.js
• ./node_modules/data-view-byte-length/index.js
• ./node_modules/data-view-byte-length/index.d.ts
• ./node_modules/log-symbols/index.js
• ./node_modules/log-symbols/index.d.ts
• ./node_modules/p-try/index.js
• ./node_modules/p-try/index.d.ts
• ./node_modules/camelcase/index.js
• ./node_modules/camelcase/index.d.ts
• ./node_modules/isarray/index.js
• ./node_modules/micromatch/index.js
• ./node_modules/is-set/index.js
• ./node_modules/is-set/index.d.ts
• ./node_modules/eslint-plugin-react/index.js
• ./node_modules/eslint-plugin-react/index.d.ts
• ./node_modules/eslint-plugin-react/index.d.ts.map
• ./node_modules/electron/index.js
• ./node_modules/mdast-util-gfm-strikethrough/index.js
• ./node_modules/mdast-util-gfm-strikethrough/index.d.ts
• ./node_modules/resolve-from/index.js
• ./node_modules/layout-base/index.js
• ./node_modules/micromark-util-subtokenize/index.js
• ./node_modules/micromark-util-subtokenize/index.d.ts
• ./node_modules/micromark-util-subtokenize/index.d.ts.map
• ./node_modules/semver-compare/index.js
• ./node_modules/archiver-utils/index.js
• ./node_modules/is-extglob/index.js
• ./node_modules/fastq/index.d.ts
• ./node_modules/diff-match-patch/index.js
• ./node_modules/rc/index.js
• ./node_modules/available-typed-arrays/index.js
• ./node_modules/available-typed-arrays/index.d.ts
• ./node_modules/es-iterator-helpers/index.json
• ./node_modules/cli-cursor/index.js
• ./node_modules/cli-cursor/index.d.ts
• ./node_modules/set-blocking/index.js
• ./node_modules/tar/index.js
• ./node_modules/string.prototype.matchall/index.js
• ./node_modules/pino-abstract-transport/index.js
• ./node_modules/pino-abstract-transport/index.d.ts
• ./node_modules/color-support/index.js
• ./node_modules/cli-spinners/index.js
• ./node_modules/cli-spinners/index.d.ts
• ./node_modules/read-cache/index.js
• ./node_modules/merge2/index.js
• ./node_modules/lodash.defaults/index.js
• ./node_modules/deep-is/index.js
• ./node_modules/es-set-tostringtag/index.js
• ./node_modules/es-set-tostringtag/index.d.ts
• ./node_modules/is-string/index.js
• ./node_modules/is-string/index.d.ts
• ./node_modules/globalthis/index.js
• ./node_modules/dequal/index.d.ts
• ./node_modules/react/index.js
• ./node_modules/buffer-from/index.js
• ./node_modules/micromark-extension-gfm-footnote/index.js
• ./node_modules/micromark-extension-gfm-footnote/index.d.ts
• ./node_modules/sanitize-filename/index.js
• ./node_modules/sanitize-filename/index.d.ts
• ./node_modules/character-entities-html4/index.js
• ./node_modules/character-entities-html4/index.d.ts
• ./node_modules/braces/index.js
• ./node_modules/array.prototype.flatmap/index.js
• ./node_modules/hast-util-to-string/index.js
• ./node_modules/hast-util-to-string/index.d.ts
• ./node_modules/hast-util-to-string/index.d.ts.map
• ./node_modules/side-channel-map/index.js
• ./node_modules/side-channel-map/index.d.ts
• ./node_modules/readdir-glob/index.js
• ./node_modules/string-width-cjs/index.js
• ./node_modules/string-width-cjs/index.d.ts
• ./node_modules/mdast-util-frontmatter/index.js
• ./node_modules/mdast-util-frontmatter/index.d.ts
• ./node_modules/emoji-regex/index.js
• ./node_modules/emoji-regex/index.d.ts
• ./node_modules/object-inspect/index.js
• ./node_modules/tunnel-agent/index.js
• ./node_modules/infer-owner/index.js
• ./node_modules/typed-array-buffer/index.js
• ./node_modules/typed-array-buffer/index.d.ts
• ./node_modules/detect-node/index.js
• ./node_modules/detect-node/index.esm.js
• ./node_modules/object.fromentries/index.js
• ./node_modules/locate-path/index.js
• ./node_modules/locate-path/index.d.ts
• ./node_modules/mkdirp-classic/index.js
• ./node_modules/object.assign/index.js
• ./node_modules/mkdirp/index.js
• ./node_modules/is-alphanumerical/index.js
• ./node_modules/is-alphanumerical/index.d.ts
• ./node_modules/character-entities/index.js
• ./node_modules/character-entities/index.d.ts
• ./node_modules/postgres-array/index.js
• ./node_modules/postgres-array/index.d.ts
• ./node_modules/expand-template/index.js
• ./node_modules/normalize-path/index.js
• ./node_modules/ws/index.js
• ./node_modules/fast-deep-equal/index.js
• ./node_modules/fast-deep-equal/index.d.ts
• ./node_modules/postgres-bytea/index.js
• ./node_modules/openai/index.d.mts
• ./node_modules/openai/index.d.mts.map
• ./node_modules/openai/index.js
• ./node_modules/openai/index.mjs.map
• ./node_modules/openai/index.mjs
• ./node_modules/openai/index.js.map
• ./node_modules/openai/index.d.ts
• ./node_modules/openai/index.d.ts.map
• ./node_modules/shebang-command/index.js
• ./node_modules/html-url-attributes/index.js
• ./node_modules/html-url-attributes/index.d.ts
• ./node_modules/html-url-attributes/index.d.ts.map
• ./node_modules/napi-build-utils/index.js
• ./node_modules/napi-build-utils/index.md
• ./node_modules/electron-to-chromium/index.js
• ./node_modules/require-from-string/index.js
• ./node_modules/secure-json-parse/index.js
• ./node_modules/buffer-equal/index.js
• ./node_modules/rw/index.js
• ./node_modules/process/index.js
• ./node_modules/bare-events/index.js
• ./node_modules/bare-events/index.d.ts
• ./node_modules/dot-prop/index.js
• ./node_modules/dot-prop/index.d.ts
• ./node_modules/glob-parent/index.js
• ./node_modules/p-map/index.js
• ./node_modules/p-map/index.d.ts
• ./node_modules/buffer/index.js
• ./node_modules/buffer/index.d.ts
• ./node_modules/mime-db/index.js
• ./node_modules/isexe/index.js
• ./node_modules/es-object-atoms/index.js
• ./node_modules/es-object-atoms/index.d.ts
• ./node_modules/tree-kill/index.js
• ./node_modules/tree-kill/index.d.ts
• ./node_modules/character-entities-legacy/index.js
• ./node_modules/character-entities-legacy/index.d.ts
• ./node_modules/mdast-util-mdx-expression/index.js
• ./node_modules/mdast-util-mdx-expression/index.d.ts
• ./node_modules/setprototypeof/index.js
• ./node_modules/setprototypeof/index.d.ts
• ./docs/index.md
• ./src/renderer/index.html
• ./src/renderer/index.css
• ./src/web/index.html
• ./src/web/index.css
• ./src/web/index.ts
• ./src/shared/index.ts
• ./src/cli/index.ts
• ./src/prompts/index.ts
• ./src/main/index.ts
• ./node_modules/react-dom/server.js
• ./node_modules/react-dom/server.browser.js
• ./node_modules/react-dom/server.node.js


---

## 📊 Project Statistics

**Languages:**
• JavaScript/TypeScript: 57150 files
• Python: 75 files

**Estimated LOC:** 572750


---

## 🧭 Navigation Guide

### Quick File Location
- Use \`grep -r "pattern" src/\` to search source
- Use \`find . -name "*.ext"\` to locate by extension
- Check CLAUDE.md for project-specific context

### Common Directories
• **Auto Run Docs/**
• **build/**
• **dist/**
• **docs/**: Documentation
• **e2e/**
• **node_modules/**
• **scripts/**: Scripts/utilities
• **src/**: Source code

---

## 💡 Usage Tips

**For Claude:**
1. Read this file first before exploring (saves tokens)
2. Use Grep/Glob tools for targeted searches
3. Reference specific paths from tree above
4. Check Important Files for config/docs

**Regenerate:**
```bash
~/.claude/hooks/project-navigator.sh generate
```

**Auto-update:** Index refreshes on major file changes (>10 files edited)
