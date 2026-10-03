import Link from "next/link";
import { getContext } from "@/lib/org";
import { MIN_SEARCH_LENGTH, sanitizeSearch } from "@/lib/search";
import { cardClass, EmptyState, inputClass, secondaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

type Hit = { href: string; title: string; sub: string };

export default async function SearchPage(props: PageProps<"/search">) {
  const sp = await props.searchParams;
  const raw = typeof sp.q === "string" ? sp.q : "";
  const q = sanitizeSearch(raw);
  const like = `%${q}%`;

  const sections: { label: string; hits: Hit[] }[] = [];
  if (q.length >= MIN_SEARCH_LENGTH) {
    const { db, orgId } = await getContext();
    const base = (table: string, cols: string) => db.from(table).select(cols).eq("organization_id", orgId);
    const [projects, tasks, items, permits, issues, punch, vendors, contacts, docs, projNames] = await Promise.all([
      base("projects", "id, name, address").or(`name.ilike.${like},address.ilike.${like}`).limit(8),
      base("tasks", "id, project_id, title, status").ilike("title", like).limit(8),
      base("procurement_items", "id, project_id, description, category, status").or(`description.ilike.${like},category.ilike.${like},order_number.ilike.${like}`).limit(8),
      base("permits_utilities", "id, item_type, agency, status").or(`item_type.ilike.${like},agency.ilike.${like},reference_number.ilike.${like}`).limit(8),
      base("issues", "id, title, status").ilike("title", like).limit(8),
      base("punch_list_items", "id, project_id, description, location, status").or(`description.ilike.${like},location.ilike.${like}`).limit(8),
      base("vendors", "id, name, category").or(`name.ilike.${like},category.ilike.${like}`).limit(8),
      base("contacts", "id, name, company, kind").or(`name.ilike.${like},company.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(8),
      base("documents", "id, project_id, name, category").ilike("name", like).limit(8),
      db.from("projects").select("id, name").eq("organization_id", orgId),
    ]);
    const projectName = new Map<string, string>((projNames.data ?? []).map((p) => [p.id as string, p.name as string]));
    const pn = (id: unknown) => projectName.get(id as string) ?? "";
    type Row = Record<string, string | null>;
    const rows = (r: { data: unknown }) => (r.data ?? []) as Row[];

    sections.push(
      { label: "Projects", hits: rows(projects).map((r) => ({ href: `/projects/${r.id}`, title: r.name!, sub: r.address ?? "" })) },
      { label: "Tasks", hits: rows(tasks).map((r) => ({ href: `/projects/${r.project_id}#task-${r.id}`, title: r.title!, sub: `${pn(r.project_id)} · ${r.status!.replace("_", " ")}` })) },
      { label: "Materials", hits: rows(items).map((r) => ({ href: `/procurement/${r.id}`, title: r.description!, sub: `${r.category} · ${pn(r.project_id)}` })) },
      { label: "Permits & utilities", hits: rows(permits).map((r) => ({ href: `/permits/${r.id}`, title: r.item_type!, sub: r.agency ?? "" })) },
      { label: "Issues", hits: rows(issues).map((r) => ({ href: `/issues/${r.id}`, title: r.title!, sub: r.status!.replace("_", " ") })) },
      { label: "Punch list", hits: rows(punch).map((r) => ({ href: `/punch/${r.id}`, title: r.description!, sub: `${r.location ?? "No location"} · ${pn(r.project_id)}` })) },
      { label: "Vendors", hits: rows(vendors).map((r) => ({ href: `/vendors?q=${encodeURIComponent(r.name!)}`, title: r.name!, sub: r.category ?? "" })) },
      { label: "Contacts", hits: rows(contacts).map((r) => ({ href: `/contacts?q=${encodeURIComponent(r.name!)}`, title: r.name!, sub: [r.company, r.kind].filter(Boolean).join(" · ") })) },
      { label: "Documents", hits: rows(docs).map((r) => ({ href: `/documents?project=${r.project_id}&q=${encodeURIComponent(r.name!)}`, title: r.name!, sub: pn(r.project_id) })) },
    );
  }
  const found = sections.filter((s) => s.hits.length > 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Search</h1>
      <form action="/search" className="flex gap-2">
        <input name="q" defaultValue={raw} placeholder="Projects, tasks, materials, vendors, permits…" className={inputClass} autoFocus />
        <button className={secondaryButton}>Search</button>
      </form>
      {q.length < MIN_SEARCH_LENGTH ? (
        <EmptyState>Type at least {MIN_SEARCH_LENGTH} characters.</EmptyState>
      ) : found.length === 0 ? (
        <EmptyState>Nothing matches “{q}”.</EmptyState>
      ) : (
        found.map((s) => (
          <section key={s.label} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{s.label}</h2>
            <ul className={`${cardClass} divide-y divide-slate-100 overflow-hidden`}>
              {s.hits.map((h, i) => (
                <li key={h.href + i}>
                  <Link href={h.href} className="block p-4 hover:bg-slate-50">
                    <p className="font-medium">{h.title}</p>
                    {h.sub && <p className="text-sm text-slate-500">{h.sub}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

