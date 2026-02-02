import type { CliSpawnConfig } from "../types.js";

export const kimiSpawnConfig: CliSpawnConfig = {
  kind: "cli",
  agentId: "kimi",
  adapter: "native",
  promptFlag: "-p",
  defaultArgs: ["--quiet"]
};
