import Link from "next/link";
import { loadNotifications } from "@/lib/notification-queries";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { cardClass, EmptyState, secondaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const DOT: Record<string, string> = { critical: "bg-red-600", warning: "bg-amber-500", info: "bg-blue-500" };

export default async function NotificationsPage() {
  const { all, unreadCount } = await loadNotifications();
  const unread = all.filter((n) => !n.read);
  const read = all.filter((n) => n.read);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button className={secondaryButton}>Mark all read</button>
          </form>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Alerts are worked out from your projects, materials, permits and issues, so they always reflect what is true right now. Marking one read hides it until the situation changes.
      </p>

      {unread.length === 0 ? (
        <EmptyState>You&apos;re all caught up. 🎉</EmptyState>
      ) : (
        <ul className="space-y-2">
          {unread.map((n) => (
            <li key={n.key} className={`${cardClass} space-y-2 p-4`}>
              <div className="flex items-start gap-3">
                <span aria-hidden className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[n.level]}`} />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.body}</p>
                  <p className="text-xs text-slate-500">{n.projectName}</p>
                </div>
              </div>
              <div className="flex gap-2 pl-5">
                <Link href={n.href} className={secondaryButton}>
                  Open
                </Link>
                <form action={markNotificationRead}>
                  <input type="hidden" name="key" value={n.key} />
                  <button className={secondaryButton}>Mark read</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {read.length > 0 && (
        <details className={`${cardClass} p-4`}>
          <summary className="cursor-pointer text-sm font-medium text-slate-600">Read ({read.length})</summary>
          <ul className="mt-3 divide-y divide-slate-100">
            {read.map((n) => (
              <li key={n.key} className="py-2 text-sm">
                <Link href={n.href} className="font-medium underline">
                  {n.title}
                </Link>
                <p className="text-slate-500">{n.projectName}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
