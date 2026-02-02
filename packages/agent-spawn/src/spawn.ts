import { allAgents, resolveAgentId } from "@poe-code/agent-defs";
import { spawn as spawnChildProcess } from "node:child_process";
import { getSpawnConfig } from "./configs/index.js";
import type { SpawnContext, SpawnOptions, SpawnResult } from "./types.js";

export async function spawn(
  agentId: string,
  options: SpawnOptions,
  _context?: SpawnContext
): Promise<SpawnResult> {
  const resolvedAgentId = resolveAgentId(agentId);
  if (!resolvedAgentId) {
    throw new Error(`Unknown agent "${agentId}".`);
  }

  const agentDefinition = allAgents.find((agent) => agent.id === resolvedAgentId);
  if (!agentDefinition) {
    throw new Error(`Unknown agent "${agentId}".`);
  }

  const spawnConfig = getSpawnConfig(resolvedAgentId);
  if (spawnConfig === undefined) {
    throw new Error(`Agent "${resolvedAgentId}" has no spawn config.`);
  }

  if (spawnConfig.kind !== "cli") {
    throw new Error(`Agent "${resolvedAgentId}" does not support CLI spawn.`);
  }

  const binaryName = agentDefinition.binaryName;
  if (!binaryName) {
    throw new Error(`Agent "${resolvedAgentId}" has no binaryName.`);
  }

  const args: string[] = [spawnConfig.promptFlag, options.prompt];

  if (options.model && spawnConfig.modelFlag) {
    args.push(spawnConfig.modelFlag, options.model);
  }

  args.push(...spawnConfig.defaultArgs);

  if (options.args && options.args.length > 0) {
    args.push(...options.args);
  }

  const child = spawnChildProcess(binaryName, args, {
    cwd: options.cwd,
    stdio: ["inherit", "pipe", "pipe"]
  });

  return new Promise<SpawnResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1
      });
    });
  });
}
