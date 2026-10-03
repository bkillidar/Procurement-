import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { loadDocuments } from "@/lib/document-queries";
import { dueState, formatDate, todayISO } from "@/lib/dates";
import { isDonePunch, LOCATION_SUGGESTIONS } from "@/lib/punch";
import { deletePunchItem, setPunchStatus, updatePunchItem } from "@/app/actions/punch";
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
  PriorityBadge,
  primaryButton,
  PunchStatusBadge,
  secondaryButton,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PunchItemPage(props: PageProps<"/punch/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const { db, orgId } = await getContext();
  const { data: item } = await db.from("punch_list_items").select("*").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!item) notFound();
  const [{ data: project }, { data: contacts }, docs] = await Promise.all([
    db.from("projects").select("id, name").eq("id", item.project_id).eq("organization_id", orgId).maybeSingle(),
    db.from("contacts").select("id, name, company, phone").eq("organization_id", orgId).order("name"),
    loadDocuments({ punchItemId: id }),
  ]);
  const contact = (contacts ?? []).find((c) => c.id === item.assigned_contact_id);
  const back = `/projects/${item.project_id}/punch`;
  const today = todayISO();

  const statusButton = (status: string, label: string, style: string) => (
    <form action={setPunchStatus} key={status}>
      <input type="hidden" name="punch_id" value={item.id} />
      <input type="hidden" name="back" value={`/punch/${item.id}`} />
      <input type="hidden" name="status" value={status} />
      <button className={`w-full rounded-md px-3 py-3 text-base font-medium ${style} ${item.status === status ? "ring-2 ring-slate-900" : ""}`}>{label}</button>
    </form>
  );

  return (
    <div className="space-y-5">
      <Link href={back} className="text-sm text-slate-500 hover:underline">
        ← Punch list{project ? ` · ${project.name}` : ""}
      </Link>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{item.description}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <PunchStatusBadge status={item.status} />
          <PriorityBadge priority={item.priority} />
          {item.location && <span className="text-slate-600">📍 {item.location}</span>}
          {!isDonePunch(item.status) && <DueBadge due={item.due_date} state={dueState(item.due_date, today)} />}
        </div>
        {(contact || item.assigned_label) && (
          <p className="text-sm text-slate-600">
            Assigned to {contact?.name ?? item.assigned_label}
            {contact?.phone && (
              <>
                {" · "}
                <a href={`tel:${contact.phone}`} className="text-blue-700 underline">{contact.phone}</a>
              </>
            )}
          </p>
        )}
        {item.verified_at && <p className="text-sm text-green-800">✓ Verified {formatDate(item.verified_at.slice(0, 10))}</p>}
        {item.notes && <p className="text-sm text-slate-700">{item.notes}</p>}
      </div>
      <ErrorBanner message={error} />

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Photos</h2>
        <FileUploader
          projectId={item.project_id}
          category="punch_photo"
          links={{ punch_item_id: item.id }}
          label="📷 Take or add photos"
          accept="image/*"
        />
        <DocumentList docs={docs} back={`/punch/${item.id}`} />
      </section>

      <section className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Status</h2>
        <div className="grid grid-cols-2 gap-2">
          {statusButton("in_progress", "In progress", "bg-indigo-100 text-indigo-900")}
          {statusButton("ready_for_verification", "Ready to verify", "bg-amber-100 text-amber-900")}
          {statusButton("verified", "✓ Verify", "bg-green-700 text-white")}
          {statusButton("wont_fix", "Won't fix", "bg-slate-200 text-slate-800")}
          {item.status !== "open" && statusButton("open", "Reopen", "bg-white text-slate-800 ring-1 ring-slate-300")}
        </div>
        <p className="text-xs text-slate-500">Verify once you have confirmed the fix on site. The schedule&apos;s “Complete punch list items” task finishes when every item is verified.</p>
      </section>

      <details className={`${cardClass} p-4`}>
        <summary className="cursor-pointer font-medium">Edit details</summary>
        <form action={updatePunchItem} className="mt-4 space-y-3">
          <input type="hidden" name="punch_id" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Room / location</label>
              <input name="location" list="loc" defaultValue={item.location ?? ""} className={inputClass} />
              <datalist id="loc">
                {LOCATION_SUGGESTIONS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select name="priority" defaultValue={item.priority} className={inputClass}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Description *</label>
            <textarea name="description" required rows={2} defaultValue={item.description} className={inputClass} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Subcontractor / contact</label>
              <select name="assigned_contact_id" defaultValue={item.assigned_contact_id ?? ""} className={inputClass}>
                <option value="">—</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>…or a name</label>
              <input name="assigned_label" defaultValue={item.assigned_label ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Due date</label>
              <input type="date" name="due_date" defaultValue={item.due_date ?? ""} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea name="notes" rows={2} defaultValue={item.notes ?? ""} className={inputClass} />
          </div>
          <SubmitButton className={primaryButton}>Save</SubmitButton>
        </form>
        <form action={deletePunchItem} className="mt-4">
          <input type="hidden" name="punch_id" value={item.id} />
          <ConfirmButton message="Delete this punch item and its photos?" className={dangerButton}>Delete item</ConfirmButton>
        </form>
      </details>
      <Link href={back} className={`${secondaryButton} block text-center`}>Back to list</Link>
    </div>
  );
}
