"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AIRPORTS } from "@/lib/domain/airports";
import {
  CABIN_CLASSES,
  CABIN_LABELS,
  TRIP_TYPES,
  TRIP_TYPE_LABELS,
  type CabinClass,
  type TripType,
} from "@/lib/domain/trip";
import { FlexibleDatesInput, type FlexibleDatesValue } from "./flexible-dates-input";

export type SearchDefaults = {
  origin: string;
  destination: string;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  window: FlexibleDatesValue;
  minNights: number;
  maxNights: number;
  thorough: boolean;
};

const SORTED_AIRPORTS = [...AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));

function AirportOptions() {
  return SORTED_AIRPORTS.map((a) => (
    <option key={a.iata} value={a.iata}>
      {a.city} ({a.iata})
    </option>
  ));
}

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";
const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

/** Inclusive number of days in a range (1 for a single day). */
function daysInRange(value: FlexibleDatesValue): number {
  if (!value.from) return 0;
  if (!value.to || value.to < value.from) return 1;
  return (
    Math.round(
      (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) /
        86_400_000,
    ) + 1
  );
}

export function SearchControls({
  defaults,
  todayIso,
  creditsRemaining,
  chargeable,
}: {
  defaults: SearchDefaults;
  todayIso: string;
  creditsRemaining: number;
  chargeable: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [origin, setOrigin] = useState(defaults.origin);
  const [destination, setDestination] = useState(defaults.destination);
  const [tripType, setTripType] = useState<TripType>(defaults.tripType);
  const [cabin, setCabin] = useState<CabinClass>(defaults.cabin);
  const [adults, setAdults] = useState(defaults.adults);
  const [range, setRange] = useState<FlexibleDatesValue>(defaults.window);
  const [minNights, setMinNights] = useState(defaults.minNights);
  const [maxNights, setMaxNights] = useState(defaults.maxNights);
  const [thorough, setThorough] = useState(defaults.thorough);

  const days = daysInRange(range);
  const estimatedCredits = Math.max(1, days) * (tripType === "round-trip" ? 2 : 1);

  function swap() {
    setOrigin(destination);
    setDestination(origin);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const qs = new URLSearchParams({
      origin,
      destination,
      tripType,
      cabin,
      adults: String(adults),
    });
    if (range.from) qs.set("departFrom", range.from);
    if (range.to) qs.set("departTo", range.to);
    if (tripType === "round-trip") {
      qs.set("minNights", String(minNights));
      qs.set("maxNights", String(maxNights));
    }
    if (thorough) qs.set("thorough", "1");
    startTransition(() => router.push(`/search?${qs.toString()}`));
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
            <AirportOptions />
          </select>
        </div>

        <div className="relative">
          <label className={labelClass} htmlFor="destination">
            To
          </label>
          <select
            id="destination"
            className={fieldClass}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <AirportOptions />
          </select>
          <button
            type="button"
            onClick={swap}
            title="Swap origin and destination"
            className="absolute right-2 top-7 rounded-md border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-100"
          >
            ⇄
          </button>
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

        <div className="grid grid-cols-2 gap-2">
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
      </div>

      {tripType === "round-trip" && (
        <div className="grid max-w-xs grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor="minNights">
              Min nights
            </label>
            <input
              id="minNights"
              type="number"
              min={0}
              max={60}
              className={fieldClass}
              value={minNights}
              onChange={(e) => setMinNights(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="maxNights">
              Max nights
            </label>
            <input
              id="maxNights"
              type="number"
              min={0}
              max={60}
              className={fieldClass}
              value={maxNights}
              onChange={(e) => setMaxNights(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      <div>
        <p className={labelClass}>Flexible departure dates</p>
        <FlexibleDatesInput
          value={range}
          onChange={setRange}
          minIso={todayIso}
        />
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {range.from
            ? range.to && range.to !== range.from
              ? `Departing any day between ${range.from} and ${range.to}.`
              : `Departing on ${range.from}.`
            : "Select a departure span (or a single day)."}
        </p>
      </div>

      <fieldset className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Search quality
        </legend>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={thorough}
            onChange={(e) => setThorough(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Thorough (exact browser results)
        </label>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          We price <strong>every day</strong> in your window
          {days > 0 ? ` (${days} day${days === 1 ? "" : "s"})` : ""}, so flexible dates
          are fully covered — no more first-day-only results.{" "}
          {chargeable ? (
            <>
              Estimated cost ≈{estimatedCredits} credit
              {estimatedCredits === 1 ? "" : "s"} · {creditsRemaining} left this month.
              {estimatedCredits > creditsRemaining && (
                <span className="text-amber-600 dark:text-amber-400">
                  {" "}
                  Not enough credits for this window.
                </span>
              )}
            </>
          ) : (
            <>The demo provider is free.</>
          )}
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Searching…" : "Search flights"}
      </button>
    </form>
  );
}
