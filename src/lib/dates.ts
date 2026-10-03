// Dates are plain 'YYYY-MM-DD' strings (no time zones to get wrong).
// "Today" is always evaluated in Eastern time because the business works in DC/MD/VA.

export const BUSINESS_TZ = "America/New_York";
const DAY_MS = 86_400_000;

export function todayISO(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: BUSINESS_TZ });
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUTC(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export type DueState = "none" | "overdue" | "today" | "soon" | "later";

/** `soonDays` = how many days ahead counts as "due soon". */
export function dueState(due: string | null | undefined, today: string, soonDays = 7): DueState {
  if (!due) return "none";
  const diff = daysBetween(today, due);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= soonDays) return "soon";
  return "later";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(toUTC(iso)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
