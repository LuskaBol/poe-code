import type { CliSpawnConfig, SpawnConfig } from "./types.js";
import type { SpawnConfig as SpawnConfigFromIndex } from "./index.js";

type AssertAssignable<To, ignoredFrom extends To> = true;

type ignoredSpawnConfigIsExported = AssertAssignable<SpawnConfig, SpawnConfigFromIndex>;

type ignoredCliSpawnConfigHasPromptFlag = AssertAssignable<
  CliSpawnConfig,
  {
    kind: "cli";
    agentId: string;
    promptFlag: string;
    defaultArgs: string[];
  }
>;

// @ts-expect-error promptFlag is required on CliSpawnConfig
type ignoredCliSpawnConfigMissingPromptFlag = AssertAssignable<CliSpawnConfig, { kind: "cli"; agentId: string; defaultArgs: string[] }>;
