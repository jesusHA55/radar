import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { loadLocalEnv } from "@/lib/utils/load-env";
import { databaseUrl } from "./config";

loadLocalEnv();

/**
 * Applies the SQL migrations in ./drizzle to the configured database.
 * Run with: npm run db:migrate   (the DB server must already be running)
 */
async function main() {
  const sql = postgres(databaseUrl(), { max: 1, prepare: false, onnotice: () => {} });
  const db = drizzle(sql);

  await migrate(db, { migrationsFolder: "./drizzle" });
  await sql.end({ timeout: 5 });

  console.log(`✓ Migrations applied to ${databaseUrl()}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
