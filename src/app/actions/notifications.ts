"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/org";
import { loadNotifications } from "@/lib/notification-queries";

async function markRead(keys: { key: string; kind: string; title: string; body: string; href: string }[]) {
  if (keys.length === 0) return;
  const { db, orgId } = await getContext();
  const { data: existing } = await db
    .from("notifications")
    .select("dedupe_key")
    .eq("organization_id", orgId)
    .is("user_id", null)
    .in("dedupe_key", keys.map((k) => k.key));
  const have = new Set((existing ?? []).map((e) => e.dedupe_key));
  const now = new Date().toISOString();
  const fresh = keys.filter((k) => !have.has(k.key));
  if (fresh.length) {
    await db.from("notifications").insert(
      fresh.map((k) => ({
        organization_id: orgId,
        user_id: null,
        kind: k.kind,
        title: k.title.slice(0, 300),
        body: k.body,
        link: k.href,
        channel: "in_app",
        dedupe_key: k.key,
        read_at: now,
      })),
    );
  }
  if (have.size) {
    await db.from("notifications").update({ read_at: now }).eq("organization_id", orgId).is("user_id", null).in("dedupe_key", [...have]);
  }
}

/** Marks one notification read. Only keys that are currently live are accepted. */
export async function markNotificationRead(formData: FormData) {
  const key = formData.get("key");
  if (typeof key === "string") {
    const { all } = await loadNotifications();
    const n = all.find((x) => x.key === key);
    if (n) await markRead([n]);
  }
  revalidatePath("/notifications");
  revalidatePath("/");
  redirect("/notifications");
}

export async function markAllNotificationsRead() {
  const { all } = await loadNotifications();
  await markRead(all.filter((n) => !n.read));
  revalidatePath("/notifications");
  revalidatePath("/");
  redirect("/notifications");
}
