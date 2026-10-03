import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { loadItems } from "@/lib/procurement-queries";
import { loadPermits } from "@/lib/permit-queries";
import { permitRiskRank } from "@/lib/permits";
import { addStandardPermits } from "@/app/actions/permits";
import { summarizePunch } from "@/lib/punch";
import { activityHref } from "@/lib/activity-links";
import { isOpenIssue } from "@/lib/issues";
import { ITEM_STATUS_LABELS, isReceived, riskRank, type ItemStatus } from "@/lib/procurement";
import { dueState, formatDate, todayISO } from "@/lib/dates";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/tasks";
import {
  addDependency,
  addItemDependency,
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
  ItemStatusBadge,
  labelClass,
  PermitStatusBadge,
  PriorityBadge,
  RiskBadge,
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
        .select("id, task_id, depends_on_task_id, depends_on_procurement_item_id")
        .eq("organization_id", orgId)
        .in("task_id", taskIds)
    : { data: [] };
  const { items: projectItems } = await loadItems({ projectId: id });
  const itemById = new Map(projectItems.map((i) => [i.id, i]));
  const [{ data: issueRows }, { data: activityRows }] = await Promise.all([
    db.from("issues").select("status").eq("organization_id", orgId).eq("project_id", id),
    db
      .from("activity_log")
      .select("id, entity_type, entity_id, project_id, summary, created_at")
      .eq("organization_id", orgId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const openIssueCount = (issueRows ?? []).filter((i) => isOpenIssue(i.status)).length;
  const { data: punchRows } = await db
    .from("punch_list_items")
    .select("status")
    .eq("organization_id", orgId)
    .eq("project_id", id);
  const punch = summarizePunch(punchRows ?? []);
  const { permits: projectPermits } = await loadPermits({ projectId: id });
  const flaggedPermits = projectPermits
    .filter((p) => p.risk.level !== "none")
    .sort((a, b) => permitRiskRank(b.risk.level) - permitRiskRank(a.risk.level));
  const atRisk = projectItems
    .filter((i) => i.risk.level !== "none")
    .sort((a, b) => riskRank(b.risk.level) - riskRank(a.risk.level));

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

      {(() => {
        const pills: { label: string; count: number; href: string }[] = [
          { label: "overdue tasks", count: overdue, href: "/tasks?view=overdue&project=" + project.id },
          { label: "materials flagged", count: atRisk.length, href: "/procurement?view=attention" },
          { label: "permit/utility delays", count: flaggedPermits.length, href: "/permits?view=attention" },
          { label: "open issues", count: openIssueCount, href: "/issues" },
          { label: "punch items to do", count: punch.open + punch.readyForVerification, href: `/projects/${project.id}/punch` },
        ].filter((p) => p.count > 0);
        return pills.length === 0 ? (
          <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Nothing needs attention on this project right now.</p>
        ) : (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <h2 className="mb-2 text-sm font-semibold text-amber-900">Needs attention</h2>
            <div className="flex flex-wrap gap-2">
              {pills.map((p) => (
                <Link key={p.label} href={p.href} className="rounded-full bg-white px-3 py-1 text-sm font-medium text-amber-900 ring-1 ring-amber-300">
                  {p.count} {p.label}
                </Link>
              ))}
            </div>
          </section>
        );
      })()}

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

      <section className={`${cardClass} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">
            Procurement{" "}
            <span className="text-sm font-normal text-slate-500">
              ({projectItems.length} item{projectItems.length === 1 ? "" : "s"}
              {atRisk.length ? `, ${atRisk.length} flagged` : ""})
            </span>
          </h2>
          <Link href={`/procurement/new?project=${project.id}`} className={secondaryButton}>
            Add item
          </Link>
        </div>
        {projectItems.length === 0 ? (
          <p className="text-sm text-slate-500">No materials tracked yet.</p>
        ) : atRisk.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing flagged.{" "}
            <Link href="/procurement?view=all" className="underline">
              View all items
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {atRisk.slice(0, 5).map((i) => (
              <li key={i.id} className="py-2">
                <Link href={`/procurement/${i.id}`} className="block space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{i.description}</span>
                    <RiskBadge level={i.risk.level} />
                  </span>
                  <span className="block text-sm text-slate-600">{i.risk.risks[0]?.message}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">
            Permits &amp; utilities{" "}
            <span className="text-sm font-normal text-slate-500">
              ({projectPermits.length}
              {flaggedPermits.length ? `, ${flaggedPermits.length} flagged` : ""})
            </span>
          </h2>
          <Link href={`/permits/new?project=${project.id}`} className={secondaryButton}>
            Add item
          </Link>
        </div>
        {projectPermits.length === 0 ? (
          <form action={addStandardPermits} className="space-y-2">
            <input type="hidden" name="project_id" value={project.id} />
            <p className="text-sm text-slate-500">Nothing tracked yet.</p>
            <button className={secondaryButton}>Add standard items from this project&apos;s tasks</button>
          </form>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(flaggedPermits.length ? flaggedPermits : projectPermits).slice(0, 6).map((p) => (
              <li key={p.id} className="py-2">
                <Link href={`/permits/${p.id}`} className="block space-y-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.item_type}</span>
                    {p.risk.level !== "none" ? <RiskBadge level={p.risk.level} /> : <PermitStatusBadge status={p.status} />}
                  </span>
                  <span className="block text-sm text-slate-600">{p.risk.risks[0]?.message ?? p.agency ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">
            Punch list{" "}
            <span className="text-sm font-normal text-slate-500">
              ({punch.total === 0 ? "none yet" : `${punch.open} open, ${punch.readyForVerification} to verify`})
            </span>
          </h2>
          <Link href={`/projects/${project.id}/punch`} className={secondaryButton}>
            {punch.total === 0 ? "Start punch list" : "Open"}
          </Link>
        </div>
        {punch.total > 0 && <ProgressBar done={punch.done} total={punch.total} />}
      </section>

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
                  const taskDeps = myDeps.filter((d) => d.depends_on_task_id);
                  const itemDeps = myDeps.filter((d) => d.depends_on_procurement_item_id);
                  const waitingOn = [
                    ...taskDeps
                      .map((d) => taskById.get(d.depends_on_task_id))
                      .filter((t) => t && t.status !== "complete")
                      .map((t) => t!.title),
                    ...itemDeps
                      .map((d) => itemById.get(d.depends_on_procurement_item_id))
                      .filter((i) => i && !isReceived(i.status))
                      .map((i) => `${i!.description} (${ITEM_STATUS_LABELS[i!.status as ItemStatus]})`),
                  ];
                  const candidates = taskList.filter(
                    (t) => t.id !== task.id && !taskDeps.some((d) => d.depends_on_task_id === t.id),
                  );
                  const itemCandidates = projectItems.filter(
                    (i) => !itemDeps.some((d) => d.depends_on_procurement_item_id === i.id),
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
                          Waiting on: {waitingOn.join("; ")}
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
                                  const dt = d.depends_on_task_id ? taskById.get(d.depends_on_task_id) : undefined;
                                  const di = d.depends_on_procurement_item_id
                                    ? itemById.get(d.depends_on_procurement_item_id)
                                    : undefined;
                                  return (
                                    <li key={d.id} className="flex items-center justify-between gap-2">
                                      <span>
                                        {di ? `📦 ${di.description}` : (dt?.title ?? "(deleted)")}{" "}
                                        {di ? <ItemStatusBadge status={di.status} /> : dt && <StatusBadge status={dt.status} />}
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

                          {itemCandidates.length > 0 && (
                            <form action={addItemDependency} className="flex gap-2">
                              <input type="hidden" name="task_id" value={task.id} />
                              <select name="procurement_item_id" className={inputClass} defaultValue="">
                                <option value="" disabled>
                                  Waits for material…
                                </option>
                                {itemCandidates.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.description}
                                  </option>
                                ))}
                              </select>
                              <button className={secondaryButton}>Add</button>
                            </form>
                          )}

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

      {(activityRows ?? []).length > 0 && (
        <section className={`${cardClass} p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Recent activity</h2>
            <Link href={`/activity?project=${project.id}`} className="text-sm text-slate-500 underline">
              All activity
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {(activityRows ?? []).map((a) => {
              const href = activityHref(a.entity_type, a.entity_id, a.project_id);
              return (
                <li key={a.id} className="py-2">
                  {href ? <Link href={href} className="hover:underline">{a.summary}</Link> : a.summary}
                  <span className="block text-xs text-slate-500">{formatDate(a.created_at.slice(0, 10))}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
