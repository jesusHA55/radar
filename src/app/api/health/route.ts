import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/** Public liveness/readiness probe (also verifies the database). */
export async function GET(): Promise<Response> {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: true, at: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { ok: false, db: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
