import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn as spawnChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { claudeCodeSpawnConfig } from "./configs/claude-code.js";
import { codexSpawnConfig } from "./configs/codex.js";
import { spawn } from "./spawn.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn()
}));

interface MockChildProcessOptions {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

function createMockChildProcess(
  options: MockChildProcessOptions = {}
): ChildProcessWithoutNullStreams {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as unknown as ChildProcessWithoutNullStreams;
  const childStreams = child as unknown as {
    stdout: PassThrough;
    stderr: PassThrough;
  };
  childStreams.stdout = stdout;
  childStreams.stderr = stderr;

  const exitCode = options.exitCode ?? 0;
  const output = options.stdout ?? "";
  const errorOutput = options.stderr ?? "";

  queueMicrotask(() => {
    if (output) {
      stdout.write(output, "utf8");
    }
    stdout.end();
    if (errorOutput) {
      stderr.write(errorOutput, "utf8");
    }
    stderr.end();
    child.emit("close", exitCode, null);
  });

  return child;
}

describe("spawn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if agent ID cannot be resolved", async () => {
    await expect(spawn("unknown", { prompt: "test" })).rejects.toThrow(/Unknown agent/);
    await expect(spawn("unknown", { prompt: "test" })).rejects.not.toThrow(/has no spawn config/);
    expect(vi.mocked(spawnChildProcess)).not.toHaveBeenCalled();
  });

  it("throws error if agent has no spawn config", async () => {
    await expect(spawn("claude-desktop", { prompt: "test" })).rejects.toThrow(/has no spawn config/);
    await expect(spawn("claude-desktop", { prompt: "test" })).rejects.not.toThrow(/Unknown agent/);
    expect(vi.mocked(spawnChildProcess)).not.toHaveBeenCalled();
  });

  it("spawns CLI using promptFlag + prompt + defaultArgs + options.args", async () => {
    const spawnMock = vi.mocked(spawnChildProcess).mockReturnValue(
      createMockChildProcess({ stdout: "ok\n", exitCode: 0 })
    );

    const result = await spawn("claude-code", {
      prompt: "test",
      args: ["--extra", "arg"]
    });

    expect(result).toEqual({ stdout: "ok\n", stderr: "", exitCode: 0 });
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args] = spawnMock.mock.calls[0];
    expect(command).toBe("claude");
    expect(args).toEqual([
      claudeCodeSpawnConfig.promptFlag,
      "test",
      ...claudeCodeSpawnConfig.defaultArgs,
      "--extra",
      "arg"
    ]);
  });

  it("includes model flag when model is provided", async () => {
    const spawnMock = vi.mocked(spawnChildProcess).mockReturnValue(
      createMockChildProcess({ exitCode: 0 })
    );

    await spawn("codex", { prompt: "hello", model: "o3" });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args] = spawnMock.mock.calls[0];
    expect(command).toBe("codex");
    expect(args).toEqual([
      codexSpawnConfig.promptFlag,
      "hello",
      codexSpawnConfig.modelFlag,
      "o3",
      ...codexSpawnConfig.defaultArgs
    ]);
  });

  it("passes cwd option to the spawned process", async () => {
    const spawnMock = vi.mocked(spawnChildProcess).mockReturnValue(
      createMockChildProcess({ exitCode: 0 })
    );

    await spawn("codex", { prompt: "hello", cwd: "/tmp/poe-agent-spawn" });

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [, , options] = spawnMock.mock.calls[0];
    expect(options).toEqual(expect.objectContaining({ cwd: "/tmp/poe-agent-spawn" }));
  });
});
