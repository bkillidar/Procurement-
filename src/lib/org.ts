import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEMPLATES, PHASE_NAMES } from "@/lib/templates/defaults";

/**
 * The one door to business data. Every page, query and action gets its database client from here,
 * and only after (1) a signed-in account and (2) a membership in the company. Rows are still scoped
 * by organization_id, so more companies or per-person roles can be added later without migrating data.
 * Cached per request so the checks run once.
 */
export const getContext = cache(async () => {
  const user = await getCurrentUser();
  if (!user) throw new Error("You are not signed in.");

  const db = createAdminClient();
  const { data: membership, error } = await db
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!membership) throw new Error("This account does not have access.");

  const { data: org, error: orgError } = await db
    .from("organizations")
    .select("id, name")
    .eq("id", membership.organization_id)
    .single();
  if (orgError) throw new Error(orgError.message);

  return { db, orgId: org.id as string, orgName: org.name as string, role: membership.role as string, user };
});

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
