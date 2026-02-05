import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { Command } from "commander";
import { createCliContainer } from "../container.js";
import type { FileSystem } from "../../utils/file-system.js";
import type { ListWorktreeEntry } from "@poe-code/worktree";

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
  beforeEach(() => {
    mockSpawnInteractive.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    mockUpdateWorktreeStatus.mockResolvedValue(undefined);
    mockRenderTemplate.mockReturnValue("rendered-merge-prompt");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    designLog.info.mockReset();
    designLog.success.mockReset();
    designLog.error.mockReset();
    mockListWorktrees.mockReset();
    mockSpawnInteractive.mockReset();
    mockUpdateWorktreeStatus.mockReset();
    mockRenderTemplate.mockReset();
  });

  it("merges a worktree by name", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
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

    await program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done"]);

    expect(mockSpawnInteractive).toHaveBeenCalledTimes(1);
  });

  it("throws when worktree name is not found in registry", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
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

    await expect(
      program.parseAsync(["node", "cli", "ralph", "worktree", "nonexistent"])
    ).rejects.toThrow(/not found in registry/i);
  });

  it("throws when worktree status is not mergeable", async () => {
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

    await expect(
      program.parseAsync(["node", "cli", "ralph", "worktree", "wt-active"])
    ).rejects.toThrow(/not mergeable/i);
  });

  it("throws when worktree has gitExists false", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done", gitExists: false })
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

    await expect(
      program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done"])
    ).rejects.toThrow(/does not exist/i);
  });

  it("renders template with worktree coordinates and spawns agent", async () => {
    const wt = makeWorktree({
      name: "wt-done",
      status: "done",
      agent: "codex",
      planPath: "/repo/plan.yaml",
      storyId: "S-001"
    });
    mockListWorktrees.mockResolvedValue([wt]);
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

    await program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done"]);

    expect(mockRenderTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        WORKTREE_NAME: "wt-done",
        WORKTREE_PATH: wt.path,
        WORKTREE_BRANCH: wt.branch,
        BASE_BRANCH: "main",
        MAIN_CWD: cwd,
        PLAN_PATH: "/repo/plan.yaml",
        STORY_ID: "S-001"
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

    await program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done"]);

    expect(mockSpawnInteractive).toHaveBeenCalledWith("claude-code", expect.any(Object));
  });

  it("overrides agent with --agent flag", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done", agent: "codex" })
    ]);
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

    await program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done", "--agent", "claude-code"]);

    expect(mockSpawnInteractive).toHaveBeenCalledWith("claude-code", expect.any(Object));
  });

  it("updates status to done and logs success on exit 0", async () => {
    mockListWorktrees.mockResolvedValue([
      makeWorktree({ name: "wt-done", status: "done" })
    ]);
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

    await program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done"]);

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

    await program.parseAsync(["node", "cli", "ralph", "worktree", "wt-done"]);

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
