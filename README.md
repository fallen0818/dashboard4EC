# Electric Cooperative Dashboard

Reporting dashboard covering System Loss, Power Supply/WESM Pricing, Billing & Collections, Membership, and Outages.

## Folder structure

- **src/app/** — Next.js App Router pages. `(dashboard)/` groups the five report modules as route segments.
- **src/components/ui/** — Generic reusable primitives (Button, Card, Table, Modal) with no business logic.
- **src/components/charts/** — Chart wrapper components (line, bar, gauge) built on recharts.
- **src/components/dashboard/** — Feature-specific composed views, one subfolder per module (billing, system-loss, power-supply, membership, outages).
- **src/components/layout/** — App chrome: Sidebar, Header, Nav.
- **src/services/** — Data-access layer. All Supabase queries live here, never inside components. One service file per domain.
- **src/models/** — TypeScript types mirroring the Supabase schema, one file per domain, kept in sync with `supabase/migrations/`.
- **src/hooks/** — Data-fetching hooks that wrap services with loading/error state, plus `useAuth`.
- **src/lib/** — Shared constants and utility/formatter functions.
- **src/context/** — Global state providers (currently AuthContext; a branch/period filter context can be added here later).
- **supabase/migrations/** — SQL migration files for the 7 core tables plus the billing/collections module.
- **supabase/seed.sql** — Mock/sample data for local development.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase project values
npm run dev
```
