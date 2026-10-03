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
