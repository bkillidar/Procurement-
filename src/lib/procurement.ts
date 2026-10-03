import { addDays, daysBetween, formatDate } from "@/lib/dates";

// Pure procurement rules: statuses, order-date math and rule-based risk.
// No database or framework code here so every rule can be unit tested.

export type ItemStatus =
  | "needs_specification"
  | "ready_for_quote"
  | "quoting"
  | "ready_to_order"
  | "ordered"
  | "awaiting_vendor_confirmation"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "problem"
  | "complete";

export const ITEM_STATUSES: ItemStatus[] = [
  "needs_specification",
  "ready_for_quote",
  "quoting",
  "ready_to_order",
  "ordered",
  "awaiting_vendor_confirmation",
  "confirmed",
  "in_production",
  "shipped",
  "partially_delivered",
  "delivered",
  "problem",
  "complete",
];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  needs_specification: "Needs specification",
  ready_for_quote: "Ready for quote",
  quoting: "Quoting",
  ready_to_order: "Ready to order",
  ordered: "Ordered",
  awaiting_vendor_confirmation: "Awaiting vendor confirmation",
  confirmed: "Confirmed",
  in_production: "In production",
  shipped: "Shipped",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  problem: "Problem",
  complete: "Complete",
};

/** Not yet ordered. */
export const PRE_ORDER: ItemStatus[] = ["needs_specification", "ready_for_quote", "quoting", "ready_to_order"];
/** Ordered, vendor has not confirmed yet. */
export const UNCONFIRMED: ItemStatus[] = ["ordered", "awaiting_vendor_confirmation"];
/** Vendor has it and it is on the way. */
export const IN_FLIGHT: ItemStatus[] = ["confirmed", "in_production", "shipped"];
/** Material is on site and usable (or the item is closed out). */
export const RECEIVED: ItemStatus[] = ["delivered", "complete"];

export const isPreOrder = (s: string) => PRE_ORDER.includes(s as ItemStatus);
export const isReceived = (s: string) => RECEIVED.includes(s as ItemStatus);
/** Waiting on a vendor or carrier: where follow-ups matter. */
export const isAwaitingVendor = (s: string) =>
  [...UNCONFIRMED, ...IN_FLIGHT, "partially_delivered", "problem"].includes(s as ItemStatus);

export const CONFIRMATION_GRACE_DAYS = 3; // order placed, no confirmation yet: nudge after this
export const CONFIRMATION_ESCALATE_DAYS = 7; // ...and escalate after this
export const ORDER_SOON_DAYS = 7; // warn this many days before the recommended order date
export const DOWNSTREAM_WINDOW_DAYS = 7; // a task due within this window cares about its material

export interface ItemRiskInput {
  description: string;
  status: string;
  required_on_site_date: string | null;
  estimated_lead_time_days: number | null;
  /** The vendor's typical lead time, used only when the item has none of its own. */
  vendor_lead_time_days?: number | null;
  actual_order_date: string | null;
  vendor_confirmed_at: string | null;
  expected_delivery_date: string | null;
  delivery_status?: string | null;
  /** Latest follow-up for this item, if any. */
  last_follow_up_at?: string | null;
  next_follow_up_on?: string | null;
  /** Incomplete tasks that cannot finish until this material is received. */
  dependentTasks?: { title: string; due_date: string | null }[];
}

export type RiskLevel = "none" | "medium" | "high" | "critical";

export interface Risk {
  code:
    | "order_late"
    | "order_soon"
    | "no_lead_time"
    | "unconfirmed"
    | "delivery_overdue"
    | "delivery_after_required"
    | "projected_late"
    | "partial_delivery"
    | "delivery_problem"
    | "follow_up_overdue"
    | "downstream_task";
  level: Exclude<RiskLevel, "none">;
  message: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  risks: Risk[];
  leadTimeDays: number | null;
  recommendedOrderDate: string | null;
}

const RANK: Record<RiskLevel, number> = { none: 0, medium: 1, high: 2, critical: 3 };

export function leadTimeFor(item: Pick<ItemRiskInput, "estimated_lead_time_days" | "vendor_lead_time_days">) {
  return item.estimated_lead_time_days ?? item.vendor_lead_time_days ?? null;
}

/** The last day the order can be placed and still arrive on the required date. */
export function recommendedOrderDate(requiredOnSite: string | null, leadTimeDays: number | null): string | null {
  if (!requiredOnSite || leadTimeDays === null) return null;
  return addDays(requiredOnSite, -leadTimeDays);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Rule-based risk for one item. Every risk carries a plain-English reason. */
export function assessRisk(item: ItemRiskInput, today: string): RiskAssessment {
  const leadTimeDays = leadTimeFor(item);
  const required = item.required_on_site_date;
  const recommended = recommendedOrderDate(required, leadTimeDays);
  const base: RiskAssessment = { level: "none", risks: [], leadTimeDays, recommendedOrderDate: recommended };
  if (isReceived(item.status)) return base;

  const risks: Risk[] = [];
  const name = item.description;
  const add = (code: Risk["code"], level: Risk["level"], message: string) => risks.push({ code, level, message });

  // --- Not ordered yet -------------------------------------------------
  if (isPreOrder(item.status)) {
    if (required && leadTimeDays === null) {
      add(
        "no_lead_time",
        "medium",
        `${name} is required on ${formatDate(required)} but has no lead time, so the order date cannot be calculated. Add a lead time or a vendor quote.`,
      );
    } else if (required && recommended) {
      const daysLate = daysBetween(recommended, today); // >0 once the recommended date has passed
      if (daysLate > 0) {
        const arrival = addDays(today, leadTimeDays!);
        const lateBy = daysBetween(required, arrival);
        add(
          "order_late",
          "critical",
          `${name} is required on ${formatDate(required)}. Lead time is ${plural(leadTimeDays!, "day")}. Order has not yet been placed. Recommended order date was ${formatDate(recommended)} (${plural(daysLate, "day")} ago). Even if ordered today it arrives about ${plural(lateBy, "day")} after the required date.`,
        );
      } else if (daysLate === 0) {
        add(
          "order_late",
          "high",
          `${name} must be ordered today to arrive by ${formatDate(required)} (lead time ${plural(leadTimeDays!, "day")}).`,
        );
      } else if (-daysLate <= ORDER_SOON_DAYS) {
        add(
          "order_soon",
          "medium",
          `${name} should be ordered by ${formatDate(recommended)} (in ${plural(-daysLate, "day")}) to arrive by ${formatDate(required)}. Lead time is ${plural(leadTimeDays!, "day")}.`,
        );
      }
    }
  }

  // --- Ordered, waiting on the vendor to confirm -----------------------
  if (UNCONFIRMED.includes(item.status as ItemStatus) && !item.vendor_confirmed_at && item.actual_order_date) {
    const waiting = daysBetween(item.actual_order_date, today);
    if (waiting >= CONFIRMATION_GRACE_DAYS) {
      add(
        "unconfirmed",
        waiting >= CONFIRMATION_ESCALATE_DAYS ? "high" : "medium",
        `${name} was ordered on ${formatDate(item.actual_order_date)} and the vendor has not confirmed after ${plural(waiting, "day")}.`,
      );
    }
  }

  // --- Ordered / in flight: delivery timing ----------------------------
  const onTheWay = !isPreOrder(item.status);
  if (onTheWay && item.status !== "partially_delivered") {
    const expected = item.expected_delivery_date;
    if (expected && daysBetween(today, expected) < 0) {
      const requiredPassed = required ? daysBetween(today, required) < 0 : false;
      add(
        "delivery_overdue",
        requiredPassed ? "critical" : "high",
        `${name} was expected on ${formatDate(expected)} (${plural(daysBetween(expected, today), "day")} ago) and has not been delivered.${requiredPassed ? ` It was required on ${formatDate(required)}.` : ""}`,
      );
    } else if (expected && required && daysBetween(required, expected) > 0) {
      add(
        "delivery_after_required",
        "high",
        `${name} is expected on ${formatDate(expected)}, ${plural(daysBetween(required, expected), "day")} after the required on-site date of ${formatDate(required)}.`,
      );
    } else if (!expected && required && leadTimeDays !== null && item.actual_order_date) {
      const projected = addDays(item.actual_order_date, leadTimeDays);
      if (daysBetween(required, projected) > 0) {
        add(
          "projected_late",
          "high",
          `${name} was ordered on ${formatDate(item.actual_order_date)} with a ${plural(leadTimeDays, "day")} lead time, so it is projected to arrive ${formatDate(projected)}, ${plural(daysBetween(required, projected), "day")} after the required date of ${formatDate(required)}.`,
        );
      }
    }
  }

  // --- Delivery problems ----------------------------------------------
  if (item.status === "partially_delivered" || item.delivery_status === "partial") {
    const urgent = required ? daysBetween(today, required) <= ORDER_SOON_DAYS : false;
    add(
      "partial_delivery",
      urgent ? "high" : "medium",
      `${name} was only partially delivered.${required ? ` The rest is needed by ${formatDate(required)}.` : ""}`,
    );
  }
  if (item.status === "problem" || item.delivery_status === "problem") {
    add("delivery_problem", "high", `${name} has an unresolved delivery problem.`);
  }

  // --- Vendor follow-up ------------------------------------------------
  const followUp = followUpStatus(item, today);
  if (followUp.state === "overdue") add("follow_up_overdue", "medium", followUp.message);

  // --- Downstream work waiting on this material -----------------------
  for (const task of item.dependentTasks ?? []) {
    if (!task.due_date) continue;
    const dueIn = daysBetween(today, task.due_date);
    const arrivesBefore = item.expected_delivery_date && daysBetween(item.expected_delivery_date, task.due_date) >= 0;
    if (dueIn <= DOWNSTREAM_WINDOW_DAYS && !arrivesBefore) {
      add(
        "downstream_task",
        dueIn < 0 ? "critical" : "high",
        `Task “${task.title}” is ${dueIn < 0 ? `overdue (was due ${formatDate(task.due_date)})` : `due ${formatDate(task.due_date)}`} but ${name} has not been delivered (status: ${ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}).`,
      );
    }
  }

  const level = risks.reduce<RiskLevel>((max, r) => (RANK[r.level] > RANK[max] ? r.level : max), "none");
  risks.sort((a, b) => RANK[b.level] - RANK[a.level]);
  return { ...base, level, risks };
}

export type FollowUpState = "none" | "due" | "overdue";

/**
 * Does this item need a vendor follow-up? Only items waiting on a vendor count.
 * Overdue/due comes from the scheduled next follow-up date; if nothing was ever
 * scheduled or logged, a follow-up is due a few days after the order.
 */
export function followUpStatus(
  item: Pick<ItemRiskInput, "description" | "status" | "actual_order_date" | "last_follow_up_at" | "next_follow_up_on">,
  today: string,
): { state: FollowUpState; message: string } {
  if (!isAwaitingVendor(item.status)) return { state: "none", message: "" };
  const name = item.description;
  if (item.next_follow_up_on) {
    const diff = daysBetween(today, item.next_follow_up_on);
    if (diff < 0) {
      return {
        state: "overdue",
        message: `Follow-up on ${name} was due ${formatDate(item.next_follow_up_on)} (${plural(-diff, "day")} ago).`,
      };
    }
    if (diff === 0) return { state: "due", message: `Follow up on ${name} today.` };
    return { state: "none", message: "" };
  }
  if (!item.last_follow_up_at && item.actual_order_date) {
    const since = daysBetween(item.actual_order_date, today);
    if (since >= CONFIRMATION_GRACE_DAYS) {
      return {
        state: "due",
        message: `No vendor contact logged for ${name} since it was ordered on ${formatDate(item.actual_order_date)}.`,
      };
    }
  }
  return { state: "none", message: "" };
}

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  none: "On track",
  medium: "Watch",
  high: "At risk",
  critical: "Critical",
};

export function riskRank(level: RiskLevel): number {
  return RANK[level];
}
