import type { CliSpawnConfig } from "../types.js";

export const openCodeSpawnConfig: CliSpawnConfig = {
  kind: "cli",
  agentId: "opencode",
  promptFlag: "run",
  modelFlag: "--model",
  defaultArgs: []
};

