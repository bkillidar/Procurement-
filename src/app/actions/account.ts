"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { firstError, passwordChangeSchema } from "@/lib/validation";

/** Lets a signed-in person set their own password (no Supabase dashboard needed). */
export async function changePassword(formData: FormData) {
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/account?error=${encodeURIComponent(firstError(parsed.error))}`);

  let error: string | undefined;
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("You are not signed in.");
    const supabase = await createClient();
    const { error: ue } = await supabase.auth.updateUser({ password: parsed.data!.password });
    if (ue) throw new Error(ue.message);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not change the password.";
  }
  redirect(error ? `/account?error=${encodeURIComponent(error)}` : "/account?saved=1");
}
