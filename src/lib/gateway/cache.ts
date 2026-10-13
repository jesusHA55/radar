import { and, eq, gt, lt } from "drizzle-orm";

import { db } from "@/db/client";
import { priceCache } from "@/db/schema";
import { hashString } from "@/lib/utils/hash";

/**
 * A Postgres-backed response cache for provider calls.
 *
 * This is what makes Explore affordable: an "everywhere" fan-out is expensive
 * upstream but identical for a given (origin, window, filters) tuple, so it is
 * computed once and reused until its TTL lapses. Cache hits never touch the
 * provider, which is exactly how the quota budget stays intact.
 */

export function cacheKey(
  provider: string,
  endpoint: string,
  params: unknown,
): string {
  return `${provider}:${endpoint}:${hashString(JSON.stringify(params)).toString(16)}`;
}

export type CacheHit<T> = { data: T; at: string };

export async function cacheGet<T>(key: string): Promise<CacheHit<T> | null> {
  const [row] = await db
    .select()
    .from(priceCache)
    .where(and(eq(priceCache.key, key), gt(priceCache.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;
  const payload = row.payload as { at: string; data: T };
  return { data: payload.data, at: payload.at };
}

export async function cacheSet<T>(
  key: string,
  provider: string,
  data: T,
  ttlSeconds: number,
  at: Date = new Date(),
): Promise<void> {
  const payload = { at: at.toISOString(), data };
  const expiresAt = new Date(at.getTime() + ttlSeconds * 1000);

  await db
    .insert(priceCache)
    .values({ key, provider, payload, expiresAt })
    .onConflictDoUpdate({
      target: priceCache.key,
      set: { provider, payload, expiresAt, createdAt: new Date() },
    });
}

/** Remove expired entries (housekeeping; safe to call from the worker). */
export async function cachePruneExpired(): Promise<void> {
  await db.delete(priceCache).where(lt(priceCache.expiresAt, new Date()));
}
