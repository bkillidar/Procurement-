"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getContext } from "@/lib/org";
import { logActivity } from "@/lib/activity";
import { syncProject } from "@/lib/project-sync";
import { purgeDocumentFiles } from "@/lib/storage-cleanup";
import { formatDate, todayISO } from "@/lib/dates";
import {
  PERMIT_STATUS_LABELS,
  permitCompletesTask,
  standardPermitsFromTasks,
  type PermitStatus,
} from "@/lib/permits";
import { firstError, permitFollowUpSchema, permitSchema, PERMIT_STATUS_VALUES } from "@/lib/validation";

const uuid = z.string().uuid();

function refresh(permitId?: string, projectId?: string) {
  revalidatePath("/permits");
  revalidatePath("/");
  if (permitId) revalidatePath(`/permits/${permitId}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

interface PermitCtx {
  db: SupabaseClient;
  orgId: string;
  permit: {
    id: string;
    project_id: string;
    item_type: string;
    status: string;
    task_id: string | null;
    submitted_on: string | null;
    approved_on: string | null;
  };
}

async function loadPermit(id: string): Promise<PermitCtx> {
  const { db, orgId } = await getContext();
  const { data, error } = await db
    .from("permits_utilities")
    .select("id, project_id, item_type, status, task_id, submitted_on, approved_on")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Permit not found");
  return { db, orgId, permit: data };
}

/** Dates implied by a status change, without overwriting dates the user already entered. */
function impliedDates(
  status: string,
  current: { submitted_on: string | null; approved_on: string | null },
  entered: { submitted_on: string | null; approved_on: string | null },
) {
  const today = todayISO();
  const submitted = entered.submitted_on ?? current.submitted_on;
  const approved = entered.approved_on ?? current.approved_on;
  return {
    submitted_on: submitted ?? (["submitted", "under_review", "additional_info_required"].includes(status) ? today : submitted),
    approved_on: approved ?? (["approved", "scheduled", "complete"].includes(status) ? today : approved),
  };
}

/** A permit that finishes completes its schedule task; one that regresses reopens it. */
async function syncLinkedTask(ctx: PermitCtx, newStatus: string) {
  const { db, orgId, permit } = ctx;
  if (!permit.task_id) return;
  const done = permitCompletesTask(permit.item_type, newStatus);
  const wasDone = permitCompletesTask(permit.item_type, permit.status);
  if (done && !wasDone) {
    await db
      .from("tasks")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", permit.task_id)
      .eq("organization_id", orgId)
      .neq("status", "complete");
  } else if (!done && wasDone) {
    await db
      .from("tasks")
      .update({ status: "waiting", completed_at: null })
      .eq("id", permit.task_id)
      .eq("organization_id", orgId)
      .eq("status", "complete");
  } else {
    return;
  }
  await syncProject(db, orgId, permit.project_id);
}

async function checkLinks(db: SupabaseClient, orgId: string, projectId: string, taskId: string | null, contactId: string | null) {
  if (taskId) {
    const { data } = await db.from("tasks").select("id").eq("id", taskId).eq("organization_id", orgId).eq("project_id", projectId).maybeSingle();
    if (!data) throw new Error("That task is not in this project");
  }
  if (contactId) {
    const { data } = await db.from("contacts").select("id").eq("id", contactId).eq("organization_id", orgId).maybeSingle();
    if (!data) throw new Error("Contact not found");
  }
}

export async function createPermit(formData: FormData) {
  const parsed = permitSchema.safeParse(Object.fromEntries(formData));
  const project = uuid.safeParse(formData.get("project_id"));
  const failTo = (m: string): never =>
    redirect(`/permits/new${project.success ? `?project=${project.data}&` : "?"}error=${encodeURIComponent(m)}`);
  if (!parsed.success) failTo(firstError(parsed.error));

  let id = "";
  try {
    const d = parsed.data!;
    const { db, orgId } = await getContext();
    const { data: proj } = await db.from("projects").select("id").eq("id", d.project_id).eq("organization_id", orgId).maybeSingle();
    if (!proj) throw new Error("Project not found");
    await checkLinks(db, orgId, d.project_id, d.task_id, d.contact_id);
    const dates = impliedDates(d.status, { submitted_on: null, approved_on: null }, d);
    const { data, error } = await db
      .from("permits_utilities")
      .insert({ ...d, ...dates, organization_id: orgId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    id = data.id;
    await logActivity(db, {
      orgId,
      projectId: d.project_id,
      entityType: "permit",
      entityId: id,
      action: "permit_created",
      summary: `Added ${d.item_type}${d.agency ? ` (${d.agency})` : ""}`,
    });
    if (d.status !== "not_started") {
      await syncLinkedTask({ db, orgId, permit: { id, project_id: d.project_id, item_type: d.item_type, status: "not_started", task_id: d.task_id, submitted_on: null, approved_on: null } }, d.status);
    }
  } catch (e) {
    failTo(e instanceof Error ? e.message : "Could not add the item");
  }
  refresh(undefined, parsed.data!.project_id);
  redirect(`/permits/${id}`);
}

export async function updatePermit(formData: FormData) {
  const id = uuid.safeParse(formData.get("permit_id"));
  if (!id.success) redirect("/permits");
  const back = (error?: string): never => {
    refresh(id.data);
    redirect(`/permits/${id.data}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
  };
  const parsed = permitSchema.omit({ project_id: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(firstError(parsed.error));

  let error: string | undefined;
  try {
    const d = parsed.data!;
    const ctx = await loadPermit(id.data);
    await checkLinks(ctx.db, ctx.orgId, ctx.permit.project_id, d.task_id, d.contact_id);
    const dates = impliedDates(d.status, ctx.permit, d);
    const { error: ue } = await ctx.db
      .from("permits_utilities")
      .update({ ...d, ...dates })
      .eq("id", ctx.permit.id)
      .eq("organization_id", ctx.orgId);
    if (ue) throw new Error(ue.message);
    if (d.status !== ctx.permit.status) {
      await logActivity(ctx.db, {
        orgId: ctx.orgId,
        projectId: ctx.permit.project_id,
        entityType: "permit",
        entityId: ctx.permit.id,
        action: "permit_status_changed",
        summary: `${d.item_type}: ${PERMIT_STATUS_LABELS[ctx.permit.status as PermitStatus]} → ${PERMIT_STATUS_LABELS[d.status as PermitStatus]}`,
      });
    }
    await syncLinkedTask({ ...ctx, permit: { ...ctx.permit, item_type: d.item_type, task_id: d.task_id } }, d.status);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not save";
  }
  back(error);
}

export async function setPermitStatus(formData: FormData) {
  const id = uuid.safeParse(formData.get("permit_id"));
  const status = z.enum(PERMIT_STATUS_VALUES).safeParse(formData.get("status"));
  if (!id.success) redirect("/permits");
  let projectId = "";
  let error: string | undefined;
  const apply = async () => {
    if (!status.success) throw new Error("Choose a status");
    const ctx = await loadPermit(id.data);
    projectId = ctx.permit.project_id;
    if (status.data === ctx.permit.status) return;
    const dates = impliedDates(status.data, ctx.permit, { submitted_on: null, approved_on: null });
    const { error: ue } = await ctx.db
      .from("permits_utilities")
      .update({ status: status.data, ...dates })
      .eq("id", ctx.permit.id)
      .eq("organization_id", ctx.orgId);
    if (ue) throw new Error(ue.message);
    await logActivity(ctx.db, {
      orgId: ctx.orgId,
      projectId,
      entityType: "permit",
      entityId: ctx.permit.id,
      action: "permit_status_changed",
      summary: `${ctx.permit.item_type}: ${PERMIT_STATUS_LABELS[ctx.permit.status as PermitStatus]} → ${PERMIT_STATUS_LABELS[status.data as PermitStatus]}`,
    });
    await syncLinkedTask(ctx, status.data);
  };
  try {
    await apply();
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not update the status";
  }
  refresh(id.data, projectId);
  redirect(`/permits/${id.data}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export async function addPermitFollowUp(formData: FormData) {
  const id = uuid.safeParse(formData.get("permit_id"));
  if (!id.success) redirect("/permits");
  const back = (error?: string): never => {
    refresh(id.data);
    redirect(`/permits/${id.data}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
  };
  const parsed = permitFollowUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(firstError(parsed.error));

  let error: string | undefined;
  try {
    const d = parsed.data!;
    const ctx = await loadPermit(id.data);
    const { permit_id, ...fields } = d;
    void permit_id;
    const { error: fe } = await ctx.db.from("follow_ups").insert({
      ...fields,
      organization_id: ctx.orgId,
      project_id: ctx.permit.project_id,
      permit_id: ctx.permit.id,
    });
    if (fe) throw new Error(fe.message);
    const { error: ue } = await ctx.db
      .from("permits_utilities")
      .update({ last_follow_up_on: todayISO(), next_follow_up_on: d.next_follow_up_on })
      .eq("id", ctx.permit.id)
      .eq("organization_id", ctx.orgId);
    if (ue) throw new Error(ue.message);
    await logActivity(ctx.db, {
      orgId: ctx.orgId,
      projectId: ctx.permit.project_id,
      entityType: "permit",
      entityId: ctx.permit.id,
      action: "follow_up_logged",
      summary: `Follow-up on ${ctx.permit.item_type} (${d.method})${d.result ? `: ${d.result}` : ""}${d.next_follow_up_on ? `. Next: ${formatDate(d.next_follow_up_on)}` : ""}`,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not log the follow-up";
  }
  back(error);
}

export async function deletePermit(formData: FormData) {
  const id = uuid.safeParse(formData.get("permit_id"));
  if (!id.success) redirect("/permits");
  let projectId = "";
  try {
    const ctx = await loadPermit(id.data);
    projectId = ctx.permit.project_id;
    await purgeDocumentFiles(ctx.db, ctx.orgId, "permit_id", ctx.permit.id);
    await ctx.db.from("permits_utilities").delete().eq("id", ctx.permit.id).eq("organization_id", ctx.orgId);
    await logActivity(ctx.db, {
      orgId: ctx.orgId,
      projectId,
      entityType: "permit",
      entityId: null,
      action: "permit_deleted",
      summary: `Deleted ${ctx.permit.item_type}`,
    });
  } catch (e) {
    console.error("deletePermit failed:", e);
  }
  refresh(undefined, projectId);
  redirect("/permits");
}

/** Creates permit/utility items from the project's Utilities tasks and its building permit task. */
export async function addStandardPermits(formData: FormData) {
  const projectId = uuid.safeParse(formData.get("project_id"));
  if (!projectId.success) redirect("/projects");
  let error: string | undefined;
  try {
    const { db, orgId } = await getContext();
    const [{ data: tasks }, { data: phases }, { data: existing }] = await Promise.all([
      db.from("tasks").select("id, title, phase_id").eq("organization_id", orgId).eq("project_id", projectId.data),
      db.from("project_phases").select("id, name").eq("organization_id", orgId).eq("project_id", projectId.data),
      db.from("permits_utilities").select("task_id").eq("organization_id", orgId).eq("project_id", projectId.data),
    ]);
    const phaseName = new Map<string, string>((phases ?? []).map((p) => [p.id, p.name]));
    const linked = new Set((existing ?? []).map((e) => e.task_id).filter(Boolean));
    const items = standardPermitsFromTasks(
      (tasks ?? []).map((t) => ({ id: t.id, title: t.title, phaseName: t.phase_id ? (phaseName.get(t.phase_id) ?? null) : null })),
    ).filter((i) => !linked.has(i.task_id));
    if (items.length === 0) throw new Error("No standard permit or utility tasks found to add");
    const { error: ie } = await db
      .from("permits_utilities")
      .insert(items.map((i) => ({ ...i, organization_id: orgId, project_id: projectId.data, status: "not_started" })));
    if (ie) throw new Error(ie.message);
    await logActivity(db, {
      orgId,
      projectId: projectId.data,
      entityType: "permit",
      entityId: null,
      action: "permits_added",
      summary: `Added ${items.length} standard permit/utility items`,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not add the items";
  }
  refresh(undefined, projectId.data);
  redirect(error ? `/projects/${projectId.data}?error=${encodeURIComponent(error)}` : `/projects/${projectId.data}`);
}
