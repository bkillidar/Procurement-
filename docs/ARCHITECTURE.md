# Architecture

## Recommendation (simple, production-grade, can grow)
- **One Next.js app** (App Router, TypeScript, Tailwind). Server Components read data; Server Actions write data. No separate API server.
- **Supabase** is the system of record: Postgres (schema via migrations in `supabase/migrations`), Auth, Storage (private `documents` bucket).
- **Security lives in the database.** Every business table has `organization_id` and Row Level Security. The UI hides things, but RLS is what enforces access. Roles: `owner`, `admin` (full), `project_manager`, `member` (read/write, no delete), `viewer` (read-only). New roles = new text value + policy helper tweak.
- **Business rules in pure TypeScript** (`src/lib/domain`), unit-tested with Vitest: required-order-date and procurement-risk calculations. Risks are computed on read (always current, each with a human-readable reason) rather than stored.
- **Browser only ever holds the publishable key.** No service-role key is used in V1.
- **Future-ready:** `follow_ups.source` (email later), `notifications.channel` (email/SMS later), org-scoped tables (multi-company SaaS later), `documents` metadata (AI extraction later).

Deviations from the suggested entity list (on purpose):
- Subcontractors/architects/engineers/lenders/etc. are `contacts` with a `kind` (one reusable contact system); vendors are company records that contacts can belong to.
- `purchase_orders` is deferred: V1 keeps the single current order on `procurement_items` (order number, dates, vendor, cost). Add a PO table when PO generation is built.
- Delivery problems are `deliveries` rows (flags) + an auto-created `issues` row (`delivery_id`).
- Templates are `project_templates` → `template_phases` → `template_tasks` (with `depends_on_keys`).

## Entities
organizations · profiles · org_members · vendors · contacts · projects · project_members · project_phases · project_templates · template_phases · template_tasks · tasks · task_dependencies (task→task or task→procurement item) · procurement_items · procurement_quotes · deliveries · issues · permits_utilities · follow_ups · documents · punch_list_items · activity_log · notifications

## Routes (planned)
| Route | Purpose | Phase |
|---|---|---|
| `/login` | Sign in / create account | 1 ✅ |
| `/` | Portfolio dashboard | 1 shell, 7 full |
| `/projects`, `/projects/new` | List / create (from template) | 2 |
| `/projects/[id]` | Project overview: stage, next steps, risks | 2/7 |
| `/projects/[id]/tasks` | Tasks and dependencies | 2 |
| `/projects/[id]/procurement`, `/…/[itemId]` | Items, quotes, orders, follow-ups, risk | 3 |
| `/projects/[id]/deliveries` | Receive, record problems, photos | 4 |
| `/projects/[id]/issues` | Issue tracker | 4 |
| `/projects/[id]/permits` | Permits & utilities | 5 |
| `/projects/[id]/punch` | Mobile punch list | 6 |
| `/projects/[id]/documents` | Uploads | 4 |
| `/procurement`, `/follow-ups`, `/issues` | Cross-project views | 3–7 |
| `/vendors`, `/contacts` | Directories | 2/3 |
| `/templates` | Project templates | 2 |
| `/settings` | Team & roles | 8 |
| `/api/health` | Connectivity check | 1 ✅ |

## Environments in plain English
- **Your computer**: runs the app with `npm run dev`, reads secrets from `.env.local` (never committed).
- **Supabase** (cloud): the database + login + file storage. One project for now; use a second project for staging if you later want to test risky changes.
- **GitHub**: stores the code. Pushing to `main` triggers Vercel.
- **Vercel**: builds and hosts the app. Its Environment Variables hold the same two Supabase values.
- Database changes are SQL files in `supabase/migrations`, applied to Supabase (CLI `supabase db push`, or paste in the SQL editor for the very first run).
