import { describe, it, expect, beforeEach, vi } from "vitest";
import { Volume, createFsFromVolume } from "memfs";
import { createProgram } from "../program.js";
import type { FileSystem } from "../utils/file-system.js";
import type { HttpClient } from "../http.js";

const cwd = "/repo";
const homeDir = "/home/test";
const credentialsPath = `${homeDir}/.poe-code/credentials.json`;

function createMemfs(homeDir: string): FileSystem {
  const volume = new Volume();
  volume.mkdirSync(homeDir, { recursive: true });
  return createFsFromVolume(volume).promises as unknown as FileSystem;
}

function createCredentialsVolume(apiKey: string): FileSystem {
  const volume = new Volume();
  volume.mkdirSync(`${homeDir}/.poe-code`, { recursive: true });
  volume.writeFileSync(
    credentialsPath,
    JSON.stringify({ apiKey })
  );
  return createFsFromVolume(volume).promises as unknown as FileSystem;
}

describe("usage balance command", () => {
  let fs: FileSystem;
  let logs: string[];
  let httpClient: HttpClient;

  beforeEach(() => {
    fs = createMemfs(homeDir);
    logs = [];
    httpClient = vi.fn();
  });

  it("fetches and displays current balance", async () => {
    fs = createCredentialsVolume("test-key");
    (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ monthly_available_balance: 1500 })
    });

    const program = createProgram({
      fs,
      prompts: vi.fn(),
      env: { cwd, homeDir },
      httpClient,
      logger: (message) => logs.push(message)
    });

    const optsSpy = vi.spyOn(program, "optsWithGlobals");
    optsSpy.mockReturnValue({ yes: false, dryRun: false } as any);

    await program.parseAsync(["node", "cli", "usage", "balance"]);

    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining("/usage/current_balance"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        })
      })
    );
    expect(
      logs.some((message) => message.includes("Current balance: 1,500 points"))
    ).toBe(true);
  });

  it("throws error when no API key configured", async () => {
    const program = createProgram({
      fs,
      prompts: vi.fn(),
      env: { cwd, homeDir },
      httpClient,
      logger: (message) => logs.push(message)
    });

    const optsSpy = vi.spyOn(program, "optsWithGlobals");
    optsSpy.mockReturnValue({ yes: false, dryRun: false } as any);

    await expect(
      program.parseAsync(["node", "cli", "usage", "balance"])
    ).rejects.toThrow();

    expect(httpClient).not.toHaveBeenCalled();
  });

  it("logs dry run message when --dry-run flag is set", async () => {
    fs = createCredentialsVolume("test-key");

    const program = createProgram({
      fs,
      prompts: vi.fn(),
      env: { cwd, homeDir },
      httpClient,
      logger: (message) => logs.push(message),
      exitOverride: true
    });

    const optsSpy = vi.spyOn(program, "optsWithGlobals");
    optsSpy.mockReturnValue({ yes: false, dryRun: true } as any);

    await program.parseAsync([
      "node",
      "cli",
      "--dry-run",
      "usage",
      "balance"
    ]);

    expect(httpClient).not.toHaveBeenCalled();
    expect(
      logs.some((message) => message.includes("Dry run"))
    ).toBe(true);
  });
});
