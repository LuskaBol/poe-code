import { describe, it, expect, vi } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import type { WorktreeFileSystem, ExecFn } from "./types.js";
import { createWorktree } from "./create.js";
import { readRegistry } from "./registry.js";

function createMemFs(
  files: Record<string, string> = {}
): WorktreeFileSystem {
  const vol = Volume.fromJSON(files, "/");
  return createFsFromVolume(vol).promises as unknown as WorktreeFileSystem;
}

function createMockExec(): ExecFn {
  return vi.fn<ExecFn>().mockResolvedValue({ stdout: "", stderr: "" });
}

describe("createWorktree", () => {
  it("runs git worktree add with correct arguments", async () => {
    const fs = createMemFs();
    const exec = createMockExec();

    await createWorktree({
      cwd: "/repo",
      name: "my-feature",
      baseBranch: "main",
      source: "ralph-build",
      agent: "codex",
      deps: { fs, exec }
    });

    expect(exec).toHaveBeenCalledWith(
      "git worktree add -b poe-code/my-feature /repo/.poe-code-worktrees/my-feature main",
      { cwd: "/repo" }
    );
  });

  it("writes entry to registry", async () => {
    const fs = createMemFs();
    const exec = createMockExec();

    const result = await createWorktree({
      cwd: "/repo",
      name: "my-feature",
      baseBranch: "main",
      source: "ralph-build",
      agent: "codex",
      deps: { fs, exec }
    });

    const registry = await readRegistry("/repo", fs);
    expect(registry.worktrees).toHaveLength(1);
    expect(registry.worktrees[0]!.name).toBe("my-feature");
    expect(registry.worktrees[0]!.branch).toBe("poe-code/my-feature");
    expect(registry.worktrees[0]!.status).toBe("active");
    expect(result.name).toBe("my-feature");
  });

  it("returns worktree entry with correct fields", async () => {
    const fs = createMemFs();
    const exec = createMockExec();

    const result = await createWorktree({
      cwd: "/repo",
      name: "test",
      baseBranch: "develop",
      source: "cli",
      agent: "claude",
      storyId: "US-001",
      planPath: "/plans/plan.yaml",
      prompt: "Do the thing",
      deps: { fs, exec }
    });

    expect(result).toMatchObject({
      name: "test",
      path: "/repo/.poe-code-worktrees/test",
      branch: "poe-code/test",
      baseBranch: "develop",
      source: "cli",
      agent: "claude",
      status: "active",
      storyId: "US-001",
      planPath: "/plans/plan.yaml",
      prompt: "Do the thing"
    });
    expect(result.createdAt).toBeDefined();
  });

  it("does not include optional fields when not provided", async () => {
    const fs = createMemFs();
    const exec = createMockExec();

    const result = await createWorktree({
      cwd: "/repo",
      name: "minimal",
      baseBranch: "main",
      source: "test",
      agent: "codex",
      deps: { fs, exec }
    });

    expect(result).not.toHaveProperty("storyId");
    expect(result).not.toHaveProperty("planPath");
    expect(result).not.toHaveProperty("prompt");
  });
});
