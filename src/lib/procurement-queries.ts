import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/org";
import { todayISO } from "@/lib/dates";
import { assessRisk, followUpStatus, type RiskAssessment } from "@/lib/procurement";

export interface ItemRow {
  id: string;
  project_id: string;
  category: string;
  description: string;
  specification: string | null;
  quantity: number | null;
  unit: string | null;
  source_reference: string | null;
  required_on_site_date: string | null;
  estimated_lead_time_days: number | null;
  target_order_date: string | null;
  actual_order_date: string | null;
  vendor_id: string | null;
  quote_amount: number | null;
  final_cost: number | null;
  order_number: string | null;
  status: string;
  vendor_confirmed_at: string | null;
  vendor_confirmation_notes: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  delivery_status: string;
  quantity_received: number | null;
  notes: string | null;
  replaces_item_id: string | null;
}

export interface ItemView extends ItemRow {
  projectName: string;
  vendorName: string | null;
  risk: RiskAssessment;
  followUp: { state: "none" | "due" | "overdue"; message: string };
  lastFollowUpAt: string | null;
  nextFollowUpOn: string | null;
}

/** All procurement items with their computed risk and follow-up state. */
export async function loadItems(opts: { projectId?: string } = {}): Promise<{ today: string; items: ItemView[] }> {
  const { db, orgId } = await getContext();
  let itemQuery = db.from("procurement_items").select("*").eq("organization_id", orgId);
  if (opts.projectId) itemQuery = itemQuery.eq("project_id", opts.projectId);

  const [itemsRes, projRes, vendorRes, fuRes, depRes, taskRes] = await Promise.all([
    itemQuery,
    db.from("projects").select("id, name").eq("organization_id", orgId),
    db.from("vendors").select("id, name, typical_lead_time_days").eq("organization_id", orgId),
    db
      .from("follow_ups")
      .select("procurement_item_id, contacted_at, next_follow_up_on")
      .eq("organization_id", orgId)
      .not("procurement_item_id", "is", null)
      .order("contacted_at", { ascending: false }),
    db
      .from("task_dependencies")
      .select("task_id, depends_on_procurement_item_id")
      .eq("organization_id", orgId)
      .not("depends_on_procurement_item_id", "is", null),
    db.from("tasks").select("id, title, due_date, status").eq("organization_id", orgId),
  ]);
  for (const r of [itemsRes, projRes, vendorRes, fuRes, depRes, taskRes]) if (r.error) throw new Error(r.error.message);

  const today = todayISO();
  const projectName = new Map<string, string>((projRes.data ?? []).map((p) => [p.id, p.name]));
  const vendors = new Map<string, { name: string; lead: number | null }>(
    (vendorRes.data ?? []).map((v) => [v.id, { name: v.name, lead: v.typical_lead_time_days }]),
  );
  const taskById = new Map((taskRes.data ?? []).map((t) => [t.id, t]));

  // Latest follow-up per item (rows are newest first).
  const lastFollowUp = new Map<string, { at: string; next: string | null }>();
  for (const f of fuRes.data ?? []) {
    if (!lastFollowUp.has(f.procurement_item_id)) {
      lastFollowUp.set(f.procurement_item_id, { at: f.contacted_at, next: f.next_follow_up_on });
    }
  }

  const items: ItemView[] = ((itemsRes.data ?? []) as ItemRow[]).map((it) => {
    const dependentTasks = (depRes.data ?? [])
      .filter((d) => d.depends_on_procurement_item_id === it.id)
      .map((d) => taskById.get(d.task_id))
      .filter((t): t is NonNullable<typeof t> => !!t && t.status !== "complete")
      .map((t) => ({ title: t.title as string, due_date: t.due_date as string | null }));
    const fu = lastFollowUp.get(it.id);
    const vendor = it.vendor_id ? vendors.get(it.vendor_id) : undefined;
    const input = {
      description: it.description,
      status: it.status,
      required_on_site_date: it.required_on_site_date,
      estimated_lead_time_days: it.estimated_lead_time_days,
      vendor_lead_time_days: vendor?.lead ?? null,
      actual_order_date: it.actual_order_date,
      vendor_confirmed_at: it.vendor_confirmed_at,
      expected_delivery_date: it.expected_delivery_date,
      delivery_status: it.delivery_status,
      last_follow_up_at: fu?.at ?? null,
      next_follow_up_on: fu?.next ?? null,
      dependentTasks,
    };
    return {
      ...it,
      projectName: projectName.get(it.project_id) ?? "",
      vendorName: vendor?.name ?? null,
      risk: assessRisk(input, today),
      followUp: followUpStatus(input, today),
      lastFollowUpAt: fu?.at ?? null,
      nextFollowUpOn: fu?.next ?? null,
    };
  });
  return { today, items };
}

/** Portfolio-wide items, shared by everything rendered in one request. */
export const loadAllItems = cache(() => loadItems());
