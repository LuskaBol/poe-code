import { resolveAgentId } from "@poe-code/agent-defs";
import type { SpawnConfig } from "../types.js";
import { claudeCodeSpawnConfig } from "./claude-code.js";
import { claudeDesktopSpawnConfig } from "./claude-desktop.js";
import { codexSpawnConfig } from "./codex.js";
import { openCodeSpawnConfig } from "./opencode.js";
import { kimiSpawnConfig } from "./kimi.js";

export const allSpawnConfigs: readonly SpawnConfig[] = [
  claudeCodeSpawnConfig,
  claudeDesktopSpawnConfig,
  codexSpawnConfig,
  openCodeSpawnConfig,
  kimiSpawnConfig
];

const lookup = new Map<string, SpawnConfig>();

for (const config of allSpawnConfigs) {
  lookup.set(config.agentId, config);
}

export function getSpawnConfig(input: string): SpawnConfig | undefined {
  const resolvedId = resolveAgentId(input);
  if (!resolvedId) {
    return undefined;
  }
  return lookup.get(resolvedId);
}
