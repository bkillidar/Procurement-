import "server-only";
import { getContext } from "@/lib/org";
import { findRemovableDuplicates } from "@/lib/duplicates";

/** Ids of accidental duplicate projects that are safe to delete (nothing real has been entered on them). */
export async function loadRemovableDuplicateIds(): Promise<string[]> {
  const { db, orgId } = await getContext();
  const [proj, items, docs, issues, permits, punch, tasks] = await Promise.all([
    db.from("projects").select("id, name, address, created_at").eq("organization_id", orgId),
    db.from("procurement_items").select("project_id").eq("organization_id", orgId),
    db.from("documents").select("project_id").eq("organization_id", orgId),
    db.from("issues").select("project_id").eq("organization_id", orgId),
    db.from("permits_utilities").select("project_id").eq("organization_id", orgId),
    db.from("punch_list_items").select("project_id").eq("organization_id", orgId),
    db.from("tasks").select("project_id, status").eq("organization_id", orgId).in("status", ["in_progress", "waiting", "blocked", "complete"]),
  ]);
  for (const r of [proj, items, docs, issues, permits, punch, tasks]) if (r.error) throw new Error(r.error.message);

  const touched = new Set<string>();
  for (const r of [items, docs, issues, permits, punch, tasks]) for (const row of r.data ?? []) if (row.project_id) touched.add(row.project_id);

  return findRemovableDuplicates(
    (proj.data ?? []).map((p) => ({ id: p.id, name: p.name, address: p.address, created_at: p.created_at, touched: touched.has(p.id) })),
  );
}
