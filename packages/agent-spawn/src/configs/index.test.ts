import { describe, it, expect } from "vitest";
import { getSpawnConfig } from "./index.js";

describe("configs/getSpawnConfig", () => {
  it("returns undefined for claude-desktop", () => {
    expect(getSpawnConfig("claude-desktop")).toBeUndefined();
  });
});

