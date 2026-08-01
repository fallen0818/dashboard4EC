# Electric Cooperative Dashboard

Reporting dashboard covering System Loss, Power Supply/WESM Pricing, Billing & Collections, Membership, and Outages.

## Stack

- **Next.js 14** (App Router) with **React 18** and **TypeScript 5**.
- **Supabase** for Postgres, auth, and row-level security, accessed via `@supabase/ssr` (cookie-based sessions).
- **Custom CSS** — design tokens and component styles live in `src/app/globals.css` (CSS variables). This project does not use Tailwind.

## Folder structure

- **src/app/** — Next.js App Router pages. `(dashboard)/` groups the five report modules as route segments.
- **src/components/ui/** — Generic reusable primitives (Button, Card, Table, Modal) with no business logic.
- **src/components/dashboard/** — Feature-specific composed views, one subfolder per module (billing, system-loss, power-supply, membership, outages). Charts are rendered with `recharts` inside these views.
- **src/components/layout/** — App chrome: Sidebar, Header, Nav.
- **src/services/** — Data-access layer. All Supabase queries live here, never inside components. One service file per domain, plus `services/supabase/` (browser + server clients).
- **src/models/** — TypeScript types mirroring the Supabase schema, one file per domain, kept in sync with `supabase/migrations/`.
- **src/hooks/** — Data-fetching hooks that wrap services with loading/error state, plus `useAuth`.
- **src/lib/** — Shared constants and utility/formatter functions.
- **src/context/** — Global state providers (currently AuthContext; a branch/period filter context can be added here later).
- **middleware.ts** — Server-side route protection; redirects unauthenticated requests to `/login`.
- **supabase/migrations/** — SQL migration files for the core tables, RLS policies, and the billing/collections module. Sample data is seeded inline within the migrations (there is no separate `seed.sql`).

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project values
npm run dev
```

## Database migrations

The SQL under `supabase/migrations/` is the source of truth for the database. The
app code (types, services, queries) assumes every migration has been applied — if
the running database is behind the code you'll see PostgREST errors such as `404`
(table not found) or `400` (unknown column / embedded relation).

Apply them **in filename order** with the Supabase CLI on a linked project:

```bash
supabase db push
```

Or, without the CLI, open the project's **SQL Editor**, paste each pending
migration file's contents in order, and run it. Running via the SQL Editor also
refreshes the PostgREST schema cache so newly added columns and relationships
resolve immediately.

Notes:

- Migrations are **run-once** and not all are idempotent — `CREATE POLICY` and
  `ADD CONSTRAINT` statements error if a file is applied twice. Apply each new
  migration a single time.
- Sample/mock data is seeded inline within the migrations; there is no separate
  `seed.sql`.
- After schema changes, verify: e.g. `power_suppliers` returns rows and
  `power_supply` has a `supplier_id` column (migration `0011`), and the
  `record_payment` function exists (migration `0010`).

## Scripts

- `npm run dev` / `build` / `start` — Next.js dev server, production build, production server.
- `npm run lint` — ESLint (`next/core-web-vitals`).
- `npm run type-check` — `tsc --noEmit`.
- `npm test` / `test:watch` — Jest (jsdom + Testing Library).
- `npm run format` — Prettier over `src/`.
