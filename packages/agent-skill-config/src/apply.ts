import { fileMutation, runMutations, templateMutation } from "@poe-code/config-mutations";
import { resolveAgentSupport } from "./configs.js";
import { createTemplateLoader } from "./templates.js";
import type { ApplyOptions } from "./types.js";

export class UnsupportedAgentError extends Error {
  constructor(agentId: string) {
    super(`Unsupported agent: ${agentId}`);
    this.name = "UnsupportedAgentError";
  }
}

function toHomeRelative(localSkillDir: string): string {
  if (localSkillDir.startsWith("~/") || localSkillDir === "~") {
    return localSkillDir;
  }

  const normalized = localSkillDir.startsWith("./")
    ? localSkillDir.slice(2)
    : localSkillDir;

  return `~/${normalized}`;
}

const bundledSkillTemplateIds = ["poe-generate.md"] as const;

export async function configure(agentId: string, options: ApplyOptions): Promise<void> {
  const support = resolveAgentSupport(agentId);
  if (support.status !== "supported") {
    throw new UnsupportedAgentError(agentId);
  }

  const scope = options.scope ?? "global";
  const config = support.config!;

  const skillDir =
    scope === "global" ? config.globalSkillDir : toHomeRelative(config.localSkillDir);
  const homeDir = scope === "global" ? options.homeDir : options.cwd;

  await runMutations(
    [
      fileMutation.ensureDirectory({
        path: skillDir,
        label: `Ensure directory ${skillDir}`
      }),
      ...bundledSkillTemplateIds.map((templateId) =>
        templateMutation.write({
          target: `${skillDir}/${templateId}`,
          templateId,
          label: `Write bundled skill ${templateId} to ${skillDir}`
        })
      )
    ],
    {
      fs: options.fs,
      homeDir,
      dryRun: options.dryRun,
      observers: options.observers,
      templates: createTemplateLoader()
    }
  );
}

export async function unconfigure(
  agentId: string,
  options: ApplyOptions & { force?: boolean }
): Promise<void> {
  const support = resolveAgentSupport(agentId);
  if (support.status !== "supported") {
    throw new UnsupportedAgentError(agentId);
  }

  const scope = options.scope ?? "global";
  const config = support.config!;

  const skillDir =
    scope === "global" ? config.globalSkillDir : toHomeRelative(config.localSkillDir);
  const homeDir = scope === "global" ? options.homeDir : options.cwd;

  await runMutations(
    [
      fileMutation.removeDirectory({
        path: skillDir,
        force: options.force,
        label: `Remove skills directory ${skillDir}`
      })
    ],
    {
      fs: options.fs,
      homeDir,
      dryRun: options.dryRun,
      observers: options.observers
    }
  );
}
