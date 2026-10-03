// Pure helpers for document uploads (shared by server and client code).

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // Supabase's default per-file limit
export const DOCUMENT_BUCKET = "documents";

export const DOCUMENT_CATEGORIES = [
  "plan",
  "engineering",
  "contract",
  "quote",
  "purchase_order",
  "invoice",
  "permit",
  "delivery_photo",
  "specification",
  "punch_photo",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  plan: "Plans",
  engineering: "Engineering drawings",
  contract: "Contracts",
  quote: "Quotes",
  purchase_order: "Purchase orders",
  invoice: "Invoices",
  permit: "Permit documents",
  delivery_photo: "Delivery photos",
  specification: "Specifications",
  punch_photo: "Punch list photos",
  other: "Other",
};

const ALLOWED_PREFIXES = ["image/", "text/"];
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/octet-stream", // some phones/browsers report CAD and other files like this
  "application/acad",
  "image/vnd.dwg",
]);

export function isAllowedType(contentType: string): boolean {
  const t = contentType.toLowerCase();
  return ALLOWED_TYPES.has(t) || ALLOWED_PREFIXES.some((p) => t.startsWith(p));
}

export const isImageType = (contentType: string | null | undefined) => !!contentType?.toLowerCase().startsWith("image/");

/** Safe object name: letters, digits, dot, dash, underscore only; length-capped; extension kept. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .replace(/_+/g, "_");
  if (!cleaned) return "file";
  if (cleaned.length <= 80) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 80 - ext.length) + ext;
}

/** Storage layout is '<org>/<project>/<uuid>-<filename>' so storage policies can isolate by organization. */
export function buildStoragePath(orgId: string, projectId: string, uuid: string, fileName: string): string {
  return `${orgId}/${projectId}/${uuid}-${safeFileName(fileName)}`;
}

export function pathBelongsTo(path: string, orgId: string, projectId: string): boolean {
  return path.startsWith(`${orgId}/${projectId}/`) && !path.includes("..");
}
