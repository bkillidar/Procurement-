import { createBrowserClient } from "@supabase/ssr";

// Browser client. Uses only the public (publishable) key; access is
// enforced by Row Level Security in the database.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
