import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ExploreForm, type ExploreDefaults } from "@/components/explore-form";
import { SaveSearchForm } from "@/components/save-search-form";
import { AIRPORTS, isKnownAirport } from "@/lib/domain/airports";
import { startOfTodayUTC } from "@/lib/domain/date-utils";
import { dateWindowFromParams, type DateWindow } from "@/lib/domain/date-window";
import {
  EXPLORE_LIMITS,
  EXPLORE_SORT_LABELS,
  applyExplore,
  isExploreSort,
  pricePerHourMinor,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/domain/explore";
import {
  CABIN_CLASSES,
  TRIP_TYPES,
  type CabinClass,
  type TripType,
} from "@/lib/domain/trip";
import type { DestinationDeal } from "@/lib/flights/types";
import { formatMoney } from "@/lib/flights/types";
import { getEverywhere } from "@/lib/gateway/flights";
import { formatDate, formatDuration, formatStops } from "@/lib/utils/format";
import { pickEnum, pickInt, pickParam, type RawParams } from "@/lib/utils/params";

export const metadata = { title: "Explore — Radar" };

type PageSearchParams = Promise<RawParams>;

const DEFAULT_ORIGIN = "STR";
const DEFAULT_LIMIT = 25;
const COUNTRIES = [...new Set(AIRPORTS.map((a) => a.country))].sort();

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

type ParsedExplore = {
  origin: string;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  currency: string;
  window: DateWindow;
  sort: ExploreSort;
  fresh: boolean;
  directOnly: boolean;
  country: string;
  limit: number;
  /** Major units, as a string for the form. */
  maxPrice: string;
  /** Hours, as a string for the form. */
  maxDurationHours: string;
  filters: ExploreFilters;
};

function parseExploreParams(params: RawParams): ParsedExplore {
  const window = dateWindowFromParams(params);

  const maxPriceRaw = Number(pickParam(params, "maxPrice"));
  const maxPriceMinor =
    Number.isFinite(maxPriceRaw) && maxPriceRaw > 0 ? Math.round(maxPriceRaw * 100) : undefined;

  const maxDurationRaw = Number(pickParam(params, "maxDuration"));
  const maxDurationMinutes =
    Number.isFinite(maxDurationRaw) && maxDurationRaw > 0
      ? Math.round(maxDurationRaw * 60)
      : undefined;

  const directOnly = pickParam(params, "directOnly") === "1";

  const countryRaw = pickParam(params, "country") ?? "";
  const country = COUNTRIES.includes(countryRaw) ? countryRaw : "";

  const limitRaw = Number(pickParam(params, "limit"));
  const limit = (EXPLORE_LIMITS as readonly number[]).includes(limitRaw)
    ? limitRaw
    : DEFAULT_LIMIT;

  const sortRaw = pickParam(params, "sort") ?? "";
  const sort: ExploreSort = isExploreSort(sortRaw) ? sortRaw : "cheapest";

  return {
    origin: resolveAirport(pickParam(params, "origin"), DEFAULT_ORIGIN),
    tripType: pickEnum<TripType>(params, "tripType", TRIP_TYPES, "round-trip"),
    cabin: pickEnum<CabinClass>(params, "cabin", CABIN_CLASSES, "economy"),
    adults: pickInt(params, "adults", 1),
    currency: pickParam(params, "currency") ?? "EUR",
    window,
    sort,
    fresh: pickParam(params, "fresh") === "1",
    directOnly,
    country,
    limit,
    maxPrice: maxPriceRaw > 0 ? String(maxPriceRaw) : "",
    maxDurationHours: maxDurationRaw > 0 ? String(maxDurationRaw) : "",
    filters: {
      maxPriceMinor,
      maxDurationMinutes,
      directOnly,
      country: country || undefined,
      limit,
    },
  };
}

export default function ExplorePage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Explore destinations</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Give a source airport and a flexible date span — we rank the cheapest
        places you could fly to, and let you refine by budget, duration and stops.
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />}>
          <ControlsFromParams searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<DealsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function DealsSkeleton() {
  return (
    <div className="mt-8 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

async function ControlsFromParams({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  await connection();
  const params = await searchParams;
  const parsed = parseExploreParams(params);

  const defaults: ExploreDefaults = {
    origin: parsed.origin,
    tripType: parsed.tripType,
    cabin: parsed.cabin,
    adults: parsed.adults,
    window: { from: parsed.window.departFrom, to: parsed.window.departTo },
    minNights: parsed.window.minNights ?? 3,
    maxNights: parsed.window.maxNights ?? 7,
    sort: parsed.sort,
    maxPrice: parsed.maxPrice,
    maxDurationHours: parsed.maxDurationHours,
    directOnly: parsed.directOnly,
    country: parsed.country,
    limit: parsed.limit,
  };

  return <ExploreForm defaults={defaults} todayIso={startOfTodayUTC()} countries={COUNTRIES} />;
}

async function Results({ searchParams }: { searchParams: PageSearchParams }) {
  await connection();
  const params = await searchParams;
  const parsed = parseExploreParams(params);

  const { data: deals, source, at } = await getEverywhere(
    {
      origin: parsed.origin,
      tripType: parsed.tripType,
      window: parsed.window,
      cabin: parsed.cabin,
      adults: parsed.adults,
      currency: parsed.currency,
      // Ask for the full set, then rank/filter in memory.
      limit: 100,
    },
    { fresh: parsed.fresh },
  );

  const ranked = applyExplore(deals, parsed.sort, parsed.filters);

  if (ranked.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <p>
          No destinations from {parsed.origin} match your filters
          {deals.length > 0 ? ` (${deals.length} available before filtering).` : "."}
        </p>
        <Link href={`/explore?origin=${parsed.origin}`} className="mt-2 inline-block font-medium text-zinc-900 underline dark:text-zinc-100">
          Clear filters
        </Link>
      </div>
    );
  }

  const query = new URLSearchParams(toQuery(params));
  query.set("fresh", "1");
  const refreshHref = `/explore?${query.toString()}`;
  const exploreHref = `/explore?${toQuery(params)}`;

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {EXPLORE_SORT_LABELS[parsed.sort]} from {parsed.origin}
        </h2>
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {ranked.length} of {deals.length} · {parsed.tripType === "round-trip" ? "round trip" : "one way"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
            <span
              className={`h-1.5 w-1.5 rounded-full ${source === "cache" ? "bg-amber-500" : "bg-emerald-500"}`}
            />
            {source === "cache" ? `cached ${at.slice(11, 16)} UTC` : "fresh"}
          </span>
          <Link href={refreshHref} className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
            Refresh
          </Link>
          <SaveSearchForm kind="explore" href={exploreHref} label={`Explore from ${parsed.origin}`} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Destination</th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Dates</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Duration</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Stops</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">€/hour</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((deal, index) => (
              <DealRow key={`${deal.destination}-${index}`} deal={deal} rank={index + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DealRow({ deal, rank }: { deal: DestinationDeal; rank: number }) {
  return (
    <tr className="border-t border-zinc-100 bg-white dark:border-zinc-900 dark:bg-zinc-950">
      <td className="px-3 py-2.5 tabular-nums text-zinc-400">{rank}</td>
      <td className="px-3 py-2.5">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          {deal.city} <span className="font-normal text-zinc-400">({deal.destination})</span>
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {deal.country} · {Math.round(deal.distanceKm).toLocaleString()} km
        </p>
      </td>
      <td className="hidden px-3 py-2.5 text-zinc-600 sm:table-cell dark:text-zinc-400">
        {formatDate(deal.departDate)}
        {deal.returnDate ? ` → ${formatDate(deal.returnDate)}` : ""}
      </td>
      <td className="hidden px-3 py-2.5 text-zinc-600 md:table-cell dark:text-zinc-400">
        {formatDuration(deal.durationMinutes)}
      </td>
      <td className="hidden px-3 py-2.5 text-zinc-600 md:table-cell dark:text-zinc-400">
        {formatStops(deal.stops)}
      </td>
      <td className="hidden px-3 py-2.5 text-right tabular-nums text-zinc-600 sm:table-cell dark:text-zinc-400">
        {formatMoney({ amountMinor: pricePerHourMinor(deal), currency: deal.price.currency })}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold text-zinc-900 dark:text-zinc-50">
        {formatMoney(deal.price)}
      </td>
    </tr>
  );
}
