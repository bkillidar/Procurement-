import Link from "next/link";
import { loadPermits, type PermitView } from "@/lib/permit-queries";
import { formatDate } from "@/lib/dates";
import { isClosedPermit, permitRiskRank } from "@/lib/permits";
import { cardClass, EmptyState, inputClass, PermitStatusBadge, RiskBadge, secondaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS: { key: string; label: string; test: (p: PermitView) => boolean }[] = [
  { key: "attention", label: "Needs attention", test: (p) => p.risk.level !== "none" || p.followUpDue },
  { key: "active", label: "In progress", test: (p) => !isClosedPermit(p.status) },
  { key: "done", label: "Approved / done", test: (p) => isClosedPermit(p.status) },
  { key: "all", label: "All", test: () => true },
];

export default async function PermitsPage(props: PageProps<"/permits">) {
  const sp = await props.searchParams;
  const viewKey = typeof sp.view === "string" && VIEWS.some((v) => v.key === sp.view) ? sp.view : "attention";
  const view = VIEWS.find((v) => v.key === viewKey)!;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const { permits } = await loadPermits();
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, permits.filter(v.test).length]));
  const shown = permits
    .filter(view.test)
    .filter((p) => !q || [p.item_type, p.agency, p.projectName, p.reference_number, p.contactName].some((v) => v?.toLowerCase().includes(q)))
    .sort(
      (a, b) =>
        permitRiskRank(b.risk.level) - permitRiskRank(a.risk.level) ||
        (a.expected_response_date ?? "9999").localeCompare(b.expected_response_date ?? "9999"),
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Permits &amp; utilities</h1>
        <Link href="/permits/new" className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">
          Add item
        </Link>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/permits?view=${v.key}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              v.key === viewKey ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {v.label} ({counts[v.key]})
          </Link>
        ))}
      </div>
      <form action="/permits" className="flex gap-2">
        <input type="hidden" name="view" value={viewKey} />
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search type, agency, project, reference…" className={inputClass} />
        <button className={secondaryButton}>Search</button>
      </form>

      {shown.length === 0 ? (
        <EmptyState>
          {permits.length === 0
            ? "No permits or utility items yet. Open a project and tap “Add standard items”, or add one here."
            : viewKey === "attention"
              ? "No permit or utility delays. 🎉"
              : "Nothing here."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/permits/${p.id}`} className={`${cardClass} block space-y-2 p-4 hover:bg-slate-50`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.item_type}</p>
                    <p className="text-sm text-slate-500">
                      {p.projectName}
                      {p.agency ? ` · ${p.agency}` : ""}
                      {p.reference_number ? ` · #${p.reference_number}` : ""}
                    </p>
                  </div>
                  {p.risk.level !== "none" && <RiskBadge level={p.risk.level} />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <PermitStatusBadge status={p.status} />
                  {p.expected_response_date && !isClosedPermit(p.status) && <span>Response expected {formatDate(p.expected_response_date)}</span>}
                  {p.next_follow_up_on && !isClosedPermit(p.status) && <span>· Follow up {formatDate(p.next_follow_up_on)}</span>}
                </div>
                {p.risk.risks[0] && <p className="text-sm text-slate-700">{p.risk.risks[0].message}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
