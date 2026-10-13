/**
 * Database connection settings.
 *
 * The app always talks to Postgres over the wire. In production that is a
 * hosted instance (Supabase/Neon); locally it is an embedded PostgreSQL cluster
 * started by `scripts/db-server.mjs` (see `scripts/dev.mjs`).
 */

export const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@127.0.0.1:5432/postgres";

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function poolSize(): number {
  const raw = Number(process.env.DATABASE_POOL_MAX);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}
