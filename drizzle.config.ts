import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * `generate` only needs the dialect + schema to emit SQL migrations. `push`
 * and `studio` additionally require a reachable database; wire `dbCredentials`
 * to a `DATABASE_URL` when you move off local PGlite.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
