import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { loadDocuments } from "@/lib/document-queries";
import { dueState, formatDate, todayISO } from "@/lib/dates";
import { isOpenIssue, ISSUE_STATUS_LABELS, ISSUE_TYPE_LABELS } from "@/lib/issues";
import { ISSUE_SEVERITIES, ISSUE_STATUSES } from "@/lib/validation";
import { deleteIssue, updateIssue } from "@/app/actions/issues";
import { ConfirmButton } from "@/components/confirm-button";
import { DocumentList } from "@/components/document-list";
import { FileUploader } from "@/components/file-uploader";
import {
  cardClass,
  dangerButton,
  DueBadge,
  ErrorBanner,
  inputClass,
  labelClass,
  primaryButton,
  SeverityBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IssuePage(props: PageProps<"/issues/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { db, orgId } = await getContext();
  const { data: issue } = await db.from("issues").select("*").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!issue) notFound();

  const [{ data: project }, { data: item }, { data: task }, docs] = await Promise.all([
    db.from("projects").select("id, name").eq("id", issue.project_id).eq("organization_id", orgId).maybeSingle(),
    issue.procurement_item_id
      ? db.from("procurement_items").select("id, description").eq("id", issue.procurement_item_id).eq("organization_id", orgId).maybeSingle()
      : Promise.resolve({ data: null }),
    issue.task_id
      ? db.from("tasks").select("id, title").eq("id", issue.task_id).eq("organization_id", orgId).maybeSingle()
      : Promise.resolve({ data: null }),
    loadDocuments({ issueId: id }),
  ]);
  const today = todayISO();
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <div className="space-y-5">
      <Link href="/issues" className="text-sm text-slate-500 hover:underline">← Issues</Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{issue.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SeverityBadge severity={issue.severity} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{ISSUE_STATUS_LABELS[issue.status]}</span>
          <span className="text-slate-500">{ISSUE_TYPE_LABELS[issue.issue_type]}</span>
          {isOpenIssue(issue.status) && <DueBadge due={issue.due_date} state={dueState(issue.due_date, today)} />}
        </div>
        <p className="text-sm text-slate-600">
          {project && <Link href={`/projects/${project.id}`} className="underline">{project.name}</Link>}
          {item && <> · Material: <Link href={`/procurement/${item.id}`} className="underline">{item.description}</Link></>}
          {task && <> · Task: <Link href={`/projects/${issue.project_id}#task-${task.id}`} className="underline">{task.title}</Link></>}
        </p>
        <p className="text-xs text-slate-500">Opened {formatDate(issue.opened_on)}{issue.owner_label ? ` · Owner: ${issue.owner_label}` : ""}</p>
      </div>
      <ErrorBanner message={error} />

      {issue.description && <p className={`${cardClass} whitespace-pre-wrap p-4 text-sm`}>{issue.description}</p>}
      {issue.resolution && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <strong>Resolution:</strong> {issue.resolution}
        </p>
      )}

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Photos</h2>
        <FileUploader
          projectId={issue.project_id}
          category={issue.delivery_id ? "delivery_photo" : "other"}
          links={{ issue_id: issue.id, ...(issue.procurement_item_id ? { procurement_item_id: issue.procurement_item_id } : {}) }}
          label="📷 Add photos"
          accept="image/*"
        />
        <DocumentList docs={docs} back={`/issues/${issue.id}`} />
      </section>

      <form action={updateIssue} className={`${cardClass} space-y-3 p-4`}>
        <input type="hidden" name="issue_id" value={issue.id} />
        <h2 className="font-medium">Update</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" defaultValue={issue.status} className={inputClass}>
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>{ISSUE_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Severity</label>
            <select name="severity" defaultValue={issue.severity} className={`${inputClass} capitalize`}>
              {ISSUE_SEVERITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Owner</label>
            <input name="owner_label" defaultValue={issue.owner_label ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Due date</label>
            <input type="date" name="due_date" defaultValue={issue.due_date ?? ""} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Details</label>
          <textarea name="description" rows={3} defaultValue={issue.description ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Resolution</label>
          <textarea name="resolution" rows={2} defaultValue={issue.resolution ?? ""} className={inputClass} placeholder="How was it resolved?" />
        </div>
        <button className={primaryButton}>Save</button>
      </form>

      <form action={deleteIssue}>
        <input type="hidden" name="issue_id" value={issue.id} />
        <ConfirmButton message="Delete this issue?" className={dangerButton}>Delete issue</ConfirmButton>
      </form>
    </div>
  );
}
