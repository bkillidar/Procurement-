"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { syncProject } from "@/lib/project-sync";
import { TASK_STATUSES, wouldCreateCycle } from "@/lib/tasks";
import { firstError, taskSchema } from "@/lib/validation";

const uuid = z.string().uuid();

function back(projectId: string, error?: string): never {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  redirect(error ? `/projects/${projectId}?error=${encodeURIComponent(error)}` : `/projects/${projectId}`);
}

async function loadTask(taskId: string) {
  const { db, orgId } = await getContext();
  const { data, error } = await db
    .from("tasks")
    .select("id, project_id, status")
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Task not found");
  return { db, orgId, task: data };
}

export async function addTask(formData: FormData) {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  const projectId = uuid.safeParse(formData.get("project_id"));
  if (!projectId.success) redirect("/projects");
  if (!parsed.success) back(projectId.data, firstError(parsed.error));

  let error: string | undefined;
  try {
    const { db, orgId } = await getContext();
    const { data: project } = await db
      .from("projects")
      .select("id")
      .eq("id", parsed.data.project_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");
    const { error: e } = await db
      .from("tasks")
      .insert({ ...parsed.data, organization_id: orgId, status: "ready" });
    if (e) throw new Error(e.message);
    await syncProject(db, orgId, parsed.data.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not add the task";
  }
  back(parsed.data.project_id, error);
}

export async function setTaskStatus(formData: FormData) {
  const id = uuid.safeParse(formData.get("task_id"));
  const status = z.enum(TASK_STATUSES as [string, ...string[]]).safeParse(formData.get("status"));
  if (!id.success || !status.success) redirect("/projects");

  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, task } = await loadTask(id.data);
    projectId = task.project_id;
    const { error: e } = await db
      .from("tasks")
      .update({
        status: status.data,
        completed_at: status.data === "complete" ? new Date().toISOString() : null,
      })
      .eq("id", task.id)
      .eq("organization_id", orgId);
    if (e) throw new Error(e.message);
    await syncProject(db, orgId, task.project_id, task.id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not update the task";
  }
  if (!projectId) redirect("/projects");
  back(projectId, error);
}

export async function setTaskDetails(formData: FormData) {
  const id = uuid.safeParse(formData.get("task_id"));
  if (!id.success) redirect("/projects");
  const parsed = taskSchema
    .pick({ due_date: true, assignee_label: true, priority: true })
    .safeParse(Object.fromEntries(formData));

  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, task } = await loadTask(id.data);
    projectId = task.project_id;
    if (!parsed.success) throw new Error(firstError(parsed.error));
    const notes = formData.get("notes");
    const { error: e } = await db
      .from("tasks")
      .update({ ...parsed.data, notes: typeof notes === "string" && notes.trim() ? notes.trim() : null })
      .eq("id", task.id)
      .eq("organization_id", orgId);
    if (e) throw new Error(e.message);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not save the task";
  }
  if (!projectId) redirect("/projects");
  back(projectId, error);
}

export async function deleteTask(formData: FormData) {
  const id = uuid.safeParse(formData.get("task_id"));
  if (!id.success) redirect("/projects");
  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, task } = await loadTask(id.data);
    projectId = task.project_id;
    const { error: e } = await db.from("tasks").delete().eq("id", task.id).eq("organization_id", orgId);
    if (e) throw new Error(e.message);
    await syncProject(db, orgId, task.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not delete the task";
  }
  if (!projectId) redirect("/projects");
  back(projectId, error);
}

export async function addDependency(formData: FormData) {
  const id = uuid.safeParse(formData.get("task_id"));
  const dep = uuid.safeParse(formData.get("depends_on_task_id"));
  if (!id.success) redirect("/projects");

  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, task } = await loadTask(id.data);
    projectId = task.project_id;
    if (!dep.success) throw new Error("Choose a task to depend on");
    const { data: depTask } = await db
      .from("tasks")
      .select("id")
      .eq("id", dep.data)
      .eq("organization_id", orgId)
      .eq("project_id", task.project_id)
      .maybeSingle();
    if (!depTask) throw new Error("That task is not in this project");

    const { data: edges, error: ee } = await db
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .eq("organization_id", orgId)
      .not("depends_on_task_id", "is", null);
    if (ee) throw new Error(ee.message);
    const list = (edges ?? []).map((x) => ({ taskId: x.task_id, dependsOnId: x.depends_on_task_id }));
    if (list.some((x) => x.taskId === task.id && x.dependsOnId === dep.data)) throw new Error("Already a dependency");
    if (wouldCreateCycle(list, task.id, dep.data)) throw new Error("That would create a circular dependency");

    const { error: e } = await db
      .from("task_dependencies")
      .insert({ organization_id: orgId, task_id: task.id, depends_on_task_id: dep.data });
    if (e) throw new Error(e.message);
    await syncProject(db, orgId, task.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not add the dependency";
  }
  if (!projectId) redirect("/projects");
  back(projectId, error);
}

export async function removeDependency(formData: FormData) {
  const depId = uuid.safeParse(formData.get("dependency_id"));
  const taskId = uuid.safeParse(formData.get("task_id"));
  if (!depId.success || !taskId.success) redirect("/projects");
  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, task } = await loadTask(taskId.data);
    projectId = task.project_id;
    const { error: e } = await db
      .from("task_dependencies")
      .delete()
      .eq("id", depId.data)
      .eq("task_id", task.id)
      .eq("organization_id", orgId);
    if (e) throw new Error(e.message);
    await syncProject(db, orgId, task.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not remove the dependency";
  }
  if (!projectId) redirect("/projects");
  back(projectId, error);
}

export async function addItemDependency(formData: FormData) {
  const id = uuid.safeParse(formData.get("task_id"));
  const item = uuid.safeParse(formData.get("procurement_item_id"));
  if (!id.success) redirect("/projects");

  let projectId = "";
  let error: string | undefined;
  try {
    const { db, orgId, task } = await loadTask(id.data);
    projectId = task.project_id;
    if (!item.success) throw new Error("Choose a procurement item");
    const { data: found } = await db
      .from("procurement_items")
      .select("id")
      .eq("id", item.data)
      .eq("organization_id", orgId)
      .eq("project_id", task.project_id)
      .maybeSingle();
    if (!found) throw new Error("That item is not in this project");
    const { data: existing } = await db
      .from("task_dependencies")
      .select("id")
      .eq("task_id", task.id)
      .eq("depends_on_procurement_item_id", item.data)
      .maybeSingle();
    if (existing) throw new Error("Already a dependency");
    const { error: e } = await db
      .from("task_dependencies")
      .insert({ organization_id: orgId, task_id: task.id, depends_on_procurement_item_id: item.data });
    if (e) throw new Error(e.message);
    await syncProject(db, orgId, task.project_id);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not add the dependency";
  }
  if (!projectId) redirect("/projects");
  back(projectId, error);
}
