# Security

## Who can get in
**Only people you add.** The app needs a signed-in account for every page, form, action and upload; there is no public area except the sign-in page and a health check that returns no data.

Three layers enforce it:
1. **Allowlist in the database.** Supabase refuses to create an account for any email not in `allowed_emails` (a trigger on `auth.users`). Even if sign-ups were switched on by mistake, a stranger cannot make an account.
2. **Sign-in on every request.** The proxy validates the session with Supabase on each request and redirects visitors to `/login` (forms and actions without a session get a 401). The one function that hands out database access, `getContext()` in `src/lib/org.ts`, checks again: signed-in **and** a member of the company.
3. **Row Level Security** on all 23 tables, with no policy for the browser's public key, as defence in depth (see audit below).

## Adding or removing a person
There are no sign-up screens by design. To add someone (needs the owner's access to Supabase):
1. Allow their email (SQL editor): `insert into public.allowed_emails (email, role) values ('name@company.com', 'owner');` (lowercase; roles: owner, admin, project_manager, member, viewer).
2. Supabase → Authentication → Users → **Add user → Create new user**: their email, a strong password, tick **Auto Confirm User**. They sign in at `/login` right away (no email is sent).

To remove someone: Authentication → Users → delete the user, and delete their row from `allowed_emails`.
To reset a password: Authentication → Users → the user → send a reset or set a new password.

Roles are stored (`org_members.role`) and enforced by the database policies, but the app itself currently treats every signed-in member the same. Both V1 accounts are owners.

## How data is protected
1. **The browser never reads business data directly.** Reads and writes happen in server code with the server-only secret key, and only after the access check above. The public key is used only to sign people in and ask "who is this?".
2. **Files are private.** The `documents` bucket is not public; links are signed and expire after an hour; uploads use one-time signed URLs created after the access check.
3. **Server code re-checks ownership**: every action looks records up with the company id, validates input with zod, and only redirects to same-site paths.
4. **Automated guard rails** (`src/lib/security.test.ts`) fail the build if the secret key is read outside `admin.ts`, only the data door / admin module / health check create the admin client, a `NEXT_PUBLIC_` variable is named like a secret, a client component imports server-only code, or a server action file loses its `"use server"` marker.

## Audit results (run against the live database)
| Check | Result |
|---|---|
| Public tables with RLS disabled | 0 of 23 (plus `allowed_emails`, RLS on, no policies) |
| Policies that apply to anyone but signed-in users | 0 |
| Policies that are always true | 0 |
| Storage policies limited to signed-in users | 4 of 4; bucket is private |
| Elevated (security definer) functions callable by the anonymous role | 0 |
| Account creation for an email not on the allowlist | Rejected ("This email is not allowed to create an account") |
| Supabase security advisor | Only the 4 RLS helper functions are flagged; they must stay callable by signed-in users and only reveal the caller's own role |

## Keys
| Variable | Where | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | No (public by design). **Required**: sign-in and uploads use it. Changing it needs a redeploy (it is built into the app) |
| `SUPABASE_SECRET_KEY` | Vercel + `.env.local` | **Yes. Server only.** Full database access; rotate it in Supabase if it ever leaks |

Never prefix a secret with `NEXT_PUBLIC_`, never paste one into chat, email or a commit.

## Supabase settings to check
- Authentication → Sign In / Providers: you may switch **off** "Allow new users to sign up" for extra safety (the allowlist already blocks strangers, but there is no reason to leave it on).
- Authentication → Sign In / Providers → Email: password sign-in must stay enabled.
- Project Settings → API Keys: keep the secret key out of anything shared.
- Database → Backups: see DEPLOYMENT.md.
