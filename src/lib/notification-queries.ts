import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/org";
import { loadPortfolio } from "@/lib/queries";
import { loadAllItems } from "@/lib/procurement-queries";
import { loadAllPermits } from "@/lib/permit-queries";
import { buildNotifications, type AppNotification } from "@/lib/notifications";

export interface NotificationState {
  all: (AppNotification & { read: boolean })[];
  unreadCount: number;
}

/** Live notifications minus the ones already marked as read. Cached per request. */
export const loadNotifications = cache(async (): Promise<NotificationState> => {
  const { db, orgId } = await getContext();
  const [portfolio, { items }, { permits }, issueRes, readRes] = await Promise.all([
    loadPortfolio(),
    loadAllItems(),
    loadAllPermits(),
    db.from("issues").select("id, project_id, title, severity, status, due_date").eq("organization_id", orgId),
    db.from("notifications").select("dedupe_key").eq("organization_id", orgId).is("user_id", null).not("read_at", "is", null),
  ]);
  if (issueRes.error) throw new Error(issueRes.error.message);
  if (readRes.error) throw new Error(readRes.error.message);

  const live = new Set(portfolio.projects.filter((p) => p.status === "active" || p.status === "planning").map((p) => p.id));
  const names = new Map(portfolio.projects.map((p) => [p.id, p.name]));
  const notifications = buildNotifications({
    today: portfolio.today,
    tasks: portfolio.open.map((t) => ({
      id: t.id,
      project_id: t.project_id,
      projectName: t.projectName,
      title: t.title,
      due_date: t.due_date,
      status: t.status,
      priority: t.priority,
    })),
    items: items.filter((i) => live.has(i.project_id)),
    permits: permits.filter((p) => live.has(p.project_id)),
    issues: (issueRes.data ?? [])
      .filter((i) => live.has(i.project_id))
      .map((i) => ({ ...i, projectName: names.get(i.project_id) ?? "" })),
  });

  const read = new Set((readRes.data ?? []).map((r) => r.dedupe_key));
  const all = notifications.map((n) => ({ ...n, read: read.has(n.key) }));
  return { all, unreadCount: all.filter((n) => !n.read).length };
});
