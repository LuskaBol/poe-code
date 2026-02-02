import { describe, it, expect } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { parsePlan } from "../plan/parser.js";
import type { FileSystem } from "../../../../src/utils/file-system.js";
import { updateStoryStatus } from "./updater.js";

type LockRelease = () => Promise<void>;
type LockFn = (path: string) => Promise<LockRelease>;

function createMemFs(files: Record<string, string> = {}): FileSystem {
  const vol = Volume.fromJSON(files, "/");
  return createFsFromVolume(vol).promises as unknown as FileSystem;
}

function createInMemoryLock(): LockFn {
  const tailByPath = new Map<string, Promise<void>>();
  return async (path: string) => {
    const previous = tailByPath.get(path) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    tailByPath.set(path, previous.then(() => current));

    await previous;

    return async () => {
      release();
      if (tailByPath.get(path) === current) {
        tailByPath.delete(path);
      }
    };
  };
}

describe("updateStoryStatus", () => {
  it("sets completedAt when marking a story done", async () => {
    const path = "/agents/tasks/plan.yaml";
    const initial = `
version: 1
project: Example Project
qualityGates: []
stories:
  - id: US-005
    title: Finish updater
    status: in_progress
    dependsOn: []
    acceptanceCriteria: []
    startedAt: 2026-02-01T00:00:00.000Z
`;

    const fs = createMemFs({ [path]: initial });
    const now = new Date("2026-02-02T00:00:00.000Z");

    await updateStoryStatus(path, "US-005", "done", {
      fs,
      lock: createInMemoryLock(),
      now
    });

    const next = parsePlan(await fs.readFile(path, "utf8"));
    expect(next.stories[0]!.status).toBe("done");
    expect(next.stories[0]!.startedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(next.stories[0]!.completedAt).toBe(now.toISOString());
    expect(next.stories[0]!.updatedAt).toBe(now.toISOString());
  });

  it("clears startedAt and completedAt when setting status to open", async () => {
    const path = "/agents/tasks/plan.yaml";
    const initial = `
version: 1
project: Example Project
qualityGates: []
stories:
  - id: US-005
    title: Reset updater
    status: done
    dependsOn: []
    acceptanceCriteria: []
    startedAt: 2026-02-01T00:00:00.000Z
    completedAt: 2026-02-01T01:00:00.000Z
`;

    const fs = createMemFs({ [path]: initial });
    const now = new Date("2026-02-02T00:00:00.000Z");

    await updateStoryStatus(path, "US-005", "open", {
      fs,
      lock: createInMemoryLock(),
      now
    });

    const next = parsePlan(await fs.readFile(path, "utf8"));
    expect(next.stories[0]!.status).toBe("open");
    expect(next.stories[0]!.startedAt).toBeUndefined();
    expect(next.stories[0]!.completedAt).toBeUndefined();
    expect(next.stories[0]!.updatedAt).toBe(now.toISOString());
  });

  it("throws when updating a non-existent story", async () => {
    const path = "/agents/tasks/plan.yaml";
    const fs = createMemFs({
      [path]: "version: 1\nproject: Example\nqualityGates: []\nstories: []\n"
    });

    await expect(
      updateStoryStatus(path, "US-404", "done", { fs, lock: createInMemoryLock() })
    ).rejects.toThrow(/US-404/);
  });

  it("acquires and releases the lock", async () => {
    const path = "/agents/tasks/plan.yaml";
    const initial = `
version: 1
project: Example Project
qualityGates: []
stories:
  - id: US-005
    title: Locking
    status: open
    dependsOn: []
    acceptanceCriteria: []
`;

    const fs = createMemFs({ [path]: initial });
    const now = new Date("2026-02-02T00:00:00.000Z");

    let acquired = 0;
    let released = 0;
    const lock: LockFn = async () => {
      acquired += 1;
      return async () => {
        released += 1;
      };
    };

    await updateStoryStatus(path, "US-005", "in_progress", { fs, lock, now });

    expect(acquired).toBe(1);
    expect(released).toBe(1);
  });
});

