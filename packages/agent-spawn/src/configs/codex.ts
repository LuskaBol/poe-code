import type { CliSpawnConfig } from "../types.js";

export const codexSpawnConfig: CliSpawnConfig = {
  kind: "cli",
  agentId: "codex",
  // ACP adapter support: yes (adapter: "codex")
  adapter: "codex",
  promptFlag: "exec",
  modelFlag: "--model",
  defaultArgs: ["--full-auto", "--skip-git-repo-check", "--json"],
  stdinMode: {
    omitPrompt: true,
    extraArgs: ["-"]
  },
  interactive: {
    defaultArgs: ["-a", "never"]
  },
  resumeCommand: (threadId, cwd) => ["resume", "-C", cwd, threadId]
};
