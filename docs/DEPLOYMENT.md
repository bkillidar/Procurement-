# Deployment and go-live checklist

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Type in Vercel | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Config (visible) | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Config (visible) | `sb_publishable_…` (needed for photo/document uploads) |
| `SUPABASE_SECRET_KEY` | Secret / Sensitive | `sb_secret_…` |
| `APP_ACCESS_PASSWORD` | Secret / Sensitive | optional: turns on the password screen |

Changing a variable needs a new deployment (Deployments → ⋯ → Redeploy). Use the same values locally in `.env.local`.

## How releases work
Merge a pull request into `main` → Vercel builds and deploys it. Each pull request also gets a preview build. Database changes are SQL files in `supabase/migrations`; apply them to Supabase **before** merging code that needs them (Supabase CLI: `npx supabase db push`, or paste the file into the SQL editor).

## Supabase production settings
- **Backups.** The free plan has no point-in-time recovery and limited backups. For a business database turn on a paid plan with daily backups / PITR (Settings → Add-ons / Backups), and periodically export (`pg_dump`) as well.
- **Sign-ups off** (Authentication → Sign In / Providers).
- **Region** near DC (East US) for speed.
- **Storage**: the `documents` bucket must stay **private**. Default per-file limit is 50 MB.
- **Pause protection**: free projects pause after about a week of inactivity; a paid plan avoids that.

## Vercel production settings
- Production branch: `main`.
- Optional: attach your own domain (Settings → Domains).
- Consider turning on the app password (`APP_ACCESS_PASSWORD`) and/or Vercel's deployment protection; see SECURITY.md.
- Function region: pick one near the Supabase region (Settings → Functions) for lower latency.

## Go-live checklist
- [ ] All Supabase migrations applied (`supabase/migrations` lists them in order).
- [ ] Three Supabase/Vercel variables set (four with the password) and a fresh deployment is Ready.
- [ ] `https://<your-site>/api/health` returns `{"ok":true}`.
- [ ] Sign-ups disabled in Supabase.
- [ ] Backups enabled on a paid Supabase plan.
- [ ] Run [QA.md](QA.md) at least once on a phone (especially the photo upload steps).
- [ ] Decide on access protection (password screen / Vercel protection) and share the URL only with your team.
- [ ] Delete the demo project (bottom of its page) and the "(demo)" vendors before entering real data.
- [ ] Review the three templates (Templates page) against how you actually work.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| Plain "Internal Server Error" everywhere | A required env var is missing/misspelled on Vercel; redeploy after fixing |
| Page says "One setup step left" | `SUPABASE_SECRET_KEY` missing |
| "Could not reach the database" | Wrong URL/key, paused Supabase project, or Supabase outage |
| Photo upload says it needs `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That variable is missing on Vercel |
| Photo upload fails with a size/type message | Over 50 MB or a blocked file type |
