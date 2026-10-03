import { describe, expect, it } from "vitest";
import { computePhaseState, initialStatus, statusAfterDependencyChange, wouldCreateCycle } from "./tasks";

describe("task status", () => {
  it("starts ready only when there are no dependencies", () => {
    expect(initialStatus(0)).toBe("ready");
    expect(initialStatus(2)).toBe("not_started");
  });

  it("becomes ready when every dependency is complete", () => {
    expect(statusAfterDependencyChange("not_started", ["complete", "complete"])).toBe("ready");
    expect(statusAfterDependencyChange("not_started", ["complete", "in_progress"])).toBe("not_started");
  });

  it("falls back to not started when a dependency is reopened", () => {
    expect(statusAfterDependencyChange("ready", ["complete", "ready"])).toBe("not_started");
  });

  it("never overrides a task a person is working on", () => {
    for (const s of ["in_progress", "waiting", "blocked", "complete"] as const) {
      expect(statusAfterDependencyChange(s, ["not_started"])).toBe(s);
    }
  });
});

describe("phase progression", () => {
  const phases = [
    { id: "b", position: 2 },
    { id: "a", position: 1 },
    { id: "c", position: 3 },
  ];

  it("current phase is the first with open work; earlier finished phases are complete", () => {
    const s = computePhaseState(phases, { a: ["complete"], b: ["complete", "ready"], c: ["not_started"] });
    expect(s.currentPhaseId).toBe("b");
    expect(s.phaseStatuses).toEqual({ a: "complete", b: "in_progress", c: "not_started" });
  });

  it("phases without tasks do not block progress", () => {
    const s = computePhaseState(phases, { a: ["complete"], c: ["ready"] });
    expect(s.currentPhaseId).toBe("c");
    expect(s.phaseStatuses.b).toBe("not_started");
  });

  it("when everything is complete the last phase is current", () => {
    const s = computePhaseState(phases, { a: ["complete"], b: ["complete"], c: ["complete"] });
    expect(s.currentPhaseId).toBe("c");
    expect(Object.values(s.phaseStatuses)).toEqual(["complete", "complete", "complete"]);
  });

  it("handles a project with no phases", () => {
    expect(computePhaseState([], {}).currentPhaseId).toBeNull();
  });
});

describe("dependency cycles", () => {
  const edges = [
    { taskId: "b", dependsOnId: "a" },
    { taskId: "c", dependsOnId: "b" },
  ];
  it("rejects self and circular dependencies", () => {
    expect(wouldCreateCycle(edges, "a", "a")).toBe(true);
    expect(wouldCreateCycle(edges, "a", "c")).toBe(true);
  });
  it("allows valid dependencies", () => {
    expect(wouldCreateCycle(edges, "c", "a")).toBe(false);
    expect(wouldCreateCycle(edges, "d", "c")).toBe(false);
  });
});
