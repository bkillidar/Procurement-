import { describe, expect, it } from "vitest";
import { buildNotifications, type NotificationInput } from "./notifications";

const TODAY = "2026-10-03";
const empty: NotificationInput = { today: TODAY, tasks: [], items: [], permits: [], issues: [] };
const item = (over: Partial<NotificationInput["items"][number]> = {}): NotificationInput["items"][number] => ({
  id: "i1",
  description: "Windows",
  projectName: "123 Main",
  status: "ordered",
  expected_delivery_date: null,
  risk: { recommendedOrderDate: null, risks: [] },
  followUp: { state: "none", message: "" },
  nextFollowUpOn: null,
  ...over,
});

describe("task notifications", () => {
  const task = (due: string, priority = "medium", status = "ready") => ({
    id: "t1", project_id: "p1", projectName: "123 Main", title: "Submit permit", due_date: due, status, priority,
  });
  it("notifies about overdue and due-soon tasks, escalating high-priority overdue tasks", () => {
    expect(buildNotifications({ ...empty, tasks: [task("2026-10-01")] })[0]).toMatchObject({ kind: "task_overdue", level: "warning" });
    expect(buildNotifications({ ...empty, tasks: [task("2026-10-01", "urgent")] })[0].level).toBe("critical");
    expect(buildNotifications({ ...empty, tasks: [task("2026-10-04")] })[0]).toMatchObject({ kind: "task_due", title: "Task due tomorrow: Submit permit" });
    expect(buildNotifications({ ...empty, tasks: [task("2026-10-03")] })[0].title).toContain("today");
  });
  it("ignores completed tasks, far-off tasks and tasks without dates", () => {
    expect(buildNotifications({ ...empty, tasks: [task("2026-10-01", "medium", "complete"), task("2026-10-20")] })).toEqual([]);
  });
});

describe("procurement notifications", () => {
  it("turns risks into typed notifications with the plain-English reason", () => {
    const n = buildNotifications({
      ...empty,
      items: [
        item({
          risk: {
            recommendedOrderDate: "2026-09-22",
            risks: [{ code: "order_late", level: "critical", message: "Windows is required on Oct 20, 2026." }],
          },
        }),
      ],
    });
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ kind: "needs_ordering", level: "critical", title: "Order now: Windows", href: "/procurement/i1" });
    expect(n[0].body).toContain("required on Oct 20");
    expect(n[0].key).toContain("2026-09-22");
  });

  it("covers confirmation overdue, late delivery, follow-ups and deliveries arriving soon", () => {
    const n = buildNotifications({
      ...empty,
      items: [
        item({
          expected_delivery_date: "2026-10-04",
          followUp: { state: "overdue", message: "Follow-up was due Oct 1." },
          nextFollowUpOn: "2026-10-01",
          risk: {
            recommendedOrderDate: null,
            risks: [
              { code: "unconfirmed", level: "high", message: "No confirmation." },
              { code: "delivery_overdue", level: "high", message: "Late." },
              { code: "follow_up_overdue", level: "medium", message: "dup" },
            ],
          },
        }),
      ],
    });
    expect(n.map((x) => x.kind).sort()).toEqual(["confirmation_overdue", "delivery_late", "delivery_soon", "follow_up_due"]);
  });

  it("does not announce deliveries that already arrived", () => {
    expect(buildNotifications({ ...empty, items: [item({ status: "delivered", expected_delivery_date: "2026-10-04" })] })).toEqual([]);
  });

  it("keys change when the situation changes so a dismissed alert can return", () => {
    const make = (expected: string) =>
      buildNotifications({
        ...empty,
        items: [item({ expected_delivery_date: expected, risk: { recommendedOrderDate: null, risks: [{ code: "delivery_overdue", level: "high", message: "x" }] } })],
      })[0].key;
    expect(make("2026-10-01")).not.toBe(make("2026-10-02"));
  });
});

describe("permit and issue notifications", () => {
  it("notifies about permit delays and follow-ups", () => {
    const n = buildNotifications({
      ...empty,
      permits: [
        { id: "p1", item_type: "Building permit", projectName: "123 Main", followUpDue: true, next_follow_up_on: TODAY, risk: { risks: [{ code: "response_overdue", level: "high", message: "Agency late." }] } },
        { id: "p2", item_type: "Gas cap-off", projectName: "123 Main", followUpDue: true, next_follow_up_on: TODAY, risk: { risks: [] } },
      ],
    });
    // p1: a late response and a follow-up due today are separate alerts; p2: follow-up only.
    expect(n.map((x) => x.kind)).toEqual(["permit_delay", "permit_follow_up", "permit_follow_up"]);
    expect(n[0].href).toBe("/permits/p1");
    expect(n.map((x) => x.href)).toEqual(["/permits/p1", "/permits/p1", "/permits/p2"]);
  });

  it("notifies only about overdue open issues", () => {
    const issue = (status: string, due: string | null, severity = "medium") => ({ id: "s1", title: "Damaged windows", projectName: "123 Main", severity, status, due_date: due });
    expect(buildNotifications({ ...empty, issues: [issue("open", "2026-10-01", "high")] })[0]).toMatchObject({ kind: "issue_overdue", level: "critical" });
    expect(buildNotifications({ ...empty, issues: [issue("resolved", "2026-10-01"), issue("open", "2026-10-09"), issue("open", null)] })).toEqual([]);
  });
});

describe("ordering", () => {
  it("lists critical before warning before info", () => {
    const n = buildNotifications({
      ...empty,
      tasks: [
        { id: "a", project_id: "p", projectName: "P", title: "A", due_date: "2026-10-04", status: "ready", priority: "low" },
        { id: "b", project_id: "p", projectName: "P", title: "B", due_date: "2026-10-01", status: "ready", priority: "urgent" },
        { id: "c", project_id: "p", projectName: "P", title: "C", due_date: "2026-10-01", status: "ready", priority: "low" },
      ],
    });
    expect(n.map((x) => x.level)).toEqual(["critical", "warning", "info"]);
  });
});
