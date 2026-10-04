import { signIn } from "./actions";
import { safeNext } from "@/lib/safe-path";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : "/");
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Development Ops</h1>
        <p className="text-sm text-slate-500">Private. Sign in with your account.</p>
      </div>
      <form action={signIn} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        <SubmitButton pendingText="Signing in…" className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white">
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
