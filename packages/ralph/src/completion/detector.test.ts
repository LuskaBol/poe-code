import { describe, it, expect } from "vitest";
import { detectCompletion } from "./detector.js";

describe("detectCompletion", () => {
  it("returns true when output contains the completion signal", () => {
    expect(detectCompletion("done\n<promise>COMPLETE</promise>\n")).toBe(true);
  });

  it("returns false when output does not contain the completion signal", () => {
    expect(detectCompletion("done\nno signal\n")).toBe(false);
  });
});

