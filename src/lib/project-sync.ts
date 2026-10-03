import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computePhaseState, statusAfterDependencyChange, type TaskStatus } from "@/lib/tasks";
import { isReceived } from "@/lib/procurement";

/**
 * Re-derives automatic task statuses (ready / not started) from dependencies,
 * then phase statuses and the project's current phase.
 * `keepTaskId` is a task whose status a person just set explicitly; it is left alone.
 */
export async function syncProject(db: SupabaseClient, orgId: string, projectId: string, keepTaskId?: string) {
  const [{ data: tasks, error: tErr }, { data: phases, error: pErr }] = await Promise.all([
    db.from("tasks").select("id, phase_id, status").eq("organization_id", orgId).eq("project_id", projectId),
    db
      .from("project_phases")
      .select("id, position, status")
      .eq("organization_id", orgId)
      .eq("project_id", projectId),
  ]);
  if (tErr) throw new Error(tErr.message);
  if (pErr) throw new Error(pErr.message);
  if (!tasks || !phases) return;

  const taskIds = tasks.map((t) => t.id);
  const { data: deps, error: dErr } = taskIds.length
    ? await db
        .from("task_dependencies")
        .select("task_id, depends_on_task_id, depends_on_procurement_item_id")
        .eq("organization_id", orgId)
        .in("task_id", taskIds)
    : { data: [], error: null };
  if (dErr) throw new Error(dErr.message);

  // A procurement dependency is satisfied once the material is received.
  const itemIds = [...new Set((deps ?? []).map((d) => d.depends_on_procurement_item_id).filter(Boolean))];
  const { data: items, error: iErr } = itemIds.length
    ? await db.from("procurement_items").select("id, status").eq("organization_id", orgId).in("id", itemIds)
    : { data: [], error: null };
  if (iErr) throw new Error(iErr.message);
  const itemDone = new Map<string, boolean>((items ?? []).map((i) => [i.id, isReceived(i.status)]));

  const statusById = new Map<string, string>(tasks.map((t) => [t.id, t.status]));

  // Dependencies can chain (A -> B -> C), so repeat until nothing changes.
  const updates = new Map<string, TaskStatus>();
  for (let pass = 0; pass < tasks.length + 1; pass++) {
    let changed = false;
    for (const task of tasks) {
      if (task.id === keepTaskId) continue;
      const depStatuses = (deps ?? [])
        .filter((d) => d.task_id === task.id)
        .map((d) =>
          d.depends_on_procurement_item_id
            ? itemDone.get(d.depends_on_procurement_item_id)
              ? "complete"
              : "pending"
            : (statusById.get(d.depends_on_task_id) ?? "complete"),
        );
      if (depStatuses.length === 0) continue;
      const current = statusById.get(task.id) as TaskStatus;
      const next = statusAfterDependencyChange(current, depStatuses);
      if (next !== current) {
        statusById.set(task.id, next);
        updates.set(task.id, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const [id, status] of updates) {
    const { error } = await db.from("tasks").update({ status }).eq("id", id).eq("organization_id", orgId);
    if (error) throw new Error(error.message);
  }

  const byPhase: Record<string, string[]> = {};
  for (const task of tasks) {
    if (!task.phase_id) continue;
    (byPhase[task.phase_id] ??= []).push(statusById.get(task.id)!);
  }
  const state = computePhaseState(phases, byPhase);

  for (const phase of phases) {
    const next = state.phaseStatuses[phase.id];
    if (next !== phase.status) {
      const { error } = await db
        .from("project_phases")
        .update({ status: next, completed_at: next === "complete" ? new Date().toISOString() : null })
        .eq("id", phase.id)
        .eq("organization_id", orgId);
      if (error) throw new Error(error.message);
    }
  }
  const { error } = await db
    .from("projects")
    .update({ current_phase_id: state.currentPhaseId })
    .eq("id", projectId)
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
}
