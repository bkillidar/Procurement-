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
