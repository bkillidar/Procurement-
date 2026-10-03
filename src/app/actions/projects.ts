"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDefaultTemplates, getContext } from "@/lib/org";
import { syncProject } from "@/lib/project-sync";
import { logActivity } from "@/lib/activity";
import { buildProjectPlan, type Priority, type TemplateDef } from "@/lib/templates/plan";
import { PHASE_NAMES } from "@/lib/templates/defaults";
import { firstError, projectSchema } from "@/lib/validation";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createProject(formData: FormData) {
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/projects/new", firstError(parsed.error));
  const { template_id, ...fields } = parsed.data;

  let projectId: string;
  try {
    await ensureDefaultTemplates();
    const { db, orgId } = await getContext();

    // Load the chosen template (or fall back to the standard phases with no tasks).
    let def: TemplateDef = { phases: PHASE_NAMES.map((name, position) => ({ name, position })), tasks: [] };
    if (template_id) {
      const [{ data: phases, error: pe }, { data: tasks, error: te }] = await Promise.all([
        db.from("template_phases").select("id, name, position").eq("organization_id", orgId).eq("template_id", template_id),
        db.from("template_tasks").select("*").eq("organization_id", orgId).eq("template_id", template_id),
      ]);
      if (pe) throw new Error(pe.message);
      if (te) throw new Error(te.message);
      if (!phases?.length) throw new Error("That template was not found");
      const phaseName = new Map<string, string>(phases.map((p) => [p.id, p.name]));
      def = {
        phases: phases.map((p) => ({ name: p.name, position: p.position })),
        tasks: (tasks ?? []).map((t) => ({
          key: t.key,
          phase: phaseName.get(t.template_phase_id) ?? phases[0].name,
          title: t.title,
          description: t.description,
          priority: t.default_priority as Priority,
          offsetDays: t.offset_days,
          dependsOn: t.depends_on_keys ?? [],
        })),
      };
    }
    const plan = buildProjectPlan(def, fields.start_date);

    const { data: project, error: projErr } = await db
      .from("projects")
      .insert({ ...fields, organization_id: orgId, status: "active" })
      .select("id")
      .single();
    if (projErr) throw new Error(projErr.message);
    projectId = project.id;

    try {
      const { data: phaseRows, error: phErr } = await db
        .from("project_phases")
        .insert(
          plan.phases.map((p) => ({
            organization_id: orgId,
            project_id: projectId,
            name: p.name,
            position: p.position,
            due_date: p.dueDate,
          })),
        )
        .select("id, name");
      if (phErr) throw new Error(phErr.message);
      const phaseId = new Map<string, string>(phaseRows.map((p) => [p.name, p.id]));

      if (plan.tasks.length) {
        // Generate ids here so dependency rows never rely on result ordering.
        const idByKey = new Map<string, string>(plan.tasks.map((t) => [t.key, randomUUID()]));
        const { error: tkErr } = await db
          .from("tasks")
          .insert(
            plan.tasks.map((t) => ({
              id: idByKey.get(t.key)!,
              organization_id: orgId,
              project_id: projectId,
              phase_id: phaseId.get(t.phase) ?? null,
              title: t.title,
              description: t.description,
              due_date: t.dueDate,
              status: t.status,
              priority: t.priority,
            })),
          );
        if (tkErr) throw new Error(tkErr.message);

        const depRows = plan.tasks.flatMap((t) =>
          t.dependsOn.map((dep) => ({
            organization_id: orgId,
            task_id: idByKey.get(t.key)!,
            depends_on_task_id: idByKey.get(dep)!,
          })),
        );
        if (depRows.length) {
          const { error: dpErr } = await db.from("task_dependencies").insert(depRows);
          if (dpErr) throw new Error(dpErr.message);
        }
      }
      await syncProject(db, orgId, projectId);
      await logActivity(db, {
        orgId,
        projectId,
        entityType: "project",
        entityId: projectId,
        action: "project_created",
        summary: `Project created: ${fields.name}${template_id ? " from a template" : ""}`,
      });
    } catch (e) {
      // Don't leave a half-built project behind (children cascade).
      await db.from("projects").delete().eq("id", projectId).eq("organization_id", orgId);
      throw e;
    }
  } catch (e) {
    fail("/projects/new", e instanceof Error ? e.message : "Could not create the project");
  }

  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${projectId}`);
}
