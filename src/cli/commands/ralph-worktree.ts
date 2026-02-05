import path from "node:path";
import { execSync } from "node:child_process";
import type { Command } from "commander";
import { log } from "@poe-code/design-system";
import { listWorktrees, updateWorktreeStatus } from "@poe-code/worktree";
import { spawnInteractive } from "@poe-code/agent-spawn";
import { renderTemplate } from "@poe-code/config-mutations";
import type { CliContainer } from "../container.js";
import { ValidationError } from "../errors.js";

export function registerRalphWorktreeCommand(
  ralph: Command,
  container: CliContainer
): void {
  ralph
    .command("worktree")
    .description("Merge a completed worktree back into the main branch.")
    .argument("<name>", "Name of the worktree to merge")
    .option("--agent <name>", "Agent to use for the merge")
    .action(async function (this: Command, name: string) {
      const cwd = container.env.cwd;
      const registryFile = path.join(cwd, ".poe-code-ralph", "worktrees.yaml");

      const worktrees = await listWorktrees(cwd, registryFile, {
        fs: {
          readFile: (p: string, enc: BufferEncoding) => container.fs.readFile(p, enc),
          writeFile: (p: string, data: string, opts?: { encoding?: BufferEncoding }) =>
            container.fs.writeFile(p, data, opts),
          mkdir: (p: string, opts?: { recursive?: boolean }) => container.fs.mkdir(p, opts)
        },
        exec: (command: string, opts?: { cwd?: string }) =>
          Promise.resolve({
            stdout: execSync(command, {
              cwd: opts?.cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "pipe"]
            }),
            stderr: ""
          })
      });

      const entry = worktrees.find((w) => w.name === name);
      if (!entry) {
        throw new ValidationError(`Worktree "${name}" not found in registry.`);
      }

      if (entry.status !== "done" && entry.status !== "failed") {
        throw new ValidationError(
          `Worktree "${name}" has status "${entry.status}" and is not mergeable. Only "done" or "failed" worktrees can be merged.`
        );
      }

      if (!entry.gitExists) {
        throw new ValidationError(
          `Worktree directory does not exist for "${name}". It may have been manually removed.`
        );
      }

      const options = this.opts<{ agent?: string }>();

      const { default: mergeTemplate } = await import("../../templates/ralph/PROMPT_worktree_merge.md");
      const renderedPrompt = renderTemplate(mergeTemplate, {
        WORKTREE_NAME: entry.name,
        WORKTREE_PATH: entry.path,
        WORKTREE_BRANCH: entry.branch,
        BASE_BRANCH: entry.baseBranch,
        MAIN_CWD: cwd,
        PLAN_PATH: entry.planPath ?? "",
        STORY_ID: entry.storyId ?? ""
      });

      const agent = options.agent?.trim() || entry.agent;
      const result = await spawnInteractive(agent, {
        prompt: renderedPrompt,
        cwd
      });

      const fsAdapter = {
        readFile: (p: string, enc: BufferEncoding) => container.fs.readFile(p, enc),
        writeFile: (p: string, data: string, opts?: { encoding?: BufferEncoding }) =>
          container.fs.writeFile(p, data, opts),
        mkdir: (p: string, opts?: { recursive?: boolean }) => container.fs.mkdir(p, opts)
      };

      if (result.exitCode === 0) {
        await updateWorktreeStatus(registryFile, entry.name, "done", { fs: fsAdapter });
        log.success(`Worktree "${entry.name}" merged successfully.`);
      } else {
        await updateWorktreeStatus(registryFile, entry.name, "failed", { fs: fsAdapter });
        log.error(`Agent exited with code ${result.exitCode}. Worktree "${entry.name}" marked as failed.`);
      }

    });
}
