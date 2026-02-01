export const agentSpawn = {};

export type {
  CliSpawnConfig,
  FileSpawnConfig,
  SpawnConfig,
  SpawnContext,
  SpawnLogger,
  SpawnOptions,
  SpawnResult,
  StdinMode
} from "./types.js";

export { allSpawnConfigs, getSpawnConfig } from "./configs/index.js";
export { spawn } from "./spawn.js";
