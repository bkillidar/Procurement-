"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getContext } from "@/lib/org";
import { logActivity } from "@/lib/activity";
import { syncProject } from "@/lib/project-sync";
import { purgeDocumentFiles } from "@/lib/storage-cleanup";
import { formatDate } from "@/lib/dates";
import {
  ITEM_STATUSES,
  ITEM_STATUS_LABELS,
  isPreOrder,
  recommendedOrderDate,
  UNCONFIRMED,
  type ItemStatus,
} from "@/lib/procurement";
import {
  confirmationSchema,
  firstError,
  followUpSchema,
  orderSchema,
  procurementItemSchema,
  quoteSchema,
} from "@/lib/validation";

const uuid = z.string().uuid();

interface Ctx {
  db: SupabaseClient;
  orgId: string;
  item: {
    id: string;
    project_id: string;
    description: string;
    status: string;
    vendor_id: string | null;
    required_on_site_date: string | null;
    estimated_lead_time_days: number | null;
    expected_delivery_date: string | null;
  };
}

async function loadItem(itemId: string): Promise<Ctx> {
  const { db, orgId } = await getContext();
  const { data, error } = await db
    .from("procurement_items")
    .select("id, project_id, description, status, vendor_id, required_on_site_date, estimated_lead_time_days, expected_delivery_date")
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Item not found");
  return { db, orgId, item: data };
}

function finish(itemId: string, projectId: string, error?: string): never {
  revalidatePath(`/procurement/${itemId}`);
  revalidatePath("/procurement");
  revalidatePath("/");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  redirect(error ? `/procurement/${itemId}?error=${encodeURIComponent(error)}` : `/procurement/${itemId}`);
}

/** Runs one item action with shared id parsing, error handling and redirect. */
async function act(formData: FormData, fn: (c: Ctx) => Promise<void>): Promise<never> {
  const id = uuid.safeParse(formData.get("item_id"));
  if (!id.success) redirect("/procurement");
  let projectId = "";
  let error: string | undefined;
  try {
    const ctx = await loadItem(id.data);
    projectId = ctx.item.project_id;
    await fn(ctx);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong";
  }
  return finish(id.data, projectId, error);
}

/** Item lead time, falling back to the chosen vendor's typical lead time. */
async function resolveLead(db: SupabaseClient, orgId: string, vendorId: string | null, lead: number | null) {
  if (lead !== null || !vendorId) return lead;
  const { data } = await db
    .from("vendors")
    .select("typical_lead_time_days")
    .eq("id", vendorId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return data?.typical_lead_time_days ?? null;
}

async function vendorName(db: SupabaseClient, orgId: string, id: string | null) {
  if (!id) return null;
  const { data } = await db.from("vendors").select("name").eq("id", id).eq("organization_id", orgId).maybeSingle();
  return data?.name ?? null;
}

async function assertVendor(db: SupabaseClient, orgId: string, id: string | null) {
  if (id && !(await vendorName(db, orgId, id))) throw new Error("Vendor not found");
}

export async function createItem(formData: FormData) {
  const parsed = procurementItemSchema.safeParse(Object.fromEntries(formData));
  const project = uuid.safeParse(formData.get("project_id"));
  if (!project.success) redirect("/procurement");
  const failTo = (m: string): never =>
    redirect(`/procurement/new?project=${project.data}&error=${encodeURIComponent(m)}`);
  if (!parsed.success) failTo(firstError(parsed.error));

  let itemId = "";
  try {
    const { db, orgId } = await getContext();
    const { data: proj } = await db
      .from("projects")
      .select("id")
      .eq("id", parsed.data!.project_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!proj) throw new Error("Project not found");
    await assertVendor(db, orgId, parsed.data!.vendor_id);
    const lead = await resolveLead(db, orgId, parsed.data!.vendor_id, parsed.data!.estimated_lead_time_days);
    const { data, error } = await db
      .from("procurement_items")
      .insert({
        ...parsed.data,
        estimated_lead_time_days: lead,
        target_order_date: recommendedOrderDate(parsed.data!.required_on_site_date, lead),
        status: parsed.data!.specification ? "ready_for_quote" : "needs_specification",
        organization_id: orgId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    itemId = data.id;
    await logActivity(db, {
      orgId,
      projectId: parsed.data!.project_id,
      entityType: "procurement_item",
      entityId: itemId,
      action: "item_created",
      summary: `Added procurement item: ${parsed.data!.description}`,
    });
  } catch (e) {
    failTo(e instanceof Error ? e.message : "Could not add the item");
  }
  revalidatePath("/procurement");
  revalidatePath("/");
  redirect(`/procurement/${itemId}`);
}

export async function updateItem(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const parsed = procurementItemSchema.omit({ project_id: true }).safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    await assertVendor(db, orgId, parsed.data.vendor_id);
    const lead = await resolveLead(db, orgId, parsed.data.vendor_id, parsed.data.estimated_lead_time_days);
    const { error } = await db
      .from("procurement_items")
      .update({
        ...parsed.data,
        estimated_lead_time_days: lead,
        target_order_date: recommendedOrderDate(parsed.data.required_on_site_date, lead),
      })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);

    if (parsed.data.vendor_id !== item.vendor_id) {
      const [from, to] = await Promise.all([vendorName(db, orgId, item.vendor_id), vendorName(db, orgId, parsed.data.vendor_id)]);
      await logActivity(db, {
        orgId,
        projectId: item.project_id,
        entityType: "procurement_item",
        entityId: item.id,
        action: "vendor_changed",
        summary: `Vendor for ${item.description} changed from ${from ?? "none"} to ${to ?? "none"}`,
      });
    }
    if (parsed.data.required_on_site_date !== item.required_on_site_date) {
      await logActivity(db, {
        orgId,
        projectId: item.project_id,
        entityType: "procurement_item",
        entityId: item.id,
        action: "required_date_changed",
        summary: `Required-on-site date for ${item.description} changed to ${formatDate(parsed.data.required_on_site_date)}`,
      });
    }
  });
}

export async function setItemStatus(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const status = z.enum(ITEM_STATUSES as [string, ...string[]]).safeParse(formData.get("status"));
    if (!status.success) throw new Error("Choose a status");
    const { error } = await db
      .from("procurement_items")
      .update({ status: status.data })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "status_changed",
      summary: `${item.description}: ${ITEM_STATUS_LABELS[item.status as ItemStatus]} → ${ITEM_STATUS_LABELS[status.data as ItemStatus]}`,
    });
    await syncProject(db, orgId, item.project_id);
  });
}

export async function addQuote(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    if (!parsed.data.vendor_id && parsed.data.amount === null) throw new Error("Enter a vendor or an amount");
    await assertVendor(db, orgId, parsed.data.vendor_id);
    const { item_id, ...fields } = parsed.data;
    void item_id;
    const { error } = await db
      .from("procurement_quotes")
      .insert({ ...fields, procurement_item_id: item.id, organization_id: orgId });
    if (error) throw new Error(error.message);
    if (item.status === "ready_for_quote" || item.status === "needs_specification") {
      await db.from("procurement_items").update({ status: "quoting" }).eq("id", item.id).eq("organization_id", orgId);
    }
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "quote_added",
      summary: `Quote added for ${item.description}`,
    });
  });
}

export async function selectQuote(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const quoteId = uuid.safeParse(formData.get("quote_id"));
    if (!quoteId.success) throw new Error("Quote not found");
    const { data: quote } = await db
      .from("procurement_quotes")
      .select("*")
      .eq("id", quoteId.data)
      .eq("procurement_item_id", item.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!quote) throw new Error("Quote not found");

    await db.from("procurement_quotes").update({ is_selected: false }).eq("procurement_item_id", item.id).eq("organization_id", orgId);
    await db.from("procurement_quotes").update({ is_selected: true }).eq("id", quote.id).eq("organization_id", orgId);

    const lead = await resolveLead(db, orgId, quote.vendor_id, quote.lead_time_days ?? item.estimated_lead_time_days);
    const { error } = await db
      .from("procurement_items")
      .update({
        vendor_id: quote.vendor_id,
        quote_amount: quote.amount,
        estimated_lead_time_days: lead,
        target_order_date: recommendedOrderDate(item.required_on_site_date, lead),
        ...(isPreOrder(item.status) ? { status: "ready_to_order" } : {}),
      })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    const name = await vendorName(db, orgId, quote.vendor_id);
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "vendor_selected",
      summary: `Selected ${name ?? "a vendor"} for ${item.description}`,
    });
  });
}

export async function deleteQuote(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const quoteId = uuid.safeParse(formData.get("quote_id"));
    if (!quoteId.success) throw new Error("Quote not found");
    const { error } = await db
      .from("procurement_quotes")
      .delete()
      .eq("id", quoteId.data)
      .eq("procurement_item_id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
  });
}

export async function placeOrder(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const parsed = orderSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    const vendorId = parsed.data.vendor_id ?? item.vendor_id;
    if (!vendorId) throw new Error("Choose the vendor this was ordered from");
    await assertVendor(db, orgId, vendorId);
    if (!isPreOrder(item.status) && !UNCONFIRMED.includes(item.status as ItemStatus)) {
      throw new Error("This item has already been ordered and confirmed");
    }
    const lead = await resolveLead(db, orgId, vendorId, item.estimated_lead_time_days);
    const { error } = await db
      .from("procurement_items")
      .update({
        vendor_id: vendorId,
        actual_order_date: parsed.data.actual_order_date,
        order_number: parsed.data.order_number,
        final_cost: parsed.data.final_cost,
        expected_delivery_date: parsed.data.expected_delivery_date ?? item.expected_delivery_date,
        estimated_lead_time_days: lead,
        status: "awaiting_vendor_confirmation",
      })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    const name = await vendorName(db, orgId, vendorId);
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "order_placed",
      summary: `Ordered ${item.description} from ${name ?? "vendor"}${parsed.data.order_number ? ` (PO ${parsed.data.order_number})` : ""}`,
    });
    await syncProject(db, orgId, item.project_id);
  });
}

export async function confirmOrder(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const parsed = confirmationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    const nextStatus: ItemStatus = UNCONFIRMED.includes(item.status as ItemStatus) ? "confirmed" : (item.status as ItemStatus);
    const { error } = await db
      .from("procurement_items")
      .update({
        vendor_confirmed_at: `${parsed.data.confirmed_on}T12:00:00Z`,
        vendor_confirmation_notes: parsed.data.notes,
        expected_delivery_date: parsed.data.expected_delivery_date ?? item.expected_delivery_date,
        status: nextStatus,
      })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "vendor_confirmed",
      summary: `Vendor confirmed ${item.description}${parsed.data.expected_delivery_date ? `, expected ${formatDate(parsed.data.expected_delivery_date)}` : ""}`,
    });
  });
}

export async function setExpectedDelivery(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const parsed = z
      .object({ expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date") })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    if (parsed.data.expected_delivery_date === item.expected_delivery_date) return;
    const { error } = await db
      .from("procurement_items")
      .update({ expected_delivery_date: parsed.data.expected_delivery_date })
      .eq("id", item.id)
      .eq("organization_id", orgId);
    if (error) throw new Error(error.message);
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "expected_delivery_changed",
      summary: `Expected delivery for ${item.description} changed from ${formatDate(item.expected_delivery_date)} to ${formatDate(parsed.data.expected_delivery_date)}`,
      metadata: { from: item.expected_delivery_date, to: parsed.data.expected_delivery_date },
    });
  });
}

export async function addFollowUp(formData: FormData) {
  await act(formData, async ({ db, orgId, item }) => {
    const parsed = followUpSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) throw new Error(firstError(parsed.error));
    const { item_id, ...fields } = parsed.data;
    void item_id;
    const { data: full } = await db
      .from("procurement_items")
      .select("vendor_id")
      .eq("id", item.id)
      .eq("organization_id", orgId)
      .single();
    const { error } = await db.from("follow_ups").insert({
      ...fields,
      organization_id: orgId,
      project_id: item.project_id,
      procurement_item_id: item.id,
      vendor_id: full?.vendor_id ?? null,
    });
    if (error) throw new Error(error.message);
    await logActivity(db, {
      orgId,
      projectId: item.project_id,
      entityType: "procurement_item",
      entityId: item.id,
      action: "follow_up_logged",
      summary: `Vendor follow-up on ${item.description} (${parsed.data.method})${parsed.data.result ? `: ${parsed.data.result}` : ""}`,
    });
  });
}

export async function deleteItem(formData: FormData) {
  const id = uuid.safeParse(formData.get("item_id"));
  if (!id.success) redirect("/procurement");
  let error: string | undefined;
  let projectId = "";
  try {
    const { db, orgId, item } = await loadItem(id.data);
    projectId = item.project_id;
    await purgeDocumentFiles(db, orgId, "procurement_item_id", item.id);
    const { error: e } = await db.from("procurement_items").delete().eq("id", item.id).eq("organization_id", orgId);
    if (e) throw new Error(e.message);
    await logActivity(db, {
      orgId,
      projectId,
      entityType: "procurement_item",
      entityId: null,
      action: "item_deleted",
      summary: `Deleted procurement item: ${item.description}`,
    });
    await syncProject(db, orgId, projectId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not delete";
  }
  if (error) finish(id.data, projectId, error);
  revalidatePath("/procurement");
  revalidatePath("/");
  redirect("/procurement");
}
