import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { appSettings } from "@/db/schema";
import { MockFlightProvider } from "./mock";
import { SerpFlightProvider } from "./serp";
import type { FlightProvider } from "./types";

/**
 * Provider selection.
 *
 * The active provider is stored in the `app_settings` table so it can be
 * toggled at runtime from `/settings`, with `FLIGHT_PROVIDER` as the fallback
 * default. The resolved provider is cached briefly per process to avoid a DB
 * round-trip on every call.
 */

export const FLIGHT_PROVIDERS = ["mock", "serpapi"] as const;
export type FlightProviderId = (typeof FLIGHT_PROVIDERS)[number];

const SETTING_KEY = "flight_provider";
const CACHE_TTL_MS = 5_000;

let cache: { at: number; provider: FlightProvider } | null = null;

export function isFlightProviderId(value: string): value is FlightProviderId {
  return (FLIGHT_PROVIDERS as readonly string[]).includes(value);
}

export async function resolveFlightProviderId(): Promise<FlightProviderId> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SETTING_KEY))
    .limit(1);

  const value = row?.value ?? process.env.FLIGHT_PROVIDER ?? "mock";
  return isFlightProviderId(value) ? value : "mock";
}

function instantiate(id: FlightProviderId): FlightProvider {
  return id === "serpapi" ? new SerpFlightProvider() : new MockFlightProvider();
}

export async function getFlightProvider(): Promise<FlightProvider> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.provider;

  const provider = instantiate(await resolveFlightProviderId());
  cache = { at: Date.now(), provider };
  return provider;
}

export async function setFlightProvider(id: FlightProviderId): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: SETTING_KEY, value: id })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: id, updatedAt: new Date() },
    });
  cache = null;
}

export type { FlightProvider } from "./types";
