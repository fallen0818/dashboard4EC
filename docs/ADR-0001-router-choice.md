# ADR-0001 — Pages Router vs App Router (Next.js 16)

Status: **Open — decide before adding the next feature**
Date: 2026-09-10

## Context

The project is on Next.js 16 with the **Pages Router** (`src/pages/*`).
`AGENTS.md` warns "This is NOT the Next.js you know" — Next 16 is
App-Router-first and much of the new documentation and library guidance
assumes `app/`. The surface today is 7 pages, all backed by Supabase.
Auth is enforced client-side in `_app.tsx` (redirect on hydration), and
every DB query runs from the browser with the anon key.

## Options

### A. Stay on Pages Router
- Pros: no migration work; existing hooks/repos keep working; ships.
- Cons: no React Server Components (every dashboard load waterfalls
  6+ Supabase requests from the browser); no server actions, so
  mutations stay in client repositories; no middleware auth gate — RLS
  is the only real boundary; future-you is fighting the docs.

### B. Migrate to App Router now
- Pros: server components can query Supabase with a cookie-scoped
  session on the server (`@supabase/ssr`) — no anon-key round-trip from
  the browser, and `middleware.ts` becomes the real auth gate; server
  actions replace half the client repositories; aligns with Next 16
  docs and `AGENTS.md`.
- Cons: ~1–2 days of migration for 7 pages plus repo/hook rework;
  add `@supabase/ssr`; Recharts must live behind `"use client"`.

### C. Hybrid — new pages in `app/`, leave existing in `pages/`
- Pros: cheap; buys time.
- Cons: two auth models (client redirect vs middleware), two data
  patterns, two conventions. Every new page pays a small cognitive tax.
  Usually the worst long-term outcome.

## Recommendation

**Option B — migrate now, while the surface is small (7 pages).** The
cost is bounded, and the security/perf upside (server-side auth,
server-rendered dashboards, generated types feeding into RSCs) is what
the review flagged as the biggest lever. Do it before adding the next
feature; each new Pages-Router page raises the migration bill.

## Decision

_TBD._
