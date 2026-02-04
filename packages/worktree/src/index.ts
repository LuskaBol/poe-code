export type {
  Worktree,
  WorktreeStatus,
  WorktreeRegistry,
  WorktreeFileSystem,
  ExecFn,
  ExecResult,
  WorktreeDeps
} from "./types.js";
export { createWorktree, type CreateWorktreeOptions } from "./create.js";
export { removeWorktree, type RemoveWorktreeOptions } from "./remove.js";
export { listWorktrees, type ListWorktreeEntry } from "./list.js";
export { updateWorktreeStatus } from "./registry.js";
