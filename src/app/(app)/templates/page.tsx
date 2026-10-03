import { ensureDefaultTemplates, getContext } from "@/lib/org";
import { cardClass, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { renovation: "Renovation", new_construction: "New construction" };

export default async function TemplatesPage() {
  await ensureDefaultTemplates();
  const { db, orgId } = await getContext();
  const [{ data: templates }, { data: phases }, { data: tasks }] = await Promise.all([
    db.from("project_templates").select("*").eq("organization_id", orgId).order("name"),
    db.from("template_phases").select("*").eq("organization_id", orgId).order("position"),
    db.from("template_tasks").select("*").eq("organization_id", orgId).order("offset_days", { nullsFirst: true }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-slate-500">
          Templates create a project&apos;s phases, tasks, dependencies and due dates (counted from the project start
          date). Task titles you change on a project never change the template. Editing templates here comes later.
        </p>
      </div>
      {(templates ?? []).length === 0 && <EmptyState>No templates.</EmptyState>}
      {(templates ?? []).map((t) => {
        const tPhases = (phases ?? []).filter((p) => p.template_id === t.id);
        const tTasks = (tasks ?? []).filter((k) => k.template_id === t.id);
        const titleByKey = new Map(tTasks.map((k) => [k.key, k.title]));
        return (
          <details key={t.id} className={`${cardClass} overflow-hidden`}>
            <summary className="cursor-pointer space-y-1 p-4">
              <span className="font-medium">{t.name}</span>
              <span className="block text-sm text-slate-500">
                {TYPE_LABEL[t.project_type] ?? "Any type"}
                {t.jurisdiction ? ` · ${t.jurisdiction}` : ""} · {tTasks.length} tasks
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-100 p-4">
              {t.description && <p className="text-sm text-slate-600">{t.description}</p>}
              {tPhases.map((p) => {
                const items = tTasks.filter((k) => k.template_phase_id === p.id);
                if (!items.length) return null;
                return (
                  <div key={p.id}>
                    <p className="mb-1 text-sm font-semibold">{p.name}</p>
                    <ul className="space-y-1 text-sm">
                      {items.map((k) => (
                        <li key={k.id} className="text-slate-700">
                          <span className="text-slate-400">Day {k.offset_days ?? "—"}</span> · {k.title}
                          {k.depends_on_keys?.length > 0 && (
                            <span className="block pl-10 text-xs text-slate-500">
                              after: {k.depends_on_keys.map((d: string) => titleByKey.get(d) ?? d).join("; ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
