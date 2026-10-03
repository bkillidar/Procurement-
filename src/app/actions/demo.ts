"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDefaultTemplates, getContext } from "@/lib/org";
import { createProjectFromTemplate } from "@/lib/project-create";
import { syncProject } from "@/lib/project-sync";
import { logActivity } from "@/lib/activity";
import { addDays, todayISO } from "@/lib/dates";
import { recommendedOrderDate } from "@/lib/procurement";
import { standardPermitsFromTasks } from "@/lib/permits";
import { buildDemoProject, date, DEMO_ITEMS, DEMO_PROJECT_PREFIX, DEMO_VENDORS, DEMO_VENDOR_SUFFIX } from "@/lib/demo";

/** Creates a realistic sample project (DC renovation) with materials, permits and an issue. */
export async function loadDemoProject() {
  let target = "/projects";
  try {
    await ensureDefaultTemplates();
    const { db, orgId } = await getContext();
    const today = todayISO();

    const { data: existing } = await db
      .from("projects")
      .select("id")
      .eq("organization_id", orgId)
      .like("name", `${DEMO_PROJECT_PREFIX}%`)
      .limit(1)
      .maybeSingle();
    if (existing) redirect(`/projects/${existing.id}`);

    const { data: template } = await db
      .from("project_templates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", "Renovation — DC")
      .maybeSingle();

    const projectId = await createProjectFromTemplate(db, orgId, buildDemoProject(today), template?.id ?? null);
    try {
      // Vendors (marked "(demo)" so they are easy to spot and remove).
      const vendorId = new Map<string, string>();
      for (const v of DEMO_VENDORS) {
        const name = v.name + DEMO_VENDOR_SUFFIX;
        const { data: found } = await db.from("vendors").select("id").eq("organization_id", orgId).eq("name", name).maybeSingle();
        if (found) {
          vendorId.set(v.key, found.id);
          continue;
        }
        const { data: created, error } = await db
          .from("vendors")
          .insert({ organization_id: orgId, name, category: v.category, phone: v.phone, typical_lead_time_days: v.lead })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        vendorId.set(v.key, created.id);
      }

      // Early schedule tasks are done by now.
      await db
        .from("tasks")
        .update({ status: "complete", completed_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("project_id", projectId)
        .lte("due_date", addDays(today, -10));

      // Materials, with deliveries for what has arrived.
      for (const i of DEMO_ITEMS) {
        const received = i.received ?? 0;
        const { data: item, error } = await db
          .from("procurement_items")
          .insert({
            organization_id: orgId,
            project_id: projectId,
            category: i.category,
            description: i.description,
            quantity: i.quantity,
            unit: i.unit,
            required_on_site_date: date(today, i.required),
            estimated_lead_time_days: i.lead,
            target_order_date: recommendedOrderDate(date(today, i.required), i.lead),
            vendor_id: vendorId.get(i.vendor),
            status: i.status,
            actual_order_date: date(today, i.ordered),
            vendor_confirmed_at: i.confirmed === undefined ? null : `${date(today, i.confirmed)}T12:00:00Z`,
            expected_delivery_date: date(today, i.expected),
            actual_delivery_date: date(today, i.delivered),
            delivery_status: i.status === "delivered" ? "delivered" : i.status === "partially_delivered" ? "partial" : "pending",
            quantity_received: received,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);

        if (received > 0) {
          const { data: delivery } = await db
            .from("deliveries")
            .insert({
              organization_id: orgId,
              procurement_item_id: item.id,
              received_on: date(today, i.delivered ?? i.expected ?? -3),
              quantity_received: received,
              is_partial: received < i.quantity,
            })
            .select("id")
            .single();
          if (i.status === "partially_delivered" && delivery) {
            await db.from("issues").insert({
              organization_id: orgId,
              project_id: projectId,
              issue_type: "delivery",
              title: `${i.description}: partial delivery (${received} of ${i.quantity} received)`,
              description: `${i.quantity - received} ${i.unit} still outstanding.`,
              severity: "high",
              due_date: addDays(today, 1),
              procurement_item_id: item.id,
              delivery_id: delivery.id,
            });
          }
        }
        if (i.category === "Asphalt shingles") {
          await db.from("follow_ups").insert({
            organization_id: orgId,
            project_id: projectId,
            procurement_item_id: item.id,
            vendor_id: vendorId.get(i.vendor),
            method: "phone",
            result: "Said the truck would be here Tuesday",
            next_follow_up_on: addDays(today, -1),
            responsible_label: "Owner",
          });
        }
      }

      // Permits and utilities from the project's own tasks.
      const [{ data: tasks }, { data: phases }] = await Promise.all([
        db.from("tasks").select("id, title, phase_id").eq("organization_id", orgId).eq("project_id", projectId),
        db.from("project_phases").select("id, name").eq("organization_id", orgId).eq("project_id", projectId),
      ]);
      const phaseName = new Map<string, string>((phases ?? []).map((p) => [p.id, p.name]));
      const permits = standardPermitsFromTasks(
        (tasks ?? []).map((t) => ({ id: t.id, title: t.title, phaseName: t.phase_id ? (phaseName.get(t.phase_id) ?? null) : null })),
      );
      for (const p of permits) {
        const extra =
          p.item_type === "Building permit"
            ? { status: "under_review", submitted_on: addDays(today, -30), expected_response_date: addDays(today, -5), reference_number: "B2600412" }
            : p.item_type === "Gas cap-off"
              ? { status: "preparing" }
              : p.item_type === "Water cap-off"
                ? { status: "complete", approved_on: addDays(today, -8) }
                : { status: "not_started" };
        await db.from("permits_utilities").insert({ organization_id: orgId, project_id: projectId, ...p, ...extra });
        if (p.item_type === "Water cap-off") {
          await db.from("tasks").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", p.task_id).eq("organization_id", orgId);
        }
      }

      await syncProject(db, orgId, projectId);
      await logActivity(db, {
        orgId,
        projectId,
        entityType: "project",
        entityId: projectId,
        action: "demo_loaded",
        summary: "Demo project loaded",
      });
    } catch (e) {
      await db.from("projects").delete().eq("id", projectId).eq("organization_id", orgId);
      throw e;
    }
    target = `/projects/${projectId}`;
  } catch (e) {
    if (typeof e === "object" && e && "digest" in e) throw e; // redirect() from above
    redirect(`/projects?error=${encodeURIComponent(e instanceof Error ? e.message : "Could not load the demo project")}`);
  }
  revalidatePath("/projects");
  revalidatePath("/");
  redirect(target);
}
