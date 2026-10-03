import { z } from "zod";

// Form values arrive as strings; empty strings mean "not provided".
const text = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : null));

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

const dateField = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")])
  .optional()
  .transform((v) => (v ? v : null));

const uuid = z.string().uuid();
const optionalUuid = z
  .union([z.literal(""), uuid])
  .optional()
  .transform((v) => (v ? v : null));

export const PROJECT_TYPES = ["renovation", "new_construction"] as const;
export const JURISDICTIONS = ["DC", "MD", "VA"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const CONTACT_KINDS = [
  "vendor",
  "architect",
  "engineer",
  "subcontractor",
  "lender",
  "utility",
  "municipal",
  "other",
] as const;

export const projectSchema = z
  .object({
    name: requiredText("Project name"),
    address: text(300),
    jurisdiction: z.enum(JURISDICTIONS).optional().or(z.literal("")).transform((v) => (v ? v : null)),
    project_type: z.enum(PROJECT_TYPES),
    scope: text(),
    acquisition_details: text(),
    start_date: dateField,
    target_completion_date: dateField,
    notes: text(),
    template_id: optionalUuid,
    request_id: optionalUuid,
  })
  .refine((p) => !p.start_date || !p.target_completion_date || p.target_completion_date >= p.start_date, {
    message: "Target completion must be on or after the start date",
    path: ["target_completion_date"],
  });

export const taskSchema = z.object({
  project_id: uuid,
  phase_id: optionalUuid,
  title: requiredText("Task title"),
  description: text(),
  assignee_label: text(100),
  due_date: dateField,
  priority: z.enum(PRIORITIES).default("medium"),
});

export const contactSchema = z.object({
  name: requiredText("Name"),
  kind: z.enum(CONTACT_KINDS),
  company: text(200),
  title: text(200),
  phone: text(50),
  email: z
    .union([z.literal(""), z.string().trim().email("Enter a valid email")])
    .optional()
    .transform((v) => (v ? v : null)),
  notes: text(),
});

export const vendorSchema = z.object({
  name: requiredText("Vendor name"),
  category: text(100),
  phone: text(50),
  email: z
    .union([z.literal(""), z.string().trim().email("Enter a valid email")])
    .optional()
    .transform((v) => (v ? v : null)),
  typical_lead_time_days: z
    .union([z.literal(""), z.coerce.number().int("Whole days only").min(0, "Cannot be negative").max(1000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  notes: text(),
});

/** First validation message, for showing in a banner. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export const ITEM_METHODS = ["phone", "email", "text", "in_person", "portal", "other"] as const;

const numberField = (label: string, { int = false, min = 0 } = {}) =>
  z
    .union([z.literal(""), z.coerce.number().min(min, `${label} cannot be less than ${min}`)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v))
    .refine((v) => v === null || !int || Number.isInteger(v), `${label} must be a whole number`);

const money = (label: string) => numberField(label);

export const procurementItemSchema = z.object({
  project_id: uuid,
  category: requiredText("Category", 100),
  description: requiredText("Description", 300),
  specification: text(),
  quantity: numberField("Quantity"),
  unit: text(30),
  source_reference: text(200),
  required_on_site_date: dateField,
  estimated_lead_time_days: numberField("Lead time", { int: true }),
  vendor_id: optionalUuid,
  notes: text(),
});

export const quoteSchema = z.object({
  item_id: uuid,
  vendor_id: optionalUuid,
  amount: money("Amount"),
  lead_time_days: numberField("Lead time", { int: true }),
  availability_notes: text(500),
  quoted_on: dateField,
  valid_until: dateField,
  notes: text(),
});

export const orderSchema = z.object({
  item_id: uuid,
  vendor_id: optionalUuid,
  actual_order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the order date"),
  order_number: text(100),
  final_cost: money("Final cost"),
  expected_delivery_date: dateField,
});

export const confirmationSchema = z.object({
  item_id: uuid,
  confirmed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the confirmation date"),
  expected_delivery_date: dateField,
  notes: text(500),
});

export const followUpSchema = z.object({
  item_id: uuid,
  method: z.enum(ITEM_METHODS),
  result: text(500),
  next_follow_up_on: dateField,
  responsible_label: text(100),
  notes: text(),
});

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

export const deliverySchema = z.object({
  item_id: uuid,
  received_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the delivery date"),
  quantity_received: numberField("Quantity received"),
  is_partial: checkbox,
  has_damage: checkbox,
  has_missing_items: checkbox,
  has_incorrect_items: checkbox,
  needs_replacement: checkbox,
  notes: text(),
});

export const ISSUE_TYPES = [
  "procurement",
  "vendor",
  "delivery",
  "permit",
  "utility",
  "design",
  "construction",
  "other",
] as const;
export const ISSUE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const ISSUE_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;

export const issueSchema = z.object({
  project_id: uuid,
  issue_type: z.enum(ISSUE_TYPES),
  title: requiredText("Title", 200),
  description: text(),
  severity: z.enum(ISSUE_SEVERITIES),
  owner_label: text(100),
  due_date: dateField,
  procurement_item_id: optionalUuid,
  task_id: optionalUuid,
});

export const issueUpdateSchema = z.object({
  issue_id: uuid,
  status: z.enum(ISSUE_STATUSES),
  severity: z.enum(ISSUE_SEVERITIES),
  owner_label: text(100),
  due_date: dateField,
  description: text(),
  resolution: text(),
});

export const replacementSchema = z.object({
  item_id: uuid,
  quantity: numberField("Quantity"),
  notes: text(),
});

export const PERMIT_STATUS_VALUES = [
  "not_started",
  "preparing",
  "submitted",
  "under_review",
  "additional_info_required",
  "approved",
  "scheduled",
  "complete",
  "delayed",
] as const;

export const permitSchema = z.object({
  project_id: uuid,
  item_type: requiredText("Type", 150),
  agency: text(200),
  status: z.enum(PERMIT_STATUS_VALUES).default("not_started"),
  contact_id: optionalUuid,
  task_id: optionalUuid,
  reference_number: text(100),
  submitted_on: dateField,
  expected_response_date: dateField,
  next_follow_up_on: dateField,
  approved_on: dateField,
  notes: text(),
});

export const permitFollowUpSchema = z.object({
  permit_id: uuid,
  method: z.enum(ITEM_METHODS),
  result: text(500),
  next_follow_up_on: dateField,
  responsible_label: text(100),
  notes: text(),
});

export const PUNCH_STATUS_VALUES = ["open", "in_progress", "ready_for_verification", "verified", "wont_fix"] as const;

export const punchSchema = z.object({
  project_id: uuid,
  location: text(100),
  description: requiredText("Description", 500),
  priority: z.enum(PRIORITIES).default("medium"),
  due_date: dateField,
  assigned_contact_id: optionalUuid,
  assigned_label: text(100),
  notes: text(),
});
