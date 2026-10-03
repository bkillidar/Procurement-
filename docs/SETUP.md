# Setup guide (first-time)

## 0. Tools on your computer
1. **Node.js 22 LTS** – https://nodejs.org (installer). Check: open Terminal (Mac) / PowerShell (Windows) → `node -v` → `v22.x.x`. If "not found", reopen the terminal or reinstall.
2. **Git** – https://git-scm.com/downloads. Check: `git --version`.
3. **VS Code** – https://code.visualstudio.com (optional but recommended).

## 1. Get the code
```
git clone https://github.com/bkillidar/Procurement-.git
cd Procurement-
git checkout claude/realestate-ops-platform-3yjchv
npm install
```
Expect: `added … packages`. If `npm install` errors, send me the last 20 lines.

## 2. Create the Supabase project
1. https://supabase.com → sign in → **New project** (name `dev-ops`, region **East US (N. Virginia)**, save the database password in a password manager).
2. Wait ~2 min until it shows "Healthy".
3. **Project Settings → API Keys**: copy the **Project URL** and the **publishable** key (`sb_publishable_…`). Do NOT use the secret / service_role key anywhere in this app.
4. **Authentication → Sign In / Providers → Email**: for testing, turn **off** "Confirm email" so sign-up logs you in immediately (turn it back on for production).

## 3. Local environment variables
Create the file `.env.local` in the project root (it is git-ignored):
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

## 4. Create the database
Option A (simplest): Supabase dashboard → **SQL Editor → New query** → paste the entire contents of `supabase/migrations/20261003000000_initial_schema.sql` → **Run**. Expect "Success. No rows returned".
Option B (CLI, recommended once you are comfortable): `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
If you see an error, copy the full message to me; do not re-run partially.

## 5. Run locally
```
npm run dev
```
Open http://localhost:3000 → you are sent to `/login` → **Create account**. The **first** account becomes the company **Owner** automatically. After you land on the dashboard showing "My Company · owner", open http://localhost:3000/api/health → expect `{"ok":true}`.
Then lock sign-ups: Supabase → Authentication → Sign In / Providers → turn **off** "Allow new users to sign up" (add teammates via Authentication → Users → Add user, then add them to `org_members`; an invite screen comes in Phase 8).

Optional demo data: SQL Editor → paste `supabase/seed_demo.sql` → Run.

## 6. Vercel deployment
1. https://vercel.com → sign up with GitHub → **Add New → Project** → import `Procurement-`. Set **Production Branch** to `main` once code is merged there (preview deployments happen for any branch).
2. **Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as `.env.local`) for Production, Preview and Development.
3. **Deploy**. Expect a URL like `https://procurement-xxxx.vercel.app`.
4. Supabase → **Authentication → URL Configuration**: set **Site URL** to the Vercel URL and add `https://<your-vercel-domain>/auth/callback` to Redirect URLs.
5. Visit the URL → sign in → check `/api/health` → `{"ok":true}`.

## Git workflow
Work on a branch, commit small, push, Vercel builds a preview, merge to `main` when it looks right.
```
git checkout -b feature/something
git add -A && git commit -m "Describe the change" && git push -u origin feature/something
```

## Variable cheat sheet
| Variable | Local `.env.local` | Vercel | Secret? |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | yes | yes | no |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | yes | yes | no (protected by RLS) |
| Supabase secret / service_role key | not used | not used | **YES – never in browser code** |
