import { describe, it, expect, vi, afterEach } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { logActivity } from "./activity.js";

type ActivityFileSystem = {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  appendFile(
    path: string,
    data: string,
    options?: { encoding?: BufferEncoding }
  ): Promise<void>;
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
};

function createMemFs(files: Record<string, string> = {}): ActivityFileSystem {
  const vol = Volume.fromJSON(files, "/");
  return createFsFromVolume(vol).promises as unknown as ActivityFileSystem;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("logActivity", () => {
  it("appends timestamped entries to the activity log file", async () => {
    const fs = createMemFs();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 2, 3, 4, 5));

    const path = "/.poe-code-ralph/activity.log";

    await logActivity(path, "first", { fs });
    await logActivity(path, "second", { fs });

    const contents = await fs.readFile(path, "utf8");
    expect(contents).toBe(
      "[2026-02-02 03:04:05] first\n[2026-02-02 03:04:05] second\n"
    );
  });

  it("throws a descriptive error for an invalid path", async () => {
    const fs = createMemFs();
    await expect(logActivity(" ", "message", { fs })).rejects.toThrow(
      "Invalid activity log path"
    );
  });
});

