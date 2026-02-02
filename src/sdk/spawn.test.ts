import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@poe-code/agent-spawn", () => ({
  spawn: vi.fn(),
  spawnStreaming: vi.fn(),
  getSpawnConfig: vi.fn()
}));

vi.mock("./spawn-core.js", () => ({
  spawnCore: vi.fn()
}));

vi.mock("./container.js", () => ({
  createSdkContainer: vi.fn()
}));

import { spawn } from "./spawn.js";
import { getSpawnConfig, spawn as agentSpawn, spawnStreaming } from "@poe-code/agent-spawn";
import { spawnCore } from "./spawn-core.js";
import { createSdkContainer } from "./container.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv, POE_API_KEY: "test-key" };
  vi.mocked(spawnStreaming).mockReset();
  vi.mocked(agentSpawn).mockReset();
  vi.mocked(getSpawnConfig).mockReset();
  vi.mocked(spawnCore).mockReset();
  vi.mocked(createSdkContainer).mockReset();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("SDK spawn()", () => {
  it("returns events and result from spawnStreaming() when supported", async () => {
    const event = { event: "agent_message", text: "hello" };

    vi.mocked(getSpawnConfig).mockReturnValue({
      kind: "cli",
      agentId: "codex",
      adapter: "codex"
    });

    vi.mocked(spawnStreaming).mockImplementation(() => ({
      events: (async function* () {
        yield event;
      })(),
      done: Promise.resolve({ stdout: "", stderr: "", exitCode: 0, threadId: "thread_1", sessionId: "thread_1" })
    }));

    const { events, result } = spawn("codex", "test prompt");

    const received: unknown[] = [];
    for await (const e of events) {
      received.push(e);
    }

    expect(received).toEqual([event]);
    await expect(result).resolves.toEqual({
      stdout: "",
      stderr: "",
      exitCode: 0,
      threadId: "thread_1",
      sessionId: "thread_1"
    });

    expect(spawnStreaming).toHaveBeenCalledTimes(1);
    expect(agentSpawn).not.toHaveBeenCalled();
    expect(spawnCore).not.toHaveBeenCalled();
  });

  it("falls back to agent-spawn non-streaming and returns empty events when no adapter", async () => {
    vi.mocked(getSpawnConfig).mockReturnValue({
      kind: "cli",
      agentId: "aider",
      promptFlag: "-p",
      defaultArgs: []
    } as any);

    vi.mocked(agentSpawn).mockResolvedValue({
      stdout: "out",
      stderr: "err",
      exitCode: 0
    });

    const { events, result } = spawn("aider", "test prompt");

    const received: unknown[] = [];
    for await (const e of events) {
      received.push(e);
    }

    expect(received).toEqual([]);
    await expect(result).resolves.toEqual({
      stdout: "out",
      stderr: "err",
      exitCode: 0
    });

    expect(spawnStreaming).not.toHaveBeenCalled();
    expect(agentSpawn).toHaveBeenCalledTimes(1);
    expect(spawnCore).not.toHaveBeenCalled();
    expect(createSdkContainer).not.toHaveBeenCalled();
  });

  it("falls back to non-streaming and returns empty events when unsupported", async () => {
    vi.mocked(getSpawnConfig).mockReturnValue(undefined);
    vi.mocked(createSdkContainer).mockReturnValue({} as any);
    vi.mocked(spawnCore).mockResolvedValue({
      stdout: "out",
      stderr: "err",
      exitCode: 0
    });

    const { events, result } = spawn("codex", "test prompt");

    const received: unknown[] = [];
    for await (const e of events) {
      received.push(e);
    }

    expect(received).toEqual([]);
    await expect(result).resolves.toEqual({
      stdout: "out",
      stderr: "err",
      exitCode: 0
    });

    expect(spawnStreaming).not.toHaveBeenCalled();
    expect(agentSpawn).not.toHaveBeenCalled();
    expect(spawnCore).toHaveBeenCalledTimes(1);
  });
});
