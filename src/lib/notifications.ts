import { daysBetween, formatDate } from "@/lib/dates";

// Pure notification rules. Notifications are *computed* from the current state of the
// business (so they are never stale); only "marked as read" is stored. A notification's
// key includes the date/level it is about, so it comes back if the situation changes.

export type NotificationLevel = "critical" | "warning" | "info";

export interface AppNotification {
  key: string;
  kind: string;
  level: NotificationLevel;
  title: string;
  body: string;
  href: string;
  projectName: string;
}

interface Risky {
  code: string;
  level: "medium" | "high" | "critical";
  message: string;
}

export interface NotificationInput {
  today: string;
  tasks: { id: string; project_id: string; projectName: string; title: string; due_date: string | null; status: string; priority: string }[];
  items: {
    id: string;
    description: string;
    projectName: string;
    status: string;
    expected_delivery_date: string | null;
    risk: { recommendedOrderDate: string | null; risks: Risky[] };
    followUp: { state: "none" | "due" | "overdue"; message: string };
    nextFollowUpOn: string | null;
  }[];
  permits: {
    id: string;
    item_type: string;
    projectName: string;
    followUpDue: boolean;
    next_follow_up_on: string | null;
    risk: { risks: Risky[] };
  }[];
  issues: { id: string; title: string; projectName: string; severity: string; status: string; due_date: string | null }[];
}

const fromRisk = (level: Risky["level"]): NotificationLevel => (level === "critical" ? "critical" : level === "high" ? "warning" : "info");
const ORDER: Record<NotificationLevel, number> = { critical: 0, warning: 1, info: 2 };

export function buildNotifications(input: NotificationInput): AppNotification[] {
  const { today } = input;
  const out: AppNotification[] = [];

  for (const t of input.tasks) {
    if (t.status === "complete" || !t.due_date) continue;
    const diff = daysBetween(today, t.due_date);
    const href = `/projects/${t.project_id}#task-${t.id}`;
    if (diff < 0) {
      out.push({
        key: `task:${t.id}:overdue:${t.due_date}`,
        kind: "task_overdue",
        level: ["urgent", "high"].includes(t.priority) ? "critical" : "warning",
        title: `Task overdue: ${t.title}`,
        body: `Was due ${formatDate(t.due_date)} (${-diff} day${diff === -1 ? "" : "s"} ago).`,
        href,
        projectName: t.projectName,
      });
    } else if (diff <= 1) {
      out.push({
        key: `task:${t.id}:due:${t.due_date}`,
        kind: "task_due",
        level: "info",
        title: `Task due ${diff === 0 ? "today" : "tomorrow"}: ${t.title}`,
        body: `Due ${formatDate(t.due_date)}.`,
        href,
        projectName: t.projectName,
      });
    }
  }

  for (const i of input.items) {
    const href = `/procurement/${i.id}`;
    const base = { href, projectName: i.projectName };
    for (const r of i.risk.risks) {
      const kind =
        r.code === "order_late" || r.code === "order_soon" || r.code === "no_lead_time"
          ? "needs_ordering"
          : r.code === "unconfirmed"
            ? "confirmation_overdue"
            : r.code === "delivery_overdue"
              ? "delivery_late"
              : r.code === "follow_up_overdue"
                ? "follow_up_due"
                : "procurement_risk";
      if (kind === "follow_up_due") continue; // covered by the follow-up rule below
      const sig = kind === "needs_ordering" ? (i.risk.recommendedOrderDate ?? "") : kind === "delivery_late" ? (i.expected_delivery_date ?? "") : r.level;
      const title =
        kind === "needs_ordering"
          ? `${r.code === "order_soon" ? "Order soon" : r.code === "no_lead_time" ? "Add a lead time" : "Order now"}: ${i.description}`
          : kind === "confirmation_overdue"
            ? `Vendor confirmation overdue: ${i.description}`
            : kind === "delivery_late"
              ? `Delivery late: ${i.description}`
              : `At risk: ${i.description}`;
      out.push({ key: `item:${i.id}:${r.code}:${sig}`, kind, level: fromRisk(r.level), title, body: r.message, ...base });
    }
    if (i.followUp.state !== "none") {
      out.push({
        key: `item:${i.id}:followup:${i.nextFollowUpOn ?? "none"}`,
        kind: "follow_up_due",
        level: i.followUp.state === "overdue" ? "warning" : "info",
        title: `Vendor follow-up due: ${i.description}`,
        body: i.followUp.message,
        ...base,
      });
    }
    if (i.expected_delivery_date && !["delivered", "complete", "partially_delivered"].includes(i.status)) {
      const diff = daysBetween(today, i.expected_delivery_date);
      if (diff >= 0 && diff <= 1) {
        out.push({
          key: `item:${i.id}:delivery:${i.expected_delivery_date}`,
          kind: "delivery_soon",
          level: "info",
          title: `Delivery expected ${diff === 0 ? "today" : "tomorrow"}: ${i.description}`,
          body: `Expected ${formatDate(i.expected_delivery_date)}. Verify quantity, product and condition when it arrives.`,
          ...base,
        });
      }
    }
  }

  for (const p of input.permits) {
    const href = `/permits/${p.id}`;
    for (const r of p.risk.risks) {
      out.push({
        key: `permit:${p.id}:${r.code}`,
        kind: r.code === "follow_up_overdue" ? "permit_follow_up" : "permit_delay",
        level: fromRisk(r.level),
        title: `${r.code === "follow_up_overdue" ? "Permit follow-up due" : "Permit / utility delay"}: ${p.item_type}`,
        body: r.message,
        href,
        projectName: p.projectName,
      });
    }
    if (p.followUpDue && !p.risk.risks.some((r) => r.code === "follow_up_overdue")) {
      out.push({
        key: `permit:${p.id}:followup:${p.next_follow_up_on ?? ""}`,
        kind: "permit_follow_up",
        level: "info",
        title: `Permit follow-up due today: ${p.item_type}`,
        body: "Check in with the agency.",
        href,
        projectName: p.projectName,
      });
    }
  }

  for (const s of input.issues) {
    if (!["open", "in_progress", "waiting"].includes(s.status) || !s.due_date) continue;
    const diff = daysBetween(today, s.due_date);
    if (diff < 0) {
      out.push({
        key: `issue:${s.id}:overdue:${s.due_date}`,
        kind: "issue_overdue",
        level: ["critical", "high"].includes(s.severity) ? "critical" : "warning",
        title: `Issue overdue: ${s.title}`,
        body: `Was due ${formatDate(s.due_date)}.`,
        href: `/issues/${s.id}`,
        projectName: s.projectName,
      });
    }
  }

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.title.localeCompare(b.title));
}
