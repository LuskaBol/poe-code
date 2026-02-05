import { describe, it, expect, vi, afterEach } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { Command } from "commander";
import { createCliContainer } from "../container.js";
import type { FileSystem } from "../../utils/file-system.js";
import type { ListWorktreeEntry } from "@poe-code/worktree";

const clackSelect = vi.hoisted(() => vi.fn());
const clackIsCancel = vi.hoisted(() => vi.fn());

vi.mock("@clack/prompts", () => ({
  select: clackSelect,
  isCancel: clackIsCancel,
  cancel: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), message: vi.fn(), success: vi.fn(), step: vi.fn() }
}));

const designSelect = vi.hoisted(() => vi.fn());
const designIsCancel = vi.hoisted(() => vi.fn());
const designCancel = vi.hoisted(() => vi.fn());
const designLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
  success: vi.fn(),
  step: vi.fn()
}));

vi.mock("@poe-code/design-system", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@poe-code/design-system")>();
  return {
    ...actual,
    select: designSelect,
    isCancel: designIsCancel,
    cancel: designCancel,
    log: designLog
  };
});

vi.mock("@poe-code/ralph", async () => {
  const actual = await vi.importActual<typeof import("@poe-code/ralph")>("@poe-code/ralph");
  return {
    ...actual,
    ralphBuild: vi.fn().mockResolvedValue({
      runId: "demo",
      iterationsCompleted: 0,
      storiesDone: [],
      iterations: [],
      stopReason: "max_iterations"
    }),
    ralphPlan: vi.fn().mockResolvedValue({
      outPath: ".agents/tasks/plan-demo.yaml"
    }),
    logActivity: vi.fn().mockResolvedValue(undefined)
  };
});

const mockListWorktrees = vi.hoisted(() => vi.fn());
const mockUpdateWorktreeStatus = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@poe-code/worktree", () => ({
  listWorktrees: mockListWorktrees,
  updateWorktreeStatus: mockUpdateWorktreeStatus
}));

const mockSpawnInteractive = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" })
);

vi.mock("@poe-code/agent-spawn", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@poe-code/agent-spawn")>();
  return {
    ...actual,
    spawnInteractive: mockSpawnInteractive
  };
});

const mockRenderTemplate = vi.hoisted(() => vi.fn().mockReturnValue("rendered-merge-prompt"));

vi.mock("@poe-code/config-mutations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@poe-code/config-mutations")>();
  return {
    ...actual,
    renderTemplate: mockRenderTemplate
  };
});

import { registerRalphCommand, gatherMergeContext } from "./ralph.js";

const cwd = "/repo";
const homeDir = "/home/test";

function createMemFs(initial: Record<string, string> = {}): FileSystem {
  const vol = new Volume();
  vol.mkdirSync(cwd, { recursive: true });
  vol.mkdirSync(homeDir, { recursive: true });
  vol.fromJSON(initial, "/");
  return createFsFromVolume(vol).promises as unknown as FileSystem;
}

function createBaseProgram(): Command {
  const program = new Command();
  program.exitOverride();
  program
    .name("poe-code")
    .option("-y, --yes")
    .option("--dry-run")
    .option("--verbose");
  return program;
}

function makeWorktree(
  overrides: Partial<ListWorktreeEntry> & Pick<ListWorktreeEntry, "name" | "status">
): ListWorktreeEntry {
  return {
    path: `/repo/.poe-code-ralph/worktrees/${overrides.name}`,
    branch: `poe-code/${overrides.name}`,
    baseBranch: "main",
    createdAt: "2026-01-01T00:00:00.000Z",
    source: "ralph-build",
    agent: "codex",
    gitExists: true,
    ...overrides
  };
}

describe("ralph worktree command", () => {
  beforeEach(() => {
    mockSpawnInteractive.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    mockUpdateWorktreeStatus.mockResolvedValue(undefined);
    mockRenderTemplate.mockReturnValue("rendered-merge-prompt");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    designSelect.mockReset();
    designIsCancel.mockReset();
    designCancel.mockReset();
    designLog.info.mockReset();
    designLog.success.mockReset();
    designLog.error.mockReset();
    mockListWorktrees.mockReset();
    mockSpawnInteractive.mockReset();
    mockUpdateWorktreeStatus.mockReset();
    mockRenderTemplate.mockReset();
  });

  it("presents mergeable worktrees for selection", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" }),
      makeWorktree({ name: "wt-failed", status: "failed" }),
      makeWorktree({ name: "wt-active", status: "active" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(designSelect).toHaveBeenCalledTimes(1);
    const selectArgs = designSelect.mock.calls[0][0];
    expect(selectArgs.options).toHaveLength(2);
    expect(selectArgs.options.map((o: any) => o.value)).toEqual(["wt-done", "wt-failed"]);
  });

  it("excludes active and removing worktrees from select", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" }),
      makeWorktree({ name: "wt-active", status: "active" }),
      makeWorktree({ name: "wt-removing", status: "removing" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    const selectArgs = designSelect.mock.calls[0][0];
    expect(selectArgs.options).toHaveLength(1);
    expect(selectArgs.options[0].value).toBe("wt-done");
  });

  it("shows info and exits when no worktrees exist", async () => {
    mockListWorktrees.mockResolvedValue([]);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(designLog.info).toHaveBeenCalledWith(expect.stringMatching(/no mergeable/i));
    expect(designSelect).not.toHaveBeenCalled();
  });

  it("shows info when all worktrees are active", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-active", status: "active" })
    ]);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(designLog.info).toHaveBeenCalledWith(expect.stringMatching(/no mergeable/i));
    expect(designSelect).not.toHaveBeenCalled();
  });

  it("handles cancel gracefully", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
    ]);
    designSelect.mockResolvedValueOnce(Symbol("cancel"));
    designIsCancel.mockReturnValue(true);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(designCancel).toHaveBeenCalledWith(expect.stringMatching(/cancel/i));
  });

  it("throws error when selected worktree has gitExists false", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done", gitExists: false })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await expect(
      program.parseAsync(["node", "cli", "ralph", "worktree"])
    ).rejects.toThrow(/does not exist/i);
  });

  it("shows worktree name, branch, and status in labels", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "my-feature", branch: "poe-code/my-feature", status: "done" })
    ]);
    designSelect.mockResolvedValueOnce("my-feature");
    designIsCancel.mockReturnValue(false);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    const selectArgs = designSelect.mock.calls[0][0];
    const label = selectArgs.options[0].label;
    expect(label).toContain("my-feature");
    expect(label).toContain("poe-code/my-feature");
    expect(label).toContain("done");
  });

  it("accepts --agent flag", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree", "--agent", "claude-code"]);

    expect(designSelect).toHaveBeenCalledTimes(1);
  });

  it("renders template with gathered context and spawns agent", async () => {
    const wt = makeWorktree({ name: "wt-done", status: "done", agent: "codex" });
    mockListWorktrees.mockResolvedValue([wt]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);
    mockRenderTemplate.mockReturnValue("rendered-prompt");
    mockSpawnInteractive.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(mockRenderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        WORKTREE_NAME: "wt-done",
        WORKTREE_PATH: wt.path,
        WORKTREE_BRANCH: wt.branch,
        BASE_BRANCH: "main",
        MAIN_CWD: cwd
      })
    );
    expect(mockSpawnInteractive).toHaveBeenCalledWith("codex", {
      prompt: "rendered-prompt",
      cwd
    });
  });

  it("uses worktree's stored agent by default", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done", agent: "claude-code" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);
    mockRenderTemplate.mockReturnValue("rendered-prompt");
    mockSpawnInteractive.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(mockSpawnInteractive).toHaveBeenCalledWith("claude-code", expect.any(Object));
  });

  it("overrides agent with --agent flag", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done", agent: "codex" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);
    mockRenderTemplate.mockReturnValue("rendered-prompt");
    mockSpawnInteractive.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree", "--agent", "claude-code"]);

    expect(mockSpawnInteractive).toHaveBeenCalledWith("claude-code", expect.any(Object));
  });

  it("updates status to done and logs success on exit 0", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);
    mockRenderTemplate.mockReturnValue("rendered-prompt");
    mockSpawnInteractive.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(mockUpdateWorktreeStatus).toHaveBeenCalledWith(
      "/repo/.poe-code-ralph/worktrees.yaml",
      "wt-done",
      "done",
      expect.objectContaining({ fs: expect.any(Object) })
    );
    expect(designLog.success).toHaveBeenCalledWith(
      expect.stringContaining("wt-done")
    );
  });

  it("updates status to failed and shows error on non-zero exit", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
    ]);
    designSelect.mockResolvedValueOnce("wt-done");
    designIsCancel.mockReturnValue(false);
    mockRenderTemplate.mockReturnValue("rendered-prompt");
    mockSpawnInteractive.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" });

    const fs = createMemFs();
    const container = createCliContainer({
      fs,
      prompts: vi.fn().mockResolvedValue({}),
      env: { cwd, homeDir },
      logger: () => {}
    });
    const program = createBaseProgram();
    registerRalphCommand(program, container);

    await program.parseAsync(["node", "cli", "ralph", "worktree"]);

    expect(mockUpdateWorktreeStatus).toHaveBeenCalledWith(
      "/repo/.poe-code-ralph/worktrees.yaml",
      "wt-done",
      "failed",
      expect.objectContaining({ fs: expect.any(Object) })
    );
    expect(designLog.error).toHaveBeenCalledWith(
      expect.stringContaining("wt-done")
    );
  });
});

describe("gatherMergeContext", () => {
  it("runs git log for branch and base commits", async () => {
    const exec = vi.fn()
      .mockReturnValueOnce("abc123 feat: add feature\ndef456 fix: bug fix\n")
      .mockReturnValueOnce("789abc chore: update deps\n");
    const readFile = vi.fn();
    const entry = makeWorktree({
      name: "wt",
      status: "done",
      branch: "feature/wt",
      baseBranch: "main"
    });

    const result = await gatherMergeContext(entry, { exec, readFile });

    expect(exec).toHaveBeenCalledWith("git log main..feature/wt --oneline");
    expect(exec).toHaveBeenCalledWith("git log feature/wt..main --oneline");
    expect(result.branchCommits).toBe("abc123 feat: add feature\ndef456 fix: bug fix");
    expect(result.baseCommits).toBe("789abc chore: update deps");
  });

  it("extracts story context and quality gates for ralph-build worktrees", async () => {
    const planYaml = [
      "version: 1",
      "project: test",
      "goals: []",
      "nonGoals: []",
      "qualityGates:",
      "  - npm run test",
      "  - npm run lint",
      "stories:",
      "  - id: S-001",
      "    title: Test story",
      "    status: done",
      "    dependsOn: []",
      "    description: |",
      "      Story description here.",
      "    acceptanceCriteria:",
      "      - First criterion",
      "      - Second criterion"
    ].join("\n");

    const exec = vi.fn().mockReturnValue("");
    const readFile = vi.fn().mockResolvedValue(planYaml);
    const entry = makeWorktree({
      name: "wt",
      status: "done",
      source: "ralph-build",
      planPath: "/repo/plan.yaml",
      storyId: "S-001"
    });

    const result = await gatherMergeContext(entry, { exec, readFile });

    expect(readFile).toHaveBeenCalledWith("/repo/plan.yaml", "utf8");
    expect(result.taskContext).toContain("Story description here.");
    expect(result.taskContext).toContain("Acceptance Criteria:");
    expect(result.taskContext).toContain("- First criterion");
    expect(result.taskContext).toContain("- Second criterion");
    expect(result.qualityGates).toBe("- npm run test\n- npm run lint");
  });

  it("uses prompt for spawn worktrees", async () => {
    const exec = vi.fn().mockReturnValue("");
    const readFile = vi.fn();
    const entry = makeWorktree({
      name: "wt",
      status: "done",
      source: "spawn",
      prompt: "Implement the login feature"
    });

    const result = await gatherMergeContext(entry, { exec, readFile });

    expect(result.taskContext).toBe("Implement the login feature");
    expect(readFile).not.toHaveBeenCalled();
  });

  it("falls back to empty context when plan file is missing", async () => {
    const exec = vi.fn().mockReturnValue("");
    const readFile = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const entry = makeWorktree({
      name: "wt",
      status: "done",
      source: "ralph-build",
      planPath: "/repo/missing-plan.yaml",
      storyId: "S-001"
    });

    const result = await gatherMergeContext(entry, { exec, readFile });

    expect(result.taskContext).toBe("");
    expect(result.qualityGates).toBe("");
  });

  it("returns empty commits when git log fails", async () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error("git error");
    });
    const readFile = vi.fn();
    const entry = makeWorktree({ name: "wt", status: "done" });

    const result = await gatherMergeContext(entry, { exec, readFile });

    expect(result.branchCommits).toBe("");
    expect(result.baseCommits).toBe("");
  });

  it("returns quality gates even when story is not found in plan", async () => {
    const planYaml = [
      "version: 1",
      "project: test",
      "goals: []",
      "nonGoals: []",
      "qualityGates:",
      "  - npm run test",
      "stories:",
      "  - id: S-999",
      "    title: Other story",
      "    status: open",
      "    dependsOn: []"
    ].join("\n");

    const exec = vi.fn().mockReturnValue("");
    const readFile = vi.fn().mockResolvedValue(planYaml);
    const entry = makeWorktree({
      name: "wt",
      status: "done",
      source: "ralph-build",
      planPath: "/repo/plan.yaml",
      storyId: "S-001"
    });

    const result = await gatherMergeContext(entry, { exec, readFile });

    expect(result.taskContext).toBe("");
    expect(result.qualityGates).toBe("- npm run test");
  });
});
