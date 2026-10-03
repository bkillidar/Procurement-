export const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export const OPEN_ISSUE_STATUSES = ["open", "in_progress", "waiting"];
export const isOpenIssue = (status: string) => OPEN_ISSUE_STATUSES.includes(status);

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  procurement: "Procurement",
  vendor: "Vendor",
  delivery: "Delivery",
  permit: "Permit",
  utility: "Utility",
  design: "Design",
  construction: "Construction",
  other: "Other",
};

export const ISSUE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

/** Most severe first, then earliest due date, then oldest. */
export function compareIssues(
  a: { severity: string; due_date: string | null; opened_on: string },
  b: { severity: string; due_date: string | null; opened_on: string },
): number {
  return (
    (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
    (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31") ||
    a.opened_on.localeCompare(b.opened_on)
  );
}
