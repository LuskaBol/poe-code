import { describe, it, expect } from "vitest";
import { adaptClaude } from "./claude.js";
import { adaptCodex } from "./codex.js";
import { adaptNative } from "./native.js";
import { getAdapter } from "./index.js";

describe("adapters barrel", () => {
  it("returns adapter functions by type", () => {
    expect(getAdapter("codex")).toBe(adaptCodex);
    expect(getAdapter("claude")).toBe(adaptClaude);
    expect(getAdapter("native")).toBe(adaptNative);
  });

  it("throws for unknown adapter type", () => {
    expect(() => getAdapter("unknown" as any)).toThrowError();
  });
});

