# Architecture

## Shape
- **One Next.js app** (App Router, TypeScript, Tailwind). Server Components read data; Server Actions write data. No separate API server.
- **Supabase** is the system of record: Postgres (schema through migrations in `supabase/migrations`) and a private Storage bucket (`documents`).
- **All database access is server-side** through one client, `src/lib/supabase/admin.ts`, which uses the server-only secret key. Row Level Security is enabled on every table with no policy for the public (browser) key, so the browser cannot read or write data directly. See [SECURITY.md](SECURITY.md).
- **V1 has no login.** There is one company (`organizations` row, created on first use); every row still carries `organization_id`, so real users, roles and multiple companies can be added later without a data migration (the `org_members`, role helper functions and RLS policies for that already exist). An optional shared password (`APP_ACCESS_PASSWORD`) can lock the whole site.
- **Business rules are pure TypeScript** in `src/lib`, unit-tested with Vitest, with no database or framework code inside: `procurement.ts` (order-date math and risk), `permits.ts`, `delivery.ts`, `tasks.ts` (dependencies, phase progression), `punch.ts`, `notifications.ts`, `dates.ts`, `validation.ts`, `documents.ts`, `access.ts`.
- **Risk and notifications are computed on read**, always current, each with a human-readable reason. Only "marked read" is stored.
- **Uploads go straight from the browser to Storage** through one-time signed URLs (Vercel limits request bodies to ~4.5 MB; phone photos are bigger). Photos are shrunk on the device first. Files are served through one-hour signed links.

## Data flow for a typical action
Form → Server Action (validates with zod, checks the record belongs to the company, writes with the admin client, logs to `activity_log`, re-syncs task/phase status) → redirect → Server Component re-reads and renders.

## Key rules
- **Required-order date** = required-on-site date − lead time (item lead time, else the vendor's typical lead time).
- **Procurement risk** (`assessRisk`): late/soon to order, missing lead time, unconfirmed order (3 / 7 days), overdue or late delivery, projected late arrival, partial delivery, problem, overdue follow-up, downstream task waiting on the material.
- **Permit risk** (`assessPermit`): overdue agency response, no response, delayed, information required, overdue follow-up, permit not submitted while its schedule task is coming due.
- **Task status** follows dependencies (task → task, or task → procurement item "received"); manual statuses (in progress / waiting / blocked / complete) are never overridden. **Phases** are complete when all their tasks are; the current phase is the first with open work.
- **Cross-links**: a permit can gate a task (approval completes it); the punch list drives "Create punch list" / "Complete punch list items"; delivering material unblocks tasks that depend on it.

## Entities
organizations · profiles · org_members · vendors · contacts · projects · project_members · project_phases · project_templates · template_phases · template_tasks · tasks · task_dependencies · procurement_items · procurement_quotes · deliveries · issues · permits_utilities · follow_ups · documents · punch_list_items · activity_log · notifications

Deliberate deviations from the suggested list:
- Subcontractors, architects, engineers, lenders and agency contacts are `contacts` with a `kind`; vendors are company records contacts can belong to.
- `purchase_orders` is deferred: V1 keeps the single current order on `procurement_items` (PO number, dates, vendor, cost). Add a PO table when PO generation is built.
- Delivery problems are `deliveries` rows (flags) plus an auto-created `issues` row.
- Because there are no user accounts yet, "who" fields (task assignee, issue owner, follow-up responsible, punch assignee) are plain names (`*_label` columns) next to the user-id columns that real accounts will use.

## Routes
| Route | Purpose |
|---|---|
| `/` | Portfolio dashboard |
| `/projects`, `/projects/new`, `/projects/[id]` | Projects, project page (needs-attention summary, phases, tasks, procurement / permits / punch cards, activity) |
| `/projects/[id]/punch`, `/punch`, `/punch/[id]` | Punch list per project, overview, item |
| `/tasks` | Cross-project tasks |
| `/procurement`, `/procurement/new`, `/procurement/[id]` | Materials |
| `/permits`, `/permits/new`, `/permits/[id]` | Permits and utilities |
| `/issues`, `/issues/new`, `/issues/[id]` | Issue tracker |
| `/documents` | Uploads by project and type |
| `/vendors`, `/contacts`, `/templates` | Directories and templates |
| `/notifications`, `/search`, `/activity` | Alerts, search, activity feed |
| `/unlock` | Password screen (only when `APP_ACCESS_PASSWORD` is set) |
| `/api/health` | Connectivity check (returns no data) |

## Prepared for, not built
Email/SMS (`notifications.channel`, `follow_ups.source`), Gmail/Outlook ingestion, vendor and subcontractor portals, accounting/QuickBooks, PO generation and invoice matching, schedule integrations, AI extraction from plans/quotes/invoices, automatic takeoffs, historical vendor lead-time analysis, multi-company SaaS (everything is organization-scoped).

## Environments in plain English
- **Your computer** runs the app with `npm run dev` and reads `.env.local`.
- **Supabase** (cloud) holds the database and files.
- **GitHub** stores the code; merging to `main` makes Vercel redeploy.
- **Vercel** builds and hosts the app; its Environment Variables hold the Supabase values.
- Database changes are SQL files in `supabase/migrations`.
