// Pure rules for the punch list.

export const PUNCH_STATUSES = ["open", "in_progress", "ready_for_verification", "verified", "wont_fix"] as const;
export type PunchStatus = (typeof PUNCH_STATUSES)[number];

export const PUNCH_STATUS_LABELS: Record<PunchStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  ready_for_verification: "Ready to verify",
  verified: "Verified",
  wont_fix: "Won't fix",
};

export const isDonePunch = (s: string) => s === "verified" || s === "wont_fix";
export const isOpenPunch = (s: string) => s === "open" || s === "in_progress";

export interface PunchSummary {
  total: number;
  open: number;
  readyForVerification: number;
  done: number;
  percentDone: number;
}

export function summarizePunch(items: { status: string }[]): PunchSummary {
  const total = items.length;
  const done = items.filter((i) => isDonePunch(i.status)).length;
  return {
    total,
    open: items.filter((i) => isOpenPunch(i.status)).length,
    readyForVerification: items.filter((i) => i.status === "ready_for_verification").length,
    done,
    percentDone: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/**
 * What the schedule should say about the punch list:
 * "Create punch list" is done once any item exists; "Complete punch list items"
 * once every item is verified (or won't-fix). Items still waiting for verification
 * keep the list open: the owner has to confirm them.
 */
export function punchTaskStates(s: PunchSummary): { listCreated: boolean; listComplete: boolean } {
  return { listCreated: s.total > 0, listComplete: s.total > 0 && s.open === 0 && s.readyForVerification === 0 };
}

export const PUNCH_TASK_TITLES = { create: "create punch list", complete: "complete punch list items" } as const;

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function comparePunch(
  a: { priority: string; due_date: string | null; created_at?: string },
  b: { priority: string; due_date: string | null; created_at?: string },
): number {
  return (
    (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
    (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31") ||
    (a.created_at ?? "").localeCompare(b.created_at ?? "")
  );
}

export interface LocationGroup<T> {
  location: string;
  items: T[];
}

/** Group by room/location (A–Z, "No location" last); items inside are most urgent first. */
export function groupByLocation<T extends { location: string | null; priority: string; due_date: string | null; created_at?: string }>(
  items: T[],
): LocationGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.location?.trim() || "No location";
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()]
    .map(([location, list]) => ({ location, items: [...list].sort(comparePunch) }))
    .sort((a, b) => {
      if (a.location === "No location") return 1;
      if (b.location === "No location") return -1;
      return a.location.localeCompare(b.location, undefined, { sensitivity: "base" });
    });
}

export const LOCATION_SUGGESTIONS = [
  "Kitchen",
  "Living room",
  "Dining room",
  "Primary bedroom",
  "Primary bath",
  "Bedroom 2",
  "Bedroom 3",
  "Hall bath",
  "Powder room",
  "Basement",
  "Laundry",
  "Garage",
  "Exterior",
  "Roof",
  "Entry / stairs",
];
