import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public connectivity check: confirms env vars are set and Supabase is reachable.
// Returns no data from the database.
export async function GET() {
  const envOk = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!envOk) return NextResponse.json({ ok: false, error: "Supabase env vars missing" }, { status: 500 });

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").select("id", { head: true, count: "exact" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
