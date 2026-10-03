# Deployment and go-live checklist

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Type in Vercel | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Config (visible) | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Config (visible) | `sb_publishable_…` (**required**: sign-in and uploads) |
| `SUPABASE_SECRET_KEY` | Secret / Sensitive | `sb_secret_…` |

Changing a variable needs a new deployment (Deployments → ⋯ → Redeploy). Use the same values locally in `.env.local`.

## How releases work
Merge a pull request into `main` → Vercel builds and deploys it. Each pull request also gets a preview build. Database changes are SQL files in `supabase/migrations`; apply them to Supabase **before** merging code that needs them (Supabase CLI: `npx supabase db push`, or paste the file into the SQL editor).

## Supabase production settings
- **Backups.** The free plan has no point-in-time recovery and limited backups. For a business database turn on a paid plan with daily backups / PITR (Settings → Add-ons / Backups), and periodically export (`pg_dump`) as well.
- **Accounts**: only emails in `allowed_emails` can exist; create the users in Authentication → Users (see SECURITY.md). Optionally switch sign-ups off.
- **Region** near DC (East US) for speed.
- **Storage**: the `documents` bucket must stay **private**. Default per-file limit is 50 MB.
- **Pause protection**: free projects pause after about a week of inactivity; a paid plan avoids that.

## Vercel production settings
- Production branch: `main`.
- Optional: attach your own domain (Settings → Domains).
- Function region: pick one near the Supabase region (Settings → Functions) for lower latency.

## Go-live checklist
- [ ] All Supabase migrations applied (`supabase/migrations` lists them in order).
- [ ] The three Supabase/Vercel variables are set and a fresh deployment is Ready.
- [ ] `https://<your-site>/api/health` returns `{"ok":true}`.
- [ ] Both accounts exist (Authentication → Users), their emails are in `allowed_emails`, and each can sign in.
- [ ] Backups enabled on a paid Supabase plan.
- [ ] Run [QA.md](QA.md) at least once on a phone (especially the photo upload steps).
- [ ] Sign in from a private/incognito window to confirm the site is closed to everyone else.
- [ ] Delete the demo project (bottom of its page) and the "(demo)" vendors before entering real data.
- [ ] Review the three templates (Templates page) against how you actually work.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Plain "Internal Server Error" or "Sign-in is not configured" | A required env var is missing/misspelled on Vercel; redeploy after fixing |
| "That email or password isn't right" | Wrong password, or the user was not created/confirmed (Authentication → Users; tick Auto Confirm) |
| "This account does not have access" | The user's email is not in `allowed_emails` (add it, then delete and re-create the user) |
| Page says "One setup step left" | `SUPABASE_SECRET_KEY` missing |
| "Could not reach the database" | Wrong URL/key, paused Supabase project, or Supabase outage |
| Photo upload says it needs `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That variable is missing on Vercel |
| Photo upload fails with a size/type message | Over 50 MB or a blocked file type |
