import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// V1 is a single-company app with no login. Every row is still scoped by
// organization_id, so adding real users and more companies later needs no
// data migration. The company row is created on first use.
export async function getOrganization() {
  const db = createAdminClient();
  const { data: existing, error } = await db
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing;

  const { data: created, error: insertError } = await db
    .from("organizations")
    .insert({ name: "My Company" })
    .select("id, name")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created;
}
