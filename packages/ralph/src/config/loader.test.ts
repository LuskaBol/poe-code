import { describe, it, expect } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import type { FileSystem } from "../../../../src/utils/file-system.js";
import { loadConfig } from "./loader.js";

function createMemFs(files: Record<string, string> = {}): FileSystem {
  const vol = Volume.fromJSON(files, "/");
  return createFsFromVolume(vol).promises as unknown as FileSystem;
}

describe("loadConfig", () => {
  it("loads config.yaml when present", async () => {
    const cwd = "/repo";
    const fs = createMemFs({
      "/repo/.agents/poe-code-ralph/config.yaml": [
        "agent: claude-code",
        "maxIterations: 7",
        "noCommit: true",
        "staleSeconds: 120",
        "planPath: .agents/tasks/plan.yaml",
        "progressPath: .poe-code-ralph/progress.md",
        "guardrailsPath: .poe-code-ralph/guardrails.md",
        "errorsLogPath: .poe-code-ralph/errors.log",
        "activityLogPath: .poe-code-ralph/activity.log",
        "unknownKey: ignored",
        ""
      ].join("\n")
    });

    await expect(loadConfig(cwd, { fs: fs as any })).resolves.toEqual({
      planPath: ".agents/tasks/plan.yaml",
      progressPath: ".poe-code-ralph/progress.md",
      guardrailsPath: ".poe-code-ralph/guardrails.md",
      errorsLogPath: ".poe-code-ralph/errors.log",
      activityLogPath: ".poe-code-ralph/activity.log",
      agent: "claude-code",
      maxIterations: 7,
      noCommit: true,
      staleSeconds: 120
    });
  });

  it("falls back to config.json when yaml is missing", async () => {
    const cwd = "/repo";
    const fs = createMemFs({
      "/repo/.agents/poe-code-ralph/config.json": JSON.stringify({
        agent: "codex",
        maxIterations: 3,
        noCommit: false,
        staleSeconds: 0
      })
    });

    await expect(loadConfig(cwd, { fs: fs as any })).resolves.toEqual({
      agent: "codex",
      maxIterations: 3,
      noCommit: false,
      staleSeconds: 0
    });
  });

  it("returns an empty config when no file exists", async () => {
    const cwd = "/repo";
    const fs = createMemFs();

    await expect(loadConfig(cwd, { fs: fs as any })).resolves.toEqual({});
  });
});

