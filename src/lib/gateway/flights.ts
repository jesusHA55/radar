import { getFlightProvider } from "@/lib/flights";
import type {
  CalendarDay,
  DestinationDeal,
  EverywhereSpec,
  Itinerary,
  PriceCalendarSpec,
  SearchSpec,
} from "@/lib/flights/types";
import { cacheGet, cacheKey, cacheSet } from "./cache";
import { recordUsage } from "./meter";

/**
 * The provider gateway.
 *
 * Every feature reads flights through here. It layers caching and usage
 * metering over the `FlightProvider` so that:
 *   - repeated Explore searches reuse a cached fan-out (keeps quota intact)
 *   - monitoring always asks for fresh data (a cached price defeats the point)
 *   - every real upstream call is recorded for quota / pay-as-you-go
 *
 * Swapping in a commercial provider (Air Scraper, SerpApi, ...) happens in
 * `src/lib/flights/index.ts`; nothing here changes.
 */

export type Sourced<T> = {
  data: T;
  source: "cache" | "provider";
  /** ISO timestamp of when the data was fetched. */
  at: string;
};

export type CallOptions = {
  /** Cache lifetime in seconds. 0 disables caching. */
  ttlSeconds?: number;
  /** Bypass any existing cache entry and refresh. */
  fresh?: boolean;
};

function ttlFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

export const cacheTtls = {
  everywhere: () => ttlFromEnv("EXPLORE_CACHE_TTL_SECONDS", 6 * 3600),
  priceCalendar: () => ttlFromEnv("CALENDAR_CACHE_TTL_SECONDS", 6 * 3600),
};

async function sourced<T>(
  endpoint: string,
  params: unknown,
  ttlSeconds: number,
  fresh: boolean,
  call: () => Promise<T>,
): Promise<Sourced<T>> {
  const provider = getFlightProvider();
  const key = cacheKey(provider.id, endpoint, params);

  if (ttlSeconds > 0 && !fresh) {
    const hit = await cacheGet<T>(key);
    if (hit) return { data: hit.data, source: "cache", at: hit.at };
  }

  const at = new Date();
  const data = await call();
  await recordUsage({ provider: provider.id, endpoint, costMicros: 0, ok: true });
  if (ttlSeconds > 0) await cacheSet(key, provider.id, data, ttlSeconds, at);

  return { data, source: "provider", at: at.toISOString() };
}

export function getEverywhere(
  spec: EverywhereSpec,
  opts: CallOptions = {},
): Promise<Sourced<DestinationDeal[]>> {
  const ttlSeconds = opts.ttlSeconds ?? cacheTtls.everywhere();
  return sourced("everywhere", spec, ttlSeconds, opts.fresh ?? false, () =>
    getFlightProvider().everywhere(spec),
  );
}

export function getOffers(
  spec: SearchSpec,
  opts: CallOptions = {},
): Promise<Sourced<Itinerary[]>> {
  // Monitoring wants fresh data, so offers default to no caching.
  const ttlSeconds = opts.ttlSeconds ?? 0;
  return sourced("searchOffers", spec, ttlSeconds, opts.fresh ?? false, () =>
    getFlightProvider().searchOffers(spec),
  );
}

export function getPriceCalendar(
  spec: PriceCalendarSpec,
  opts: CallOptions = {},
): Promise<Sourced<CalendarDay[]>> {
  const ttlSeconds = opts.ttlSeconds ?? cacheTtls.priceCalendar();
  return sourced("priceCalendar", spec, ttlSeconds, opts.fresh ?? false, () =>
    getFlightProvider().priceCalendar(spec),
  );
}
