# Setup guide (first-time)

## 0. Tools on your computer
1. **Node.js 22 LTS** – https://nodejs.org (installer). Check: open Terminal (Mac) / PowerShell (Windows) → `node -v` → `v22.x.x`. If "not found", reopen the terminal or reinstall.
2. **Git** – https://git-scm.com/downloads. Check: `git --version`.
3. **VS Code** – https://code.visualstudio.com (optional but recommended).

## 1. Get the code
```
git clone https://github.com/bkillidar/Procurement-.git
cd Procurement-
npm install
```
Expect: `added … packages`. If `npm install` errors, send me the last 20 lines.

## 2. Create the Supabase project
1. https://supabase.com → sign in → **New project** (name `dev-ops`, region **East US (N. Virginia)**, save the database password in a password manager).
2. Wait ~2 min until it shows "Healthy".
3. **Project Settings → API Keys**: copy the **Project URL** and the **secret** key (`sb_secret_…`). The secret key is **server-only**: it is used only in `src/lib/supabase/admin.ts`, never in a `NEXT_PUBLIC_` variable, never in browser code.
4. **Authentication → Sign In / Providers**: keep Email enabled. You may turn **off** "Allow new users to sign up" (accounts are created by you, below).

## 3. Local environment variables
Create the file `.env.local` in the project root (it is git-ignored):
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<secret key>
```
The publishable key (`sb_publishable_…`, same API Keys page) is public by design; sign-in and uploads need it.

## 4. Create the database
The database is built from the SQL files in `supabase/migrations`, which must run **in file-name order** (oldest first).
Option A (CLI, recommended): `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
Option B (manual): Supabase dashboard → **SQL Editor → New query** → paste each file in order → **Run**. Each should say "Success". If one fails, stop and send me the full message rather than re-running pieces.

## 5. Run locally
```
npm run dev
```
Open http://localhost:3000 → you are sent to the sign-in page. Sign in with an account you created (next step), then you land on the dashboard. http://localhost:3000/api/health should return `{"ok":true}`.

### Create the accounts
There is no sign-up screen. The owner allows each email and creates the user:
1. Supabase → **SQL Editor**: `insert into public.allowed_emails (email, role) values ('you@company.com', 'owner'), ('partner@company.com', 'owner');` (lowercase emails).
2. Supabase → **Authentication → Users → Add user → Create new user**: email, strong password, tick **Auto Confirm User**. Do this once per person.
3. Sign in at the app's `/login`.
See docs/SECURITY.md for adding/removing people and resetting passwords.

Demo data: Projects → **Load a demo project** creates a realistic DC renovation with materials, deliveries, permits and an issue. Delete it (bottom of its project page) and the "(demo)" vendors when you are done.

## 6. Vercel deployment
1. https://vercel.com → sign up with GitHub → **Add New → Project** → import `Procurement-`. Set **Production Branch** to `main` once code is merged there (preview deployments happen for any branch).
2. **Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (both as plain "Config" values) and `SUPABASE_SECRET_KEY` (as a Secret). See DEPLOYMENT.md.
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
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | yes | yes | no (public; RLS gives it nothing) |
| SUPABASE_SECRET_KEY | yes | yes | **YES – server-only, never NEXT_PUBLIC_, never in browser code** |
