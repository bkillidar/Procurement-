import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { createPermit } from "@/app/actions/permits";
import { getContext } from "@/lib/org";
import { PERMIT_STATUSES, PERMIT_STATUS_LABELS, PERMIT_TYPE_SUGGESTIONS } from "@/lib/permits";
import { cardClass, EmptyState, ErrorBanner, inputClass, labelClass, primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewPermitPage(props: PageProps<"/permits/new">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const selected = typeof sp.project === "string" ? sp.project : "";
  const { db, orgId } = await getContext();
  const [{ data: projects }, { data: contacts }, { data: tasks }] = await Promise.all([
    db.from("projects").select("id, name").eq("organization_id", orgId).order("name"),
    db.from("contacts").select("id, name, company, kind").eq("organization_id", orgId).order("name"),
    selected
      ? db.from("tasks").select("id, title").eq("organization_id", orgId).eq("project_id", selected).order("title")
      : Promise.resolve({ data: [] }),
  ]);
  if (!projects?.length) return <EmptyState>Create a project first.</EmptyState>;

  return (
    <div className="space-y-4">
      <Link href="/permits" className="text-sm text-slate-500 hover:underline">← Permits &amp; utilities</Link>
      <h1 className="text-2xl font-semibold">Add permit or utility item</h1>
      <ErrorBanner message={error} />
      {!selected ? (
        <form action="/permits/new" className={`${cardClass} space-y-3 p-4`}>
          <label className={labelClass} htmlFor="project">Which project?</label>
          <select id="project" name="project" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <SubmitButton className={primaryButton}>Continue</SubmitButton>
        </form>
      ) : (
        <form action={createPermit} className={`${cardClass} space-y-4 p-4`}>
          <input type="hidden" name="project_id" value={selected} />
          <p className="text-sm text-slate-600">Project: <strong>{projects.find((p) => p.id === selected)?.name}</strong></p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="item_type">Type *</label>
              <input id="item_type" name="item_type" required list="permit-types" className={inputClass} placeholder="Gas cap-off" />
              <datalist id="permit-types">
                {PERMIT_TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass} htmlFor="agency">Agency / utility</label>
              <input id="agency" name="agency" className={inputClass} placeholder="DC Water, Pepco, county office…" />
            </div>
            <div>
              <label className={labelClass} htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="not_started" className={inputClass}>
                {PERMIT_STATUSES.map((s) => (
                  <option key={s} value={s}>{PERMIT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="reference_number">Reference / application #</label>
              <input id="reference_number" name="reference_number" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="contact_id">Contact</label>
              <select id="contact_id" name="contact_id" defaultValue="" className={inputClass}>
                <option value="">None</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="task_id">Schedule task it gates</label>
              <select id="task_id" name="task_id" defaultValue="" className={inputClass}>
                <option value="">None</option>
                {(tasks ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="submitted_on">Submitted on</label>
              <input id="submitted_on" name="submitted_on" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="expected_response_date">Response expected by</label>
              <input id="expected_response_date" name="expected_response_date" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="next_follow_up_on">Next follow-up</label>
              <input id="next_follow_up_on" name="next_follow_up_on" type="date" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} className={inputClass} />
          </div>
          <p className="text-xs text-slate-500">When a linked item is complete (or an approved permit), its schedule task is completed automatically.</p>
          <SubmitButton className={`${primaryButton} w-full sm:w-auto`}>Add item</SubmitButton>
        </form>
      )}
    </div>
  );
}
