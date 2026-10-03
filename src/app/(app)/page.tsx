import Link from "next/link";
import { hasServerCredentials } from "@/lib/supabase/admin";
import { loadPortfolio } from "@/lib/queries";
import { dueState } from "@/lib/dates";
import { cardClass, DueBadge, EmptyState, PriorityBadge, ProgressBar, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

async function load() {
  try {
    return { data: await loadPortfolio(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export default async function DashboardPage() {
  if (!hasServerCredentials()) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="font-semibold">One setup step left</p>
        <p className="mt-1">
          Add the <code>SUPABASE_SECRET_KEY</code> environment variable in Vercel (Project → Settings →
          Environment Variables), then redeploy.
        </p>
      </div>
    );
  }
  const { data, error } = await load();
  if (!data) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
        <p className="font-semibold">Could not reach the database</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  const { orgName, today, projects, open } = data;
  const active = projects.filter((p) => p.status === "active" || p.status === "planning");
  const overdue = open.filter((t) => dueState(t.due_date, today) === "overdue");
  const soon = open.filter((t) => ["today", "soon"].includes(dueState(t.due_date, today)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{orgName}</h1>

      {active.length === 0 ? (
        <EmptyState>
          No active projects yet.{" "}
          <Link href="/projects/new" className="font-medium text-slate-900 underline">
            Create your first project
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Active projects" value={active.length} />
            <Stat label="Overdue tasks" value={overdue.length} tone={overdue.length ? "bad" : "ok"} />
            <Stat label="Due in 7 days" value={soon.length} tone={soon.length ? "warn" : "ok"} />
          </div>

          <Section title="Overdue" count={overdue.length}>
            {overdue.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Nothing overdue.</p>
            ) : (
              <TaskList tasks={overdue.slice(0, 15)} today={today} />
            )}
          </Section>

          <Section title="Due in the next 7 days" count={soon.length}>
            {soon.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Nothing due this week.</p>
            ) : (
              <TaskList tasks={soon.slice(0, 15)} today={today} />
            )}
          </Section>

          <Section title="Active projects" count={active.length}>
            <ul className="divide-y divide-slate-100">
              {active.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="block space-y-2 p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-slate-500">{p.currentPhase ?? "No phase yet"}</p>
                      </div>
                      {p.overdue > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          {p.overdue} overdue
                        </span>
                      )}
                    </div>
                    <ProgressBar done={p.done} total={p.total} />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div className={`${cardClass} p-3`}>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="font-normal">({count})</span>
      </h2>
      <div className={`${cardClass} overflow-hidden`}>{children}</div>
    </section>
  );
}

function TaskList({ tasks, today }: { tasks: Awaited<ReturnType<typeof loadPortfolio>>["open"]; today: string }) {
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link href={`/projects/${t.project_id}#task-${t.id}`} className="block space-y-1 p-4 hover:bg-slate-50">
            <p className="font-medium">{t.title}</p>
            <p className="text-sm text-slate-500">
              {t.projectName}
              {t.phaseName ? ` · ${t.phaseName}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <DueBadge due={t.due_date} state={dueState(t.due_date, today)} />
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
