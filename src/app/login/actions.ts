"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-path";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address"),
  password: z.string().min(1, "Enter your password"),
});

function back(next: string, error: string): never {
  redirect(`/login?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`);
}

export async function signIn(formData: FormData) {
  const next = safeNext(typeof formData.get("next") === "string" ? String(formData.get("next")) : "/");
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(next, parsed.error.issues[0].message);

  let failed = false;
  let message = "";
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data!);
    if (error) {
      failed = true;
      // One generic message: never reveal whether the email exists.
      message = "That email or password isn't right.";
    }
  } catch (e) {
    failed = true;
    message = e instanceof Error ? e.message : "Could not sign in.";
  }
  if (failed) back(next, message);
  redirect(next);
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Nothing to sign out of.
  }
  redirect("/login");
}
