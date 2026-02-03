import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("@poe-code/agent-skill-config (plain Node runtime)", () => {
  it("loads bundled skill templates without a bundler", () => {
    const script = [
      'import { configure } from "@poe-code/agent-skill-config";',
      'import { Volume, createFsFromVolume } from "memfs";',
      "",
      "const cwd = \"/repo\";",
      "const homeDir = \"/home/test\";",
      "const vol = new Volume();",
      "vol.mkdirSync(cwd, { recursive: true });",
      "vol.mkdirSync(homeDir, { recursive: true });",
      "const fs = createFsFromVolume(vol).promises;",
      "",
      "await configure(\"claude-code\", {",
      "  fs,",
      "  cwd,",
      "  homeDir,",
      "  scope: \"global\",",
      "  dryRun: true",
      "});"
    ].join("\n");

    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { encoding: "utf8" }
    );

    expect(result.status).toBe(0);
  });
});

