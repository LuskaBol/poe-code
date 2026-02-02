import { describe, it, expect } from "vitest";
import { OverbakingDetector } from "./overbaking.js";

describe("OverbakingDetector", () => {
  it("defaults threshold to 3 failures", () => {
    const detector = new OverbakingDetector();
    const event = detector.record("US-001", "failure");
    expect(event.threshold).toBe(3);
  });

  it("tracks consecutive failures per story and resets on non-failure", () => {
    const detector = new OverbakingDetector({ threshold: 3 });

    expect(detector.record("US-001", "failure").consecutiveFailures).toBe(1);
    expect(detector.record("US-001", "failure").consecutiveFailures).toBe(2);

    expect(detector.record("US-002", "failure").consecutiveFailures).toBe(1);

    // Non-failure breaks the failure streak
    expect(detector.record("US-001", "incomplete").consecutiveFailures).toBe(0);
    expect(detector.record("US-001", "failure").consecutiveFailures).toBe(1);
  });

  it("triggers warning only when threshold is reached", () => {
    const detector = new OverbakingDetector({ threshold: 3 });

    expect(detector.record("US-001", "failure").shouldWarn).toBe(false);
    expect(detector.record("US-001", "failure").shouldWarn).toBe(false);

    const third = detector.record("US-001", "failure");
    expect(third.shouldWarn).toBe(true);
    expect(third.consecutiveFailures).toBe(3);

    const fourth = detector.record("US-001", "failure");
    expect(fourth.shouldWarn).toBe(false);
    expect(fourth.consecutiveFailures).toBe(4);
  });

  it("does not trigger when failures are intermittent", () => {
    const detector = new OverbakingDetector({ threshold: 2 });

    expect(detector.record("US-001", "failure").shouldWarn).toBe(false);
    expect(detector.record("US-001", "success").shouldWarn).toBe(false);
    expect(detector.record("US-001", "failure").shouldWarn).toBe(false);
  });
});

