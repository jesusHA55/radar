# Radar

**A flight-price radar.** Watch a route, explore the cheapest places you could
fly from an airport, and find the fairest meeting point for a group — all
bounded by a shared **flexible-dates** window.

> Status: all three features work end-to-end on deterministic demo data, behind
> invite-only auth. Web push is the only outstanding item.

---

## Features

**1. Monitor a connection** — Watch a route (e.g. `STR → BCN`) across a flexible
date window. Radar polls the fare on a schedule, keeps a price history, and
emails you when a threshold is crossed (a target price, a % drop, or any new
low).

**2. Explore cheap destinations** — Give a source airport and a date window.
Radar ranks everywhere you could fly — by *cheapest*, *best value* (€ per hour in
the air), *fastest*, or *leaving soonest* — and lets you refine by budget, flight
time, direct-only, and country.

**3. Meet in the middle** — N people, N origins, one destination. Radar
intersects everyone's reachable destinations, sums the fares, and aligns you all
onto the same dates so the shared window is exact.

Everything is bounded by a shared **flexible-dates** control — the same
`DateWindow` drives the UI, the URL, and the query layer.

Platform features: **invite-only passwordless auth**, **saved searches**, and a
**quota dashboard**.

## Quick start

Requirements: **Node.js 20.9+** and npm.

```bash
npm install
npm run dev
```

`npm run dev` does everything in order:

1. starts an embedded **PostgreSQL** cluster (`scripts/db-server.mjs`)
2. applies migrations and seeds reference data
3. starts `next dev` at <http://localhost:3000>

Then open the app and **sign in as `you@radar.local`**. No email account is
needed: the magic link is printed to the console and shown inline on the sign-in
page in development.

> AI coding agents: this project uses **Next.js 16**, which differs from older
> versions. See `AGENTS.md` and the bundled docs in `node_modules/next/dist/docs/`.

## How it works

### A shared flexible-dates abstraction

Monitor, Explore and Meet all bottom out on the same query shape
(`src/lib/domain/date-window.ts`): a span of acceptable departure dates, an
optional return span, and optional trip-length constraints. The URL, the
calendar component and the provider layer all speak this one language.

### Mock-first, provider-agnostic

The obvious API for this product — Amadeus Self-Service, which shipped dedicated
*Flight Inspiration Search* and *Flight Cheapest Date Search* endpoints — was
**decommissioned in 2026**. The practical options today (Air Scraper/Skyscanner,
SerpApi/Google Flights, Duffel, Kiwi) all cost money, and their free tiers are
far too small to run real monitoring.

So Radar is built **mock-first**: every feature is developed and demoed against a
deterministic offline provider (`src/lib/flights/mock.ts`), and a real provider
plugs in behind the same `FlightProvider` interface with a config change
(`FLIGHT_PROVIDER=airscraper`). Zero cost today, no rewrite tomorrow.

```
FlightProvider
  searchOffers(spec)       → specific route over a window
  priceCalendar(spec)      → per-day prices
  everywhere(spec)         → cheapest destinations from an origin
                             (powers Explore, and Meet)
```

### The provider gateway

Every feature reads flights through `src/lib/gateway/`, which layers a
Postgres-backed response cache and usage metering over the provider. Cache hits
never reach upstream, so they never consume the quota budget; monitoring always
requests fresh data (a cached price defeats the point). This is the foundation
for quota-aware polling and pay-as-you-go billing.

### The monitor engine

`src/lib/monitor/engine.ts` quotes a watch (with a deterministic day-to-day
market multiplier so history moves), persists the observation, evaluates the
threshold, and dispatches an alert with an anti-spam cooldown. It runs three
ways: `POST /api/cron/poll` (schedulers), `npm run poll`, and `npm run poll:loop`.

### The Meet optimizer

`src/lib/meet/optimize.ts` fans `everywhere` out over each origin (cached),
intersects the destination sets, shortlists by naive total, then aligns everyone
onto a common anchor departure for the same `togetherNights` — so the shared
overlap window is exact. Call volume is bounded and every sub-search is cached.

### Authentication

Invite-only and passwordless. A magic link is emailed via Resend, or logged in
development. Tokens are 256-bit random and stored **hashed** only; login links
are single-use and expire in 15 minutes. Sessions live in an httpOnly,
SameSite=lax cookie (hash at rest, 30-day expiry). A single **proxy**
(`src/proxy.ts`) gates every route except the sign-in flow and the
secret-protected cron endpoint.

## Tech stack

- **Next.js 16** (App Router, Cache Components / Partial Prerendering, Turbopack)
  and **React 19**
- **TypeScript**, **Tailwind CSS v4**
- **PostgreSQL** via **Drizzle ORM** and the **postgres-js** driver
- **Embedded PostgreSQL** for local development; hosted (Supabase/Neon)-ready
- **Resend** for alert + sign-in emails (console fallback in dev)

## Project structure

```
scripts/
  dev.mjs                   one-command dev: DB → migrate → seed → Next
  db-server.mjs             embedded PostgreSQL for local development
src/
  app/                      routes (App Router, Cache Components)
    page.tsx                home / feature overview
    search/  explore/       route search; cheapest destinations
    monitor/                watch list, detail, server actions
    meet/                   multi-origin optimizer
    saved/  settings/       saved searches; account + quota dashboard
    sign-in/  auth/         passwordless sign-in; magic-link verify + sign-out
    api/cron/poll/          protected polling endpoint for schedulers
  components/               UI (calendar + feature forms, cards, sparkline)
  lib/
    domain/                 DateWindow, airports, trip enums, explore ranking
    flights/                FlightProvider interface + mock + factory
    gateway/                caching + usage metering over the provider
    monitor/                engine, queries, form parsing, CLI worker
    meet/                   multi-origin optimizer + param parsing
    saved/                  saved-search queries + actions
    notifications/          alert payloads + Resend (console fallback)
    auth/                   sessions, magic links, invites, current user
    utils/                  hashing, formatting, param parsing
  db/
    schema.ts               Drizzle/Postgres schema
    config.ts, client.ts    connection settings + postgres-js client
    migrate.ts, seed.ts     migration + seed scripts
  proxy.ts                  central auth gate (Next.js 16 proxy)
```

## Environment variables

Everything has sensible defaults; see `.env.example`. Copy it to `.env.local` to
override.

| Variable | Default | Purpose |
| --- | --- | --- |
| `FLIGHT_PROVIDER` | `mock` | Flight data source (`mock`, later `airscraper`/`serpapi`) |
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/postgres` | Postgres connection string |
| `DATABASE_POOL_MAX` | `2` | Connection pool size |
| `POSTGRES_DATA_DIR` | `.data/pg` | Local embedded-cluster data directory |
| `LOCAL_USER_EMAIL` | `you@radar.local` | First user seeded locally (+ invite) |
| `SEED_FRIEND_EMAIL` | — | Optional extra invite to seed |
| `RESEND_API_KEY` | — | Enables real email; unset ⇒ console fallback |
| `ALERT_FROM_EMAIL` | — | From address for alerts + sign-in links |
| `CRON_SECRET` | — | Required to call `POST /api/cron/poll` in production |
| `MONTHLY_CALL_BUDGET` | `10000` | Monthly upstream call cap (quota-aware polling) |
| `ALERT_COOLDOWN_MINUTES` | `720` | Minimum minutes between alerts for a watch |
| `EXPLORE_CACHE_TTL_SECONDS` | `21600` | Explore `everywhere` cache lifetime |
| `CALENDAR_CACHE_TTL_SECONDS` | `21600` | Price-calendar cache lifetime |
| `MEET_CACHE_TTL_SECONDS` | `1800` | Meet leg-search cache lifetime |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local DB + migrate + seed + Next |
| `npm run dev:next` | Next only (DB must already be running) |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:server` | Local embedded PostgreSQL |
| `npm run db:setup` | Migrate + seed against `DATABASE_URL` |
| `npm run db:generate` | Generate SQL migrations from the schema |
| `npm run poll` / `poll:loop` | Run the monitoring worker once / on a loop |

## Data & persistence

The app always talks to Postgres **over the wire** via `postgres-js` and
`DATABASE_URL`, so the same code runs locally and against a hosted
Supabase/Neon instance. Locally, `scripts/db-server.mjs` starts an **embedded
PostgreSQL** cluster — a real server, so the several processes Next.js dev uses
can connect concurrently.

```bash
npm run db:server   # just the local database (leave running)
npm run db:setup    # migrate + seed against DATABASE_URL
```

## Deploying

1. Provision Postgres (Supabase/Neon) and set `DATABASE_URL`.
2. Run `npm run db:migrate` (and optionally `db:seed`) against it.
3. Set `CRON_SECRET` and point a scheduler at `POST /api/cron/poll`.
4. Set `RESEND_API_KEY` + `ALERT_FROM_EMAIL` to enable email.

## Roadmap

| Phase | Deliverable |
| --- | --- |
| **M0** | Skeleton, schema, provider interface + mock, flexible-dates window ✅ |
| **M1** | Monitor: watch CRUD, worker, price history, email alerts, metering ✅ |
| **M2** | Explore: ranking, filtering, cached gateway ✅ |
| **M3** | Meet: multi-origin optimizer with a shared window ✅ |
| **M4** | (folded into M2) provider gateway caching + metering ✅ |
| **M5** | Invite-only auth, saved searches, quota dashboard ✅ |
| **M6** | Web push alerts; switch `FLIGHT_PROVIDER` to a real adapter |

### Planned: web push (M6)

Web push will add a third notification channel alongside email and the
development console log. It will need a VAPID key pair and a service worker:

```
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_SUBJECT=mailto:you@example.com
```

## Notes

- Next.js 16 with Cache Components and Partial Prefetching; runtime data is
  deferred behind `<Suspense>` + `connection()`.
- Reference airports are a small curated set (`src/lib/domain/airports.ts`) with
  coordinates, so demo fares track great-circle distance. Real deployments seed
  the full dataset into the `airports` table.
