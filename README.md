# Development Ops

Operations and procurement management for a residential real-estate development company (DC / MD / VA renovations and new construction).

It connects **schedule → task dependencies → material lead times → order dates → vendor follow-up → delivery → downstream construction**, and tells you what is at risk *before* you discover it yourself.

Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Storage) · Vercel.

## What it does
| Area | What you get |
|---|---|
| **Dashboard** | Overdue / due-soon tasks, materials flagged / to order / awaiting confirmation, vendor follow-ups due, late and upcoming deliveries, permit & utility delays, open issues, open punch items, recent activity |
| **Projects** | Created from editable templates (DC renovation, Maryland renovation, new construction): phases, tasks, due dates, dependencies. Phases advance automatically |
| **Procurement** | Items with quotes, vendor selection, order placement, vendor confirmation, expected-delivery tracking, follow-up log. Rule-based risk with a plain-English reason for every flag |
| **Deliveries & issues** | Receive partial / damaged / missing / wrong deliveries, auto-created issues, photos, replacement orders |
| **Permits & utilities** | Status, agency, reference numbers, follow-ups, delay detection tied to the schedule task each permit gates |
| **Punch list** | Phone-first quick entry, photos, assignment, verification; drives the schedule's punch-list tasks |
| **Notifications** | Computed live from real data (never stale); header bell with unread count |
| **Search, activity, tasks** | Global search, activity feed, cross-project task view |
| **Documents** | Private Supabase Storage with signed links; direct browser uploads |

## Docs
- **[docs/SETUP.md](docs/SETUP.md)** – first-time setup (local, Supabase, GitHub, Vercel)
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** – going live: env vars, Supabase/Vercel settings, backups, checklist
- **[docs/SECURITY.md](docs/SECURITY.md)** – how data is protected, what is open by design, how to lock the site
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** – architecture, data model, routes, business rules
- **[docs/QA.md](docs/QA.md)** – manual test checklist for every workflow

## Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Local dev server at http://localhost:3000 |
| `npm run build` | Production build (what Vercel runs) |
| `npm run lint` | Lint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (risk rules, dates, dependencies, validation, security guard rails…) |

## First look
Projects → **Load a demo project** creates a realistic DC renovation with materials, deliveries, permits and an issue so every screen has something to show. Delete it from the bottom of its page when you are done.
