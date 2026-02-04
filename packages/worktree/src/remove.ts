import { removeWorktreeEntry, readRegistry } from "./registry.js";
import type { WorktreeDeps } from "./types.js";

export type RemoveWorktreeOptions = {
  cwd: string;
  name: string;
  deleteBranch?: boolean;
  deps: WorktreeDeps;
};

export async function removeWorktree(
  opts: RemoveWorktreeOptions
): Promise<void> {
  const registry = await readRegistry(opts.cwd, opts.deps.fs);
  const entry = registry.worktrees.find((w) => w.name === opts.name);
  if (!entry) {
    throw new Error(`Worktree "${opts.name}" not found in registry`);
  }

  await opts.deps.exec(`git worktree remove ${entry.path}`, {
    cwd: opts.cwd
  });

  if (opts.deleteBranch) {
    await opts.deps.exec(`git branch -D ${entry.branch}`, {
      cwd: opts.cwd
    });
  }

  await removeWorktreeEntry(opts.cwd, opts.name, opts.deps.fs);
}
