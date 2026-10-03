import Link from "next/link";
import { hasServerCredentials } from "@/lib/supabase/admin";
import { loadPortfolio } from "@/lib/queries";
import { loadItems, type ItemView } from "@/lib/procurement-queries";
import { daysBetween, dueState, formatDate } from "@/lib/dates";
import { isPreOrder, isReceived, riskRank, UNCONFIRMED, type ItemStatus } from "@/lib/procurement";
import {
  cardClass,
  DueBadge,
  EmptyState,
  ItemStatusBadge,
  PriorityBadge,
  ProgressBar,
  RiskBadge,
  StatusBadge,
} from "@/components/ui";

export const dynamic = "force-dynamic";

async function load() {
  try {
    const [portfolio, procurement] = await Promise.all([loadPortfolio(), loadItems()]);
    return { data: { ...portfolio, items: procurement.items }, error: null };
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

  const { orgName, today, projects, open, items } = data;
  const activeIds = new Set(projects.filter((p) => p.status === "active" || p.status === "planning").map((p) => p.id));
  const liveItems = items.filter((i) => activeIds.has(i.project_id));
  const flagged = liveItems
    .filter((i) => i.risk.level !== "none")
    .sort((a, b) => riskRank(b.risk.level) - riskRank(a.risk.level));
  const toOrder = liveItems.filter((i) => isPreOrder(i.status));
  const awaiting = liveItems.filter((i) => UNCONFIRMED.includes(i.status as ItemStatus));
  const followUps = liveItems.filter((i) => i.followUp.state !== "none");
  const lateDeliveries = liveItems.filter(
    (i) => !isReceived(i.status) && !isPreOrder(i.status) && i.expected_delivery_date && daysBetween(today, i.expected_delivery_date) < 0,
  );
  const upcoming = liveItems
    .filter(
      (i) =>
        !isReceived(i.status) &&
        !isPreOrder(i.status) &&
        i.expected_delivery_date &&
        daysBetween(today, i.expected_delivery_date) >= 0 &&
        daysBetween(today, i.expected_delivery_date) <= 14,
    )
    .sort((a, b) => a.expected_delivery_date!.localeCompare(b.expected_delivery_date!));
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Active projects" value={active.length} />
            <Stat label="Overdue tasks" value={overdue.length} tone={overdue.length ? "bad" : "ok"} />
            <Stat label="Tasks due in 7 days" value={soon.length} tone={soon.length ? "warn" : "ok"} />
            <Stat label="Materials flagged" value={flagged.length} tone={flagged.length ? "bad" : "ok"} href="/procurement?view=attention" />
            <Stat label="Materials to order" value={toOrder.length} tone={toOrder.length ? "warn" : "ok"} href="/procurement?view=ordering" />
            <Stat label="Awaiting confirmation" value={awaiting.length} tone={awaiting.length ? "warn" : "ok"} href="/procurement?view=awaiting" />
          </div>

          <Section title="Procurement risks" count={flagged.length}>
            {flagged.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No materials at risk.</p>
            ) : (
              <ItemList items={flagged.slice(0, 8)} reason="risk" />
            )}
          </Section>

          <Section title="Vendor follow-ups due" count={followUps.length}>
            {followUps.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No follow-ups due.</p>
            ) : (
              <ItemList items={followUps.slice(0, 8)} reason="followup" />
            )}
          </Section>

          <Section title="Late deliveries" count={lateDeliveries.length}>
            {lateDeliveries.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No late deliveries.</p>
            ) : (
              <ItemList items={lateDeliveries.slice(0, 8)} reason="delivery" />
            )}
          </Section>

          <Section title="Deliveries in the next 14 days" count={upcoming.length}>
            {upcoming.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No deliveries expected soon.</p>
            ) : (
              <ItemList items={upcoming.slice(0, 8)} reason="delivery" />
            )}
          </Section>

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

function Stat({
  label,
  value,
  tone = "ok",
  href,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
  href?: string;
}) {
  const color = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  const body = (
    <>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className={`${cardClass} block p-3 hover:bg-slate-50`}>
      {body}
    </Link>
  ) : (
    <div className={`${cardClass} p-3`}>{body}</div>
  );
}

function ItemList({ items, reason }: { items: ItemView[]; reason: "risk" | "followup" | "delivery" }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/procurement/${i.id}`} className="block space-y-1 p-4 hover:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{i.description}</p>
              {i.risk.level !== "none" && <RiskBadge level={i.risk.level} />}
            </div>
            <p className="text-sm text-slate-500">
              {i.projectName}
              {i.vendorName ? ` · ${i.vendorName}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <ItemStatusBadge status={i.status} />
              <span>Required {formatDate(i.required_on_site_date)}</span>
              {i.expected_delivery_date && <span>· Expected {formatDate(i.expected_delivery_date)}</span>}
            </div>
            <p className="text-sm text-slate-700">
              {reason === "followup" ? i.followUp.message : (i.risk.risks[0]?.message ?? i.followUp.message)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
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
