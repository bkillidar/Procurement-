import Link from "next/link";
import { getContext } from "@/lib/org";
import { dueState, formatDate, todayISO } from "@/lib/dates";
import { compareIssues, isOpenIssue, ISSUE_STATUS_LABELS, ISSUE_TYPE_LABELS } from "@/lib/issues";
import { ISSUE_SEVERITIES, ISSUE_TYPES } from "@/lib/validation";
import { cardClass, DueBadge, EmptyState, inputClass, secondaryButton, SeverityBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IssuesPage(props: PageProps<"/issues">) {
  const sp = await props.searchParams;
  const view = sp.view === "resolved" || sp.view === "all" ? sp.view : "open";
  const type = typeof sp.type === "string" ? sp.type : "";
  const severity = typeof sp.severity === "string" ? sp.severity : "";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const { db, orgId } = await getContext();
  const [{ data }, { data: projects }] = await Promise.all([
    db.from("issues").select("*").eq("organization_id", orgId),
    db.from("projects").select("id, name").eq("organization_id", orgId),
  ]);
  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));
  const all = data ?? [];
  const openCount = all.filter((i) => isOpenIssue(i.status)).length;
  const today = todayISO();

  const shown = all
    .filter((i) => (view === "all" ? true : view === "open" ? isOpenIssue(i.status) : !isOpenIssue(i.status)))
    .filter((i) => !type || i.issue_type === type)
    .filter((i) => !severity || i.severity === severity)
    .filter(
      (i) =>
        !q ||
        [i.title, i.description, i.owner_label, projectName.get(i.project_id)].some((v) => v?.toLowerCase().includes(q)),
    )
    .sort(compareIssues);

  const tab = (key: string, label: string) => (
    <Link
      key={key}
      href={`/issues?view=${key}`}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
        view === key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Issues</h1>
        <Link href="/issues/new" className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">
          New issue
        </Link>
      </div>
      <div className="flex gap-2">
        {tab("open", `Open (${openCount})`)}
        {tab("resolved", "Resolved")}
        {tab("all", "All")}
      </div>
      <form action="/issues" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search…" className={`${inputClass} col-span-2 sm:col-span-1`} />
        <select name="type" defaultValue={type} className={inputClass} aria-label="Type">
          <option value="">All types</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select name="severity" defaultValue={severity} className={inputClass} aria-label="Severity">
          <option value="">Any severity</option>
          {ISSUE_SEVERITIES.map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <button className={secondaryButton}>Filter</button>
      </form>

      {shown.length === 0 ? (
        <EmptyState>{view === "open" ? "No open issues. 🎉" : "No issues match."}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <li key={i.id}>
              <Link href={`/issues/${i.id}`} className={`${cardClass} block space-y-2 p-4 hover:bg-slate-50`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{i.title}</p>
                  <SeverityBadge severity={i.severity} />
                </div>
                <p className="text-sm text-slate-500">
                  {projectName.get(i.project_id)} · {ISSUE_TYPE_LABELS[i.issue_type] ?? i.issue_type} ·{" "}
                  {ISSUE_STATUS_LABELS[i.status] ?? i.status}
                  {i.owner_label ? ` · ${i.owner_label}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>Opened {formatDate(i.opened_on)}</span>
                  {isOpenIssue(i.status) && <DueBadge due={i.due_date} state={dueState(i.due_date, today)} />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
