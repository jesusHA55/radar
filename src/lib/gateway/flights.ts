import { getFlightProvider, type FlightProvider } from "@/lib/flights";
import type {
  DestinationDeal,
  EverywhereSpec,
  Itinerary,
  SearchSpec,
} from "@/lib/flights/types";
import { cacheGet, cacheKey, cacheSet } from "./cache";
import { recordUsage } from "./meter";

/**
 * The provider gateway.
 *
 * Every feature reads flights through here. It layers caching and usage
 * metering (in credits) over the `FlightProvider` so that:
 *   - repeated Explore searches reuse a cached fan-out (keeps quota intact)
 *   - monitoring always asks for fresh data (a cached price defeats the point)
 *   - every real upstream request is recorded for quota / pay-as-you-go
 *
 * Swapping provider (mock ⇄ SerpApi) happens in `src/lib/flights/index.ts`.
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
};

async function sourced<T>(
  provider: FlightProvider,
  input: {
    endpoint: string;
    params: unknown;
    ttlSeconds: number;
    fresh: boolean;
    credits: number;
    call: (provider: FlightProvider) => Promise<T>;
  },
): Promise<Sourced<T>> {
  const key = cacheKey(provider.id, input.endpoint, input.params);

  if (input.ttlSeconds > 0 && !input.fresh) {
    const hit = await cacheGet<T>(key);
    if (hit) return { data: hit.data, source: "cache", at: hit.at };
  }

  const at = new Date();
  const data = await input.call(provider);
  await recordUsage({
    provider: provider.id,
    endpoint: input.endpoint,
    credits: input.credits,
    ok: true,
  });

  if (input.ttlSeconds > 0) {
    await cacheSet(key, provider.id, data, input.ttlSeconds, at);
  }

  return { data, source: "provider", at: at.toISOString() };
}

export async function getEverywhere(
  spec: EverywhereSpec,
  opts: CallOptions = {},
): Promise<Sourced<DestinationDeal[]>> {
  const provider = await getFlightProvider();
  return sourced(provider, {
    endpoint: "everywhere",
    params: spec,
    ttlSeconds: opts.ttlSeconds ?? cacheTtls.everywhere(),
    fresh: opts.fresh ?? false,
    credits: provider.credits.everywhere(spec),
    call: (p) => p.everywhere(spec),
  });
}

export async function getOffers(
  spec: SearchSpec,
  opts: CallOptions = {},
): Promise<Sourced<Itinerary[]>> {
  const provider = await getFlightProvider();
  // Monitoring wants fresh data, so offers default to no caching.
  return sourced(provider, {
    endpoint: "searchOffers",
    params: spec,
    ttlSeconds: opts.ttlSeconds ?? 0,
    fresh: opts.fresh ?? false,
    credits: provider.credits.search(spec),
    call: (p) => p.searchOffers(spec),
  });
}
