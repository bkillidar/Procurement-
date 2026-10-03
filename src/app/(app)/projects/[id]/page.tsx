import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { dueState, formatDate, todayISO } from "@/lib/dates";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/tasks";
import {
  addDependency,
  addTask,
  deleteTask,
  removeDependency,
  setTaskDetails,
  setTaskStatus,
} from "@/app/actions/tasks";
import { ConfirmButton } from "@/components/confirm-button";
import { StatusSelect } from "@/components/status-select";
import {
  cardClass,
  dangerButton,
  DueBadge,
  EmptyState,
  ErrorBanner,
  inputClass,
  labelClass,
  PriorityBadge,
  primaryButton,
  ProgressBar,
  secondaryButton,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { renovation: "Renovation", new_construction: "New construction" };
const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }));

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const { error } = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { db, orgId } = await getContext();
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: phases }, { data: tasks }] = await Promise.all([
    db.from("project_phases").select("*").eq("organization_id", orgId).eq("project_id", id).order("position"),
    db
      .from("tasks")
      .select("*")
      .eq("organization_id", orgId)
      .eq("project_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  const taskList = tasks ?? [];
  const taskIds = taskList.map((t) => t.id);
  const { data: deps } = taskIds.length
    ? await db
        .from("task_dependencies")
        .select("id, task_id, depends_on_task_id")
        .eq("organization_id", orgId)
        .in("task_id", taskIds)
        .not("depends_on_task_id", "is", null)
    : { data: [] };

  const today = todayISO();
  const taskById = new Map(taskList.map((t) => [t.id, t]));
  const done = taskList.filter((t) => t.status === "complete").length;
  const overdue = taskList.filter((t) => t.status !== "complete" && dueState(t.due_date, today) === "overdue").length;
  const currentPhase = (phases ?? []).find((p) => p.id === project.current_phase_id);

  return (
    <div className="space-y-5">
      <Link href="/projects" className="text-sm text-slate-500 hover:underline">
        ← Projects
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-slate-600">{project.address ?? "No address"}</p>
        <p className="text-sm text-slate-500">
          {TYPE_LABEL[project.project_type] ?? project.project_type}
          {project.jurisdiction ? ` · ${project.jurisdiction}` : ""} · Start {formatDate(project.start_date)} · Target{" "}
          {formatDate(project.target_completion_date)}
        </p>
      </div>

      <ErrorBanner message={typeof error === "string" ? error : undefined} />

      <div className={`${cardClass} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="text-slate-500">Current phase: </span>
            <strong>{currentPhase?.name ?? "—"}</strong>
          </p>
          {overdue > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              {overdue} overdue
            </span>
          )}
        </div>
        <ProgressBar done={done} total={taskList.length} />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {(phases ?? []).map((p) => (
            <a
              key={p.id}
              href={`#phase-${p.id}`}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                p.status === "complete"
                  ? "bg-green-100 text-green-800"
                  : p.status === "in_progress"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {p.name}
            </a>
          ))}
        </div>
        {(project.scope || project.acquisition_details || project.notes) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Scope, acquisition and notes</summary>
            <div className="mt-2 space-y-2 text-slate-700">
              {project.scope && <p><strong>Scope:</strong> {project.scope}</p>}
              {project.acquisition_details && <p><strong>Acquisition:</strong> {project.acquisition_details}</p>}
              {project.notes && <p><strong>Notes:</strong> {project.notes}</p>}
            </div>
          </details>
        )}
      </div>

      {(phases ?? []).map((phase) => {
        const phaseTasks = taskList.filter((t) => t.phase_id === phase.id);
        const phaseDone = phaseTasks.filter((t) => t.status === "complete").length;
        return (
          <details
            key={phase.id}
            id={`phase-${phase.id}`}
            open={phase.status === "in_progress"}
            className={`${cardClass} overflow-hidden`}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-2 p-4">
              <span className="font-medium">{phase.name}</span>
              <span className="text-xs text-slate-500">
                {phaseTasks.length === 0 ? "No tasks" : `${phaseDone}/${phaseTasks.length} done`}
              </span>
            </summary>
            {phaseTasks.length === 0 ? (
              <p className="border-t border-slate-100 p-4 text-sm text-slate-500">No tasks in this phase.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {phaseTasks.map((task) => {
                  const myDeps = (deps ?? []).filter((d) => d.task_id === task.id);
                  const waitingOn = myDeps
                    .map((d) => taskById.get(d.depends_on_task_id))
                    .filter((t) => t && t.status !== "complete");
                  const candidates = taskList.filter(
                    (t) => t.id !== task.id && !myDeps.some((d) => d.depends_on_task_id === t.id),
                  );
                  return (
                    <li key={task.id} id={`task-${task.id}`} className="space-y-2 p-4">
                      <p className={`font-medium ${task.status === "complete" ? "text-slate-400 line-through" : ""}`}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <DueBadge due={task.due_date} state={task.status === "complete" ? "later" : dueState(task.due_date, today)} />
                        <PriorityBadge priority={task.priority} />
                        {task.assignee_label && <span className="text-xs text-slate-500">👤 {task.assignee_label}</span>}
                      </div>
                      {waitingOn.length > 0 && task.status !== "complete" && (
                        <p className="text-xs text-amber-700">
                          Waiting on: {waitingOn.map((t) => t!.title).join("; ")}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <StatusBadge status={task.status} />
                        <StatusSelect
                          action={setTaskStatus}
                          taskId={task.id}
                          value={task.status}
                          options={STATUS_OPTIONS}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        />
                        {task.status !== "complete" && (
                          <form action={setTaskStatus}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <input type="hidden" name="status" value="complete" />
                            <button className={secondaryButton}>✓ Done</button>
                          </form>
                        )}
                      </div>

                      <details className="text-sm">
                        <summary className="cursor-pointer text-slate-500">Details, dependencies, delete</summary>
                        <div className="mt-3 space-y-4">
                          <form action={setTaskDetails} className="space-y-3">
                            <input type="hidden" name="task_id" value={task.id} />
                            <div className="grid gap-3 sm:grid-cols-3">
                              <div>
                                <label className={labelClass}>Due date</label>
                                <input type="date" name="due_date" defaultValue={task.due_date ?? ""} className={inputClass} />
                              </div>
                              <div>
                                <label className={labelClass}>Assigned to</label>
                                <input name="assignee_label" defaultValue={task.assignee_label ?? ""} className={inputClass} placeholder="Owner, PM, name…" />
                              </div>
                              <div>
                                <label className={labelClass}>Priority</label>
                                <select name="priority" defaultValue={task.priority} className={inputClass}>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className={labelClass}>Notes</label>
                              <textarea name="notes" rows={2} defaultValue={task.notes ?? ""} className={inputClass} />
                            </div>
                            <button className={secondaryButton}>Save</button>
                          </form>

                          <div className="space-y-2">
                            <p className="font-medium text-slate-700">Depends on</p>
                            {myDeps.length === 0 ? (
                              <p className="text-slate-500">No dependencies.</p>
                            ) : (
                              <ul className="space-y-1">
                                {myDeps.map((d) => {
                                  const dt = taskById.get(d.depends_on_task_id);
                                  return (
                                    <li key={d.id} className="flex items-center justify-between gap-2">
                                      <span>
                                        {dt?.title ?? "(deleted task)"}{" "}
                                        {dt && <StatusBadge status={dt.status} />}
                                      </span>
                                      <form action={removeDependency}>
                                        <input type="hidden" name="dependency_id" value={d.id} />
                                        <input type="hidden" name="task_id" value={task.id} />
                                        <button className="text-xs text-red-700 underline">Remove</button>
                                      </form>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                            {candidates.length > 0 && (
                              <form action={addDependency} className="flex gap-2">
                                <input type="hidden" name="task_id" value={task.id} />
                                <select name="depends_on_task_id" className={inputClass} defaultValue="">
                                  <option value="" disabled>
                                    Add a dependency…
                                  </option>
                                  {candidates.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                                </select>
                                <button className={secondaryButton}>Add</button>
                              </form>
                            )}
                          </div>

                          <form action={deleteTask}>
                            <input type="hidden" name="task_id" value={task.id} />
                            <ConfirmButton message={`Delete “${task.title}”?`} className={dangerButton}>
                              Delete task
                            </ConfirmButton>
                          </form>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </details>
        );
      })}

      {(phases ?? []).length === 0 && <EmptyState>This project has no phases.</EmptyState>}

      <details className={`${cardClass} p-4`}>
        <summary className="cursor-pointer font-medium">+ Add a task</summary>
        <form action={addTask} className="mt-4 space-y-3">
          <input type="hidden" name="project_id" value={project.id} />
          <div>
            <label className={labelClass} htmlFor="title">
              Task *
            </label>
            <input id="title" name="title" required className={inputClass} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="phase_id">
                Phase
              </label>
              <select id="phase_id" name="phase_id" className={inputClass} defaultValue={project.current_phase_id ?? ""}>
                <option value="">No phase</option>
                {(phases ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="due_date">
                Due date
              </label>
              <input id="due_date" name="due_date" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="assignee_label">
                Assigned to
              </label>
              <input id="assignee_label" name="assignee_label" className={inputClass} placeholder="Owner, PM, name…" />
            </div>
            <div>
              <label className={labelClass} htmlFor="priority">
                Priority
              </label>
              <select id="priority" name="priority" defaultValue="medium" className={inputClass}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="description">
              Description
            </label>
            <textarea id="description" name="description" rows={2} className={inputClass} />
          </div>
          <button className={primaryButton}>Add task</button>
        </form>
      </details>
    </div>
  );
}
