import { describe, expect, it } from "vitest";
import { allSpawnConfigs, getSpawnConfig } from "./index.js";

describe("getSpawnConfig", () => {
  it("resolves aliases (claude -> claude-code)", () => {
    expect(getSpawnConfig("claude")?.agentId).toBe("claude-code");
  });

  it("returns the codex config", () => {
    expect(getSpawnConfig("codex")?.agentId).toBe("codex");
  });

  it("returns the claude-desktop file spawn config", () => {
    const config = getSpawnConfig("claude-desktop");
    expect(config).toEqual(
      expect.objectContaining({ agentId: "claude-desktop", kind: "file" })
    );
    expect(config && "promptFlag" in config).toBe(false);
  });

  it("returns undefined for unknown agents", () => {
    expect(getSpawnConfig("unknown")).toBeUndefined();
  });
});

describe("allSpawnConfigs", () => {
  it("includes the expected agent configs", () => {
    const ids = allSpawnConfigs.map((config) => config.agentId);
    expect(ids).toEqual(["claude-code", "claude-desktop", "codex", "opencode", "kimi"]);
  });
});
