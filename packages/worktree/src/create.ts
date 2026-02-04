import { join } from "node:path";
import { addWorktreeEntry, removeWorktreeEntry } from "./registry.js";
import type { Worktree, WorktreeDeps } from "./types.js";

export type CreateWorktreeOptions = {
  cwd: string;
  name: string;
  baseBranch: string;
  source: string;
  agent: string;
  registryFile: string;
  worktreeDir: string;
  storyId?: string;
  planPath?: string;
  prompt?: string;
  deps: WorktreeDeps;
};

export async function createWorktree(
  opts: CreateWorktreeOptions
): Promise<Worktree> {
  const branch = `poe-code/${opts.name}`;
  const worktreePath = join(opts.worktreeDir, opts.name);

  // Clean up any existing worktree/branch from a previous run
  try {
    await opts.deps.exec(`git worktree remove ${worktreePath} --force`, { cwd: opts.cwd });
  } catch { /* worktree may not exist */ }
  try {
    await opts.deps.exec(`git branch -D ${branch}`, { cwd: opts.cwd });
  } catch { /* branch may not exist */ }
  await removeWorktreeEntry(opts.registryFile, opts.name, opts.deps.fs).catch(() => {});

  await opts.deps.exec(
    `git worktree add -b ${branch} ${worktreePath} ${opts.baseBranch}`,
    { cwd: opts.cwd }
  );

  const entry: Worktree = {
    name: opts.name,
    path: worktreePath,
    branch,
    baseBranch: opts.baseBranch,
    createdAt: new Date().toISOString(),
    source: opts.source,
    agent: opts.agent,
    status: "active",
    ...(opts.storyId !== undefined && { storyId: opts.storyId }),
    ...(opts.planPath !== undefined && { planPath: opts.planPath }),
    ...(opts.prompt !== undefined && { prompt: opts.prompt })
  };

  await addWorktreeEntry(opts.registryFile, entry, opts.deps.fs);

  return entry;
}
