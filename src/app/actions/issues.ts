"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { logActivity } from "@/lib/activity";
import { syncProject } from "@/lib/project-sync";
import { purgeDocumentFiles } from "@/lib/storage-cleanup";
import { statusAfterIssueResolved } from "@/lib/delivery";
import { firstError, issueSchema, issueUpdateSchema } from "@/lib/validation";

const uuid = z.string().uuid();
const OPEN = ["open", "in_progress", "waiting"];

function refresh(issueId?: string) {
  revalidatePath("/issues");
  revalidatePath("/procurement");
  revalidatePath("/");
  if (issueId) revalidatePath(`/issues/${issueId}`);
}

export async function createIssue(formData: FormData) {
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  const project = uuid.safeParse(formData.get("project_id"));
  const failTo = (m: string): never =>
    redirect(`/issues/new${project.success ? `?project=${project.data}&` : "?"}error=${encodeURIComponent(m)}`);
  if (!parsed.success) failTo(firstError(parsed.error));

  let issueId = "";
  try {
    const d = parsed.data!;
    const { db, orgId } = await getContext();
    const { data: proj } = await db.from("projects").select("id").eq("id", d.project_id).eq("organization_id", orgId).maybeSingle();
    if (!proj) throw new Error("Project not found");
    for (const [table, value] of [
      ["procurement_items", d.procurement_item_id],
      ["tasks", d.task_id],
    ] as const) {
      if (!value) continue;
      const { data } = await db.from(table).select("id").eq("id", value).eq("organization_id", orgId).eq("project_id", d.project_id).maybeSingle();
      if (!data) throw new Error("The linked item or task is not in this project");
    }
    const { data, error } = await db
      .from("issues")
      .insert({ ...d, organization_id: orgId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    issueId = data.id;
    await logActivity(db, {
      orgId,
      projectId: d.project_id,
      entityType: "issue",
      entityId: issueId,
      action: "issue_opened",
      summary: `Issue opened: ${d.title}`,
    });
  } catch (e) {
    failTo(e instanceof Error ? e.message : "Could not create the issue");
  }
  refresh();
  redirect(`/issues/${issueId}`);
}

export async function updateIssue(formData: FormData) {
  const id = uuid.safeParse(formData.get("issue_id"));
  if (!id.success) redirect("/issues");
  const back = (error?: string): never => {
    refresh(id.data);
    redirect(`/issues/${id.data}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
  };
  const parsed = issueUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(firstError(parsed.error));

  let error: string | undefined;
  try {
    const d = parsed.data!;
    const { db, orgId } = await getContext();
    const { data: issue } = await db
      .from("issues")
      .select("id, project_id, title, status, issue_type, procurement_item_id")
      .eq("id", d.issue_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!issue) throw new Error("Issue not found");

    const closing = d.status === "resolved" || d.status === "closed";
    const { issue_id, ...fields } = d;
    void issue_id;
    const { error: ue } = await db
      .from("issues")
      .update({ ...fields, resolved_at: closing ? new Date().toISOString() : null })
      .eq("id", issue.id)
      .eq("organization_id", orgId);
    if (ue) throw new Error(ue.message);

    if (d.status !== issue.status) {
      await logActivity(db, {
        orgId,
        projectId: issue.project_id,
        entityType: "issue",
        entityId: issue.id,
        action: closing ? "issue_resolved" : "issue_status_changed",
        summary: `Issue ${closing ? "resolved" : "updated"}: ${issue.title} (${issue.status.replace("_", " ")} → ${d.status.replace("_", " ")})`,
      });
    }

    // A delivery issue controls its item's "Problem" status.
    if (issue.procurement_item_id && issue.issue_type === "delivery") {
      const { data: item } = await db
        .from("procurement_items")
        .select("id, status, quantity, quantity_received")
        .eq("id", issue.procurement_item_id)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (item) {
        const { count } = await db
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("procurement_item_id", item.id)
          .eq("issue_type", "delivery")
          .in("status", OPEN);
        const nextStatus =
          !closing && ["delivered", "partially_delivered"].includes(item.status)
            ? "problem"
            : item.status === "problem"
              ? statusAfterIssueResolved({
                  orderedQuantity: item.quantity === null ? null : Number(item.quantity),
                  totalReceived: Number(item.quantity_received ?? 0),
                  openProblemIssues: count ?? 0,
                })
              : item.status;
        if (nextStatus !== item.status) {
          await db
            .from("procurement_items")
            .update({
              status: nextStatus,
              delivery_status: nextStatus === "problem" ? "problem" : nextStatus === "delivered" ? "delivered" : "partial",
            })
            .eq("id", item.id)
            .eq("organization_id", orgId);
          await syncProject(db, orgId, issue.project_id);
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not save the issue";
  }
  back(error);
}

export async function deleteIssue(formData: FormData) {
  const id = uuid.safeParse(formData.get("issue_id"));
  if (!id.success) redirect("/issues");
  try {
    const { db, orgId } = await getContext();
    await purgeDocumentFiles(db, orgId, "issue_id", id.data);
    await db.from("issues").delete().eq("id", id.data).eq("organization_id", orgId);
  } catch (e) {
    console.error("deleteIssue failed:", e);
  }
  refresh();
  redirect("/issues");
}
