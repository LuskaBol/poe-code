import { allAgents, resolveAgentId } from "@poe-code/agent-defs";
import type { CliSpawnConfig } from "../types.js";
import { getSpawnConfig } from "./index.js";

export interface ResolvedCliSpawnConfig {
  agentId: string;
  binaryName: string;
  spawnConfig: CliSpawnConfig;
}

export function resolveConfig(agentId: string): ResolvedCliSpawnConfig {
  const resolvedAgentId = resolveAgentId(agentId);
  if (!resolvedAgentId) {
    throw new Error(`Unknown agent "${agentId}".`);
  }

  const agentDefinition = allAgents.find((agent) => agent.id === resolvedAgentId);
  if (!agentDefinition) {
    throw new Error(`Unknown agent "${agentId}".`);
  }

  const spawnConfig = getSpawnConfig(resolvedAgentId);
  if (!spawnConfig) {
    throw new Error(`Agent "${resolvedAgentId}" has no spawn config.`);
  }

  if (spawnConfig.kind !== "cli") {
    throw new Error(`Agent "${resolvedAgentId}" does not support CLI spawn.`);
  }

  const binaryName = agentDefinition.binaryName;
  if (!binaryName) {
    throw new Error(`Agent "${resolvedAgentId}" has no binaryName.`);
  }

  return { agentId: resolvedAgentId, binaryName, spawnConfig };
}

