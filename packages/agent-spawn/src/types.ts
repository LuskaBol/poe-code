import type { AdapterType } from "./adapters/index.js";

export interface SpawnOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  args?: string[];
  useStdin?: boolean;
  tee?: {
    stdout?: { write(chunk: string): void };
    stderr?: { write(chunk: string): void };
  };
}

export interface SpawnUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd?: number;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  threadId?: string;
  sessionId?: string;
  usage?: SpawnUsage;
}

export interface SpawnLogger {
  dryRun(message: string): void;
}

export interface SpawnContext {
  dryRun?: boolean;
  logger?: SpawnLogger;
  homeDir?: string;
}

export interface StdinMode {
  omitPrompt: boolean;
  extraArgs: string[];
}

export interface InteractiveSpawnConfig {
  defaultArgs: string[];
  promptFlag?: string;
}

export interface CliSpawnConfig {
  kind: "cli";
  agentId: string;
  adapter: AdapterType;
  promptFlag: string;
  defaultArgs: string[];
  stdinMode?: StdinMode;
  modelFlag?: string;
  interactive?: InteractiveSpawnConfig;
}

export interface FileSpawnConfig {
  kind: "file";
  agentId: string;
  launchCommand?: string;
  launchArgs?: string[];
}

export type SpawnConfig = CliSpawnConfig | FileSpawnConfig;
