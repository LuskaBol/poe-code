import type { CliSpawnConfig } from "../types.js";

export const kimiSpawnConfig: CliSpawnConfig = {
  kind: "cli",
  agentId: "kimi",
  promptFlag: "-p",
  defaultArgs: ["--quiet"]
};

