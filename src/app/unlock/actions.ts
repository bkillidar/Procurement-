"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessToken, safeEqual, safeNext } from "@/lib/access";

export async function unlock(formData: FormData) {
  const expected = process.env.APP_ACCESS_PASSWORD;
  const next = safeNext(typeof formData.get("next") === "string" ? String(formData.get("next")) : "/");
  if (!expected) redirect(next); // gate is off

  const given = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  // Compare hashes so the comparison is constant-time regardless of length.
  const ok = safeEqual(await accessToken(given), await accessToken(expected));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    redirect(`/unlock?error=1&next=${encodeURIComponent(next)}`);
  }
  (await cookies()).set(ACCESS_COOKIE, await accessToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export async function lock() {
  (await cookies()).delete(ACCESS_COOKIE);
  redirect("/unlock");
}
