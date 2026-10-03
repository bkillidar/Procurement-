import Link from "next/link";
import { loadPortfolio } from "@/lib/queries";
import { formatDate } from "@/lib/dates";
import { cardClass, EmptyState, primaryButton, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { renovation: "Renovation", new_construction: "New construction" };

export default async function ProjectsPage() {
  const { projects } = await loadPortfolio();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/projects/new" className={primaryButton}>
          New project
        </Link>
      </div>
      {projects.length === 0 ? (
        <EmptyState>No projects yet. Tap “New project” to create one from a template.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className={`${cardClass} block space-y-2 p-4 hover:bg-slate-50`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-slate-500">{p.address ?? "No address"}</p>
                  </div>
                  {p.overdue > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      {p.overdue} overdue
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {TYPE_LABEL[p.project_type] ?? p.project_type}
                  {p.jurisdiction ? ` · ${p.jurisdiction}` : ""} · {p.currentPhase ?? "No phase"} · Target{" "}
                  {formatDate(p.target_completion_date)}
                </p>
                <ProgressBar done={p.done} total={p.total} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
