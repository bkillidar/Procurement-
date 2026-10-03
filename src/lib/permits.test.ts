import { describe, expect, it } from "vitest";
import { assessPermit, permitCompletesTask, standardPermitsFromTasks, type PermitRiskInput } from "./permits";

const TODAY = "2026-10-03";
const base: PermitRiskInput = {
  item_type: "Building permit",
  status: "submitted",
  submitted_on: "2026-09-20",
  expected_response_date: null,
  next_follow_up_on: null,
};

describe("assessPermit", () => {
  it("has no risk once approved, scheduled or complete", () => {
    for (const status of ["approved", "scheduled", "complete"]) {
      expect(assessPermit({ ...base, status, expected_response_date: "2026-01-01" }, TODAY).level).toBe("none");
    }
  });

  it("flags an overdue agency response", () => {
    const r = assessPermit({ ...base, expected_response_date: "2026-09-28" }, TODAY);
    expect(r.level).toBe("high");
    expect(r.risks[0].code).toBe("response_overdue");
    expect(r.risks[0].message).toContain("expected Sep 28, 2026 (5 days ago)");
  });

  it("is fine while the response date is still in the future", () => {
    expect(assessPermit({ ...base, expected_response_date: "2026-10-10" }, TODAY).level).toBe("none");
  });

  it("flags a long silence when no response date was given", () => {
    expect(assessPermit({ ...base, submitted_on: "2026-09-10" }, TODAY).risks[0].code).toBe("no_response");
    expect(assessPermit({ ...base, submitted_on: "2026-09-25" }, TODAY).level).toBe("none");
  });

  it("flags delayed and additional-information-required", () => {
    expect(assessPermit({ ...base, status: "delayed" }, TODAY).risks[0].code).toBe("delayed");
    expect(assessPermit({ ...base, status: "additional_info_required" }, TODAY).risks[0].code).toBe("info_required");
  });

  it("flags an overdue follow-up", () => {
    const r = assessPermit({ ...base, next_follow_up_on: "2026-10-01" }, TODAY);
    expect(r.risks.some((x) => x.code === "follow_up_overdue")).toBe(true);
    expect(assessPermit({ ...base, next_follow_up_on: "2026-10-09" }, TODAY).level).toBe("none");
  });

  it("flags an unsubmitted permit whose schedule task is coming due", () => {
    const input = (due: string): PermitRiskInput => ({
      ...base,
      status: "preparing",
      submitted_on: null,
      linkedTask: { title: "Building permit approved", due_date: due, status: "ready" },
    });
    expect(assessPermit(input("2026-10-15"), TODAY).risks[0].level).toBe("medium");
    expect(assessPermit(input("2026-10-08"), TODAY).risks[0].level).toBe("high");
    expect(assessPermit(input("2026-10-01"), TODAY).risks[0].level).toBe("critical");
    expect(assessPermit(input("2026-10-20"), TODAY).level).toBe("none");
    expect(assessPermit(input("2026-12-01"), TODAY).level).toBe("none");
    expect(assessPermit({ ...input("2026-10-08"), linkedTask: { title: "x", due_date: "2026-10-08", status: "complete" } }, TODAY).level).toBe("none");
  });

  it("orders risks by severity", () => {
    const r = assessPermit(
      {
        ...base,
        status: "delayed",
        next_follow_up_on: "2026-10-01",
      },
      TODAY,
    );
    expect(r.risks.map((x) => x.level)).toEqual(["high", "medium"]);
    expect(r.level).toBe("high");
  });
});

describe("permitCompletesTask", () => {
  it("completes on 'complete' for anything", () => {
    expect(permitCompletesTask("Gas cap-off", "complete")).toBe(true);
  });
  it("treats an approved permit as done but not an approved utility", () => {
    expect(permitCompletesTask("Building permit", "approved")).toBe(true);
    expect(permitCompletesTask("Gas cap-off", "approved")).toBe(false);
    expect(permitCompletesTask("Building permit", "submitted")).toBe(false);
  });
});

describe("standardPermitsFromTasks", () => {
  it("builds items from utilities tasks and the permit approval task", () => {
    const items = standardPermitsFromTasks([
      { id: "1", title: "Gas cap-off (Washington Gas)", phaseName: "Utilities" },
      { id: "2", title: "Temporary power (Pepco)", phaseName: "Utilities" },
      { id: "3", title: "Building permit approved", phaseName: "Permitting" },
      { id: "4", title: "Submit building permit application (DC Department of Buildings)", phaseName: "Permitting" },
      { id: "5", title: "Demolition", phaseName: "Construction" },
      { id: "6", title: "Water / sewer tap and connection (DC Water)", phaseName: "Utilities" },
      { id: "7", title: "Meter inspection", phaseName: "Utilities" },
    ]);
    expect(items).toEqual([
      { item_type: "Gas cap-off", agency: "Washington Gas", task_id: "1" },
      { item_type: "Temporary power", agency: "Pepco", task_id: "2" },
      { item_type: "Building permit", agency: null, task_id: "3" },
      { item_type: "Water / sewer tap and connection", agency: "DC Water", task_id: "6" },
      { item_type: "Meter inspection", agency: null, task_id: "7" },
    ]);
  });
});
