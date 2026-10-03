import { getContext } from "@/lib/org";
import { loadDocuments } from "@/lib/document-queries";
import { CATEGORY_LABELS, DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documents";
import { DocumentList } from "@/components/document-list";
import { UploadPanel } from "@/components/upload-panel";
import { cardClass, EmptyState, inputClass, secondaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DocumentsPage(props: PageProps<"/documents">) {
  const sp = await props.searchParams;
  const projectId = typeof sp.project === "string" ? sp.project : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();

  const { db, orgId } = await getContext();
  const [{ data: projects }, all] = await Promise.all([
    db.from("projects").select("id, name").eq("organization_id", orgId).order("name"),
    loadDocuments({ projectId: projectId || undefined }),
  ]);
  const docs = all.filter((d) => (!category || d.category === category) && (!q || d.name.toLowerCase().includes(q)));
  const projectName = new Map((projects ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Documents</h1>

      <section className={`${cardClass} p-4`}>
        <UploadPanel projects={projects ?? []} defaultProjectId={projectId || undefined} />
      </section>

      <form action="/documents" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input name="q" defaultValue={sp.q as string | undefined} placeholder="Search file name…" className={`${inputClass} col-span-2 sm:col-span-1`} />
        <select name="project" defaultValue={projectId} className={inputClass} aria-label="Project">
          <option value="">All projects</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="category" defaultValue={category} className={inputClass} aria-label="Type">
          <option value="">All types</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <button className={secondaryButton}>Filter</button>
      </form>

      {docs.length === 0 ? (
        <EmptyState>No documents yet.</EmptyState>
      ) : (
        DOCUMENT_CATEGORIES.filter((c) => docs.some((d) => d.category === c)).map((c) => (
          <section key={c} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{CATEGORY_LABELS[c as DocumentCategory]}</h2>
            <div className={`${cardClass} p-4`}>
              {!projectId && (
                <p className="mb-2 text-xs text-slate-500">
                  {[...new Set(docs.filter((d) => d.category === c).map((d) => projectName.get(d.project_id ?? "") ?? ""))].filter(Boolean).join(" · ")}
                </p>
              )}
              <DocumentList docs={docs.filter((d) => d.category === c)} back="/documents" />
            </div>
          </section>
        ))
      )}
    </div>
  );
}
