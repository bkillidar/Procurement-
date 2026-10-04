import { changePassword } from "@/app/actions/account";
import { getCurrentUser } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { SubmitButton } from "@/components/submit-button";
import { cardClass, ErrorBanner, inputClass, labelClass, primaryButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AccountPage(props: PageProps<"/account">) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="text-sm text-slate-600">
        Signed in as <strong>{user?.email}</strong>
      </p>
      <ErrorBanner message={error} />
      {sp.saved && (
        <p role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Password changed. Use the new one next time you sign in.
        </p>
      )}
      <form action={changePassword} className={`${cardClass} space-y-3 p-4`}>
        <h2 className="font-medium">Change password</h2>
        <div>
          <label className={labelClass} htmlFor="password">
            New password
          </label>
          <input id="password" name="password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" className={inputClass} />
          <p className="mt-1 text-xs text-slate-500">At least {MIN_PASSWORD_LENGTH} characters. A few random words works well.</p>
        </div>
        <div>
          <label className={labelClass} htmlFor="confirm">
            Type it again
          </label>
          <input id="confirm" name="confirm" type="password" required autoComplete="new-password" autoCapitalize="none" autoCorrect="off" className={inputClass} />
        </div>
        <SubmitButton className={primaryButton}>Change password</SubmitButton>
      </form>
    </div>
  );
}
