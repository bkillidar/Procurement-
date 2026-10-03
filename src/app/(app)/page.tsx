import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("org_members")
    .select("role, organizations(name)")
    .limit(1);
  const membership = memberships?.[0];
  const org = membership?.organizations as { name: string } | { name: string }[] | null | undefined;
  const orgName = Array.isArray(org) ? org[0]?.name : org?.name;

  if (!membership) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        Your account is not part of a company yet. Ask the owner to add you.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{orgName}</h1>
      <p className="text-sm text-slate-600">
        Signed in as <strong>{membership.role}</strong>. Foundation is working: authentication,
        database, and row-level security are connected. Projects and procurement come next.
      </p>
    </div>
  );
}
