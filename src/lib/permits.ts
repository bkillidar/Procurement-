import { daysBetween, formatDate } from "@/lib/dates";

// Pure rules for permits and utility work: statuses, delay detection, follow-ups.

export type PermitStatus =
  | "not_started"
  | "preparing"
  | "submitted"
  | "under_review"
  | "additional_info_required"
  | "approved"
  | "scheduled"
  | "complete"
  | "delayed";

export const PERMIT_STATUSES: PermitStatus[] = [
  "not_started",
  "preparing",
  "submitted",
  "under_review",
  "additional_info_required",
  "approved",
  "scheduled",
  "complete",
  "delayed",
];

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  not_started: "Not started",
  preparing: "Preparing",
  submitted: "Submitted",
  under_review: "Under review",
  additional_info_required: "Additional information required",
  approved: "Approved",
  scheduled: "Scheduled",
  complete: "Complete",
  delayed: "Delayed",
};

/** Nothing left to chase the agency about. */
export const isClosedPermit = (s: string) => ["approved", "scheduled", "complete"].includes(s);
/** Waiting on the agency to respond. */
export const isWithAgency = (s: string) => ["submitted", "under_review"].includes(s);
/** We have not sent it in yet. */
export const isUnsubmitted = (s: string) => ["not_started", "preparing"].includes(s);

export const NO_RESPONSE_DAYS = 21; // submitted with no expected date: flag after this long
export const TASK_WARNING_DAYS = 14; // permit not submitted but its task is due this soon

export interface PermitRiskInput {
  item_type: string;
  status: string;
  submitted_on: string | null;
  expected_response_date: string | null;
  next_follow_up_on: string | null;
  /** The schedule task this permit gates, if linked. */
  linkedTask?: { title: string; due_date: string | null; status: string } | null;
}

export type PermitRiskLevel = "none" | "medium" | "high" | "critical";

export interface PermitRisk {
  code: "delayed" | "info_required" | "response_overdue" | "no_response" | "follow_up_overdue" | "not_submitted";
  level: Exclude<PermitRiskLevel, "none">;
  message: string;
}

export interface PermitAssessment {
  level: PermitRiskLevel;
  risks: PermitRisk[];
}

const RANK: Record<PermitRiskLevel, number> = { none: 0, medium: 1, high: 2, critical: 3 };
export const permitRiskRank = (l: PermitRiskLevel) => RANK[l];

function plural(n: number, w: string) {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

export function assessPermit(p: PermitRiskInput, today: string): PermitAssessment {
  if (isClosedPermit(p.status)) return { level: "none", risks: [] };
  const risks: PermitRisk[] = [];
  const name = p.item_type;
  const add = (code: PermitRisk["code"], level: PermitRisk["level"], message: string) => risks.push({ code, level, message });

  if (p.status === "delayed") add("delayed", "high", `${name} is marked as delayed.`);
  if (p.status === "additional_info_required") {
    add("info_required", "high", `${name}: the agency needs additional information before it can move forward.`);
  }

  if (isWithAgency(p.status)) {
    if (p.expected_response_date && daysBetween(today, p.expected_response_date) < 0) {
      const late = daysBetween(p.expected_response_date, today);
      add(
        "response_overdue",
        "high",
        `${name} response was expected ${formatDate(p.expected_response_date)} (${plural(late, "day")} ago) and the agency has not responded.`,
      );
    } else if (!p.expected_response_date && p.submitted_on) {
      const waiting = daysBetween(p.submitted_on, today);
      if (waiting >= NO_RESPONSE_DAYS) {
        add("no_response", "medium", `${name} was submitted ${formatDate(p.submitted_on)} (${plural(waiting, "day")} ago) with no response date.`);
      }
    }
  }

  if (p.next_follow_up_on && daysBetween(today, p.next_follow_up_on) < 0) {
    add(
      "follow_up_overdue",
      "medium",
      `Follow-up on ${name} was due ${formatDate(p.next_follow_up_on)} (${plural(daysBetween(p.next_follow_up_on, today), "day")} ago).`,
    );
  }

  const task = p.linkedTask;
  if (task && task.status !== "complete" && task.due_date && isUnsubmitted(p.status)) {
    const dueIn = daysBetween(today, task.due_date);
    if (dueIn <= TASK_WARNING_DAYS) {
      add(
        "not_submitted",
        dueIn < 0 ? "critical" : dueIn <= 7 ? "high" : "medium",
        `${name} has not been submitted but “${task.title}” is ${dueIn < 0 ? `overdue (was due ${formatDate(task.due_date)})` : `due ${formatDate(task.due_date)}`}.`,
      );
    }
  }

  risks.sort((a, b) => RANK[b.level] - RANK[a.level]);
  const level = risks.reduce<PermitRiskLevel>((m, r) => (RANK[r.level] > RANK[m] ? r.level : m), "none");
  return { level, risks };
}

/** Does this permit's current status mean its schedule task is finished? */
export function permitCompletesTask(itemType: string, status: string): boolean {
  if (status === "complete") return true;
  // A permit counts as done once approved; for utilities "approved" only means cleared to proceed.
  return status === "approved" && /permit/i.test(itemType);
}

export interface TaskLike {
  id: string;
  title: string;
  phaseName: string | null;
}

export interface StandardPermit {
  item_type: string;
  agency: string | null;
  task_id: string;
}

/**
 * Standard permit/utility items for a project, taken from its template tasks:
 * every task in the Utilities phase ("Gas cap-off (Washington Gas)" -> type + agency)
 * and the "Building permit approved" task.
 */
export function standardPermitsFromTasks(tasks: TaskLike[]): StandardPermit[] {
  const out: StandardPermit[] = [];
  for (const t of tasks) {
    const isUtility = t.phaseName === "Utilities";
    const isPermitApproval = t.phaseName === "Permitting" && /^building permit approved/i.test(t.title);
    if (!isUtility && !isPermitApproval) continue;
    const m = t.title.match(/^(.*?)\s*\((.+)\)\s*$/);
    out.push({
      item_type: (isPermitApproval ? "Building permit" : (m ? m[1] : t.title)).trim(),
      agency: m ? m[2].trim() : null,
      task_id: t.id,
    });
  }
  return out;
}

export const PERMIT_TYPE_SUGGESTIONS = [
  "Building permit",
  "Long-form permit",
  "Short-form permit",
  "Gas cap-off",
  "Water cap-off",
  "Sewer cap-off",
  "Temporary power",
  "Electrical inspection",
  "Plumbing inspection",
  "Framing inspection",
  "Final inspection",
  "Certificate of occupancy",
];
