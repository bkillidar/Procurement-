import Link from "next/link";
import { getContext } from "@/lib/org";
import { activityHref } from "@/lib/activity-links";
import { formatDate } from "@/lib/dates";
import { cardClass, EmptyState, inputClass, secondaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ActivityPage(props: PageProps<"/activity">) {
  const sp = await props.searchParams;
  const projectId = typeof sp.project === "string" ? sp.project : "";
  const limit = Math.min(Math.max(Number(sp.limit) || 60, 20), 500);

  const { db, orgId } = await getContext();
  let q = db.from("activity_log").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(limit + 1);
  if (projectId) q = q.eq("project_id", projectId);
  const [{ data }, { data: projects }] = await Promise.all([
    q,
    db.from("projects").select("id, name").eq("organization_id", orgId).order("name"),
  ]);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const shown = rows.slice(0, limit);
  const names = new Map((projects ?? []).map((p) => [p.id, p.name]));

  // Group by calendar day (Eastern).
  const byDay = new Map<string, typeof shown>();
  for (const r of shown) {
    const day = new Date(r.created_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Activity</h1>
      <form action="/activity" className="flex gap-2">
        <select name="project" defaultValue={projectId} className={inputClass} aria-label="Project">
          <option value="">All projects</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className={secondaryButton}>Filter</button>
      </form>
      {shown.length === 0 ? (
        <EmptyState>No activity yet. Orders, deliveries, status changes and completed tasks show up here.</EmptyState>
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <section key={day} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{formatDate(day)}</h2>
            <ul className={`${cardClass} divide-y divide-slate-100`}>
              {list.map((r) => {
                const href = activityHref(r.entity_type, r.entity_id, r.project_id);
                const time = new Date(r.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
                const body = (
                  <>
                    <p className="text-sm">{r.summary}</p>
                    <p className="text-xs text-slate-500">
                      {time}
                      {r.project_id && names.get(r.project_id) ? ` · ${names.get(r.project_id)}` : ""}
                    </p>
                  </>
                );
                return (
                  <li key={r.id}>
                    {href ? (
                      <Link href={href} className="block p-3 hover:bg-slate-50">{body}</Link>
                    ) : (
                      <div className="p-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {hasMore && (
        <Link href={`/activity?${projectId ? `project=${projectId}&` : ""}limit=${limit + 60}`} className={`${secondaryButton} block text-center`}>
          Show more
        </Link>
      )}
    </div>
  );
}
