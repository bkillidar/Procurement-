import { hasServerCredentials } from "@/lib/supabase/admin";
import { getOrganization } from "@/lib/org";

export const dynamic = "force-dynamic";

async function loadOrganization() {
  try {
    return { org: await getOrganization(), error: null };
  } catch (e) {
    return { org: null, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export default async function DashboardPage() {
  if (!hasServerCredentials()) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="font-semibold">One setup step left</p>
        <p className="mt-1">
          Add the <code>SUPABASE_SECRET_KEY</code> environment variable in Vercel (Project →
          Settings → Environment Variables), then redeploy.
        </p>
      </div>
    );
  }

  const { org, error } = await loadOrganization();
  if (!org) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm">
        <p className="font-semibold">Could not reach the database</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{org.name}</h1>
      <p className="text-sm text-slate-600">
        Foundation is working: the app is connected to the database. Projects and procurement come
        next.
      </p>
    </div>
  );
}
