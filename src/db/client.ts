import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { databaseUrl, poolSize } from "./config";
import * as schema from "./schema";

/**
 * Database client.
 *
 * Server-only by convention: never import this from a Client Component.
 *
 * Uses postgres-js against a real Postgres endpoint (over TCP), so the same
 * code path runs locally, in tests, and in production regardless of whether the
 * backing Postgres is hosted or an embedded local cluster.
 */

export type Database = PostgresJsDatabase<typeof schema>;
type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as {
  __radarDb?: Database;
  __radarSql?: Sql;
};

function createConnection(): { db: Database; sql: Sql } {
  const sql = postgres(databaseUrl(), {
    max: poolSize(),
    // Transaction-pooling endpoints (PgBouncer, Supabase pooler — and PGlite
    // sockets) don't reliably support named prepared statements.
    prepare: false,
    onnotice: () => {},
  });
  return { db: drizzle(sql, { schema }), sql };
}

const connection =
  globalForDb.__radarDb && globalForDb.__radarSql
    ? { db: globalForDb.__radarDb, sql: globalForDb.__radarSql }
    : createConnection();

globalForDb.__radarDb = connection.db;
globalForDb.__radarSql = connection.sql;

export const db = connection.db;

/** Close the connection pool (used by CLI scripts before exit). */
export async function closeDatabase(): Promise<void> {
  await connection.sql.end({ timeout: 5 });
}

export { schema };
