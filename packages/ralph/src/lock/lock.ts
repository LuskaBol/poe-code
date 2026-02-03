import * as fsPromises from "node:fs/promises";

export type LockFileSystem = {
  mkdir(path: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  stat(path: string): Promise<{ mtimeMs: number }>;
};

export type LockOptions = {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  staleMs?: number;
  fs?: LockFileSystem;
};

type LockRelease = () => Promise<void>;

const defaultFs: LockFileSystem = {
  mkdir: (p) => fsPromises.mkdir(p),
  rmdir: (p) => fsPromises.rmdir(p),
  stat: (p) => fsPromises.stat(p)
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoff(attempt: number, min: number, max: number): number {
  const delay = Math.min(max, min * Math.pow(2, attempt));
  return delay + Math.random() * delay * 0.1;
}

async function tryRemoveStale(
  lockPath: string,
  staleMs: number,
  fs: LockFileSystem
): Promise<boolean> {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs > staleMs) {
      await fs.rmdir(lockPath);
      return true;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return true;
    }
  }
  return false;
}

export async function lockFile(
  filePath: string,
  options: LockOptions = {}
): Promise<LockRelease> {
  const fs = options.fs ?? defaultFs;
  const retries = options.retries ?? 20;
  const minTimeout = options.minTimeout ?? 25;
  const maxTimeout = options.maxTimeout ?? 250;
  const staleMs = options.staleMs ?? 30_000;
  const lockPath = `${filePath}.lock`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fs.mkdir(lockPath);
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        try {
          await fs.rmdir(lockPath);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            throw err;
          }
        }
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        throw err;
      }

      if (await tryRemoveStale(lockPath, staleMs, fs)) {
        continue;
      }

      if (attempt < retries) {
        await sleep(backoff(attempt, minTimeout, maxTimeout));
      }
    }
  }

  const err = new Error(
    `Failed to acquire lock on "${filePath}" after ${retries} retries`
  );
  (err as NodeJS.ErrnoException).code = "ELOCKED";
  throw err;
}
