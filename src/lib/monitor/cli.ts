import { closeDatabase } from "@/db/client";
import { loadLocalEnv } from "@/lib/utils/load-env";

import { runDueWatches } from "./engine";

loadLocalEnv();

/**
 * Monitor worker entry point.
 *
 *   npm run poll           # one pass over due watches
 *   npm run poll:loop      # keep polling on an interval (local dev)
 *
 * In production, drive the same logic from `POST /api/cron/poll` via your
 * scheduler of choice so it works on serverless too.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatResult(result: {
  watchId: string;
  status: string;
  priceMinor?: number;
  error?: string;
}): string {
  const price = result.priceMinor !== undefined ? ` ${(result.priceMinor / 100).toFixed(2)}` : "";
  const error = result.error ? ` (${result.error})` : "";
  return `  - ${result.watchId.slice(0, 8)}  ${result.status}${price}${error}`;
}

async function once(): Promise<void> {
  const summary = await runDueWatches({ force: process.env.FORCE === "1" });
  console.log(
    `poll: checked=${summary.checked} alerted=${summary.alerted} cooldown=${summary.cooldown} ` +
      `errors=${summary.errors} credits=${summary.budget.credits}/${summary.budget.budget}`,
  );
  for (const result of summary.results) {
    console.log(formatResult(result));
  }
}

async function loop(): Promise<void> {
  const intervalMs = Number(process.env.POLL_INTERVAL_MS ?? 60_000);
  console.log(`poll loop every ${intervalMs}ms — press Ctrl-C to stop`);
  for (;;) {
    await once().catch((error) => console.error("poll error:", error));
    await sleep(intervalMs);
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "once";
  try {
    if (mode === "loop") {
      await loop();
    } else {
      await once();
    }
  } finally {
    if (mode !== "loop") {
      await closeDatabase();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
