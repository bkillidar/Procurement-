import { describe, expect, it } from "vitest";
import { assessRisk, followUpStatus, recommendedOrderDate, type ItemRiskInput } from "./procurement";

const TODAY = "2026-10-03";

function item(over: Partial<ItemRiskInput> = {}): ItemRiskInput {
  return {
    description: "Windows",
    status: "ready_to_order",
    required_on_site_date: null,
    estimated_lead_time_days: null,
    actual_order_date: null,
    vendor_confirmed_at: null,
    expected_delivery_date: null,
    ...over,
  };
}

describe("recommendedOrderDate", () => {
  it("is the required date minus the lead time", () => {
    expect(recommendedOrderDate("2026-10-20", 28)).toBe("2026-09-22");
  });
  it("is null when either input is missing", () => {
    expect(recommendedOrderDate(null, 28)).toBeNull();
    expect(recommendedOrderDate("2026-10-20", null)).toBeNull();
  });
  it("handles a zero lead time", () => {
    expect(recommendedOrderDate("2026-10-20", 0)).toBe("2026-10-20");
  });
});

describe("not-yet-ordered items", () => {
  it("explains a late order in plain English (the spec example)", () => {
    const r = assessRisk(item({ required_on_site_date: "2026-10-20", estimated_lead_time_days: 28 }), TODAY);
    expect(r.level).toBe("critical");
    expect(r.recommendedOrderDate).toBe("2026-09-22");
    expect(r.risks[0].code).toBe("order_late");
    expect(r.risks[0].message).toContain("Windows is required on Oct 20, 2026");
    expect(r.risks[0].message).toContain("Lead time is 28 days");
    expect(r.risks[0].message).toContain("Order has not yet been placed");
    expect(r.risks[0].message).toContain("Recommended order date was Sep 22, 2026 (11 days ago)");
    expect(r.risks[0].message).toContain("about 11 days after the required date");
  });

  it("says order today when today is the recommended date", () => {
    const r = assessRisk(item({ required_on_site_date: "2026-10-31", estimated_lead_time_days: 28 }), TODAY);
    expect(r.level).toBe("high");
    expect(r.risks[0].message).toContain("must be ordered today");
  });

  it("warns within the order-soon window and stays quiet outside it", () => {
    const soon = assessRisk(item({ required_on_site_date: "2026-11-05", estimated_lead_time_days: 28 }), TODAY);
    expect(soon.level).toBe("medium");
    expect(soon.risks[0].code).toBe("order_soon");
    const fine = assessRisk(item({ required_on_site_date: "2026-12-31", estimated_lead_time_days: 28 }), TODAY);
    expect(fine.level).toBe("none");
  });

  it("uses the vendor's typical lead time when the item has none", () => {
    const r = assessRisk(
      item({ required_on_site_date: "2026-10-20", vendor_lead_time_days: 28 }),
      TODAY,
    );
    expect(r.leadTimeDays).toBe(28);
    expect(r.level).toBe("critical");
  });

  it("flags a missing lead time when there is a required date", () => {
    const r = assessRisk(item({ required_on_site_date: "2026-10-20" }), TODAY);
    expect(r.risks[0].code).toBe("no_lead_time");
    expect(assessRisk(item(), TODAY).level).toBe("none");
  });
});

describe("ordered items", () => {
  const ordered = (over: Partial<ItemRiskInput>) =>
    item({
      status: "awaiting_vendor_confirmation",
      actual_order_date: "2026-09-28",
      required_on_site_date: "2026-12-01",
      estimated_lead_time_days: 21,
      ...over,
    });

  it("stays quiet during the confirmation grace period", () => {
    expect(assessRisk(ordered({ actual_order_date: "2026-10-01" }), TODAY).risks).toEqual([]);
  });

  it("flags an unconfirmed order after 3 days and escalates after 7", () => {
    const medium = assessRisk(ordered({ actual_order_date: "2026-09-30" }), TODAY);
    expect(medium.risks.find((r) => r.code === "unconfirmed")!.level).toBe("medium");
    const high = assessRisk(ordered({ actual_order_date: "2026-09-25" }), TODAY);
    expect(high.risks.find((r) => r.code === "unconfirmed")!.level).toBe("high");
  });

  it("does not flag confirmation once the vendor confirmed", () => {
    const r = assessRisk(
      ordered({ status: "confirmed", vendor_confirmed_at: "2026-09-29T12:00:00Z", expected_delivery_date: "2026-10-20" }),
      TODAY,
    );
    expect(r.risks).toEqual([]);
  });

  it("flags an overdue delivery, and critical if the required date also passed", () => {
    const late = assessRisk(
      ordered({ status: "shipped", vendor_confirmed_at: "x", expected_delivery_date: "2026-10-01" }),
      TODAY,
    );
    expect(late.risks.find((r) => r.code === "delivery_overdue")!.level).toBe("high");
    const veryLate = assessRisk(
      ordered({
        status: "shipped",
        vendor_confirmed_at: "x",
        expected_delivery_date: "2026-10-01",
        required_on_site_date: "2026-10-02",
      }),
      TODAY,
    );
    expect(veryLate.level).toBe("critical");
  });

  it("flags an expected delivery after the required date", () => {
    const r = assessRisk(
      ordered({ status: "confirmed", vendor_confirmed_at: "x", expected_delivery_date: "2026-12-06" }),
      TODAY,
    );
    const risk = r.risks.find((x) => x.code === "delivery_after_required")!;
    expect(risk.message).toContain("5 days after the required on-site date");
  });

  it("projects arrival from order date + lead time when there is no expected date", () => {
    const r = assessRisk(
      ordered({ actual_order_date: "2026-10-02", estimated_lead_time_days: 70, required_on_site_date: "2026-11-30" }),
      TODAY,
    );
    expect(r.risks.find((x) => x.code === "projected_late")!.message).toContain("projected to arrive Dec 11, 2026");
  });

  it("flags partial deliveries and problems", () => {
    expect(assessRisk(ordered({ status: "partially_delivered" }), TODAY).risks.some((r) => r.code === "partial_delivery")).toBe(true);
    expect(assessRisk(ordered({ status: "problem" }), TODAY).risks.some((r) => r.code === "delivery_problem")).toBe(true);
  });
});

describe("downstream tasks", () => {
  it("flags a task due soon that depends on material not yet delivered", () => {
    const r = assessRisk(
      item({
        status: "ordered",
        actual_order_date: "2026-10-02",
        dependentTasks: [{ title: "Install windows", due_date: "2026-10-08" }],
      }),
      TODAY,
    );
    const risk = r.risks.find((x) => x.code === "downstream_task")!;
    expect(risk.level).toBe("high");
    expect(risk.message).toContain("Install windows");
  });

  it("is critical when the task is already overdue", () => {
    const r = assessRisk(
      item({ status: "ordered", dependentTasks: [{ title: "Install windows", due_date: "2026-10-01" }] }),
      TODAY,
    );
    expect(r.level).toBe("critical");
  });

  it("ignores tasks far in the future or when delivery lands before the task", () => {
    const far = assessRisk(
      item({ status: "ordered", dependentTasks: [{ title: "Install", due_date: "2026-12-01" }] }),
      TODAY,
    );
    expect(far.risks.some((x) => x.code === "downstream_task")).toBe(false);
    const covered = assessRisk(
      item({
        status: "confirmed",
        expected_delivery_date: "2026-10-05",
        dependentTasks: [{ title: "Install", due_date: "2026-10-08" }],
      }),
      TODAY,
    );
    expect(covered.risks.some((x) => x.code === "downstream_task")).toBe(false);
  });
});

describe("delivered items", () => {
  it("have no risk", () => {
    for (const status of ["delivered", "complete"]) {
      const r = assessRisk(
        item({ status, required_on_site_date: "2026-09-01", estimated_lead_time_days: 28, dependentTasks: [{ title: "x", due_date: "2026-09-02" }] }),
        TODAY,
      );
      expect(r.level).toBe("none");
    }
  });
});

describe("risk ordering", () => {
  it("lists the most severe risk first and reports the highest level", () => {
    const r = assessRisk(
      item({
        status: "awaiting_vendor_confirmation",
        actual_order_date: "2026-09-30",
        required_on_site_date: "2026-10-05",
        estimated_lead_time_days: 14,
        dependentTasks: [{ title: "Install", due_date: "2026-10-04" }],
      }),
      TODAY,
    );
    expect(r.level).toBe("high");
    expect(r.risks[0].level).toBe("high");
    expect(r.risks.at(-1)!.level).toBe("medium");
  });
});

describe("followUpStatus", () => {
  const waiting = { description: "Windows", status: "ordered", actual_order_date: "2026-09-28" };
  it("ignores items that are not waiting on a vendor", () => {
    expect(followUpStatus({ ...waiting, status: "ready_to_order" }, TODAY).state).toBe("none");
    expect(followUpStatus({ ...waiting, status: "delivered" }, TODAY).state).toBe("none");
  });
  it("uses the scheduled next follow-up date", () => {
    expect(followUpStatus({ ...waiting, next_follow_up_on: "2026-10-01" }, TODAY).state).toBe("overdue");
    expect(followUpStatus({ ...waiting, next_follow_up_on: TODAY }, TODAY).state).toBe("due");
    expect(followUpStatus({ ...waiting, next_follow_up_on: "2026-10-09" }, TODAY).state).toBe("none");
  });
  it("is due a few days after ordering when nothing was ever logged", () => {
    expect(followUpStatus(waiting, TODAY).state).toBe("due");
    expect(followUpStatus({ ...waiting, actual_order_date: "2026-10-02" }, TODAY).state).toBe("none");
    expect(followUpStatus({ ...waiting, last_follow_up_at: "2026-09-30T10:00:00Z" }, TODAY).state).toBe("none");
  });
});
