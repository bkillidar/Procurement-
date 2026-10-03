import { describe, expect, it } from "vitest";
import { sanitizeSearch } from "./search";
import { activityHref } from "./activity-links";

describe("sanitizeSearch", () => {
  it("removes characters that would change a filter", () => {
    expect(sanitizeSearch("50%_off, (windows)*")).toBe("50 off windows");
    expect(sanitizeSearch(`a.name,eq.b") or id.neq.0`)).toBe("a.name eq.b or id.neq.0");
  });
  it("collapses whitespace, trims and caps length", () => {
    expect(sanitizeSearch("  kitchen   cabinets ")).toBe("kitchen cabinets");
    expect(sanitizeSearch("x".repeat(200))).toHaveLength(60);
  });
  it("returns an empty string when nothing is left", () => {
    expect(sanitizeSearch("%%%___")).toBe("");
  });
});

describe("activityHref", () => {
  it("links each entity type to its page", () => {
    expect(activityHref("procurement_item", "i1", "p1")).toBe("/procurement/i1");
    expect(activityHref("issue", "s1", "p1")).toBe("/issues/s1");
    expect(activityHref("permit", "m1", "p1")).toBe("/permits/m1");
    expect(activityHref("punch_item", "u1", "p1")).toBe("/punch/u1");
    expect(activityHref("task", "t1", "p1")).toBe("/projects/p1#task-t1");
    expect(activityHref("project", "p1", "p1")).toBe("/projects/p1");
  });
  it("falls back to the project when the entity was deleted", () => {
    expect(activityHref("procurement_item", null, "p1")).toBe("/projects/p1");
    expect(activityHref("permit", null, "p1")).toBe("/projects/p1");
    expect(activityHref("punch_item", null, "p1")).toBe("/projects/p1/punch");
    expect(activityHref("issue", null, "p1")).toBeNull();
    expect(activityHref("unknown", null, null)).toBeNull();
  });
});
