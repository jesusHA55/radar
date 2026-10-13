import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";

import EmbeddedPostgres from "embedded-postgres";

/**
 * Local development database: a real, embedded PostgreSQL cluster.
 *
 * The app connects to it over TCP exactly as it would to hosted Supabase/Neon,
 * so the same wire protocol, driver, and SQL run everywhere. Unlike the PGlite
 * socket we previously used, a real server handles concurrent clients correctly
 * (Next.js dev renders in several processes).
 *
 *   npm run db:server
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const url = new URL(DATABASE_URL);
const PORT = Number(url.port || 5432);
const DATABASE_DIR = process.env.POSTGRES_DATA_DIR ?? ".data/pg";
const USER = decodeURIComponent(url.username || "postgres");
const PASSWORD = decodeURIComponent(url.password || "postgres");

mkdirSync(DATABASE_DIR, { recursive: true });

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

if (await portInUse(PORT)) {
  console.error(
    `[db] port ${PORT} is already in use — another database is probably still running.\n` +
      `     Stop it (e.g. \`lsof -nP -iTCP:${PORT} -sTCP:LISTEN\`) and try again.`,
  );
  process.exit(1);
}

const pg = new EmbeddedPostgres({
  databaseDir: DATABASE_DIR,
  port: PORT,
  user: USER,
  password: PASSWORD,
  persistent: true,
  authMethod: "password",
  onLog: () => {},
  onError: (message) => console.error("[db]", message),
});

if (!existsSync(`${DATABASE_DIR}/PG_VERSION`)) {
  console.log("[db] initialising Postgres cluster (first run)…");
  await pg.initialise();
}

try {
  await pg.start();
} catch (error) {
  console.error("[db] failed to start Postgres:", error);
  process.exit(1);
}
console.log(`[db] Postgres listening on 127.0.0.1:${PORT}`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    await pg.stop();
  } catch {
    // ignore
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process (and therefore the cluster) alive.
await new Promise(() => {});
