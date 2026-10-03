import { describe, expect, it } from "vitest";
import { assessRisk } from "./procurement";
import { buildDemoProject, date, DEMO_ITEMS, DEMO_VENDORS } from "./demo";

const TODAY = "2026-10-03";

describe("demo data", () => {
  const vendorLead = new Map(DEMO_VENDORS.map((v) => [v.key, v.lead]));

  it("is flagged at the intended level by the real risk rules", () => {
    for (const i of DEMO_ITEMS) {
      const r = assessRisk(
        {
          description: i.description,
          status: i.status,
          required_on_site_date: date(TODAY, i.required),
          estimated_lead_time_days: i.lead,
          vendor_lead_time_days: vendorLead.get(i.vendor),
          actual_order_date: date(TODAY, i.ordered),
          vendor_confirmed_at: i.confirmed === undefined ? null : `${date(TODAY, i.confirmed)}T12:00:00Z`,
          expected_delivery_date: date(TODAY, i.expected),
        },
        TODAY,
      );
      expect(r.level, i.description).toBe(i.expectRisk);
    }
  });

  it("covers a good mix of situations", () => {
    const levels = new Set(DEMO_ITEMS.map((i) => i.expectRisk));
    expect(levels).toEqual(new Set(["none", "medium", "high", "critical"]));
    expect(DEMO_ITEMS.some((i) => i.status === "delivered")).toBe(true);
    expect(DEMO_ITEMS.some((i) => i.status === "partially_delivered")).toBe(true);
  });

  it("uses only declared vendors and valid quantities", () => {
    for (const i of DEMO_ITEMS) {
      expect(vendorLead.has(i.vendor)).toBe(true);
      expect(i.quantity).toBeGreaterThan(0);
      if (i.received !== undefined) expect(i.received).toBeLessThanOrEqual(i.quantity);
    }
  });

  it("builds a project that started in the past and is clearly labelled as a demo", () => {
    const p = buildDemoProject(TODAY);
    expect(p.name.startsWith("DEMO — ")).toBe(true);
    expect(p.start_date).toBe("2026-06-25");
    expect(p.target_completion_date! > p.start_date).toBe(true);
  });
});
