import Link from "next/link";
import { loadPortfolio } from "@/lib/queries";
import { loadDemoProject } from "@/app/actions/demo";
import { removeDuplicateProjects } from "@/app/actions/projects";
import { loadRemovableDuplicateIds } from "@/lib/duplicate-queries";
import { ConfirmButton } from "@/components/confirm-button";
import { DEMO_PROJECT_PREFIX } from "@/lib/demo";
import { formatDate } from "@/lib/dates";
import { cardClass, EmptyState, primaryButton, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { renovation: "Renovation", new_construction: "New construction" };

export default async function ProjectsPage(props: PageProps<"/projects">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;
  const { projects } = await loadPortfolio();
  const hasDemo = projects.some((p) => p.name.startsWith(DEMO_PROJECT_PREFIX));
  const duplicateCount = (await loadRemovableDuplicateIds()).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/projects/new" className={primaryButton}>
          New project
        </Link>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {duplicateCount > 0 && (
        <form action={removeDuplicateProjects} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-2 text-amber-900">
            {duplicateCount} duplicate project{duplicateCount === 1 ? "" : "s"} found: same name and address with nothing entered on them.
          </p>
          <ConfirmButton
            message={`Delete ${duplicateCount} untouched duplicate project${duplicateCount === 1 ? "" : "s"}? The oldest copy of each is kept.`}
            className="rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-medium text-amber-900"
          >
            Remove duplicates (keeps the oldest)
          </ConfirmButton>
        </form>
      )}
      {projects.length === 0 ? (
        <EmptyState>
          No projects yet. Tap “New project” to create one from a template, or{" "}
          <form action={loadDemoProject} className="inline">
            <button className="font-medium text-slate-900 underline">load a demo project</button>
          </form>{" "}
          to see how everything works.
        </EmptyState>
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
      {!hasDemo && projects.length > 0 && (
        <form action={loadDemoProject}>
          <button className="text-sm text-slate-500 underline">Load a demo project</button>
        </form>
      )}
    </div>
  );
}
