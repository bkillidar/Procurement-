import { describe, expect, it } from "vitest";
import { comparePunch, groupByLocation, isDonePunch, isOpenPunch, punchTaskStates, summarizePunch } from "./punch";

describe("punch statuses", () => {
  it("classifies open and done statuses", () => {
    expect(isOpenPunch("open") && isOpenPunch("in_progress")).toBe(true);
    expect(isOpenPunch("ready_for_verification")).toBe(false);
    expect(isDonePunch("verified") && isDonePunch("wont_fix")).toBe(true);
    expect(isDonePunch("ready_for_verification")).toBe(false);
  });
});

describe("summarizePunch", () => {
  it("counts each bucket and the percentage done", () => {
    const s = summarizePunch([
      { status: "open" },
      { status: "in_progress" },
      { status: "ready_for_verification" },
      { status: "verified" },
      { status: "wont_fix" },
    ]);
    expect(s).toEqual({ total: 5, open: 2, readyForVerification: 1, done: 2, percentDone: 40 });
  });
  it("handles an empty list", () => {
    expect(summarizePunch([]).percentDone).toBe(0);
  });
});

describe("punchTaskStates", () => {
  it("is not created or complete with no items", () => {
    expect(punchTaskStates(summarizePunch([]))).toEqual({ listCreated: false, listComplete: false });
  });
  it("is created but not complete while anything is open or awaiting verification", () => {
    expect(punchTaskStates(summarizePunch([{ status: "open" }, { status: "verified" }]))).toEqual({ listCreated: true, listComplete: false });
    expect(punchTaskStates(summarizePunch([{ status: "ready_for_verification" }]))).toEqual({ listCreated: true, listComplete: false });
  });
  it("is complete only when everything is verified or won't-fix", () => {
    expect(punchTaskStates(summarizePunch([{ status: "verified" }, { status: "wont_fix" }]))).toEqual({ listCreated: true, listComplete: true });
  });
});

describe("ordering and grouping", () => {
  it("sorts by priority, then due date, then age", () => {
    const items = [
      { id: "a", priority: "medium", due_date: null, created_at: "1" },
      { id: "b", priority: "urgent", due_date: "2026-10-09", created_at: "2" },
      { id: "c", priority: "medium", due_date: "2026-10-01", created_at: "3" },
      { id: "d", priority: "low", due_date: "2026-09-01", created_at: "4" },
    ];
    expect(items.sort(comparePunch).map((i) => i.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("groups by location A–Z with 'No location' last, trimming blanks", () => {
    const groups = groupByLocation([
      { location: "Kitchen", priority: "low", due_date: null },
      { location: null, priority: "low", due_date: null },
      { location: "  ", priority: "low", due_date: null },
      { location: "basement", priority: "high", due_date: null },
      { location: "Kitchen", priority: "urgent", due_date: null },
    ]);
    expect(groups.map((g) => g.location)).toEqual(["basement", "Kitchen", "No location"]);
    expect(groups[1].items.map((i) => i.priority)).toEqual(["urgent", "low"]);
    expect(groups[2].items).toHaveLength(2);
  });
});
