import { describe, it, expect, vi } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { stringify } from "yaml";
import type { FileSystem } from "../../../../src/utils/file-system.js";
import { parsePlan } from "../plan/parser.js";
import { buildLoop } from "./loop.js";

function createMemFs(files: Record<string, string> = {}): FileSystem & {
  copyFile(src: string, dest: string): Promise<void>;
} {
  const vol = Volume.fromJSON(files, "/");
  const promises = createFsFromVolume(vol).promises;
  const fs = promises as unknown as FileSystem;
  return {
    ...fs,
    async copyFile(src: string, dest: string): Promise<void> {
      const content = await promises.readFile(src, "utf8");
      await promises.writeFile(dest, content);
    }
  };
}

const noLock = async () => async () => {};

const planYaml = stringify({
  version: 1,
  project: "Test",
  goals: [],
  nonGoals: [],
  qualityGates: ["npm run test"],
  stories: [
    {
      id: "US-001",
      title: "Do the thing",
      status: "open",
      dependsOn: [],
      description: "As a user, I want a thing.",
      acceptanceCriteria: ["Criterion A"]
    }
  ]
});

function createWorktreeFs() {
  return createMemFs({
    "/.agents/poe-code-ralph/PROMPT_build.md": [
      "# Test Prompt",
      "ID: {{STORY_ID}}",
      "{{STORY_BLOCK}}",
      "Run: {{RUN_ID}} Iter: {{ITERATION}}",
      ""
    ].join("\n"),
    "/.poe-code-ralph/errors.log": "",
    "/.agents/tasks/plan-build-worktree.yaml": planYaml
  });
}

const PROMPT_TEMPLATE = [
  "# Test Prompt",
  "ID: {{STORY_ID}}",
  "{{STORY_BLOCK}}",
  "Run: {{RUN_ID}} Iter: {{ITERATION}}",
  ""
].join("\n");

function createWorktreeDeps(fs: ReturnType<typeof createMemFs>) {
  const execCalls: { command: string; cwd?: string }[] = [];

  return {
    deps: {
      fs: {
        readFile: (p: string, enc: BufferEncoding) => fs.readFile(p, enc),
        writeFile: (p: string, data: string, opts?: { encoding?: BufferEncoding }) =>
          fs.writeFile(p, data, opts),
        mkdir: (p: string, opts?: { recursive?: boolean }) => fs.mkdir(p, opts)
      },
      exec: async (command: string, options?: { cwd?: string }) => {
        execCalls.push({ command, cwd: options?.cwd });

        // Simulate git worktree add: create the worktree directory with prompt template
        if (command.startsWith("git worktree add")) {
          // Parse the path from the command: git worktree add -b <branch> <path> <baseBranch>
          const parts = command.split(" ");
          const pathIndex = parts.indexOf("-b") + 2; // skip -b and branch name
          const worktreePath = parts[pathIndex] ?? "";
          if (worktreePath) {
            await fs.mkdir(`${worktreePath}/.agents/poe-code-ralph`, {
              recursive: true
            });
            await fs.writeFile(
              `${worktreePath}/.agents/poe-code-ralph/PROMPT_build.md`,
              PROMPT_TEMPLATE,
              { encoding: "utf8" }
            );
          }
        }

        return { stdout: "", stderr: "" };
      }
    },
    execCalls
  };
}

describe("buildLoop with worktree", () => {
  it("creates a worktree, copies plan, and runs build with worktree cwd", async () => {
    const fs = createWorktreeFs();
    const { deps: worktreeDeps, execCalls } = createWorktreeDeps(fs);
    const runId = "test-run-wt";

    let capturedCwd = "";
    const spawn = vi.fn(async (_agent: string, options: { prompt: string; cwd?: string }) => {
      capturedCwd = options.cwd ?? "";
      return {
        stdout: "<promise>COMPLETE</promise>",
        stderr: "",
        exitCode: 0
      };
    });

    let stdoutOutput = "";
    const stdout = { write: (chunk: string) => { stdoutOutput += chunk; } };

    const result = await buildLoop({
      planPath: ".agents/tasks/plan-build-worktree.yaml",
      maxIterations: 3,
      noCommit: true,
      agent: "codex",
      staleSeconds: 0,
      cwd: "/",
      worktree: { enabled: true },
      deps: {
        fs,
        lock: noLock,
        runId,
        spawn,
        stdout,
        stderr: { write: () => {} },
        worktree: worktreeDeps,
        git: {
          getHead: () => null,
          getCommitList: () => [],
          getChangedFiles: () => [],
          getDirtyFiles: () => [],
          getCurrentBranch: () => "main"
        },
        now: () => new Date("2026-02-02T06:00:00.000Z")
      }
    });

    // Worktree was created via exec
    const createCmd = execCalls.find((c) => c.command.includes("git worktree add"));
    expect(createCmd).toBeDefined();
    expect(createCmd?.command).toContain("poe-code/plan-build-worktree");
    expect(createCmd?.command).toContain("main");

    // Build ran inside the worktree directory
    expect(capturedCwd).toContain(".poe-code-worktrees/plan-build-worktree");

    // Plan was copied into the worktree
    const worktreePlanPath =
      "/.poe-code-worktrees/plan-build-worktree/.agents/tasks/plan-build-worktree.yaml";
    const copiedPlan = await fs.readFile(worktreePlanPath, "utf8");
    expect(copiedPlan).toContain("US-001");

    // Story was marked done in the worktree plan
    const updated = parsePlan(copiedPlan);
    expect(updated.stories[0]?.status).toBe("done");

    // Result includes worktree branch
    expect(result.worktreeBranch).toBe("poe-code/plan-build-worktree");
    expect(result.storiesDone).toEqual(["US-001"]);

    // Merge command was printed
    expect(stdoutOutput).toContain("poe-code/plan-build-worktree");
    expect(stdoutOutput).toContain("git merge");

    // Worktree registry was updated to "done"
    const registryContent = await fs.readFile(
      "/.poe-code-worktrees/worktrees.yaml",
      "utf8"
    );
    expect(registryContent).toContain("done");
  });

  it("updates worktree status to failed on build failure", async () => {
    const fs = createWorktreeFs();
    const { deps: worktreeDeps } = createWorktreeDeps(fs);
    const runId = "test-run-fail";

    const spawn = vi.fn(async () => ({
      stdout: "crash",
      stderr: "boom\n",
      exitCode: 1
    }));

    let stdoutOutput = "";
    const stdout = { write: (chunk: string) => { stdoutOutput += chunk; } };

    const result = await buildLoop({
      planPath: ".agents/tasks/plan-build-worktree.yaml",
      maxIterations: 1,
      noCommit: true,
      agent: "codex",
      staleSeconds: 0,
      cwd: "/",
      worktree: { enabled: true },
      deps: {
        fs,
        lock: noLock,
        runId,
        spawn,
        stdout,
        stderr: { write: () => {} },
        worktree: worktreeDeps,
        git: {
          getHead: () => null,
          getCommitList: () => [],
          getChangedFiles: () => [],
          getDirtyFiles: () => [],
          getCurrentBranch: () => "main"
        },
        now: () => new Date("2026-02-02T06:00:00.000Z")
      }
    });

    expect(result.storiesDone).toEqual([]);
    expect(result.worktreeBranch).toBe("poe-code/plan-build-worktree");

    // Worktree registry was updated to "failed"
    const registryContent = await fs.readFile(
      "/.poe-code-worktrees/worktrees.yaml",
      "utf8"
    );
    expect(registryContent).toContain("failed");

    // Merge hint still printed (with branch info)
    expect(stdoutOutput).toContain("poe-code/plan-build-worktree");
  });

  it("uses custom worktree name when provided", async () => {
    const fs = createWorktreeFs();
    const { deps: worktreeDeps, execCalls } = createWorktreeDeps(fs);
    const runId = "test-run-custom-name";

    const spawn = vi.fn(async () => ({
      stdout: "<promise>COMPLETE</promise>",
      stderr: "",
      exitCode: 0
    }));

    const result = await buildLoop({
      planPath: ".agents/tasks/plan-build-worktree.yaml",
      maxIterations: 3,
      noCommit: true,
      agent: "codex",
      staleSeconds: 0,
      cwd: "/",
      worktree: { enabled: true, name: "my-custom-worktree" },
      deps: {
        fs,
        lock: noLock,
        runId,
        spawn,
        stdout: { write: () => {} },
        stderr: { write: () => {} },
        worktree: worktreeDeps,
        git: {
          getHead: () => null,
          getCommitList: () => [],
          getChangedFiles: () => [],
          getDirtyFiles: () => [],
          getCurrentBranch: () => "main"
        },
        now: () => new Date("2026-02-02T06:00:00.000Z")
      }
    });

    // Custom name was used for the branch
    expect(result.worktreeBranch).toBe("poe-code/my-custom-worktree");

    // Git command used custom name
    const createCmd = execCalls.find((c) => c.command.includes("git worktree add"));
    expect(createCmd?.command).toContain("poe-code/my-custom-worktree");
  });

  it("derives worktree name from plan file name when no name provided", async () => {
    const fs = createMemFs({
      "/.agents/poe-code-ralph/PROMPT_build.md": "ID: {{STORY_ID}}\n{{STORY_BLOCK}}\n",
      "/.poe-code-ralph/errors.log": "",
      "/.agents/tasks/plan-feature-x.yml": planYaml
    });
    const { deps: worktreeDeps, execCalls } = createWorktreeDeps(fs);
    const runId = "test-run-derive";

    const spawn = vi.fn(async () => ({
      stdout: "<promise>COMPLETE</promise>",
      stderr: "",
      exitCode: 0
    }));

    const result = await buildLoop({
      planPath: ".agents/tasks/plan-feature-x.yml",
      maxIterations: 3,
      noCommit: true,
      agent: "codex",
      staleSeconds: 0,
      cwd: "/",
      worktree: { enabled: true },
      deps: {
        fs,
        lock: noLock,
        runId,
        spawn,
        stdout: { write: () => {} },
        stderr: { write: () => {} },
        worktree: worktreeDeps,
        git: {
          getHead: () => null,
          getCommitList: () => [],
          getChangedFiles: () => [],
          getDirtyFiles: () => [],
          getCurrentBranch: () => "develop"
        },
        now: () => new Date("2026-02-02T06:00:00.000Z")
      }
    });

    // Name derived from plan file: "plan-feature-x" (without .yml)
    expect(result.worktreeBranch).toBe("poe-code/plan-feature-x");

    // Base branch was "develop"
    const createCmd = execCalls.find((c) => c.command.includes("git worktree add"));
    expect(createCmd?.command).toContain("develop");
  });

  it("resets all story statuses to open when copying plan to worktree", async () => {
    const donePlanYaml = stringify({
      version: 1,
      project: "Test",
      goals: [],
      nonGoals: [],
      qualityGates: ["npm run test"],
      stories: [
        {
          id: "US-001",
          title: "First story",
          status: "done",
          dependsOn: [],
          description: "Already done story.",
          acceptanceCriteria: ["Criterion A"],
          startedAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T01:00:00.000Z",
          updatedAt: "2026-01-01T01:00:00.000Z"
        },
        {
          id: "US-002",
          title: "Second story",
          status: "done",
          dependsOn: ["US-001"],
          description: "Also done.",
          acceptanceCriteria: ["Criterion B"],
          startedAt: "2026-01-02T00:00:00.000Z",
          completedAt: "2026-01-02T01:00:00.000Z",
          updatedAt: "2026-01-02T01:00:00.000Z"
        }
      ]
    });

    const fs = createMemFs({
      "/.agents/poe-code-ralph/PROMPT_build.md": PROMPT_TEMPLATE,
      "/.poe-code-ralph/errors.log": "",
      "/.agents/tasks/plan-done.yaml": donePlanYaml
    });
    const { deps: worktreeDeps } = createWorktreeDeps(fs);
    const runId = "test-run-reset";

    const spawnCalls: string[] = [];
    const spawn = vi.fn(async (_agent: string, options: { prompt: string; cwd?: string }) => {
      spawnCalls.push(options.cwd ?? "");
      return {
        stdout: "<promise>COMPLETE</promise>",
        stderr: "",
        exitCode: 0
      };
    });

    const result = await buildLoop({
      planPath: ".agents/tasks/plan-done.yaml",
      maxIterations: 5,
      noCommit: true,
      agent: "codex",
      staleSeconds: 0,
      cwd: "/",
      worktree: { enabled: true },
      deps: {
        fs,
        lock: noLock,
        runId,
        spawn,
        stdout: { write: () => {} },
        stderr: { write: () => {} },
        worktree: worktreeDeps,
        git: {
          getHead: () => null,
          getCommitList: () => [],
          getChangedFiles: () => [],
          getDirtyFiles: () => [],
          getCurrentBranch: () => "main"
        },
        now: () => new Date("2026-02-02T06:00:00.000Z")
      }
    });

    // Both stories should have been processed (not skipped as already done)
    expect(result.storiesDone).toEqual(["US-001", "US-002"]);
    expect(spawn).toHaveBeenCalledTimes(2);

    // Verify the worktree plan was reset before the loop started
    const worktreePlanPath =
      "/.poe-code-worktrees/plan-done/.agents/tasks/plan-done.yaml";
    const finalPlan = parsePlan(await fs.readFile(worktreePlanPath, "utf8"));
    // After successful run, stories should be done again
    expect(finalPlan.stories[0]?.status).toBe("done");
    expect(finalPlan.stories[1]?.status).toBe("done");
  });

  it("does not create worktree when worktree option is not set", async () => {
    const fs = createMemFs({
      "/.agents/poe-code-ralph/PROMPT_build.md": "ID: {{STORY_ID}}\n{{STORY_BLOCK}}\n",
      "/.poe-code-ralph/errors.log": "",
      "/.agents/tasks/plan.yaml": planYaml
    });
    const runId = "test-run-no-wt";

    let capturedCwd = "";
    const spawn = vi.fn(async (_agent: string, options: { prompt: string; cwd?: string }) => {
      capturedCwd = options.cwd ?? "";
      return {
        stdout: "<promise>COMPLETE</promise>",
        stderr: "",
        exitCode: 0
      };
    });

    const result = await buildLoop({
      planPath: ".agents/tasks/plan.yaml",
      maxIterations: 3,
      noCommit: true,
      agent: "codex",
      staleSeconds: 0,
      cwd: "/",
      deps: {
        fs,
        lock: noLock,
        runId,
        spawn,
        stderr: { write: () => {} },
        git: {
          getHead: () => null,
          getCommitList: () => [],
          getChangedFiles: () => [],
          getDirtyFiles: () => []
        },
        now: () => new Date("2026-02-02T06:00:00.000Z")
      }
    });

    // Build ran in cwd, not a worktree
    expect(capturedCwd).toBe("/");
    expect(result.worktreeBranch).toBeUndefined();
    expect(result.storiesDone).toEqual(["US-001"]);
  });
});
