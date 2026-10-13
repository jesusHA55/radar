# Radar

**A flight-price radar.** Watch a route, explore the cheapest places you could
fly from an airport, and find the fairest meeting point for a group — all
bounded by a shared **flexible-dates** window.

> Status: all three features work end-to-end — on deterministic demo data by
> default, or **live Google Flights (SerpApi)** via a runtime toggle — behind
> invite-only auth. Web push is the outstanding item.

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

Radar ships **mock-first**: every feature works against a deterministic offline
provider (`src/lib/flights/mock.ts`), and you can switch to **live data** —
SerpApi (Google Flights) — at runtime from `/settings`. The adapter implements
the same `FlightProvider` interface, so no feature code changes.

```
FlightProvider
  searchOffers(spec)   → specific route (SerpApi: 1 credit one-way, 2 round-trip)
  everywhere(spec)     → cheapest destinations from an origin (1 credit)
                         (powers Explore, and Meet)
```

### Flight data providers

| Provider | Cost | Notes |
| --- | --- | --- |
| `mock` (default) | **0 credits** | Deterministic, offline demo data |
| `serpapi` | **1 credit/request** | Live Google Flights; round-trip search = 2 |

Switch at runtime in **`/settings`** (persisted in `app_settings`), or via
`FLIGHT_PROVIDER`. Every upstream request is metered as a **credit**; the monitor
worker and Meet both refuse to exceed `MONTHLY_CALL_BUDGET` (default **250** — the
SerpApi free tier). Round-trips take a second `departure_token` request, so they
cost 2. Because Google Flights needs concrete dates, a flexible window is
date-sampled.

On the **Search** page you choose how thoroughly to sample — **1 / 5 / 10 dates**
plus a **Thorough** switch (`deep_search` + `show_hidden` for exact browser
parity) — with a live credit estimate. Searches are **short-cached**
(`SEARCH_CACHE_TTL_SECONDS`, default 5 min) so re-runs are free, and a **budget
guard** refuses a search that would exceed the monthly cap. Set the form's
default with `SEARCH_DEFAULT_DEPTH`.

### The provider gateway

Every feature reads flights through `src/lib/gateway/`, which layers a
Postgres-backed response cache and credit metering over the provider. Cache hits
never reach upstream, so they never consume the credit budget; monitoring always
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

Invite-only and passwordless. A magic link is emailed via **Gmail/SMTP** or
**Resend** (auto-selected — see *Email* below), or logged to the console in
development. Tokens are 256-bit random and stored **hashed** only; login links
are single-use and expire in 15 minutes. Sessions live in an httpOnly,
SameSite=lax cookie (hash at rest, 30-day expiry). A single **proxy**
(`src/proxy.ts`) gates every route except the sign-in flow and the
secret-protected cron endpoint.

The **invite list** (`invites` table) is the allowlist: you may sign in if you
already have an account or hold an invite. The first successful sign-in creates
the account and marks the invite accepted. Manage it from **`/invites`** (add,
see pending/joined status, send a sign-in link, remove) or the CLI:

```bash
npm run invite -- friend@example.com another@example.com
npm run invite -- --list
```

Seeding also creates an invite for `LOCAL_USER_EMAIL`, plus `SEED_FRIEND_EMAIL`
if set. Removing an invite only forgets a *pending* invitation — an account that
already signed in keeps its access.

## Tech stack

- **Next.js 16** (App Router, Cache Components / Partial Prerendering, Turbopack)
  and **React 19**
- **TypeScript**, **Tailwind CSS v4**
- **PostgreSQL** via **Drizzle ORM** and the **postgres-js** driver
- **Embedded PostgreSQL** for local development; hosted (Supabase/Neon)-ready
- **Resend** for alert + sign-in emails (console fallback in dev)

## Project structure

```
pi/
  README.md                 Raspberry Pi runbook (systemd + Cloudflare tunnel)
  install.sh / uninstall.sh install or remove the services
  deploy.sh                 build + migrate + restart on the Pi
  systemd/                  unit + timer templates (app, tunnel, poller)
  scripts/                  run-app / run-tunnel / run-poller
scripts/
  dev.mjs                   one-command dev: DB → migrate → seed → Next
  db-server.mjs             embedded PostgreSQL for local development
  invite.ts                 add / list invites from the CLI
  check-mappers.ts          fixture assertions for the SerpApi mappers
src/
  app/                      routes (App Router, Cache Components)
    page.tsx                home / feature overview
    search/  explore/       route search; cheapest destinations
    monitor/                watch list, detail, server actions
    meet/                   multi-origin optimizer
    saved/  settings/       saved searches; account + quota dashboard
    invites/                invite allowlist management
    sign-in/  auth/         passwordless sign-in; magic-link verify + sign-out
    api/cron/poll/          protected polling endpoint for schedulers
  components/               UI (calendar + feature forms, cards, sparkline)
  lib/
    domain/                 DateWindow, airports, trip enums, explore ranking
    flights/                FlightProvider + mock + SerpApi adapter/mappers
    gateway/                caching + credit metering over the provider
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
| `FLIGHT_PROVIDER` | `mock` | Default flight data source (`mock` or `serpapi`) |
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/postgres` | Postgres connection string |
| `DATABASE_POOL_MAX` | `2` | Connection pool size |
| `POSTGRES_DATA_DIR` | `.data/pg` | Local embedded-cluster data directory |
| `LOCAL_USER_EMAIL` | `you@radar.local` | First user seeded locally (+ invite) |
| `SEED_FRIEND_EMAIL` | — | Optional extra invite to seed |
| `RESEND_API_KEY` | — | Enables real email; unset ⇒ console fallback |
| `ALERT_FROM_EMAIL` | — | From address for alerts + sign-in links |
| `CRON_SECRET` | — | Required to call `POST /api/cron/poll` in production |
| `MONTHLY_CALL_BUDGET` | `250` | Monthly credit cap (SerpApi free tier) |
| `ALERT_COOLDOWN_MINUTES` | `720` | Minimum minutes between alerts for a watch |
| `SERPAPI_API_KEY` | — | Required when the provider is `serpapi` |
| `SERPAPI_GL` / `SERPAPI_HL` / `SERPAPI_CURRENCY` | `de` / `en` / `EUR` | SerpApi locale + price currency |
| `SERPAPI_DATE_SAMPLES` | `1` | Dates sampled across a flexible window |
| `SERPAPI_ROUNDTRIP_DEPTH` | `1` | Return legs resolved per round-trip search |
| `EXPLORE_CACHE_TTL_SECONDS` | `21600` | Explore `everywhere` cache lifetime |
| `SEARCH_CACHE_TTL_SECONDS` | `300` | Search results cache lifetime |
| `SEARCH_DEFAULT_DEPTH` | `1` | Default dates to sample on Search (1/5/10) |
| `MEET_CACHE_TTL_SECONDS` | `1800` | Meet leg-search cache lifetime |
| `MEET_ANCHORS` | `1` | Aligned re-pricing anchors per Meet destination |
| `EMAIL_TRANSPORT` | auto | `gmail` \| `resend` \| `console` |
| `MAIL_FROM` | — | From address for outgoing mail |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `465` / `true` | SMTP settings (Gmail) |
| `SMTP_USER` / `SMTP_PASS` | — | Gmail address + App Password |
| `MAGIC_LINK_MAX_PER_HOUR` | `5` | Sign-in link throttle per email |
| `TUNNEL_URL_FILE` | `/var/lib/radar/tunnel-url.txt` | Where the tunnel writes its URL |
| `PUBLIC_URL` | — | Stable public origin (named tunnel) |

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
| `npm run test:mappers` | Verify SerpApi response mapping against fixtures |
| `npm run invite` | Add invites from the CLI (`-- --list` to list) |

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

## Email

One transport is auto-selected (override with `EMAIL_TRANSPORT`):

| Transport | When | Notes |
| --- | --- | --- |
| **Gmail (SMTP)** | `SMTP_USER` + `SMTP_PASS` set | Free, sends to anyone, **no domain needed**. Use a Google **App Password** (2‑Step Verification required). ~500 recipients/day. |
| **Resend** | `RESEND_API_KEY` + `ALERT_FROM_EMAIL` set | Requires a verified domain. |
| **Console** | neither | The link/alert is logged and returned for manual sharing — zero setup. |

`/settings` shows the active transport and has a **Send test email** button.
Magic links and monitor alerts both route through the same transport.

## Running on a Raspberry Pi

The `pi/` folder runs Radar as **systemd** services — the app, a Cloudflare
**quick tunnel**, and an hourly poller — and is fully self-contained, so Mac dev
(`npm run dev`) is unaffected. Full runbook: [`pi/README.md`](pi/README.md).

```bash
cp pi/env.example .env.local          # DB, Gmail, CRON_SECRET
npm ci && npm run build && npm run db:migrate
npm run invite -- you@gmail.com
sudo ./pi/install.sh                  # app + tunnel + poller
cat /var/lib/radar/tunnel-url.txt     # the public URL (also in /settings)
```

Quick-tunnel URLs change on restart; `/settings` (or `GET /api/tunnel-url`)
always shows the current one. `GET /api/health` is a public DB-backed health check.

## Deploying

> Running it yourself (a Raspberry Pi, or any Linux box) vs a hosted platform —
> see **Running on a Raspberry Pi** below.

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
| **M6** | Live SerpApi provider, credit budget, runtime provider toggle ✅ |
| **M7** | Web push alerts |

### Planned: web push (M7)

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
