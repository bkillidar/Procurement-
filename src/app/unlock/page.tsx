import { unlock } from "./actions";
import { safeNext } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function UnlockPage(props: PageProps<"/unlock">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : "/");
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Development Ops</h1>
      <form action={unlock} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Access password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
        />
        {sp.error && <p role="alert" className="text-sm text-red-700">That password isn&apos;t right.</p>}
        <button className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">Unlock</button>
      </form>
    </main>
  );
}
