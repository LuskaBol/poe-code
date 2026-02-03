import { describe, it, expect } from "vitest";
import type { Plan } from "../plan/types.js";
import { selectStory } from "./selector.js";

describe("selectStory", () => {
  it("selects the first open story whose dependencies are done", () => {
    const prd: Plan = {
      version: 1,
      project: "Example",
      goals: [],
      nonGoals: [],
      qualityGates: [],
      stories: [
        {
          id: "US-001",
          title: "Dependency",
          status: "done",
          dependsOn: [],
          acceptanceCriteria: []
        },
        {
          id: "US-002",
          title: "Blocked",
          status: "open",
          dependsOn: ["US-404"],
          acceptanceCriteria: []
        },
        {
          id: "US-003",
          title: "Ready",
          status: "open",
          dependsOn: ["US-001"],
          acceptanceCriteria: []
        }
      ]
    };

    const now = new Date("2026-02-02T00:00:00.000Z");
    const selected = selectStory(prd, { now, staleSeconds: 3600 });

    expect(selected?.id).toBe("US-003");
    expect(prd.stories[2]!.status).toBe("in_progress");
    expect(prd.stories[2]!.startedAt).toBe(now.toISOString());
  });

  it("resets stale in_progress stories to open before selecting", () => {
    const prd: Plan = {
      version: 1,
      project: "Example",
      goals: [],
      nonGoals: [],
      qualityGates: [],
      stories: [
        {
          id: "US-001",
          title: "Stuck",
          status: "in_progress",
          dependsOn: [],
          acceptanceCriteria: [],
          startedAt: "2026-02-01T00:00:00.000Z"
        }
      ]
    };

    const now = new Date("2026-02-02T00:00:00.000Z");
    const selected = selectStory(prd, { now, staleSeconds: 60 });

    expect(selected?.id).toBe("US-001");
    expect(prd.stories[0]!.status).toBe("in_progress");
    expect(prd.stories[0]!.startedAt).toBe(now.toISOString());
  });

  it("returns the existing in_progress story when it is not stale", () => {
    const prd: Plan = {
      version: 1,
      project: "Example",
      goals: [],
      nonGoals: [],
      qualityGates: [],
      stories: [
        {
          id: "US-001",
          title: "Ongoing",
          status: "in_progress",
          dependsOn: [],
          acceptanceCriteria: [],
          startedAt: "2026-02-02T00:00:00.000Z"
        },
        {
          id: "US-002",
          title: "Open",
          status: "open",
          dependsOn: [],
          acceptanceCriteria: []
        }
      ]
    };

    const now = new Date("2026-02-02T00:01:00.000Z");
    const selected = selectStory(prd, { now, staleSeconds: 3600 });

    expect(selected?.id).toBe("US-001");
    expect(prd.stories[0]!.status).toBe("in_progress");
    expect(prd.stories[0]!.startedAt).toBe("2026-02-02T00:00:00.000Z");
    expect(prd.stories[1]!.status).toBe("open");
  });

  it("returns null when there are no actionable stories", () => {
    const prd: Plan = {
      version: 1,
      project: "Example",
      goals: [],
      nonGoals: [],
      qualityGates: [],
      stories: [
        {
          id: "US-001",
          title: "Done",
          status: "done",
          dependsOn: [],
          acceptanceCriteria: []
        }
      ]
    };

    const selected = selectStory(prd, { now: new Date(), staleSeconds: 3600 });
    expect(selected).toBeNull();
  });
});

