import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { loadPermits } from "@/lib/permit-queries";
import { loadDocuments } from "@/lib/document-queries";
import { formatDate } from "@/lib/dates";
import { isClosedPermit, PERMIT_STATUSES, PERMIT_STATUS_LABELS } from "@/lib/permits";
import { addPermitFollowUp, deletePermit, setPermitStatus, updatePermit } from "@/app/actions/permits";
import { ConfirmButton } from "@/components/confirm-button";
import { DocumentList } from "@/components/document-list";
import { FileUploader } from "@/components/file-uploader";
import {
  cardClass,
  dangerButton,
  ErrorBanner,
  inputClass,
  labelClass,
  PermitStatusBadge,
  primaryButton,
  RiskBadge,
  secondaryButton,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const METHODS = [
  ["phone", "Phone call"],
  ["email", "Email"],
  ["text", "Text message"],
  ["in_person", "In person"],
  ["portal", "Agency portal"],
  ["other", "Other"],
] as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default async function PermitPage(props: PageProps<"/permits/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const { db, orgId } = await getContext();
  const { permits } = await loadPermits();
  const permit = permits.find((p) => p.id === id);
  if (!permit) notFound();

  const [{ data: contacts }, { data: followUps }, { data: tasks }, docs] = await Promise.all([
    db.from("contacts").select("id, name, company, phone, email").eq("organization_id", orgId).order("name"),
    db.from("follow_ups").select("*").eq("organization_id", orgId).eq("permit_id", id).order("contacted_at", { ascending: false }),
    db.from("tasks").select("id, title").eq("organization_id", orgId).eq("project_id", permit.project_id).order("title"),
    loadDocuments({ permitId: id }),
  ]);
  const contact = (contacts ?? []).find((c) => c.id === permit.contact_id);
  const closed = isClosedPermit(permit.status);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <div className="space-y-5">
      <Link href="/permits" className="text-sm text-slate-500 hover:underline">← Permits &amp; utilities</Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{permit.item_type}</h1>
        <p className="text-sm text-slate-600">
          <Link href={`/projects/${permit.project_id}`} className="underline">{permit.projectName}</Link>
          {permit.agency ? ` · ${permit.agency}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <PermitStatusBadge status={permit.status} />
          {permit.risk.level !== "none" && <RiskBadge level={permit.risk.level} />}
        </div>
      </div>
      <ErrorBanner message={error} />

      {permit.risk.risks.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Why this is flagged</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {permit.risk.risks.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
        </section>
      )}

      {contact && (contact.phone || contact.email) && (
        <div className="flex gap-2">
          {contact.phone && <a href={`tel:${contact.phone}`} className={`${secondaryButton} flex-1 text-center`}>📞 Call {contact.name}</a>}
          {contact.email && <a href={`mailto:${contact.email}`} className={`${secondaryButton} flex-1 text-center`}>✉️ Email</a>}
        </div>
      )}

      <section className={`${cardClass} space-y-3 p-4`}>
        <form action={setPermitStatus} className="flex items-end gap-2">
          <input type="hidden" name="permit_id" value={permit.id} />
          <div className="flex-1">
            <label className={labelClass}>Status</label>
            <select name="status" defaultValue={permit.status} className={inputClass}>
              {PERMIT_STATUSES.map((s) => (
                <option key={s} value={s}>{PERMIT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <button className={secondaryButton}>Update</button>
        </form>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Fact label="Reference #" value={permit.reference_number ?? "—"} />
          <Fact label="Contact" value={permit.contactName ?? "—"} />
          <Fact label="Submitted" value={formatDate(permit.submitted_on)} />
          <Fact label="Response expected" value={formatDate(permit.expected_response_date)} />
          <Fact label="Last follow-up" value={formatDate(permit.last_follow_up_on)} />
          <Fact label="Next follow-up" value={formatDate(permit.next_follow_up_on)} />
          <Fact label="Approved / completed" value={formatDate(permit.approved_on)} />
        </dl>
        {permit.linkedTask && (
          <p className="text-sm">
            Gates task:{" "}
            <Link href={`/projects/${permit.project_id}#task-${permit.linkedTask.id}`} className="underline">{permit.linkedTask.title}</Link>{" "}
            <StatusBadge status={permit.linkedTask.status} />
            {permit.linkedTask.due_date ? <span className="text-slate-500"> · due {formatDate(permit.linkedTask.due_date)}</span> : null}
          </p>
        )}
        {permit.notes && <p className="text-sm text-slate-700"><strong>Notes:</strong> {permit.notes}</p>}
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Follow-ups</h2>
        <form action={addPermitFollowUp} className="space-y-3">
          <input type="hidden" name="permit_id" value={permit.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>How did you reach them?</label>
              <select name="method" defaultValue="phone" className={inputClass}>
                {METHODS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input type="date" name="next_follow_up_on" className={inputClass} disabled={closed} />
            </div>
            <div>
              <label className={labelClass}>Result</label>
              <input name="result" className={inputClass} placeholder="Reviewer assigned / still in queue" />
            </div>
            <div>
              <label className={labelClass}>Responsible</label>
              <input name="responsible_label" className={inputClass} placeholder="Owner, PM…" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" rows={2} className={inputClass} />
          </div>
          <SubmitButton className={primaryButton}>Log follow-up</SubmitButton>
        </form>
        {(followUps ?? []).length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {(followUps ?? []).map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <p>
                  <strong>{formatDate(f.contacted_at.slice(0, 10))}</strong> · {METHODS.find((m) => m[0] === f.method)?.[1] ?? f.method}
                  {f.responsible_label ? ` · ${f.responsible_label}` : ""}
                </p>
                {f.result && <p className="text-slate-700">{f.result}</p>}
                {f.notes && <p className="text-slate-500">{f.notes}</p>}
                {f.next_follow_up_on && <p className="text-xs text-slate-500">Next follow-up {formatDate(f.next_follow_up_on)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Documents</h2>
        <FileUploader projectId={permit.project_id} category="permit" links={{ permit_id: permit.id }} label="⬆️ Add documents or photos" />
        <DocumentList docs={docs} back={`/permits/${permit.id}`} />
      </section>

      <details className={`${cardClass} p-4`}>
        <summary className="cursor-pointer font-medium">Edit details</summary>
        <form action={updatePermit} className="mt-4 space-y-3">
          <input type="hidden" name="permit_id" value={permit.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Type *</label>
              <input name="item_type" required defaultValue={permit.item_type} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Agency / utility</label>
              <input name="agency" defaultValue={permit.agency ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue={permit.status} className={inputClass}>
                {PERMIT_STATUSES.map((s) => (
                  <option key={s} value={s}>{PERMIT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Reference #</label>
              <input name="reference_number" defaultValue={permit.reference_number ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Contact</label>
              <select name="contact_id" defaultValue={permit.contact_id ?? ""} className={inputClass}>
                <option value="">None</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Schedule task it gates</label>
              <select name="task_id" defaultValue={permit.task_id ?? ""} className={inputClass}>
                <option value="">None</option>
                {(tasks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Submitted on</label>
              <input type="date" name="submitted_on" defaultValue={permit.submitted_on ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Response expected by</label>
              <input type="date" name="expected_response_date" defaultValue={permit.expected_response_date ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input type="date" name="next_follow_up_on" defaultValue={permit.next_follow_up_on ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Approved / completed on</label>
              <input type="date" name="approved_on" defaultValue={permit.approved_on ?? ""} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" rows={2} defaultValue={permit.notes ?? ""} className={inputClass} />
          </div>
          <button className={secondaryButton}>Save changes</button>
        </form>
        <form action={deletePermit} className="mt-4">
          <input type="hidden" name="permit_id" value={permit.id} />
          <ConfirmButton message={`Delete ${permit.item_type}?`} className={dangerButton}>Delete item</ConfirmButton>
        </form>
      </details>
    </div>
  );
}
