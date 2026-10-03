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
3. **Project Settings → API Keys**: copy the **Project URL** and the **secret** key (`sb_secret_…`). The secret key is **server-only**: it is used only in `src/lib/supabase/admin.ts`, never in a `NEXT_PUBLIC_` variable, never in browser code.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" (the app has no login in V1).

## 3. Local environment variables
Create the file `.env.local` in the project root (it is git-ignored):
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
SUPABASE_SECRET_KEY=<secret key>
```

## 4. Create the database
Option A (simplest): Supabase dashboard → **SQL Editor → New query** → paste the entire contents of `supabase/migrations/20261003000000_initial_schema.sql` → **Run**. Expect "Success. No rows returned".
Option B (CLI, recommended once you are comfortable): `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
If you see an error, copy the full message to me; do not re-run partially.

## 5. Run locally
```
npm run dev
```
Open http://localhost:3000 → you land on the dashboard showing your company name (created automatically on first load). Then open http://localhost:3000/api/health → expect `{"ok":true}`. There is no login in V1; the database is only reachable through the server (Row Level Security stays on, so the public key can read nothing).

Optional demo data: SQL Editor → paste `supabase/seed_demo.sql` → Run.

## 6. Vercel deployment
1. https://vercel.com → sign up with GitHub → **Add New → Project** → import `Procurement-`. Set **Production Branch** to `main` once code is merged there (preview deployments happen for any branch).
2. **Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` (same values as `.env.local`).
3. **Deploy**. Expect a URL like `https://procurement-xxxx.vercel.app`.
4. Visit the URL → check `/api/health` → `{"ok":true}`.

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
| SUPABASE_SECRET_KEY | yes | yes | **YES – server-only, never NEXT_PUBLIC_, never in browser code** |
