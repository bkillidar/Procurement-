import Link from "next/link";
import { loadItems, type ItemView } from "@/lib/procurement-queries";
import { formatDate } from "@/lib/dates";
import { isAwaitingVendor, isPreOrder, isReceived, riskRank, UNCONFIRMED, type ItemStatus } from "@/lib/procurement";
import { cardClass, EmptyState, inputClass, ItemStatusBadge, RiskBadge, secondaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS: { key: string; label: string; test: (i: ItemView) => boolean }[] = [
  { key: "attention", label: "Needs attention", test: (i) => i.risk.level !== "none" || i.followUp.state !== "none" },
  { key: "ordering", label: "To order", test: (i) => isPreOrder(i.status) },
  { key: "awaiting", label: "Awaiting confirmation", test: (i) => UNCONFIRMED.includes(i.status as ItemStatus) },
  { key: "transit", label: "On the way", test: (i) => isAwaitingVendor(i.status) && !UNCONFIRMED.includes(i.status as ItemStatus) },
  { key: "delivered", label: "Delivered", test: (i) => isReceived(i.status) },
  { key: "all", label: "All", test: () => true },
];

export default async function ProcurementPage(props: PageProps<"/procurement">) {
  const sp = await props.searchParams;
  const viewKey = typeof sp.view === "string" && VIEWS.some((v) => v.key === sp.view) ? sp.view : "attention";
  const view = VIEWS.find((v) => v.key === viewKey)!;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const { items } = await loadItems();
  const counts = Object.fromEntries(VIEWS.map((v) => [v.key, items.filter(v.test).length]));
  const shown = items
    .filter(view.test)
    .filter(
      (i) =>
        !q ||
        [i.description, i.category, i.projectName, i.vendorName, i.order_number].some((v) => v?.toLowerCase().includes(q)),
    )
    .sort(
      (a, b) =>
        riskRank(b.risk.level) - riskRank(a.risk.level) ||
        (a.required_on_site_date ?? "9999").localeCompare(b.required_on_site_date ?? "9999"),
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Procurement</h1>
        <Link href="/procurement/new" className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">
          Add item
        </Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/procurement?view=${v.key}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              v.key === viewKey ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {v.label} ({counts[v.key]})
          </Link>
        ))}
      </div>

      <form action="/procurement" className="flex gap-2">
        <input type="hidden" name="view" value={viewKey} />
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search item, project, vendor, PO…" className={inputClass} />
        <button className={secondaryButton}>Search</button>
      </form>

      {shown.length === 0 ? (
        <EmptyState>
          {items.length === 0
            ? "No procurement items yet. Add the materials each project needs, with required-on-site dates and lead times."
            : viewKey === "attention"
              ? "Nothing needs attention right now. 🎉"
              : "No items here."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <li key={i.id}>
              <Link href={`/procurement/${i.id}`} className={`${cardClass} block space-y-2 p-4 hover:bg-slate-50`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{i.description}</p>
                    <p className="text-sm text-slate-500">
                      {i.category} · {i.projectName}
                    </p>
                  </div>
                  {i.risk.level !== "none" && <RiskBadge level={i.risk.level} />}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <ItemStatusBadge status={i.status} />
                  {i.vendorName && <span>{i.vendorName}</span>}
                  <span>Required {formatDate(i.required_on_site_date)}</span>
                  {i.expected_delivery_date && <span>· Expected {formatDate(i.expected_delivery_date)}</span>}
                </div>
                {i.risk.risks[0] && <p className="text-sm text-slate-700">{i.risk.risks[0].message}</p>}
                {!i.risk.risks[0] && i.followUp.state !== "none" && (
                  <p className="text-sm text-amber-800">{i.followUp.message}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
