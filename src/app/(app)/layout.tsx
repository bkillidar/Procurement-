import Link from "next/link";
import { Nav } from "@/components/nav";
import { hasServerCredentials } from "@/lib/supabase/admin";
import { loadNotifications } from "@/lib/notification-queries";
import { signOut } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/auth";

async function unreadCount() {
  if (!hasServerCredentials()) return 0;
  try {
    return (await loadNotifications()).unreadCount;
  } catch {
    return 0; // never break the whole app because the bell could not load
  }
}

async function currentEmail() {
  try {
    return (await getCurrentUser())?.email ?? "";
  } catch {
    return "";
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const unread = await unreadCount();
  const email = await currentEmail();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pt-3">
        <div className="mb-2 flex items-center gap-3">
          <Link href="/" className="shrink-0 font-semibold">
            Development Ops
          </Link>
          <form action="/search" className="min-w-0 flex-1">
            <input
              name="q"
              type="search"
              placeholder="Search…"
              aria-label="Search"
              className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-base"
            />
          </form>
          <Link href="/notifications" aria-label={`Notifications, ${unread} unread`} className="relative shrink-0 rounded-md p-2 text-xl hover:bg-slate-100">
            🔔
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Nav />
          </div>
          <Link href="/account" className="mb-2 shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">
            Account
          </Link>
          <form action={signOut} className="shrink-0 pb-2">
            <button
              title={email ? `Signed in as ${email}` : undefined}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 pb-16">{children}</main>
    </div>
  );
}
