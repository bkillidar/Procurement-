import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, PHASE_NAMES } from "./defaults";
import { buildProjectPlan, type TemplateDef } from "./plan";
import { wouldCreateCycle } from "@/lib/tasks";

const small: TemplateDef = {
  phases: [
    { name: "B", position: 2 },
    { name: "A", position: 1 },
  ],
  tasks: [
    { key: "x", phase: "A", title: "X", priority: "medium", offsetDays: 0, dependsOn: [] },
    { key: "y", phase: "A", title: "Y", priority: "high", offsetDays: 10, dependsOn: ["x", "ghost", "y"] },
    { key: "z", phase: "B", title: "Z", priority: "low", offsetDays: null, dependsOn: ["y"] },
  ],
};

describe("buildProjectPlan", () => {
  it("computes due dates from the start date", () => {
    const plan = buildProjectPlan(small, "2026-11-01");
    expect(plan.tasks.find((t) => t.key === "y")!.dueDate).toBe("2026-11-11");
    expect(plan.tasks.find((t) => t.key === "z")!.dueDate).toBeNull();
  });

  it("leaves dates empty when there is no start date", () => {
    expect(buildProjectPlan(small, null).tasks.every((t) => t.dueDate === null)).toBe(true);
  });

  it("drops unknown and self dependencies and sets initial status", () => {
    const plan = buildProjectPlan(small, "2026-11-01");
    expect(plan.tasks.find((t) => t.key === "y")!.dependsOn).toEqual(["x"]);
    expect(plan.tasks.find((t) => t.key === "x")!.status).toBe("ready");
    expect(plan.tasks.find((t) => t.key === "y")!.status).toBe("not_started");
  });

  it("orders phases and uses the latest task date as the phase due date", () => {
    const plan = buildProjectPlan(small, "2026-11-01");
    expect(plan.phases.map((p) => p.name)).toEqual(["A", "B"]);
    expect(plan.phases[0].dueDate).toBe("2026-11-11");
    expect(plan.phases[1].dueDate).toBeNull();
  });
});

describe("default templates", () => {
  for (const tpl of DEFAULT_TEMPLATES) {
    describe(tpl.name, () => {
      const keys = tpl.tasks.map((t) => t.key);
      it("has unique keys and valid dependencies", () => {
        expect(new Set(keys).size).toBe(keys.length);
        for (const task of tpl.tasks) {
          for (const dep of task.dependsOn) expect(keys).toContain(dep);
        }
      });
      it("uses only known phases", () => {
        for (const task of tpl.tasks) expect(PHASE_NAMES).toContain(task.phase);
      });
      it("has no circular dependencies and no dependency on a later due date", () => {
        const edges: { taskId: string; dependsOnId: string }[] = [];
        const byKey = new Map(tpl.tasks.map((x) => [x.key, x]));
        for (const task of tpl.tasks) {
          for (const dep of task.dependsOn) {
            expect(wouldCreateCycle(edges, task.key, dep)).toBe(false);
            edges.push({ taskId: task.key, dependsOnId: dep });
            expect(byKey.get(dep)!.offsetDays!).toBeLessThanOrEqual(task.offsetDays!);
          }
        }
      });
      it("starts with at least one ready task", () => {
        const plan = buildProjectPlan(
          { phases: PHASE_NAMES.map((name, position) => ({ name, position })), tasks: tpl.tasks },
          "2026-11-01",
        );
        expect(plan.tasks.some((x) => x.status === "ready")).toBe(true);
      });
    });
  }
});
