import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { createIssue } from "@/app/actions/issues";
import { getContext } from "@/lib/org";
import { ISSUE_TYPE_LABELS } from "@/lib/issues";
import { ISSUE_SEVERITIES, ISSUE_TYPES } from "@/lib/validation";
import { cardClass, EmptyState, ErrorBanner, inputClass, labelClass, primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewIssuePage(props: PageProps<"/issues/new">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const selected = typeof sp.project === "string" ? sp.project : "";
  const type = typeof sp.type === "string" ? sp.type : "other";

  const { db, orgId } = await getContext();
  const { data: projects } = await db.from("projects").select("id, name").eq("organization_id", orgId).order("name");
  const [{ data: items }, { data: tasks }] = selected
    ? await Promise.all([
        db.from("procurement_items").select("id, description").eq("organization_id", orgId).eq("project_id", selected).order("description"),
        db.from("tasks").select("id, title").eq("organization_id", orgId).eq("project_id", selected).order("title"),
      ])
    : [{ data: [] }, { data: [] }];

  if (!projects?.length) {
    return <EmptyState>Create a project first.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <Link href="/issues" className="text-sm text-slate-500 hover:underline">← Issues</Link>
      <h1 className="text-2xl font-semibold">New issue</h1>
      <ErrorBanner message={error} />
      {!selected && (
        <form action="/issues/new" className={`${cardClass} space-y-3 p-4`}>
          <label className={labelClass} htmlFor="project">Which project?</label>
          <select id="project" name="project" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <SubmitButton className={primaryButton}>Continue</SubmitButton>
        </form>
      )}
      {selected && (
        <form action={createIssue} className={`${cardClass} space-y-4 p-4`}>
          <input type="hidden" name="project_id" value={selected} />
          <p className="text-sm text-slate-600">Project: <strong>{projects.find((p) => p.id === selected)?.name}</strong></p>
          <div>
            <label className={labelClass} htmlFor="title">What&apos;s the problem? *</label>
            <input id="title" name="title" required className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="issue_type">Type</label>
              <select id="issue_type" name="issue_type" defaultValue={type} className={inputClass}>
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="severity">Severity</label>
              <select id="severity" name="severity" defaultValue="medium" className={`${inputClass} capitalize`}>
                {ISSUE_SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="owner_label">Owner</label>
              <input id="owner_label" name="owner_label" className={inputClass} placeholder="Owner, PM, name…" />
            </div>
            <div>
              <label className={labelClass} htmlFor="due_date">Due date</label>
              <input id="due_date" name="due_date" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="procurement_item_id">Related material</label>
              <select id="procurement_item_id" name="procurement_item_id" defaultValue={typeof sp.item === "string" ? sp.item : ""} className={inputClass}>
                <option value="">None</option>
                {(items ?? []).map((i) => (
                  <option key={i.id} value={i.id}>{i.description}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="task_id">Related task</label>
              <select id="task_id" name="task_id" defaultValue="" className={inputClass}>
                <option value="">None</option>
                {(tasks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="description">Details</label>
            <textarea id="description" name="description" rows={3} className={inputClass} />
          </div>
          <SubmitButton className={`${primaryButton} w-full sm:w-auto`}>Open issue</SubmitButton>
        </form>
      )}
    </div>
  );
}
