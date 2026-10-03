"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureDefaultTemplates, getContext } from "@/lib/org";
import { createProjectFromTemplate } from "@/lib/project-create";
import { purgeDocumentFiles } from "@/lib/storage-cleanup";
import { firstError, projectSchema } from "@/lib/validation";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createProject(formData: FormData) {
  const parsed = projectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail("/projects/new", firstError(parsed.error));
  const { template_id, ...fields } = parsed.data;

  let projectId = "";
  try {
    await ensureDefaultTemplates();
    const { db, orgId } = await getContext();
    projectId = await createProjectFromTemplate(db, orgId, fields, template_id);
  } catch (e) {
    fail("/projects/new", e instanceof Error ? e.message : "Could not create the project");
  }

  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${projectId}`);
}

/** Permanently deletes a project and everything in it. The project name must be typed to confirm. */
export async function deleteProject(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("project_id"));
  if (!id.success) redirect("/projects");
  const typed = typeof formData.get("confirm_name") === "string" ? String(formData.get("confirm_name")).trim() : "";
  let error: string | undefined;
  try {
    const { db, orgId } = await getContext();
    const { data: project } = await db.from("projects").select("id, name").eq("id", id.data).eq("organization_id", orgId).maybeSingle();
    if (!project) throw new Error("Project not found");
    if (typed !== project.name) throw new Error("The name you typed does not match, so nothing was deleted.");
    await purgeDocumentFiles(db, orgId, "project_id", project.id);
    const { error: de } = await db.from("projects").delete().eq("id", project.id).eq("organization_id", orgId);
    if (de) throw new Error(de.message);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not delete the project";
  }
  revalidatePath("/projects");
  revalidatePath("/");
  if (error) redirect(`/projects/${id.data}?error=${encodeURIComponent(error)}`);
  redirect("/projects");
}
