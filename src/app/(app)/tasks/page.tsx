import Link from "next/link";
import { loadPortfolio } from "@/lib/queries";
import { dueState } from "@/lib/dates";
import { setTaskStatus } from "@/app/actions/tasks";
import { cardClass, DueBadge, EmptyState, inputClass, PriorityBadge, secondaryButton, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "overdue", label: "Overdue", test: (s: string) => s === "overdue" },
  { key: "soon", label: "Due in 7 days", test: (s: string) => s === "today" || s === "soon" },
  { key: "all", label: "All open", test: () => true },
] as const;

export default async function TasksPage(props: PageProps<"/tasks">) {
  const sp = await props.searchParams;
  const { open, today, projects } = await loadPortfolio();
  const projectId = typeof sp.project === "string" ? sp.project : "";
  const assignee = (typeof sp.assignee === "string" ? sp.assignee : "").trim().toLowerCase();
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const withState = open.map((t) => ({ ...t, state: dueState(t.due_date, today) }));
  const viewKey = VIEWS.some((v) => v.key === sp.view) ? (sp.view as string) : withState.some((t) => t.state === "overdue") ? "overdue" : "soon";
  const view = VIEWS.find((v) => v.key === viewKey)!;
  const base = withState.filter(
    (t) =>
      (!projectId || t.project_id === projectId) &&
      (!assignee || t.assignee_label?.toLowerCase().includes(assignee)) &&
      (!q || [t.title, t.projectName, t.phaseName].some((v) => v?.toLowerCase().includes(q))),
  );
  const shown = base.filter((t) => view.test(t.state));
  const here = `/tasks?view=${viewKey}${projectId ? `&project=${projectId}` : ""}`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tasks</h1>
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/tasks?view=${v.key}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              v.key === viewKey ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {v.label} ({base.filter((t) => v.test(t.state)).length})
          </Link>
        ))}
      </div>
      <form action="/tasks" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="hidden" name="view" value={viewKey} />
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search tasks…" className={`${inputClass} col-span-2 sm:col-span-1`} />
        <select name="project" defaultValue={projectId} className={inputClass} aria-label="Project">
          <option value="">All projects</option>
          {projects.filter((p) => p.status === "active" || p.status === "planning").map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input name="assignee" defaultValue={sp.assignee as string | undefined} placeholder="Assigned to…" className={inputClass} />
        <button className={secondaryButton}>Filter</button>
      </form>

      {shown.length === 0 ? (
        <EmptyState>{viewKey === "overdue" ? "Nothing overdue. 🎉" : "No tasks here."}</EmptyState>
      ) : (
        <ul className={`${cardClass} divide-y divide-slate-100 overflow-hidden`}>
          {shown.map((t) => (
            <li key={t.id} className="space-y-2 p-4">
              <Link href={`/projects/${t.project_id}#task-${t.id}`} className="block space-y-1">
                <p className="font-medium">{t.title}</p>
                <p className="text-sm text-slate-500">
                  {t.projectName}
                  {t.phaseName ? ` · ${t.phaseName}` : ""}
                  {t.assignee_label ? ` · 👤 ${t.assignee_label}` : ""}
                </p>
                <span className="flex flex-wrap items-center gap-2">
                  <DueBadge due={t.due_date} state={t.state} />
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </span>
              </Link>
              <form action={setTaskStatus}>
                <input type="hidden" name="task_id" value={t.id} />
                <input type="hidden" name="status" value="complete" />
                <input type="hidden" name="back" value={here} />
                <button className={secondaryButton}>✓ Done</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
