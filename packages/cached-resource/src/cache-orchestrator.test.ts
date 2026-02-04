import { describe, it, expect, vi, beforeEach } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { resolveData } from "./cache-orchestrator.js";
import type { CacheConfig, CachedData } from "./types.js";
import type { MemoryCache } from "./memory-cache.js";
import type { DiskCacheFs } from "./disk-cache.js";

function createMockMemoryCache<T>(): MemoryCache<T> {
  const store = new Map<string, CachedData<T>>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
}

function createMemFs(files: Record<string, string> = {}): DiskCacheFs {
  const vol = Volume.fromJSON(files, "/");
  const fs = createFsFromVolume(vol).promises;
  return {
    readFile: (p: string, encoding: BufferEncoding) =>
      fs.readFile(p, encoding) as Promise<string>,
    writeFile: (p: string, data: string) =>
      fs.writeFile(p, data) as Promise<void>,
    mkdir: (p: string, options?: { recursive?: boolean }) =>
      fs.mkdir(p, options) as Promise<void>,
  };
}

function createMockFetch(data: unknown) {
  return vi
    .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(data),
    } as Response);
}

function createFailingFetch() {
  return vi
    .fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
    .mockRejectedValue(new Error("Network error"));
}

const defaultConfig: CacheConfig = {
  freshTtl: 60_000,
  staleTtl: 300_000,
  fetchTimeout: 5_000,
  apiEndpoint: "https://api.example.com/data",
  cacheDir: "/cache",
  cacheName: "test",
};

const bundledData = ["bundled-a", "bundled-b"];

describe("resolveData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns memory-cached data if available", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const cached: CachedData<string[]> = {
      data: ["mem-a"],
      timestamp: Date.now(),
    };
    memoryCache.set("test", cached);

    const result = await resolveData(bundledData, defaultConfig, {
      memoryCache,
      fs: createMemFs(),
    });

    expect(result).toEqual(cached);
  });

  it("falls back to filesystem cache, populating memory cache on hit", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const cached: CachedData<string[]> = {
      data: ["disk-a"],
      timestamp: Date.now(),
    };
    const fs = createMemFs({
      "/cache/test.json": JSON.stringify(cached),
    });

    const result = await resolveData(bundledData, defaultConfig, {
      memoryCache,
      fs,
    });

    expect(result).toEqual(cached);
    expect(memoryCache.get("test")).toEqual(cached);
  });

  it("falls back to network fetch when no cache is available", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const networkData = ["net-a", "net-b"];
    const mockFetch = createMockFetch(networkData);
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const result = await resolveData(bundledData, defaultConfig, {
      memoryCache,
      fs: createMemFs(),
      fetch: mockFetch,
    });

    expect(result.data).toEqual(networkData);
    expect(result.timestamp).toBe(now);
    expect(memoryCache.get("test")?.data).toEqual(networkData);
  });

  it("falls back to bundled data when network fails", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const mockFetch = createFailingFetch();

    const result = await resolveData(bundledData, defaultConfig, {
      memoryCache,
      fs: createMemFs(),
      fetch: mockFetch,
    });

    expect(result.data).toEqual(bundledData);
    expect(result.timestamp).toBe(0);
  });

  it("forceRefresh skips all caches and fetches from network", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const cached: CachedData<string[]> = {
      data: ["mem-a"],
      timestamp: Date.now(),
    };
    memoryCache.set("test", cached);
    const diskFs = createMemFs({
      "/cache/test.json": JSON.stringify(cached),
    });
    const networkData = ["fresh-a"];
    const mockFetch = createMockFetch(networkData);

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs: diskFs, fetch: mockFetch },
      { forceRefresh: true },
    );

    expect(result.data).toEqual(networkData);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("offline option never hits network, returns cached data", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const cached: CachedData<string[]> = {
      data: ["mem-a"],
      timestamp: Date.now(),
    };
    memoryCache.set("test", cached);
    const mockFetch = createMockFetch(["should-not-reach"]);

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs: createMemFs(), fetch: mockFetch },
      { offline: true },
    );

    expect(result).toEqual(cached);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("offline option returns bundled data when no cache exists", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const mockFetch = createMockFetch(["should-not-reach"]);

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs: createMemFs(), fetch: mockFetch },
      { offline: true },
    );

    expect(result.data).toEqual(bundledData);
    expect(result.timestamp).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("preferOffline option returns bundled data instead of fetching when no cache exists", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const mockFetch = createMockFetch(["should-not-reach"]);

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs: createMemFs(), fetch: mockFetch },
      { preferOffline: true },
    );

    expect(result.data).toEqual(bundledData);
    expect(result.timestamp).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("preferOffline returns memory-cached data if available", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const cached: CachedData<string[]> = {
      data: ["mem-a"],
      timestamp: Date.now(),
    };
    memoryCache.set("test", cached);

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs: createMemFs() },
      { preferOffline: true },
    );

    expect(result).toEqual(cached);
  });

  it("preferOffline returns disk-cached data if available", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const cached: CachedData<string[]> = {
      data: ["disk-a"],
      timestamp: Date.now(),
    };
    const fs = createMemFs({
      "/cache/test.json": JSON.stringify(cached),
    });

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs },
      { preferOffline: true },
    );

    expect(result).toEqual(cached);
  });

  it("network fetch persists data to disk", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const networkData = ["net-a"];
    const mockFetch = createMockFetch(networkData);
    const fs = createMemFs();
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    await resolveData(bundledData, defaultConfig, {
      memoryCache,
      fs,
      fetch: mockFetch,
    });

    const content = await fs.readFile("/cache/test.json", "utf8");
    expect(JSON.parse(content)).toEqual({
      data: networkData,
      timestamp: now,
    });
  });

  it("forceRefresh falls back to bundled data when network fails", async () => {
    const memoryCache = createMockMemoryCache<string[]>();
    const mockFetch = createFailingFetch();

    const result = await resolveData(
      bundledData,
      defaultConfig,
      { memoryCache, fs: createMemFs(), fetch: mockFetch },
      { forceRefresh: true },
    );

    expect(result.data).toEqual(bundledData);
    expect(result.timestamp).toBe(0);
  });
});
