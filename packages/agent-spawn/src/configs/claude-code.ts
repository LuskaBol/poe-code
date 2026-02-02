import type { CliSpawnConfig } from "../types.js";

export const claudeCodeSpawnConfig: CliSpawnConfig = {
  kind: "cli",
  agentId: "claude-code",
  adapter: "claude",
  promptFlag: "-p",
  modelFlag: "--model",
  defaultArgs: [
    "--allowedTools",
    "Bash,Read",
    "--permission-mode",
    "acceptEdits",
    "--output-format",
    "stream-json",
    "--verbose"
  ],
  stdinMode: {
    omitPrompt: true,
    extraArgs: ["--input-format", "text"]
  }
};
