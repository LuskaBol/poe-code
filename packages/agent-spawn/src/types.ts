export interface SpawnOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  args?: string[];
  useStdin?: boolean;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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

export interface CliSpawnConfig {
  kind: "cli";
  agentId: string;
  promptFlag: string;
  defaultArgs: string[];
  stdinMode?: StdinMode;
  modelFlag?: string;
}

export interface FileSpawnConfig {
  kind: "file";
  agentId: string;
  launchCommand?: string;
  launchArgs?: string[];
}

export type SpawnConfig = CliSpawnConfig | FileSpawnConfig;

