import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only database client. It uses the Supabase secret key, which bypasses
// Row Level Security, so it must never be imported from client components and
// the key must never be given a NEXT_PUBLIC_ name.
// Row Level Security stays ON, so the public (publishable) key cannot read or
// write anything directly; all access goes through this server code.

export function hasServerCredentials() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
