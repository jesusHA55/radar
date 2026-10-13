import { Suspense } from "react";
import { connection } from "next/server";

import { OfferCard } from "@/components/offer-card";
import { SaveSearchForm } from "@/components/save-search-form";
import { SearchControls, type SearchDefaults } from "@/components/search-controls";
import { getAirport, isKnownAirport } from "@/lib/domain/airports";
import { startOfTodayUTC } from "@/lib/domain/date-utils";
import { dateWindowFromParams } from "@/lib/domain/date-window";
import { CABIN_CLASSES, TRIP_TYPES, type CabinClass, type TripType } from "@/lib/domain/trip";
import { getOffers } from "@/lib/gateway/flights";
import { pickEnum, pickInt, pickParam, type RawParams } from "@/lib/utils/params";

export const metadata = { title: "Search — Radar" };

type PageSearchParams = Promise<RawParams>;

const DEFAULT_ORIGIN = "STR";
const DEFAULT_DESTINATION = "BCN";

function resolveAirport(value: string | undefined, fallback: string): string {
  return value && isKnownAirport(value) ? value.toUpperCase() : fallback;
}

function toQuery(params: RawParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  return query.toString();
}

export default function SearchPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Search flights</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Pick a route and a flexible span of departure dates.
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <Suspense fallback={<ControlsSkeleton />}>
          <ControlsFromParams searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function ControlsSkeleton() {
  return <div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />;
}

function ResultsSkeleton() {
  return (
    <div className="mt-8 space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </div>
  );
}

async function ControlsFromParams({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  // Defer to request time: today's date is a runtime value.
  await connection();
  const params = await searchParams;
  const window = dateWindowFromParams(params);

  const defaults: SearchDefaults = {
    origin: resolveAirport(pickParam(params, "origin"), DEFAULT_ORIGIN),
    destination: resolveAirport(pickParam(params, "destination"), DEFAULT_DESTINATION),
    tripType: pickEnum<TripType>(params, "tripType", TRIP_TYPES, "round-trip"),
    cabin: pickEnum<CabinClass>(params, "cabin", CABIN_CLASSES, "economy"),
    adults: pickInt(params, "adults", 1),
    window: { from: window.departFrom, to: window.departTo },
    minNights: window.minNights ?? 3,
    maxNights: window.maxNights ?? 7,
  };

  return <SearchControls defaults={defaults} todayIso={startOfTodayUTC()} />;
}

async function Results({ searchParams }: { searchParams: PageSearchParams }) {
  await connection();
  const params = await searchParams;
  const origin = resolveAirport(pickParam(params, "origin"), DEFAULT_ORIGIN);
  const destination = resolveAirport(
    pickParam(params, "destination"),
    DEFAULT_DESTINATION,
  );
  const window = dateWindowFromParams(params);
  const tripType = pickEnum<TripType>(params, "tripType", TRIP_TYPES, "round-trip");
  const cabin = pickEnum<CabinClass>(params, "cabin", CABIN_CLASSES, "economy");
  const adults = pickInt(params, "adults", 1);
  const currency = pickParam(params, "currency") ?? "EUR";

  const { data: offers } = await getOffers(
    { origin, destination, tripType, window, cabin, adults, currency },
    { ttlSeconds: 0 },
  );

  const from = getAirport(origin);
  const to = getAirport(destination);

  if (offers.length === 0) {
    return (
      <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
        No offers found for {origin} → {destination}.
      </p>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {from?.city ?? origin} → {to?.city ?? destination}
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {offers.length} offers · cheapest first
          </p>
          <SaveSearchForm
            kind="search"
            href={`/search?${toQuery(params)}`}
            label={`${origin} → ${destination}`}
          />
        </div>
      </div>
      <div className="space-y-3">
        {offers.map((offer) => (
          <OfferCard key={offer.id} itinerary={offer} />
        ))}
      </div>
    </section>
  );
}
