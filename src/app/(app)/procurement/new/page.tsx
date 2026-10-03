import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import { createItem } from "@/app/actions/procurement";
import { getContext } from "@/lib/org";
import { cardClass, EmptyState, ErrorBanner, inputClass, labelClass, primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

// Suggestions only: any category can be typed.
const CATEGORY_SUGGESTIONS = [
  "Framing lumber", "Sheathing", "Roofing", "Asphalt shingles", "TPO / EPDM flat roofing", "Windows", "Insulation",
  "Drywall", "Interior doors", "Paint", "Flooring", "Kitchen cabinets", "Wet bar cabinets", "Primary bath cabinets",
  "Bathroom vanities", "Appliances", "Lighting", "Fireplaces", "Custom closets", "Custom mudroom", "Screened patio",
  "Flagstone",
];

export default async function NewItemPage(props: PageProps<"/procurement/new">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const { db, orgId } = await getContext();
  const [{ data: projects }, { data: vendors }] = await Promise.all([
    db.from("projects").select("id, name").eq("organization_id", orgId).order("name"),
    db.from("vendors").select("id, name, typical_lead_time_days").eq("organization_id", orgId).order("name"),
  ]);
  const selected = typeof sp.project === "string" ? sp.project : "";

  if (!projects?.length) {
    return (
      <EmptyState>
        Create a project first, then add its materials.{" "}
        <Link href="/projects/new" className="font-medium text-slate-900 underline">
          New project
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/procurement" className="text-sm text-slate-500 hover:underline">
        ← Procurement
      </Link>
      <h1 className="text-2xl font-semibold">Add procurement item</h1>
      <ErrorBanner message={error} />
      <form action={createItem} className={`${cardClass} space-y-4 p-4`}>
        <div>
          <label className={labelClass} htmlFor="project_id">Project *</label>
          <select id="project_id" name="project_id" required defaultValue={selected} className={inputClass}>
            <option value="" disabled>Choose a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="category">Category *</label>
            <input id="category" name="category" required list="categories" className={inputClass} placeholder="Windows" />
            <datalist id="categories">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass} htmlFor="description">Description *</label>
            <input id="description" name="description" required className={inputClass} placeholder="Double-hung vinyl windows" />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="specification">Specification</label>
          <textarea id="specification" name="specification" rows={2} className={inputClass} />
          <p className="mt-1 text-xs text-slate-500">With a specification the item starts as “Ready for quote”, otherwise “Needs specification”.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="quantity">Quantity</label>
            <input id="quantity" name="quantity" type="number" step="any" min={0} inputMode="decimal" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="unit">Unit</label>
            <input id="unit" name="unit" className={inputClass} placeholder="ea, sf, bf…" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass} htmlFor="source_reference">Architect / engineer reference</label>
            <input id="source_reference" name="source_reference" className={inputClass} placeholder="Sheet A-401" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="required_on_site_date">Required on site</label>
            <input id="required_on_site_date" name="required_on_site_date" type="date" className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="estimated_lead_time_days">Lead time (days)</label>
            <input id="estimated_lead_time_days" name="estimated_lead_time_days" type="number" min={0} step={1} inputMode="numeric" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="vendor_id">Vendor (if already decided)</label>
          <select id="vendor_id" name="vendor_id" defaultValue="" className={inputClass}>
            <option value="">Not chosen yet</option>
            {(vendors ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.typical_lead_time_days != null ? ` (typically ${v.typical_lead_time_days} days)` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">If you leave the lead time blank, the vendor&apos;s typical lead time is used.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={2} className={inputClass} />
        </div>
        <SubmitButton className={`${primaryButton} w-full sm:w-auto`}>Add item</SubmitButton>
      </form>
    </div>
  );
}
