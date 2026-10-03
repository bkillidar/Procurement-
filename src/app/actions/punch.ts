"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getContext } from "@/lib/org";
import { logActivity } from "@/lib/activity";
import { syncProject } from "@/lib/project-sync";
import { purgeDocumentFiles } from "@/lib/storage-cleanup";
import { PUNCH_STATUS_LABELS, PUNCH_TASK_TITLES, punchTaskStates, summarizePunch, type PunchStatus } from "@/lib/punch";
import { firstError, punchSchema, PUNCH_STATUS_VALUES } from "@/lib/validation";

const uuid = z.string().uuid();

/** Only same-site paths: never redirect somewhere an attacker chose. */
function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}

function refresh(projectId: string, punchId?: string) {
  revalidatePath(`/projects/${projectId}/punch`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/punch");
  revalidatePath("/");
  if (punchId) revalidatePath(`/punch/${punchId}`);
}

/** Keep the schedule in step with the punch list (matched by task title). */
async function syncPunchTasks(db: SupabaseClient, orgId: string, projectId: string) {
  const [{ data: items }, { data: tasks }] = await Promise.all([
    db.from("punch_list_items").select("status").eq("organization_id", orgId).eq("project_id", projectId),
    db.from("tasks").select("id, title, status").eq("organization_id", orgId).eq("project_id", projectId),
  ]);
  const states = punchTaskStates(summarizePunch(items ?? []));
  const find = (title: string) => (tasks ?? []).find((t) => t.title.trim().toLowerCase() === title);
  const createTask = find(PUNCH_TASK_TITLES.create);
  const completeTask = find(PUNCH_TASK_TITLES.complete);

  const set = async (id: string, status: string) =>
    db
      .from("tasks")
      .update({ status, completed_at: status === "complete" ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("organization_id", orgId);

  if (createTask) {
    if (states.listCreated && createTask.status !== "complete") await set(createTask.id, "complete");
    else if (!states.listCreated && createTask.status === "complete") await set(createTask.id, "ready");
  }
  if (completeTask) {
    if (states.listComplete && completeTask.status !== "complete") await set(completeTask.id, "complete");
    else if (!states.listComplete && states.listCreated && completeTask.status === "complete") await set(completeTask.id, "in_progress");
    else if (!states.listComplete && states.listCreated && completeTask.status === "not_started") await set(completeTask.id, "in_progress");
  }
  await syncProject(db, orgId, projectId);
}

async function loadPunch(id: string) {
  const { db, orgId } = await getContext();
  const { data, error } = await db
    .from("punch_list_items")
    .select("id, project_id, description, status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Punch item not found");
  return { db, orgId, item: data };
}

export async function addPunchItem(formData: FormData) {
  const project = uuid.safeParse(formData.get("project_id"));
  if (!project.success) redirect("/projects");
  const listPath = `/projects/${project.data}/punch`;
  const parsed = punchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${listPath}?error=${encodeURIComponent(firstError(parsed.error))}`);

  let id = "";
  let error: string | undefined;
  try {
    const d = parsed.data!;
    const { db, orgId } = await getContext();
    const { data: proj } = await db.from("projects").select("id").eq("id", d.project_id).eq("organization_id", orgId).maybeSingle();
    if (!proj) throw new Error("Project not found");
    if (d.assigned_contact_id) {
      const { data: c } = await db.from("contacts").select("id").eq("id", d.assigned_contact_id).eq("organization_id", orgId).maybeSingle();
      if (!c) throw new Error("Contact not found");
    }
    const { data, error: ie } = await db
      .from("punch_list_items")
      .insert({ ...d, organization_id: orgId })
      .select("id")
      .single();
    if (ie) throw new Error(ie.message);
    id = data.id;
    await logActivity(db, {
      orgId,
      projectId: d.project_id,
      entityType: "punch_item",
      entityId: id,
      action: "punch_added",
      summary: `Punch item added${d.location ? ` (${d.location})` : ""}: ${d.description}`,
    });
    await syncPunchTasks(db, orgId, d.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not add the item";
  }
  refresh(project.data);
  if (error) redirect(`${listPath}?error=${encodeURIComponent(error)}`);
  // "Add & photos" opens the item so the camera is one tap away; plain "Add" stays on the list.
  redirect(formData.get("next") === "photos" ? `/punch/${id}` : `${listPath}${formData.get("view") ? `?view=${formData.get("view")}` : ""}`);
}

export async function setPunchStatus(formData: FormData) {
  const id = uuid.safeParse(formData.get("punch_id"));
  const status = z.enum(PUNCH_STATUS_VALUES).safeParse(formData.get("status"));
  if (!id.success) redirect("/projects");
  let projectId = "";
  let error: string | undefined;
  try {
    if (!status.success) throw new Error("Choose a status");
    const { db, orgId, item } = await loadPunch(id.data);
    projectId = item.project_id;
    if (status.data !== item.status) {
      const verified = status.data === "verified";
      const { error: ue } = await db
        .from("punch_list_items")
        .update({ status: status.data, verified_at: verified ? new Date().toISOString() : null, verified_by: null })
        .eq("id", item.id)
        .eq("organization_id", orgId);
      if (ue) throw new Error(ue.message);
      await logActivity(db, {
        orgId,
        projectId,
        entityType: "punch_item",
        entityId: item.id,
        action: verified ? "punch_verified" : "punch_status_changed",
        summary: `Punch item ${verified ? "verified" : "updated"}: ${item.description} (${PUNCH_STATUS_LABELS[item.status as PunchStatus]} → ${PUNCH_STATUS_LABELS[status.data as PunchStatus]})`,
      });
      await syncPunchTasks(db, orgId, projectId);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not update";
  }
  if (projectId) refresh(projectId, id.data);
  const back = safePath(formData.get("back"), projectId ? `/projects/${projectId}/punch` : "/projects");
  redirect(error ? `${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : back);
}

export async function updatePunchItem(formData: FormData) {
  const id = uuid.safeParse(formData.get("punch_id"));
  if (!id.success) redirect("/projects");
  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, item } = await loadPunch(id.data);
    projectId = item.project_id;
    const parsed = punchSchema.omit({ project_id: true }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    if (parsed.data.assigned_contact_id) {
      const { data: c } = await db.from("contacts").select("id").eq("id", parsed.data.assigned_contact_id).eq("organization_id", orgId).maybeSingle();
      if (!c) throw new Error("Contact not found");
    }
    const { error: ue } = await db.from("punch_list_items").update(parsed.data).eq("id", item.id).eq("organization_id", orgId);
    if (ue) throw new Error(ue.message);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not save";
  }
  if (projectId) refresh(projectId, id.data);
  redirect(`/punch/${id.data}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export async function deletePunchItem(formData: FormData) {
  const id = uuid.safeParse(formData.get("punch_id"));
  if (!id.success) redirect("/projects");
  let projectId = "";
  try {
    const { db, orgId, item } = await loadPunch(id.data);
    projectId = item.project_id;
    await purgeDocumentFiles(db, orgId, "punch_item_id", item.id);
    await db.from("punch_list_items").delete().eq("id", item.id).eq("organization_id", orgId);
    await syncPunchTasks(db, orgId, projectId);
  } catch (e) {
    console.error("deletePunchItem failed:", e);
  }
  if (projectId) refresh(projectId);
  redirect(projectId ? `/projects/${projectId}/punch` : "/projects");
}
