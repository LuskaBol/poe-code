import { describe, it, expect, vi, beforeEach } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import type { Stats } from "node:fs";
import type { FileSystem } from "../../../../src/utils/file-system.js";

const clackSelect = vi.hoisted(() => vi.fn());
const clackIsCancel = vi.hoisted(() => vi.fn());

vi.mock("@poe-code/design-system", () => ({
  select: clackSelect,
  isCancel: clackIsCancel
}));

import { resolvePlanPath } from "./resolver.js";

function createMemFs(files: Record<string, string> = {}): FileSystem {
  const vol = Volume.fromJSON(files, "/");
  return createFsFromVolume(vol).promises as unknown as FileSystem;
}

function asPlanFs(fs: FileSystem): {
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<Stats>;
} {
  return {
    readdir: (path) => fs.readdir(path),
    stat: (path) => fs.stat(path)
  };
}

describe("resolvePlanPath", () => {
  beforeEach(() => {
    clackSelect.mockReset();
    clackIsCancel.mockReset();
    vi.restoreAllMocks();
  });

  it("returns the provided --plan path without scanning", async () => {
    const fs = createMemFs({
      "/repo/custom-plan.yaml": "version: 1\nproject: demo\nstories: []\n"
    });

    const readdirSpy = vi.spyOn(fs, "readdir");
    const selectSpy = clackSelect.mockResolvedValueOnce(".agents/tasks/ignored.yaml");
    clackIsCancel.mockReturnValue(false);

    const result = await resolvePlanPath({
      cwd: "/repo",
      plan: "custom-plan.yaml",
      fs: asPlanFs(fs)
    });

    expect(result).toBe("custom-plan.yaml");
    expect(readdirSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
  });

  it("returns null with a message when no plans exist", async () => {
    const fs = createMemFs({
      "/repo/README.md": "hi"
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await resolvePlanPath({
      cwd: "/repo",
      fs: asPlanFs(fs)
    });

    expect(result).toBeNull();
    expect(log).toHaveBeenCalled();
  });

  it("auto-selects when exactly one plan exists", async () => {
    const fs = createMemFs({
      "/repo/.agents/tasks/plan.yaml": "version: 1\nproject: demo\nstories: []\n"
    });

    const result = await resolvePlanPath({
      cwd: "/repo",
      fs: asPlanFs(fs)
    });

    expect(result).toBe(".agents/tasks/plan.yaml");
    expect(clackSelect).not.toHaveBeenCalled();
  });

  it("prompts with a select when multiple plans exist", async () => {
    const fs = createMemFs({
      "/repo/.agents/tasks/plan-one.yaml": "version: 1\nproject: one\nstories: []\n",
      "/repo/.agents/tasks/plan-two.yaml": "version: 1\nproject: two\nstories: []\n"
    });

    clackSelect.mockResolvedValueOnce(".agents/tasks/plan-two.yaml");
    clackIsCancel.mockReturnValue(false);

    const result = await resolvePlanPath({
      cwd: "/repo",
      fs: asPlanFs(fs)
    });

    expect(result).toBe(".agents/tasks/plan-two.yaml");
    expect(clackSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("plan"),
        options: expect.arrayContaining([
          expect.objectContaining({ value: ".agents/tasks/plan-one.yaml" }),
          expect.objectContaining({ value: ".agents/tasks/plan-two.yaml" })
        ])
      })
    );
  });

  it("returns null when the prompt is cancelled", async () => {
    const fs = createMemFs({
      "/repo/.agents/tasks/plan-one.yaml": "version: 1\nproject: one\nstories: []\n",
      "/repo/.agents/tasks/plan-two.yaml": "version: 1\nproject: two\nstories: []\n"
    });

    clackSelect.mockResolvedValueOnce(Symbol.for("cancel"));
    clackIsCancel.mockReturnValue(true);

    const result = await resolvePlanPath({
      cwd: "/repo",
      fs: asPlanFs(fs)
    });

    expect(result).toBeNull();
  });
});
