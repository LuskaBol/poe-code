import { describe, it, expect } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { lockFile, type LockFileSystem } from "./lock.js";

function createLockFs(files: Record<string, string> = {}): LockFileSystem {
  const vol = Volume.fromJSON(files, "/");
  const fs = createFsFromVolume(vol).promises;
  return {
    mkdir: (p: string) => fs.mkdir(p) as Promise<void>,
    rmdir: (p: string) => fs.rmdir(p) as Promise<void>,
    stat: (p: string) => fs.stat(p) as Promise<{ mtimeMs: number }>
  };
}

describe("lockFile", () => {
  it("creates a .lock directory and returns a release function", async () => {
    const fs = createLockFs({ "/plan.yaml": "" });

    const release = await lockFile("/plan.yaml", { fs });

    await expect(fs.stat("/plan.yaml.lock")).resolves.toBeDefined();
    await release();
    await expect(fs.stat("/plan.yaml.lock")).rejects.toThrow();
  });

  it("retries when the lock is held and succeeds when released", async () => {
    const fs = createLockFs({ "/plan.yaml": "" });
    await fs.mkdir("/plan.yaml.lock");

    setTimeout(() => fs.rmdir("/plan.yaml.lock"), 15);

    const release = await lockFile("/plan.yaml", {
      fs,
      retries: 20,
      minTimeout: 5,
      maxTimeout: 20
    });

    await expect(fs.stat("/plan.yaml.lock")).resolves.toBeDefined();
    await release();
  });

  it("throws ELOCKED after exhausting retries", async () => {
    const fs = createLockFs({ "/plan.yaml": "" });
    await fs.mkdir("/plan.yaml.lock");

    await expect(
      lockFile("/plan.yaml", {
        fs,
        retries: 2,
        minTimeout: 1,
        maxTimeout: 2,
        staleMs: 60_000
      })
    ).rejects.toThrow("Failed to acquire lock");
  });

  it("propagates non-EEXIST errors immediately", async () => {
    const fs: LockFileSystem = {
      async mkdir() {
        const err = new Error("permission denied");
        (err as NodeJS.ErrnoException).code = "EACCES";
        throw err;
      },
      async rmdir() {},
      async stat() {
        return { mtimeMs: 0 };
      }
    };

    await expect(lockFile("/plan.yaml", { fs })).rejects.toThrow(
      "permission denied"
    );
  });

  it("release is idempotent", async () => {
    const fs = createLockFs({ "/plan.yaml": "" });
    const release = await lockFile("/plan.yaml", { fs });

    await release();
    await release();

    await expect(fs.stat("/plan.yaml.lock")).rejects.toThrow();
  });

  it("removes stale locks older than staleMs", async () => {
    const inner = createLockFs({ "/plan.yaml": "" });
    await inner.mkdir("/plan.yaml.lock");

    const staleFs: LockFileSystem = {
      mkdir: inner.mkdir,
      rmdir: inner.rmdir,
      stat: async (p) => {
        const s = await inner.stat(p);
        return { mtimeMs: s.mtimeMs - 35_000 };
      }
    };

    const release = await lockFile("/plan.yaml", {
      fs: staleFs,
      staleMs: 30_000,
      retries: 1,
      minTimeout: 1,
      maxTimeout: 2
    });

    await expect(inner.stat("/plan.yaml.lock")).resolves.toBeDefined();
    await release();
  });

  it("does not remove locks younger than staleMs", async () => {
    const fs = createLockFs({ "/plan.yaml": "" });
    await fs.mkdir("/plan.yaml.lock");

    await expect(
      lockFile("/plan.yaml", {
        fs,
        staleMs: 30_000,
        retries: 1,
        minTimeout: 1,
        maxTimeout: 2
      })
    ).rejects.toThrow("Failed to acquire lock");

    // Lock directory still exists (not removed as stale)
    await expect(fs.stat("/plan.yaml.lock")).resolves.toBeDefined();
  });
});
