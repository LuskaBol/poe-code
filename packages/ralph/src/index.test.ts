import { describe, expect, it } from "vitest";
import {
  ralphBuild,
  ralphPlan,
  logActivity,
  type Plan,
  type RalphBuildOptions,
  type RalphBuildResult,
  type RalphPlanOptions,
  type RalphPlanResult,
  type Story
} from "@poe-code/ralph";

describe("Ralph SDK public exports", () => {
  it("exports ralphBuild()", () => {
    expect(typeof ralphBuild).toBe("function");
  });

  it("exports ralphPlan()", () => {
    expect(typeof ralphPlan).toBe("function");
  });

  it("exports logActivity()", () => {
    expect(typeof logActivity).toBe("function");
  });

  it("exports SDK types", () => {
    const options: RalphBuildOptions = {
      planPath: ".agents/tasks/plan-ralph-typescript.json",
      maxIterations: 1,
      noCommit: true,
      agent: "codex",
      staleSeconds: 60
    };
    const result = null as unknown as RalphBuildResult;
    const planOptions = null as unknown as RalphPlanOptions;
    const planResult = null as unknown as RalphPlanResult;
    const prd = null as unknown as Plan;
    const story = null as unknown as Story;

    void options;
    void result;
    void planOptions;
    void planResult;
    void prd;
    void story;
  });
});
