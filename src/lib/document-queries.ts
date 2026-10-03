import "server-only";
import { getContext } from "@/lib/org";
import { DOCUMENT_BUCKET } from "@/lib/documents";

export interface DocumentView {
  id: string;
  project_id: string | null;
  category: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  delivery_id: string | null;
  issue_id: string | null;
  procurement_item_id: string | null;
  url: string | null; // short-lived signed link
}

export interface DocumentFilter {
  projectId?: string;
  procurementItemId?: string;
  deliveryId?: string;
  issueId?: string;
  taskId?: string;
  permitId?: string;
  punchItemId?: string;
  limit?: number;
}

/** Documents (newest first) with one-hour signed links. Files themselves stay private. */
export async function loadDocuments(f: DocumentFilter = {}): Promise<DocumentView[]> {
  const { db, orgId } = await getContext();
  let q = db.from("documents").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (f.projectId) q = q.eq("project_id", f.projectId);
  if (f.procurementItemId) q = q.eq("procurement_item_id", f.procurementItemId);
  if (f.deliveryId) q = q.eq("delivery_id", f.deliveryId);
  if (f.issueId) q = q.eq("issue_id", f.issueId);
  if (f.taskId) q = q.eq("task_id", f.taskId);
  if (f.permitId) q = q.eq("permit_id", f.permitId);
  if (f.punchItemId) q = q.eq("punch_item_id", f.punchItemId);
  const { data, error } = await q.limit(f.limit ?? 200);
  if (error) throw new Error(error.message);
  const docs = data ?? [];
  if (docs.length === 0) return [];

  const { data: signed } = await db.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      3600,
    );
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath.set(s.path, s.signedUrl);
  return docs.map((d) => ({
    id: d.id,
    project_id: d.project_id,
    category: d.category,
    name: d.name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
    created_at: d.created_at,
    delivery_id: d.delivery_id,
    issue_id: d.issue_id,
    procurement_item_id: d.procurement_item_id,
    url: urlByPath.get(d.storage_path) ?? null,
  }));
}
