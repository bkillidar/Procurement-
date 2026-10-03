import Link from "next/link";
import { getContext } from "@/lib/org";
import { summarizePunch } from "@/lib/punch";
import { cardClass, EmptyState, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PunchOverviewPage() {
  const { db, orgId } = await getContext();
  const [{ data: projects }, { data: items }] = await Promise.all([
    db.from("projects").select("id, name, address, status").eq("organization_id", orgId).order("name"),
    db.from("punch_list_items").select("project_id, status").eq("organization_id", orgId),
  ]);
  const rows = (projects ?? []).map((p) => ({
    ...p,
    summary: summarizePunch((items ?? []).filter((i) => i.project_id === p.id)),
  }));
  // Projects with unfinished punch work first, then projects with no list yet.
  const withItems = rows.filter((r) => r.summary.total > 0).sort((a, b) => b.summary.open + b.summary.readyForVerification - (a.summary.open + a.summary.readyForVerification));
  const without = rows.filter((r) => r.summary.total === 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Punch lists</h1>
      {rows.length === 0 && <EmptyState>Create a project to start a punch list.</EmptyState>}
      {withItems.length > 0 && (
        <ul className="space-y-3">
          {withItems.map((r) => (
            <li key={r.id}>
              <Link href={`/projects/${r.id}/punch`} className={`${cardClass} block space-y-2 p-4 hover:bg-slate-50`}>
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-slate-600">
                  {r.summary.open} open · {r.summary.readyForVerification} ready to verify · {r.summary.done} done
                </p>
                <ProgressBar done={r.summary.done} total={r.summary.total} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {without.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">No punch list yet</h2>
          <ul className={`${cardClass} divide-y divide-slate-100`}>
            {without.map((r) => (
              <li key={r.id}>
                <Link href={`/projects/${r.id}/punch`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <span>{r.name}</span>
                  <span className="text-sm text-slate-500">Start →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
