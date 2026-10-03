import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATES, PHASE_NAMES } from "@/lib/templates/defaults";

// V1 is a single-company app with no login. Every row is still scoped by
// organization_id, so adding real users and more companies later needs no
// data migration. The company row is created on first use.
export async function getOrganization() {
  const db = createAdminClient();
  const { data: existing, error } = await db
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing;

  const { data: created, error: insertError } = await db
    .from("organizations")
    .insert({ name: "My Company" })
    .select("id, name")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created;
}

/** Database client + the company id every query/insert must be scoped to. */
export async function getContext() {
  const org = await getOrganization();
  return { db: createAdminClient(), orgId: org.id as string, orgName: org.name as string };
}

/** Copies the starter templates into the database the first time they are needed. */
export async function ensureDefaultTemplates() {
  const { db, orgId } = await getContext();
  const { count, error } = await db
    .from("project_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;

  for (const tpl of DEFAULT_TEMPLATES) {
    const { data: created, error: tErr } = await db
      .from("project_templates")
      .insert({
        organization_id: orgId,
        name: tpl.name,
        project_type: tpl.projectType,
        jurisdiction: tpl.jurisdiction,
        description: tpl.description,
      })
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);

    const { data: phases, error: pErr } = await db
      .from("template_phases")
      .insert(
        PHASE_NAMES.map((name, position) => ({
          organization_id: orgId,
          template_id: created.id,
          name,
          position,
        })),
      )
      .select("id, name");
    if (pErr) throw new Error(pErr.message);
    const phaseIdByName = new Map<string, string>(phases.map((p: { id: string; name: string }) => [p.name, p.id]));

    const { error: kErr } = await db.from("template_tasks").insert(
      tpl.tasks.map((task) => ({
        organization_id: orgId,
        template_id: created.id,
        template_phase_id: phaseIdByName.get(task.phase),
        key: task.key,
        title: task.title,
        description: task.description ?? null,
        default_priority: task.priority,
        offset_days: task.offsetDays,
        depends_on_keys: task.dependsOn,
      })),
    );
    if (kErr) throw new Error(kErr.message);
  }
}
