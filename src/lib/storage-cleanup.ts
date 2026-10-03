import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENT_BUCKET } from "@/lib/documents";

type Column = "project_id" | "procurement_item_id" | "issue_id" | "permit_id" | "punch_item_id" | "task_id" | "delivery_id";

/**
 * Deletes the stored files behind documents that are about to disappear.
 * Database rows go away automatically when their parent is deleted (cascade), but
 * the files in Storage would be left behind, so call this BEFORE deleting the parent.
 * Failures are logged, never thrown: a leftover file must not block a delete.
 */
export async function purgeDocumentFiles(db: SupabaseClient, orgId: string, column: Column, id: string) {
  try {
    const { data } = await db.from("documents").select("storage_path").eq("organization_id", orgId).eq(column, id);
    const paths = (data ?? []).map((d) => d.storage_path as string);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await db.storage.from(DOCUMENT_BUCKET).remove(paths.slice(i, i + 100));
      if (error) console.error("storage cleanup failed:", error.message);
    }
  } catch (e) {
    console.error("storage cleanup failed:", e);
  }
}
