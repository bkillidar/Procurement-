import { describe, expect, it } from "vitest";
import { compareIssues, isOpenIssue } from "./issues";

describe("issues", () => {
  it("knows which statuses are open", () => {
    expect(["open", "in_progress", "waiting"].every(isOpenIssue)).toBe(true);
    expect(isOpenIssue("resolved")).toBe(false);
    expect(isOpenIssue("closed")).toBe(false);
  });

  it("sorts by severity, then due date, then age", () => {
    const issues = [
      { id: "a", severity: "medium", due_date: "2026-10-01", opened_on: "2026-09-01" },
      { id: "b", severity: "critical", due_date: null, opened_on: "2026-09-20" },
      { id: "c", severity: "medium", due_date: "2026-09-25", opened_on: "2026-09-10" },
      { id: "d", severity: "medium", due_date: "2026-09-25", opened_on: "2026-09-05" },
    ];
    expect(issues.sort(compareIssues).map((i) => i.id)).toEqual(["b", "d", "c", "a"]);
  });
});
