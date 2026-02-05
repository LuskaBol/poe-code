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

vi.mock("@poe-code/worktree", () => ({
  listWorktrees: mockListWorktrees
}));

import { registerRalphCommand } from "./ralph.js";

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
  afterEach(() => {
    vi.restoreAllMocks();
    designSelect.mockReset();
    designIsCancel.mockReset();
    designCancel.mockReset();
    designLog.info.mockReset();
    mockListWorktrees.mockReset();
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
});
