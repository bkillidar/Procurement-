"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { logActivity } from "@/lib/activity";
import { syncProject } from "@/lib/project-sync";
import { addDays, daysBetween, formatDate, todayISO } from "@/lib/dates";
import { deliveryIssueTitle, evaluateDelivery } from "@/lib/delivery";
import { firstError, deliverySchema, replacementSchema } from "@/lib/validation";

const uuid = z.string().uuid();

function itemPage(itemId: string, error?: string, extra = ""): never {
  revalidatePath(`/procurement/${itemId}`);
  revalidatePath("/procurement");
  revalidatePath("/issues");
  revalidatePath("/");
  const q = error ? `?error=${encodeURIComponent(error)}` : "";
  redirect(`/procurement/${itemId}${q}${extra}`);
}

export async function receiveDelivery(formData: FormData) {
  const id = uuid.safeParse(formData.get("item_id"));
  if (!id.success) redirect("/procurement");
  const parsed = deliverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) itemPage(id.data, firstError(parsed.error));

  let anchor = "";
  let error: string | undefined;
  try {
    const d = parsed.data!;
    const { db, orgId } = await getContext();
    const { data: item, error: ie } = await db
      .from("procurement_items")
      .select("id, project_id, description, quantity, quantity_received, required_on_site_date, status")
      .eq("id", id.data)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (ie) throw new Error(ie.message);
    if (!item) throw new Error("Item not found");

    const today = todayISO();
    const outcome = evaluateDelivery({
      orderedQuantity: item.quantity === null ? null : Number(item.quantity),
      previouslyReceived: Number(item.quantity_received ?? 0),
      receivedNow: d.quantity_received,
      markedPartial: d.is_partial,
      damage: d.has_damage,
      missingItems: d.has_missing_items,
      incorrectItems: d.has_incorrect_items,
      needsReplacement: d.needs_replacement,
      daysToRequired: item.required_on_site_date ? daysBetween(today, item.required_on_site_date) : null,
    });

    const { data: delivery, error: de } = await db
      .from("deliveries")
      .insert({
        organization_id: orgId,
        procurement_item_id: item.id,
        received_on: d.received_on,
        quantity_received: outcome.quantityThisDelivery,
        is_partial: outcome.isPartial,
        has_damage: d.has_damage,
        has_missing_items: d.has_missing_items,
        has_incorrect_items: d.has_incorrect_items,
        needs_replacement: d.needs_replacement,
        notes: d.notes,
      })
      .select("id")
      .single();
    if (de) throw new Error(de.message);
    anchor = `#delivery-${delivery.id}`;

    const { error: ue } = await db
      .from("procurement_items")
      .update({
        quantity_received: outcome.totalReceived,
        status: outcome.itemStatus,
        delivery_status: outcome.deliveryStatus,
        actual_delivery_date: outcome.itemStatus === "delivered" ? d.received_on : null,
      })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (ue) throw new Error(ue.message);

    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "delivery_recorded",
      summary: `Received ${outcome.quantityThisDelivery ?? "?"} of ${item.description} on ${formatDate(d.received_on)}${outcome.problems.length ? ` (${outcome.problems.join(", ")})` : outcome.isPartial ? " (partial)" : ""}`,
    });

    if (outcome.createIssue && outcome.severity) {
      const dueDays = outcome.severity === "critical" ? 0 : outcome.severity === "high" ? 2 : 5;
      const detail = [
        outcome.problems.length ? `Problems: ${outcome.problems.join(", ")}.` : "",
        outcome.isPartial && item.quantity !== null
          ? `Received ${outcome.totalReceived} of ${item.quantity}; ${outcome.shortfall} still outstanding.`
          : "",
        d.notes ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      const { data: issue, error: ise } = await db
        .from("issues")
        .insert({
          organization_id: orgId,
          project_id: item.project_id,
          issue_type: "delivery",
          title: deliveryIssueTitle(item.description, outcome, item.quantity === null ? null : Number(item.quantity)),
          description: detail || null,
          severity: outcome.severity,
          due_date: addDays(today, dueDays),
          procurement_item_id: item.id,
          delivery_id: delivery.id,
        })
        .select("id")
        .single();
      if (ise) throw new Error(ise.message);
      await logActivity(db, {
        orgId,
        projectId: item.project_id,
        entityType: "issue",
        entityId: issue.id,
        action: "issue_opened",
        summary: `Issue opened: ${deliveryIssueTitle(item.description, outcome, item.quantity === null ? null : Number(item.quantity))}`,
      });
    } else if (outcome.itemStatus === "delivered") {
      // Clean, complete delivery: earlier partial/problem issues for this item are done.
      const { data: closed } = await db
        .from("issues")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution: `Resolved by delivery on ${formatDate(d.received_on)}`,
        })
        .eq("organization_id", orgId)
        .eq("procurement_item_id", item.id)
        .eq("issue_type", "delivery")
        .in("status", ["open", "in_progress", "waiting"])
        .select("id");
      if (closed?.length) {
        await logActivity(db, {
          orgId,
          projectId: item.project_id,
          entityType: "procurement_item",
          entityId: item.id,
          action: "issue_resolved",
          summary: `${closed.length} delivery issue${closed.length === 1 ? "" : "s"} for ${item.description} resolved by delivery`,
        });
      }
    }
    await syncProject(db, orgId, item.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not record the delivery";
  }
  itemPage(id.data, error, error ? "" : anchor);
}

export async function createReplacement(formData: FormData) {
  const id = uuid.safeParse(formData.get("item_id"));
  if (!id.success) redirect("/procurement");
  const parsed = replacementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) itemPage(id.data, firstError(parsed.error));

  let newId = "";
  let error: string | undefined;
  try {
    const { db, orgId } = await getContext();
    const { data: item } = await db
      .from("procurement_items")
      .select("*")
      .eq("id", id.data)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!item) throw new Error("Item not found");
    const { data: created, error: ce } = await db
      .from("procurement_items")
      .insert({
        organization_id: orgId,
        project_id: item.project_id,
        category: item.category,
        description: `Replacement: ${item.description}`,
        specification: item.specification,
        quantity: parsed.data!.quantity ?? item.quantity,
        unit: item.unit,
        source_reference: item.source_reference,
        required_on_site_date: item.required_on_site_date,
        estimated_lead_time_days: item.estimated_lead_time_days,
        vendor_id: item.vendor_id,
        replaces_item_id: item.id,
        status: "ready_to_order",
        notes: parsed.data!.notes,
      })
      .select("id")
      .single();
    if (ce) throw new Error(ce.message);
    newId = created.id;
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: newId,
      action: "replacement_created",
      summary: `Replacement order created for ${item.description}`,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not create the replacement";
  }
  if (error || !newId) itemPage(id.data, error);
  revalidatePath("/procurement");
  revalidatePath("/");
  redirect(`/procurement/${newId}`);
}
