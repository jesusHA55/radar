"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AIRPORTS } from "@/lib/domain/airports";
import { startOfTodayUTC } from "@/lib/domain/date-utils";
import {
  EXPLORE_LIMITS,
  EXPLORE_SORTS,
  EXPLORE_SORT_LABELS,
  type ExploreSort,
} from "@/lib/domain/explore";
import {
  CABIN_CLASSES,
  CABIN_LABELS,
  TRIP_TYPES,
  TRIP_TYPE_LABELS,
  type CabinClass,
  type TripType,
} from "@/lib/domain/trip";
import { FlexibleDatesCalendar, type FlexibleDatesValue } from "./flexible-dates-calendar";

export type ExploreDefaults = {
  origin: string;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  window: FlexibleDatesValue;
  minNights: number;
  maxNights: number;
  sort: ExploreSort;
  /** Major units, or "" for no budget. */
  maxPrice: string;
  /** Hours, or "" for no cap. */
  maxDurationHours: string;
  directOnly: boolean;
  country: string;
  limit: number;
};

const SORTED_AIRPORTS = [...AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";
const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function ExploreForm({
  defaults,
  todayIso,
  countries,
}: {
  defaults: ExploreDefaults;
  todayIso: string;
  countries: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [origin, setOrigin] = useState(defaults.origin);
  const [tripType, setTripType] = useState<TripType>(defaults.tripType);
  const [cabin, setCabin] = useState<CabinClass>(defaults.cabin);
  const [adults, setAdults] = useState(defaults.adults);
  const [range, setRange] = useState<FlexibleDatesValue>(defaults.window);
  const [sort, setSort] = useState<ExploreSort>(defaults.sort);
  const [maxPrice, setMaxPrice] = useState(defaults.maxPrice);
  const [maxDurationHours, setMaxDurationHours] = useState(defaults.maxDurationHours);
  const [directOnly, setDirectOnly] = useState(defaults.directOnly);
  const [country, setCountry] = useState(defaults.country);
  const [limit, setLimit] = useState(defaults.limit);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const qs = new URLSearchParams({
      origin,
      tripType,
      cabin,
      adults: String(adults),
      sort,
      limit: String(limit),
    });
    if (range.from) qs.set("departFrom", range.from);
    if (range.to) qs.set("departTo", range.to);
    if (tripType === "round-trip") {
      qs.set("minNights", String(defaults.minNights));
      qs.set("maxNights", String(defaults.maxNights));
    }
    if (maxPrice.trim()) qs.set("maxPrice", maxPrice.trim());
    if (maxDurationHours.trim()) qs.set("maxDuration", maxDurationHours.trim());
    if (directOnly) qs.set("directOnly", "1");
    if (country) qs.set("country", country);
    startTransition(() => router.push(`/explore?${qs.toString()}`));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="origin">
            From
          </label>
          <select
            id="origin"
            className={fieldClass}
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {SORTED_AIRPORTS.map((a) => (
              <option key={a.iata} value={a.iata}>
                {a.city} ({a.iata})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="tripType">
            Trip
          </label>
          <select
            id="tripType"
            className={fieldClass}
            value={tripType}
            onChange={(e) => setTripType(e.target.value as TripType)}
          >
            {TRIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRIP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="cabin">
            Cabin
          </label>
          <select
            id="cabin"
            className={fieldClass}
            value={cabin}
            onChange={(e) => setCabin(e.target.value as CabinClass)}
          >
            {CABIN_CLASSES.map((c) => (
              <option key={c} value={c}>
                {CABIN_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="adults">
            Travellers
          </label>
          <input
            id="adults"
            type="number"
            min={1}
            max={9}
            className={fieldClass}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <p className={labelClass}>Flexible departure dates</p>
        <FlexibleDatesCalendar value={range} onChange={setRange} minIso={todayIso} />
      </div>

      <fieldset className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Refine
        </legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="sort">
              Rank by
            </label>
            <select
              id="sort"
              className={fieldClass}
              value={sort}
              onChange={(e) => setSort(e.target.value as ExploreSort)}
            >
              {EXPLORE_SORTS.map((s) => (
                <option key={s} value={s}>
                  {EXPLORE_SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="maxPrice">
              Max price (EUR)
            </label>
            <input
              id="maxPrice"
              type="number"
              min={1}
              placeholder="Any"
              className={fieldClass}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="maxDuration">
              Max flight time (hours)
            </label>
            <input
              id="maxDuration"
              type="number"
              min={1}
              max={30}
              placeholder="Any"
              className={fieldClass}
              value={maxDurationHours}
              onChange={(e) => setMaxDurationHours(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="country">
              Country
            </label>
            <select
              id="country"
              className={fieldClass}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Any country</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="limit">
              Results
            </label>
            <select
              id="limit"
              className={fieldClass}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {EXPLORE_LIMITS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={directOnly}
              onChange={(e) => setDirectOnly(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            Direct flights only
          </label>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Exploring…" : "Find cheap destinations"}
      </button>
    </form>
  );
}
