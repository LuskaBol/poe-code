import { describe, it, expect } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import type { FileSystem } from "../../../../src/utils/file-system.js";
import { writeRunMeta } from "./metadata.js";

function createMemFs(files: Record<string, string> = {}): FileSystem {
  const vol = Volume.fromJSON(files, "/");
  return createFsFromVolume(vol).promises as unknown as FileSystem;
}

describe("writeRunMeta", () => {
  it("writes run metadata markdown matching Ralph output", async () => {
    const path = "/.poe-code-ralph/runs/run-20260201-221816-14669-iter-8.md";
    const fs = createMemFs();

    await writeRunMeta(
      path,
      {
        runId: "20260201-221816-14669",
        iteration: 8,
        mode: "build",
        storyId: "US-008",
        storyTitle: "Implement run metadata writer",
        started: "2026-02-01 23:31:39",
        ended: "2026-02-01 23:40:00",
        duration: "501s",
        status: "success",
        logPath: "/.poe-code-ralph/runs/run-20260201-221816-14669-iter-8.log",
        git: {
          headBefore: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          headAfter: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          commits: [
            {
              hash: "bbbbbbbcccccccccccccccccccccccccccccccc",
              subject: "chore(ralph): record US-008 run logs"
            },
            {
              hash: "ddddddddeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
              subject: "feat(ralph): add run metadata writer"
            }
          ],
          changedFiles: [
            ".poe-code-ralph/activity.log",
            "packages/ralph/src/run/metadata.test.ts",
            "packages/ralph/src/run/metadata.ts"
          ],
          dirtyFiles: [".poe-code-ralph/activity.log"]
        }
      },
      { fs }
    );

    const markdown = await fs.readFile(path, "utf8");

    const expected = [
      "# Ralph Run Summary",
      "",
      "- Run ID: 20260201-221816-14669",
      "- Iteration: 8",
      "- Mode: build",
      "- Story: US-008: Implement run metadata writer",
      "- Started: 2026-02-01 23:31:39",
      "- Ended: 2026-02-01 23:40:00",
      "- Duration: 501s",
      "- Status: success",
      "- Log: /.poe-code-ralph/runs/run-20260201-221816-14669-iter-8.log",
      "",
      "## Git",
      "- Head (before): aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "- Head (after): bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "",
      "### Commits",
      "- bbbbbbb chore(ralph): record US-008 run logs",
      "- ddddddd feat(ralph): add run metadata writer",
      "",
      "### Changed Files (commits)",
      "- .poe-code-ralph/activity.log",
      "- packages/ralph/src/run/metadata.test.ts",
      "- packages/ralph/src/run/metadata.ts",
      "",
      "### Uncommitted Changes",
      "- .poe-code-ralph/activity.log",
      ""
    ].join("\n");

    expect(markdown).toBe(expected);
  });

  it("writes metadata even when git info is missing", async () => {
    const path = "/.poe-code-ralph/runs/run-20260201-221816-14669-iter-8.md";
    const fs = createMemFs();

    await writeRunMeta(
      path,
      {
        runId: "20260201-221816-14669",
        iteration: 8,
        storyId: "US-008",
        storyTitle: "Implement run metadata writer",
        started: "2026-02-01 23:31:39",
        ended: "2026-02-01 23:40:00",
        duration: "501s",
        status: "success"
      },
      { fs }
    );

    const markdown = await fs.readFile(path, "utf8");

    expect(markdown).toContain("# Ralph Run Summary");
    expect(markdown).toContain("- Run ID: 20260201-221816-14669");
    expect(markdown).not.toContain("## Git");
  });
});

