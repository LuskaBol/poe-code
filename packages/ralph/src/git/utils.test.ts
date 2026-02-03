import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const execSyncMock = vi.fn();

vi.mock("node:child_process", () => ({
  execSync: execSyncMock
}));

describe("git utils", () => {
  beforeEach(() => {
    execSyncMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getHead returns a 40-char hex commit hash", async () => {
    execSyncMock.mockReturnValue(
      "0123456789abcdef0123456789abcdef01234567\n"
    );

    const { getHead } = await import("./utils.js");

    expect(getHead("/repo")).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(String(execSyncMock.mock.calls[0]?.[0])).toContain("rev-parse");
  });

  it("getHead returns null when cwd is not a git repo", async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error("not a git repository");
    });

    const { getHead } = await import("./utils.js");

    expect(getHead("/not-a-repo")).toBeNull();
  });

  it("getCommitList returns commits between refs", async () => {
    execSyncMock.mockReturnValue(
      [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\tfeat: first",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tfix: second",
        ""
      ].join("\n")
    );

    const { getCommitList } = await import("./utils.js");

    const commits = getCommitList("/repo", "before", "after");
    expect(commits).toEqual([
      { hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", subject: "feat: first" },
      { hash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", subject: "fix: second" }
    ]);

    const command = String(execSyncMock.mock.calls[0]?.[0]);
    expect(command).toContain("git log");
    expect(command).toContain("before..after");
  });

  it("getCommitList returns empty list when cwd is not a git repo", async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error("not a git repository");
    });

    const { getCommitList } = await import("./utils.js");

    expect(getCommitList("/not-a-repo", "before", "after")).toEqual([]);
  });

  it("getChangedFiles returns changed paths between refs", async () => {
    execSyncMock.mockReturnValue(["a.txt", "b/c.ts", ""].join("\n"));

    const { getChangedFiles } = await import("./utils.js");

    const files = getChangedFiles("/repo", "before", "after");
    expect(files).toEqual(["a.txt", "b/c.ts"]);

    const command = String(execSyncMock.mock.calls[0]?.[0]);
    expect(command).toContain("git diff");
    expect(command).toContain("--name-only");
  });

  it("getDirtyFiles returns uncommitted paths", async () => {
    execSyncMock.mockReturnValue(
      [" M a.txt", "?? new file.txt", "R  old.txt -> new.txt", ""].join("\n")
    );

    const { getDirtyFiles } = await import("./utils.js");

    expect(getDirtyFiles("/repo")).toEqual(["a.txt", "new file.txt", "new.txt"]);
  });

  it("getDirtyFiles returns empty list for non-git directory", async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error("not a git repository");
    });

    const { getDirtyFiles } = await import("./utils.js");

    expect(getDirtyFiles("/not-a-repo")).toEqual([]);
  });
});

