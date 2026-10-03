import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContext } from "@/lib/org";
import { loadDocuments } from "@/lib/document-queries";
import { dueState, todayISO } from "@/lib/dates";
import {
  groupByLocation,
  isDonePunch,
  isOpenPunch,
  LOCATION_SUGGESTIONS,
  PUNCH_STATUSES,
  PUNCH_STATUS_LABELS,
  summarizePunch,
} from "@/lib/punch";
import { addPunchItem, setPunchStatus } from "@/app/actions/punch";
import { StatusSelect } from "@/components/status-select";
import {
  cardClass,
  DueBadge,
  EmptyState,
  ErrorBanner,
  inputClass,
  labelClass,
  PriorityBadge,
  primaryButton,
  ProgressBar,
  PunchStatusBadge,
  secondaryButton,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "Open", test: (s: string) => isOpenPunch(s) },
  { key: "verify", label: "Verify", test: (s: string) => s === "ready_for_verification" },
  { key: "done", label: "Done", test: (s: string) => isDonePunch(s) },
  { key: "all", label: "All", test: () => true },
] as const;

const STATUS_OPTIONS = PUNCH_STATUSES.map((s) => ({ value: s, label: PUNCH_STATUS_LABELS[s] }));

export default async function PunchPage(props: PageProps<"/projects/[id]/punch">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const viewKey = VIEWS.some((v) => v.key === sp.view) ? (sp.view as string) : "open";
  const view = VIEWS.find((v) => v.key === viewKey)!;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const { db, orgId } = await getContext();
  const { data: project } = await db.from("projects").select("id, name").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!project) notFound();

  const [{ data: items }, { data: contacts }, docs] = await Promise.all([
    db.from("punch_list_items").select("*").eq("organization_id", orgId).eq("project_id", id),
    db.from("contacts").select("id, name, company, kind").eq("organization_id", orgId).order("name"),
    loadDocuments({ projectId: id }),
  ]);
  const all = items ?? [];
  const summary = summarizePunch(all);
  const contactName = new Map((contacts ?? []).map((c) => [c.id, c.name]));
  const photosByItem = new Map<string, string[]>();
  for (const d of docs) {
    if (d.punch_item_id && d.url && d.mime_type?.startsWith("image/")) {
      photosByItem.set(d.punch_item_id, [...(photosByItem.get(d.punch_item_id) ?? []), d.url]);
    }
  }
  const today = todayISO();
  const shown = all.filter((i) => view.test(i.status));
  const groups = groupByLocation(shown);
  const knownLocations = [...new Set([...all.map((i) => i.location).filter(Boolean), ...LOCATION_SUGGESTIONS])] as string[];
  const here = `/projects/${id}/punch?view=${viewKey}`;
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, all.filter((i) => v.test(i.status)).length]));

  return (
    <div className="space-y-4">
      <Link href={`/projects/${id}`} className="text-sm text-slate-500 hover:underline">
        ← {project.name}
      </Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Punch list</h1>
        <ProgressBar done={summary.done} total={summary.total} />
        <p className="text-sm text-slate-600">
          {summary.open} open · {summary.readyForVerification} ready to verify · {summary.done} done
        </p>
      </div>
      <ErrorBanner message={error} />

      <form action={addPunchItem} className={`${cardClass} space-y-3 p-4`}>
        <input type="hidden" name="project_id" value={id} />
        <input type="hidden" name="view" value={viewKey} />
        <h2 className="font-medium">Add item</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="location">Room / location</label>
            <input id="location" name="location" list="locations" autoComplete="off" className={inputClass} placeholder="Kitchen" />
            <datalist id="locations">
              {knownLocations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="priority">Priority</label>
            <select id="priority" name="priority" defaultValue="medium" className={inputClass}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="description">What needs fixing? *</label>
          <textarea id="description" name="description" required rows={2} className={inputClass} placeholder="Touch up paint at window trim" />
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-slate-600">Assign / due date</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="assigned_contact_id">Subcontractor / contact</label>
              <select id="assigned_contact_id" name="assigned_contact_id" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="assigned_label">…or a name</label>
              <input id="assigned_label" name="assigned_label" className={inputClass} placeholder="Owner, PM, painter" />
            </div>
            <div>
              <label className={labelClass} htmlFor="due_date">Due date</label>
              <input id="due_date" name="due_date" type="date" className={inputClass} />
            </div>
          </div>
        </details>
        <div className="flex flex-wrap gap-2">
          <button className={primaryButton}>Add item</button>
          <button name="next" value="photos" className={secondaryButton}>
            Add + photos 📷
          </button>
        </div>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/projects/${id}/punch?view=${v.key}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              v.key === viewKey ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {v.label} ({counts[v.key]})
          </Link>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState>
          {all.length === 0 ? "No punch items yet. Walk the house and add them as you go." : "Nothing in this view."}
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.location} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {g.location} <span className="font-normal">({g.items.length})</span>
            </h2>
            <ul className={`${cardClass} divide-y divide-slate-100 overflow-hidden`}>
              {g.items.map((i) => {
                const photos = photosByItem.get(i.id) ?? [];
                const assignee = (i.assigned_contact_id && contactName.get(i.assigned_contact_id)) || i.assigned_label;
                return (
                  <li key={i.id} className="space-y-2 p-4">
                    <Link href={`/punch/${i.id}`} className="block space-y-1">
                      <p className={`font-medium ${isDonePunch(i.status) ? "text-slate-400 line-through" : ""}`}>{i.description}</p>
                      <span className="flex flex-wrap items-center gap-2">
                        <PunchStatusBadge status={i.status} />
                        <PriorityBadge priority={i.priority} />
                        {assignee && <span className="text-xs text-slate-500">👤 {assignee}</span>}
                        {!isDonePunch(i.status) && <DueBadge due={i.due_date} state={dueState(i.due_date, today)} />}
                      </span>
                    </Link>
                    {photos.length > 0 && (
                      <div className="flex gap-2">
                        {photos.slice(0, 4).map((u) => (
                          <Link key={u} href={`/punch/${i.id}`} className="block h-14 w-14 overflow-hidden rounded-md bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </Link>
                        ))}
                        {photos.length > 4 && <span className="self-center text-xs text-slate-500">+{photos.length - 4}</span>}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {isOpenPunch(i.status) && (
                        <form action={setPunchStatus}>
                          <input type="hidden" name="punch_id" value={i.id} />
                          <input type="hidden" name="back" value={here} />
                          <input type="hidden" name="status" value="ready_for_verification" />
                          <button className={secondaryButton}>Mark ready</button>
                        </form>
                      )}
                      {!isDonePunch(i.status) && (
                        <form action={setPunchStatus}>
                          <input type="hidden" name="punch_id" value={i.id} />
                          <input type="hidden" name="back" value={here} />
                          <input type="hidden" name="status" value="verified" />
                          <button className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800">✓ Verify</button>
                        </form>
                      )}
                      <StatusSelect
                        action={setPunchStatus}
                        taskId={i.id}
                        idName="punch_id"
                        hidden={{ back: here }}
                        value={i.status}
                        options={STATUS_OPTIONS}
                        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
