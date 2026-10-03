// Pure rules for receiving a delivery: what changed, and whether it is a problem.

export interface DeliveryInput {
  /** Quantity on the order, if known. */
  orderedQuantity: number | null;
  /** Total received on earlier deliveries of this item. */
  previouslyReceived: number;
  /** Quantity on this delivery. Blank means "everything that was still outstanding". */
  receivedNow: number | null;
  markedPartial: boolean;
  damage: boolean;
  missingItems: boolean;
  incorrectItems: boolean;
  needsReplacement: boolean;
  /** Days until the item is required on site (negative = already past), if known. */
  daysToRequired: number | null;
}

export type DeliveryItemStatus = "delivered" | "partially_delivered" | "problem";
export type DeliveryStatus = "delivered" | "partial" | "problem";
export type IssueSeverity = "medium" | "high" | "critical";

export interface DeliveryOutcome {
  quantityThisDelivery: number | null;
  totalReceived: number;
  shortfall: number;
  isPartial: boolean;
  /** Everything wrong with the delivery, in plain English. Empty when it is clean and complete. */
  problems: string[];
  itemStatus: DeliveryItemStatus;
  deliveryStatus: DeliveryStatus;
  createIssue: boolean;
  severity: IssueSeverity | null;
}

const URGENT_DAYS = 7;

export function evaluateDelivery(input: DeliveryInput): DeliveryOutcome {
  const ordered = input.orderedQuantity;
  const outstanding = ordered !== null ? Math.max(0, ordered - input.previouslyReceived) : null;
  const now = input.receivedNow ?? (input.markedPartial ? 0 : outstanding);
  const totalReceived = input.previouslyReceived + (now ?? 0);

  const shortfall = ordered !== null ? Math.max(0, ordered - totalReceived) : 0;
  const over = ordered !== null ? Math.max(0, totalReceived - ordered) : 0;
  const isPartial = input.markedPartial || shortfall > 0;

  const problems: string[] = [];
  if (input.damage) problems.push("damaged");
  if (input.missingItems) problems.push("missing components or accessories");
  if (input.incorrectItems) problems.push("wrong product");
  if (over > 0) problems.push(`incorrect quantity (${over} more than ordered)`);
  if (input.needsReplacement) problems.push("replacement needed");

  const hasProblem = problems.length > 0;
  const urgent = input.daysToRequired !== null && input.daysToRequired <= URGENT_DAYS;

  let severity: IssueSeverity | null = null;
  if (hasProblem) severity = urgent ? "critical" : "high";
  else if (isPartial) severity = urgent ? "high" : "medium";

  return {
    quantityThisDelivery: now,
    totalReceived,
    shortfall,
    isPartial,
    problems,
    itemStatus: hasProblem ? "problem" : isPartial ? "partially_delivered" : "delivered",
    deliveryStatus: hasProblem ? "problem" : isPartial ? "partial" : "delivered",
    createIssue: hasProblem || isPartial,
    severity,
  };
}

/** One-line issue title, e.g. "Windows: damaged, partial delivery (28 of 32 received)". */
export function deliveryIssueTitle(
  description: string,
  outcome: Pick<DeliveryOutcome, "problems" | "isPartial" | "totalReceived">,
  orderedQuantity: number | null,
): string {
  const parts = [...outcome.problems];
  if (outcome.isPartial) {
    parts.push(
      orderedQuantity !== null
        ? `partial delivery (${outcome.totalReceived} of ${orderedQuantity} received)`
        : "partial delivery",
    );
  }
  return `${description}: ${parts.join(", ")}`;
}

/**
 * After a delivery issue is resolved, what status should the item go back to?
 * `openProblemIssues` = other unresolved delivery issues still linked to the item.
 */
export function statusAfterIssueResolved(opts: {
  orderedQuantity: number | null;
  totalReceived: number;
  openProblemIssues: number;
}): "problem" | "partially_delivered" | "delivered" {
  if (opts.openProblemIssues > 0) return "problem";
  const complete = opts.orderedQuantity === null ? opts.totalReceived > 0 : opts.totalReceived >= opts.orderedQuantity;
  return complete ? "delivered" : "partially_delivered";
}
