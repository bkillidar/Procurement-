import { describe, expect, it } from "vitest";
import { contactSchema, projectSchema, taskSchema, vendorSchema } from "./validation";

describe("projectSchema", () => {
  const base = { name: "123 Main St", project_type: "renovation" };

  it("accepts a minimal project and turns blanks into null", () => {
    const r = projectSchema.parse({ ...base, address: "", start_date: "", jurisdiction: "" });
    expect(r.address).toBeNull();
    expect(r.start_date).toBeNull();
    expect(r.jurisdiction).toBeNull();
  });

  it("requires a name and a known type", () => {
    expect(projectSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, project_type: "condo" }).success).toBe(false);
  });

  it("rejects bad dates and a completion date before the start date", () => {
    expect(projectSchema.safeParse({ ...base, start_date: "10/20/2026" }).success).toBe(false);
    const r = projectSchema.safeParse({ ...base, start_date: "2026-11-01", target_completion_date: "2026-10-01" });
    expect(r.success).toBe(false);
  });

  it("only allows DC, MD or VA", () => {
    expect(projectSchema.safeParse({ ...base, jurisdiction: "NY" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, jurisdiction: "MD" }).success).toBe(true);
  });
});

describe("taskSchema", () => {
  const pid = "6f1c1c0e-8c0a-4c36-9a53-0b8f3b0a1111";
  it("requires a title and a valid project id", () => {
    expect(taskSchema.safeParse({ project_id: pid, title: "" }).success).toBe(false);
    expect(taskSchema.safeParse({ project_id: "nope", title: "x" }).success).toBe(false);
  });
  it("defaults priority to medium", () => {
    expect(taskSchema.parse({ project_id: pid, title: "x" }).priority).toBe("medium");
  });
});

describe("contactSchema / vendorSchema", () => {
  it("validates email format but allows blank", () => {
    expect(contactSchema.safeParse({ name: "A", kind: "vendor", email: "bad" }).success).toBe(false);
    expect(contactSchema.parse({ name: "A", kind: "vendor", email: "" }).email).toBeNull();
  });
  it("validates lead time as a non-negative whole number", () => {
    expect(vendorSchema.safeParse({ name: "V", typical_lead_time_days: "-3" }).success).toBe(false);
    expect(vendorSchema.safeParse({ name: "V", typical_lead_time_days: "2.5" }).success).toBe(false);
    expect(vendorSchema.parse({ name: "V", typical_lead_time_days: "28" }).typical_lead_time_days).toBe(28);
    expect(vendorSchema.parse({ name: "V", typical_lead_time_days: "" }).typical_lead_time_days).toBeNull();
  });
});

import { confirmationSchema, followUpSchema, orderSchema, procurementItemSchema, quoteSchema } from "./validation";

describe("procurement schemas", () => {
  const id = "6f1c1c0e-8c0a-4c36-9a53-0b8f3b0a1111";

  it("accepts an item with blanks and parses numbers", () => {
    const r = procurementItemSchema.parse({
      project_id: id,
      category: "Windows",
      description: "Double-hung, 32 units",
      quantity: "32",
      estimated_lead_time_days: "28",
      required_on_site_date: "",
    });
    expect(r.quantity).toBe(32);
    expect(r.estimated_lead_time_days).toBe(28);
    expect(r.required_on_site_date).toBeNull();
    expect(r.unit).toBeNull();
  });

  it("rejects negative or fractional lead times and missing category/description", () => {
    const base = { project_id: id, category: "Windows", description: "x" };
    expect(procurementItemSchema.safeParse({ ...base, estimated_lead_time_days: "-1" }).success).toBe(false);
    expect(procurementItemSchema.safeParse({ ...base, estimated_lead_time_days: "2.5" }).success).toBe(false);
    expect(procurementItemSchema.safeParse({ ...base, category: "" }).success).toBe(false);
    expect(procurementItemSchema.safeParse({ ...base, description: " " }).success).toBe(false);
  });

  it("validates quotes, orders, confirmations and follow-ups", () => {
    expect(quoteSchema.safeParse({ item_id: id, amount: "-5" }).success).toBe(false);
    expect(quoteSchema.parse({ item_id: id, amount: "1250.50", lead_time_days: "" }).amount).toBe(1250.5);
    expect(orderSchema.safeParse({ item_id: id, actual_order_date: "" }).success).toBe(false);
    expect(orderSchema.parse({ item_id: id, actual_order_date: "2026-10-01", final_cost: "" }).final_cost).toBeNull();
    expect(confirmationSchema.safeParse({ item_id: id, confirmed_on: "tomorrow" }).success).toBe(false);
    expect(followUpSchema.safeParse({ item_id: id, method: "carrier-pigeon" }).success).toBe(false);
    expect(followUpSchema.parse({ item_id: id, method: "phone", next_follow_up_on: "2026-10-09" }).next_follow_up_on).toBe("2026-10-09");
  });
});

import { deliverySchema, issueSchema, issueUpdateSchema, replacementSchema } from "./validation";

describe("delivery and issue schemas", () => {
  const id = "6f1c1c0e-8c0a-4c36-9a53-0b8f3b0a1111";

  it("parses checkboxes: present = true, absent = false", () => {
    const r = deliverySchema.parse({ item_id: id, received_on: "2026-10-03", has_damage: "on", quantity_received: "28" });
    expect(r.has_damage).toBe(true);
    expect(r.is_partial).toBe(false);
    expect(r.quantity_received).toBe(28);
  });

  it("requires a delivery date and rejects negative quantities", () => {
    expect(deliverySchema.safeParse({ item_id: id, received_on: "" }).success).toBe(false);
    expect(deliverySchema.safeParse({ item_id: id, received_on: "2026-10-03", quantity_received: "-1" }).success).toBe(false);
    expect(deliverySchema.parse({ item_id: id, received_on: "2026-10-03", quantity_received: "" }).quantity_received).toBeNull();
  });

  it("validates issues", () => {
    expect(issueSchema.safeParse({ project_id: id, issue_type: "delivery", title: "", severity: "high" }).success).toBe(false);
    expect(issueSchema.safeParse({ project_id: id, issue_type: "weather", title: "x", severity: "high" }).success).toBe(false);
    expect(issueSchema.safeParse({ project_id: id, issue_type: "permit", title: "x", severity: "urgent" }).success).toBe(false);
    const ok = issueSchema.parse({ project_id: id, issue_type: "permit", title: "Permit stalled", severity: "high", due_date: "" });
    expect(ok.due_date).toBeNull();
    expect(issueUpdateSchema.safeParse({ issue_id: id, status: "done", severity: "low" }).success).toBe(false);
    expect(replacementSchema.safeParse({ item_id: id, quantity: "-4" }).success).toBe(false);
  });
});
