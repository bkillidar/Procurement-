import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActivityEvent {
  orgId: string;
  projectId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/** Appends a business event to the activity feed. Never blocks the user's action. */
export async function logActivity(db: SupabaseClient, e: ActivityEvent) {
  const { error } = await db.from("activity_log").insert({
    organization_id: e.orgId,
    project_id: e.projectId ?? null,
    entity_type: e.entityType,
    entity_id: e.entityId ?? null,
    action: e.action,
    summary: e.summary,
    metadata: e.metadata ?? {},
  });
  if (error) console.error("activity_log insert failed:", error.message);
}
