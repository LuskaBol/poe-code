# Worktree Merge

You are an autonomous coding agent. Your task is to merge worktree `{{WORKTREE_NAME}}` into `{{BASE_BRANCH}}`.

## Worktree

| Key | Value |
|-----|-------|
| Path | `{{WORKTREE_PATH}}` |
| Branch | `{{WORKTREE_BRANCH}}` |
| Base branch | `{{BASE_BRANCH}}` |
| Main cwd | `{{MAIN_CWD}}` |
| Plan file | `{{PLAN_PATH}}` |
| Story ID | `{{STORY_ID}}` |

## Steps

1. Understand what the worktree branch changed — read the plan file (if present), inspect `git log` and `git diff` in the worktree.
2. `cd {{WORKTREE_PATH}}` and `git rebase {{BASE_BRANCH}}`. Resolve any conflicts preserving both sides' intent.
3. Run the quality gates from the plan file (if present), otherwise run the project's default test/lint commands.
4. `cd {{MAIN_CWD}}` and `git merge --ff-only {{WORKTREE_BRANCH}}`.
5. `git worktree remove {{WORKTREE_PATH}}` and `git branch -D {{WORKTREE_BRANCH}}`.

If the rebase fails or conflicts cannot be resolved, run `git rebase --abort` and exit with a non-zero status.
