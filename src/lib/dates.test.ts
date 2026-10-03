import { describe, expect, it } from "vitest";
import { addDays, daysBetween, dueState, formatDate, todayISO } from "./dates";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts whole days, including across DST changes", () => {
    expect(daysBetween("2026-03-07", "2026-03-10")).toBe(3);
    expect(daysBetween("2026-10-30", "2026-11-03")).toBe(4);
    expect(daysBetween("2026-05-10", "2026-05-01")).toBe(-9);
  });

  it("classifies due dates", () => {
    const today = "2026-10-03";
    expect(dueState(null, today)).toBe("none");
    expect(dueState("2026-10-02", today)).toBe("overdue");
    expect(dueState("2026-10-03", today)).toBe("today");
    expect(dueState("2026-10-10", today)).toBe("soon");
    expect(dueState("2026-10-11", today)).toBe("later");
  });

  it("evaluates today in Eastern time", () => {
    // 2026-10-04 02:30 UTC is still Oct 3 in New York.
    expect(todayISO(new Date("2026-10-04T02:30:00Z"))).toBe("2026-10-03");
  });

  it("formats dates without shifting the day", () => {
    expect(formatDate("2026-10-20")).toBe("Oct 20, 2026");
    expect(formatDate(null)).toBe("—");
  });
});
