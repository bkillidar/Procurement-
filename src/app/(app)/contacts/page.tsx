import { getContext } from "@/lib/org";
import { addContact, deleteContact } from "@/app/actions/contacts";
import { ConfirmButton } from "@/components/confirm-button";
import { CONTACT_KINDS } from "@/lib/validation";
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

const KIND_LABEL: Record<string, string> = {
  vendor: "Vendor",
  architect: "Architect",
  engineer: "Engineer",
  subcontractor: "Subcontractor",
  lender: "Lender",
  utility: "Utility",
  municipal: "Municipal",
  other: "Other",
};

export default async function ContactsPage(props: PageProps<"/contacts">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const kind = typeof sp.kind === "string" ? sp.kind : "";

  const { db, orgId } = await getContext();
  const { data } = await db
    .from("contacts")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });
  const contacts = (data ?? []).filter(
    (c) =>
      (!kind || c.kind === kind) &&
      (!q || [c.name, c.company, c.title, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Contacts</h1>
      <ErrorBanner message={error} />

      <form className="flex gap-2" action="/contacts">
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search name, company, phone…" className={inputClass} />
        <select name="kind" defaultValue={kind} className={`${inputClass} max-w-40`} aria-label="Type">
          <option value="">All types</option>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <button className={secondaryButton}>Filter</button>
      </form>

      {contacts.length === 0 ? (
        <EmptyState>{data?.length ? "No contacts match." : "No contacts yet. Add architects, engineers, lenders, subs and agency contacts below."}</EmptyState>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className={`${cardClass} space-y-1 p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-slate-500">
                    {KIND_LABEL[c.kind] ?? c.kind}
                    {c.company ? ` · ${c.company}` : ""}
                    {c.title ? ` · ${c.title}` : ""}
                  </p>
                </div>
                <form action={deleteContact}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message={`Delete ${c.name}?`} className={dangerButton}>
                    Delete
                  </ConfirmButton>
                </form>
              </div>
              <p className="flex flex-wrap gap-x-4 text-sm">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="text-blue-700 underline">
                    {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="text-blue-700 underline">
                    {c.email}
                  </a>
                )}
              </p>
              {c.notes && <p className="text-sm text-slate-600">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <details className={`${cardClass} p-4`}>
        <summary className="cursor-pointer font-medium">+ Add a contact</summary>
        <form action={addContact} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="name">
                Name *
              </label>
              <input id="name" name="name" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="kind">
                Type
              </label>
              <select id="kind" name="kind" defaultValue="other" className={inputClass}>
                {CONTACT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="company">
                Company / agency
              </label>
              <input id="company" name="company" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="title">
                Title
              </label>
              <input id="title" name="title" className={inputClass} />
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
          </div>
          <div>
            <label className={labelClass} htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" name="notes" rows={2} className={inputClass} />
          </div>
          <button className={primaryButton}>Add contact</button>
        </form>
      </details>
    </div>
  );
}
