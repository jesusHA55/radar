import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

/**
 * One-command local dev:
 *   1. start an embedded PostgreSQL cluster (scripts/db-server.mjs)
 *   2. apply migrations + seed
 *   3. start Next.js
 *
 * Because the database is a *server*, the app, the poller CLI, and any number
 * of Next worker processes all connect as clients — no more "two writers, one
 * file" corruption.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const parsed = new URL(DATABASE_URL);
const PORT = Number(parsed.port || 5432);
const HOST = parsed.hostname || "127.0.0.1";

mkdirSync(".data", { recursive: true });

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 400);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function start(command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL },
  });
  children.push(child);
  child.on("exit", (code) => shutdown(code ?? 0));
  return child;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

async function waitForPort(port, host, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ port, host }, () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => resolve(false));
    });
    if (ok) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function main() {
  console.log(`[dev] starting local Postgres on ${HOST}:${PORT}`);
  start("node", ["scripts/db-server.mjs"]);

  await waitForPort(PORT, HOST);

  console.log("[dev] applying migrations and seeding");
  await run("tsx", ["src/db/migrate.ts"]);
  await run("tsx", ["src/db/seed.ts"]);

  console.log("[dev] starting Next.js");
  start("next", ["dev"]);
}

main().catch((error) => {
  console.error("[dev] failed:", error.message);
  shutdown(1);
});
