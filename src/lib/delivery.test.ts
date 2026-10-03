import { describe, expect, it } from "vitest";
import { deliveryIssueTitle, evaluateDelivery, statusAfterIssueResolved, type DeliveryInput } from "./delivery";

const base: DeliveryInput = {
  orderedQuantity: 32,
  previouslyReceived: 0,
  receivedNow: null,
  markedPartial: false,
  damage: false,
  missingItems: false,
  incorrectItems: false,
  needsReplacement: false,
  daysToRequired: 30,
};

describe("evaluateDelivery", () => {
  it("treats a blank quantity as the full outstanding amount", () => {
    const r = evaluateDelivery(base);
    expect(r.quantityThisDelivery).toBe(32);
    expect(r.itemStatus).toBe("delivered");
    expect(r.deliveryStatus).toBe("delivered");
    expect(r.createIssue).toBe(false);
    expect(r.severity).toBeNull();
  });

  it("records a short delivery as partial and opens a medium issue", () => {
    const r = evaluateDelivery({ ...base, receivedNow: 28 });
    expect(r.isPartial).toBe(true);
    expect(r.shortfall).toBe(4);
    expect(r.itemStatus).toBe("partially_delivered");
    expect(r.createIssue).toBe(true);
    expect(r.severity).toBe("medium");
  });

  it("adds up across multiple deliveries", () => {
    const first = evaluateDelivery({ ...base, receivedNow: 20 });
    const second = evaluateDelivery({ ...base, previouslyReceived: first.totalReceived, receivedNow: 12 });
    expect(second.totalReceived).toBe(32);
    expect(second.isPartial).toBe(false);
    expect(second.itemStatus).toBe("delivered");
    // blank = whatever is left
    expect(evaluateDelivery({ ...base, previouslyReceived: 20 }).quantityThisDelivery).toBe(12);
  });

  it("honors the partial checkbox even when quantity matches or is unknown", () => {
    expect(evaluateDelivery({ ...base, receivedNow: 32, markedPartial: true }).itemStatus).toBe("partially_delivered");
    const unknown = evaluateDelivery({ ...base, orderedQuantity: null, markedPartial: true });
    expect(unknown.isPartial).toBe(true);
    expect(unknown.totalReceived).toBe(0);
  });

  it("flags damage, missing parts and wrong product as problems with high severity", () => {
    const r = evaluateDelivery({ ...base, damage: true, missingItems: true, incorrectItems: true });
    expect(r.problems).toEqual(["damaged", "missing components or accessories", "wrong product"]);
    expect(r.itemStatus).toBe("problem");
    expect(r.deliveryStatus).toBe("problem");
    expect(r.severity).toBe("high");
  });

  it("flags receiving more than ordered as an incorrect quantity", () => {
    const r = evaluateDelivery({ ...base, receivedNow: 35 });
    expect(r.problems).toEqual(["incorrect quantity (3 more than ordered)"]);
    expect(r.itemStatus).toBe("problem");
  });

  it("escalates severity when the material is needed within a week", () => {
    expect(evaluateDelivery({ ...base, damage: true, daysToRequired: 5 }).severity).toBe("critical");
    expect(evaluateDelivery({ ...base, damage: true, daysToRequired: -3 }).severity).toBe("critical");
    expect(evaluateDelivery({ ...base, receivedNow: 10, daysToRequired: 2 }).severity).toBe("high");
    expect(evaluateDelivery({ ...base, damage: true, daysToRequired: null }).severity).toBe("high");
  });

  it("a replacement request is a problem on its own", () => {
    const r = evaluateDelivery({ ...base, needsReplacement: true });
    expect(r.problems).toEqual(["replacement needed"]);
    expect(r.itemStatus).toBe("problem");
  });

  it("works when the ordered quantity is unknown", () => {
    const r = evaluateDelivery({ ...base, orderedQuantity: null, receivedNow: 10 });
    expect(r.itemStatus).toBe("delivered");
    expect(r.totalReceived).toBe(10);
    expect(r.shortfall).toBe(0);
  });
});

describe("deliveryIssueTitle", () => {
  it("combines problems and partial delivery", () => {
    const o = evaluateDelivery({ ...base, receivedNow: 28, damage: true });
    expect(deliveryIssueTitle("Windows", o, 32)).toBe("Windows: damaged, partial delivery (28 of 32 received)");
  });
  it("handles partial without a known quantity", () => {
    const o = evaluateDelivery({ ...base, orderedQuantity: null, markedPartial: true });
    expect(deliveryIssueTitle("Doors", o, null)).toBe("Doors: partial delivery");
  });
});

describe("statusAfterIssueResolved", () => {
  it("stays a problem while other delivery issues are open", () => {
    expect(statusAfterIssueResolved({ orderedQuantity: 32, totalReceived: 32, openProblemIssues: 1 })).toBe("problem");
  });
  it("returns to delivered once complete and clean", () => {
    expect(statusAfterIssueResolved({ orderedQuantity: 32, totalReceived: 32, openProblemIssues: 0 })).toBe("delivered");
    expect(statusAfterIssueResolved({ orderedQuantity: null, totalReceived: 5, openProblemIssues: 0 })).toBe("delivered");
  });
  it("returns to partially delivered when quantity is still short", () => {
    expect(statusAfterIssueResolved({ orderedQuantity: 32, totalReceived: 28, openProblemIssues: 0 })).toBe("partially_delivered");
  });
});
