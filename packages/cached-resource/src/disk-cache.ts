import { join } from "node:path";
import os from "node:os";
import type { CachedData, CacheConfig } from "./types.js";

export interface DiskCacheFs {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

interface DiskCacheDeps {
  fs: DiskCacheFs;
}

interface ResolveCacheDirDeps {
  env?: Record<string, string | undefined>;
  homedir?: () => string;
}

export async function loadFromDisk<T>(
  config: Pick<CacheConfig, "cacheDir" | "cacheName" | "staleTtl">,
  deps: DiskCacheDeps,
): Promise<CachedData<T> | null> {
  try {
    const filePath = join(config.cacheDir, `${config.cacheName}.json`);
    const content = await deps.fs.readFile(filePath, "utf8");
    const cached: CachedData<T> = JSON.parse(content);

    if (Date.now() - cached.timestamp > config.staleTtl) {
      return null;
    }

    return cached;
  } catch {
    return null;
  }
}

export async function persist<T>(
  data: T,
  config: Pick<CacheConfig, "cacheDir" | "cacheName">,
  deps: DiskCacheDeps,
): Promise<void> {
  try {
    await deps.fs.mkdir(config.cacheDir, { recursive: true });
    const filePath = join(config.cacheDir, `${config.cacheName}.json`);
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };
    await deps.fs.writeFile(filePath, JSON.stringify(cached));
  } catch {
    // silently fail on write errors
  }
}

export function resolveCacheDir(
  appName: string,
  deps?: ResolveCacheDirDeps,
): string {
  const xdgCacheHome = (deps?.env ?? process.env).XDG_CACHE_HOME;
  const home = deps?.homedir ? deps.homedir() : os.homedir();
  return xdgCacheHome ? join(xdgCacheHome, appName) : join(home, ".cache", appName);
}
