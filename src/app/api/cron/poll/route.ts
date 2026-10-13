import { NextRequest } from "next/server";

import { runDueWatches } from "@/lib/monitor/engine";

/**
 * Polling endpoint for the monitoring worker.
 *
 * Call it from a scheduler (Vercel Cron, GitHub Actions, cron, or the local
 * `npm run poll:loop`). If `CRON_SECRET` is set, requests must present it as a
 * bearer token or `?secret=`.
 *
 *   POST /api/cron/poll?force=1
 */
async function handle(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);

  if (secret) {
    const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const provided = header ?? url.searchParams.get("secret");
    if (provided !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const summary = await runDueWatches({ force: url.searchParams.get("force") === "1" });

  return Response.json({
    ok: true,
    checked: summary.checked,
    alerted: summary.alerted,
    cooldown: summary.cooldown,
    errors: summary.errors,
    budget: summary.budget,
    results: summary.results,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  return handle(request);
}

export async function GET(request: NextRequest): Promise<Response> {
  return handle(request);
}
