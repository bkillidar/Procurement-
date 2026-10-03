import { getContext } from "@/lib/org";
import { addVendor, deleteVendor } from "@/app/actions/contacts";
import { ConfirmButton } from "@/components/confirm-button";
import {
  cardClass,
  dangerButton,
  EmptyState,
  ErrorBanner,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function VendorsPage(props: PageProps<"/vendors">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const { db, orgId } = await getContext();
  const { data } = await db.from("vendors").select("*").eq("organization_id", orgId).order("name");
  const vendors = (data ?? []).filter(
    (v) => !q || [v.name, v.category, v.email, v.phone].some((x) => x?.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Vendors</h1>
      <ErrorBanner message={error} />

      <form className="flex gap-2" action="/vendors">
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search vendor or category…" className={inputClass} />
        <button className={secondaryButton}>Search</button>
      </form>

      {vendors.length === 0 ? (
        <EmptyState>{data?.length ? "No vendors match." : "No vendors yet. Add the suppliers you order from."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {vendors.map((v) => (
            <li key={v.id} className={`${cardClass} space-y-1 p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{v.name}</p>
                  <p className="text-sm text-slate-500">
                    {v.category ?? "Uncategorized"}
                    {v.typical_lead_time_days != null ? ` · typical lead time ${v.typical_lead_time_days} days` : ""}
                  </p>
                </div>
                <form action={deleteVendor}>
                  <input type="hidden" name="id" value={v.id} />
                  <ConfirmButton message={`Delete ${v.name}?`} className={dangerButton}>
                    Delete
                  </ConfirmButton>
                </form>
              </div>
              <p className="flex flex-wrap gap-x-4 text-sm">
                {v.phone && (
                  <a href={`tel:${v.phone}`} className="text-blue-700 underline">
                    {v.phone}
                  </a>
                )}
                {v.email && (
                  <a href={`mailto:${v.email}`} className="text-blue-700 underline">
                    {v.email}
                  </a>
                )}
              </p>
              {v.notes && <p className="text-sm text-slate-600">{v.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <details className={`${cardClass} p-4`}>
        <summary className="cursor-pointer font-medium">+ Add a vendor</summary>
        <form action={addVendor} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="name">
                Vendor name *
              </label>
              <input id="name" name="name" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="category">
                Category
              </label>
              <input id="category" name="category" className={inputClass} placeholder="Windows, lumber, cabinets…" />
            </div>
            <div>
              <label className={labelClass} htmlFor="phone">
                Phone
              </label>
              <input id="phone" name="phone" type="tel" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="typical_lead_time_days">
                Typical lead time (days)
              </label>
              <input id="typical_lead_time_days" name="typical_lead_time_days" type="number" min={0} step={1} inputMode="numeric" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={2} className={inputClass} />
          </div>
          <button className={primaryButton}>Add vendor</button>
        </form>
      </details>
    </div>
  );
}
