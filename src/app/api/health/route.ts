import { NextResponse } from "next/server";
import { createAdminClient, hasServerCredentials } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Connectivity check: confirms env vars are set and the database is reachable.
// Returns no data from the database.
export async function GET() {
  if (!hasServerCredentials()) {
    return NextResponse.json(
      { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY is missing" },
      { status: 500 },
    );
  }
  const { error } = await createAdminClient()
    .from("organizations")
    .select("id", { head: true, count: "exact" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
