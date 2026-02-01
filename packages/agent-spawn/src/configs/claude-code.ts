import type { CliSpawnConfig } from "../types.js";

export const claudeCodeSpawnConfig: CliSpawnConfig = {
  kind: "cli",
  agentId: "claude-code",
  promptFlag: "-p",
  modelFlag: "--model",
  defaultArgs: [
    "--allowedTools",
    "Bash,Read",
    "--permission-mode",
    "acceptEdits",
    "--output-format",
    "text"
  ],
  stdinMode: {
    omitPrompt: true,
    extraArgs: ["--input-format", "text"]
  }
};

