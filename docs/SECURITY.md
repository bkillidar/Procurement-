# Security

## How data is protected
1. **The browser never talks to the database.** All reads and writes happen in server code (`src/lib/supabase/admin.ts`) using the Supabase **secret key**, which exists only in server environment variables.
2. **Row Level Security is on for every table** (23 of 23) and no policy grants the browser's public key anything, so even someone who copies the public key out of the page gets zero rows. Verified by catalog audit (see below).
3. **Files are private.** The `documents` bucket is not public; links are signed and expire after an hour. Storage policies only allow signed-in members of the company.
4. **Server code re-checks ownership**: every action looks records up with the company id, validates input with zod, and only redirects to same-site paths.
5. **Automated guard rails** (`src/lib/security.test.ts`) fail the build if the secret key is read outside `admin.ts`, a `NEXT_PUBLIC_` variable is named like a secret, a client component imports server-only code, or a server action file loses its `"use server"` marker.

## What is open by design (V1 has no login)
Anyone who knows the site URL can view and change the data. That was a deliberate choice for V1. Reduce the exposure with either or both of:

1. **Shared password (built in).** In Vercel add `APP_ACCESS_PASSWORD` (a long passphrase) and redeploy. Every page, action and upload then requires it (30-day cookie, constant-time compare, slow-down on wrong guesses). A **Lock** button appears in the menu. Remove the variable to turn it off. `/api/health` stays open (it returns no data).
2. **Vercel protection.** Vercel can password-protect or require a Vercel login for a deployment (availability depends on your Vercel plan).

Either way, keep the site URL private. For real per-person accounts and roles, see "Adding users later".

## Audit results (run against the live database)
| Check | Result |
|---|---|
| Public tables with RLS disabled | 0 of 23 |
| Policies that apply to anyone but signed-in users | 0 |
| Policies that are always true | 0 |
| Storage policies limited to signed-in users | 4 of 4; bucket is private |
| Elevated (security definer) functions callable by the anonymous role | 0 |
| Supabase security advisor | Only the 4 RLS helper functions are flagged; they must stay callable by signed-in users and only reveal the caller's own role |

## Keys
| Variable | Where | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | No (public by design; RLS gives it nothing). Needed only for browser uploads |
| `SUPABASE_SECRET_KEY` | Vercel + `.env.local` | **Yes. Server only.** Full database access; rotate it in Supabase if it ever leaks |
| `APP_ACCESS_PASSWORD` | Vercel (optional) | **Yes.** Server only |

Never prefix a secret with `NEXT_PUBLIC_`, never paste one into chat, email or a commit.

## Supabase settings to check
- Authentication → Sign In / Providers: **turn off "Allow new users to sign up"** (the app has no sign-up; a stray account could not read data thanks to RLS, but there is no reason to allow it).
- Project Settings → API Keys: keep the secret key out of anything shared.
- Database → Backups: see DEPLOYMENT.md.

## Adding users later
The schema already supports it: `org_members` (roles: owner, admin, project_manager, member, viewer), the `can_write` / `can_delete` helpers and per-table policies. Adding login means: Supabase Auth sign-in screens, replacing the admin client with a per-user client in the data layer (so RLS enforces roles), and switching the `*_label` name fields to user pickers.
