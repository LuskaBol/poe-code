# Worktree Merge

You are an autonomous coding agent. Your task is to merge a worktree branch into the base branch, rebasing in the worktree directory and cleaning up only after a successful fast-forward merge.

## Worktree Context
- Worktree name: {{WORKTREE_NAME}}
- Worktree path: {{WORKTREE_PATH}}
- Worktree branch: {{WORKTREE_BRANCH}}
- Base branch: {{BASE_BRANCH}}
- Main cwd: {{MAIN_CWD}}

## Task Context
{{TASK_CONTEXT}}

## Branch Commits
Worktree branch commits (since divergence):
{{BRANCH_COMMITS}}

Base branch commits (since divergence):
{{BASE_COMMITS}}

## Quality Gates
{{QUALITY_GATES}}

## Instructions
1. `cd {{WORKTREE_PATH}}` (the worktree branch is already checked out here).
2. `git rebase {{BASE_BRANCH}}`.
3. If the rebase is clean, skip conflict resolution and continue. If conflicts occur, resolve them while preserving both sides' intent.
4. Do NOT drop changes from either side unless they are truly redundant.
5. Run the quality gates listed above.
6. `cd {{MAIN_CWD}}`.
7. `git merge --ff-only {{WORKTREE_BRANCH}}`.
8. `git worktree remove {{WORKTREE_PATH}}`.
9. `git branch -D {{WORKTREE_BRANCH}}`.

## Failure Handling
- If the rebase fails or you cannot resolve conflicts, run `git rebase --abort` and exit with a non-zero status.
