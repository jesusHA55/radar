"use client";

import { useActionState, useState } from "react";

import { createWatchAction } from "@/app/monitor/actions";
import { AIRPORTS } from "@/lib/domain/airports";
import {
  CABIN_CLASSES,
  CABIN_LABELS,
  TRIP_TYPES,
  TRIP_TYPE_LABELS,
  type CabinClass,
  type TripType,
} from "@/lib/domain/trip";
import {
  CADENCE_OPTIONS,
  THRESHOLD_LABELS,
  THRESHOLD_TYPES,
  type ActionState,
  type ThresholdType,
} from "@/lib/monitor/types";
import { FlexibleDatesInput, type FlexibleDatesValue } from "./flexible-dates-input";

type Props = {
  todayIso: string;
  defaultWindow: FlexibleDatesValue;
};

const SORTED_AIRPORTS = [...AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";
const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function WatchForm({ todayIso, defaultWindow }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    createWatchAction,
    { ok: true },
  );

  const [tripType, setTripType] = useState<TripType>("round-trip");
  const [thresholdType, setThresholdType] = useState<ThresholdType>("any-low");
  const [range, setRange] = useState<FlexibleDatesValue>(defaultWindow);
  const [minNights, setMinNights] = useState(3);
  const [maxNights, setMaxNights] = useState(7);
  const [dateSamples, setDateSamples] = useState(1);

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="origin">
            From
          </label>
          <select id="origin" name="origin" className={fieldClass} defaultValue="STR">
            {SORTED_AIRPORTS.map((a) => (
              <option key={a.iata} value={a.iata}>
                {a.city} ({a.iata})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="destination">
            To
          </label>
          <select id="destination" name="destination" className={fieldClass} defaultValue="BCN">
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
            name="tripType"
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
            <select id="cabin" name="cabin" className={fieldClass} defaultValue="economy">
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
              name="adults"
              type="number"
              min={1}
              max={9}
              defaultValue={1}
              className={fieldClass}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="label">
          Label (optional)
        </label>
        <input
          id="label"
          name="label"
          placeholder="e.g. Weekend in Barcelona"
          className={fieldClass}
        />
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
        <FlexibleDatesInput value={range} onChange={setRange} minIso={todayIso} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="thresholdType">
            Alert me when
          </label>
          <select
            id="thresholdType"
            name="thresholdType"
            className={fieldClass}
            value={thresholdType}
            onChange={(e) => setThresholdType(e.target.value as ThresholdType)}
          >
            {THRESHOLD_TYPES.map((t) => (
              <option key={t} value={t}>
                {THRESHOLD_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {thresholdType === "target" && (
          <div>
            <label className={labelClass} htmlFor="thresholdAmount">
              Target price (EUR)
            </label>
            <input
              id="thresholdAmount"
              name="thresholdAmount"
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 120"
              className={fieldClass}
            />
          </div>
        )}

        {thresholdType === "drop-percent" && (
          <div>
            <label className={labelClass} htmlFor="dropPercent">
              Drop below previous low (%)
            </label>
            <input
              id="dropPercent"
              name="dropPercent"
              type="number"
              min={1}
              max={90}
              defaultValue={10}
              className={fieldClass}
            />
          </div>
        )}
      </div>

      <div className="grid max-w-md gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="cadenceMinutes">
            Check frequency
          </label>
          <select id="cadenceMinutes" name="cadenceMinutes" className={fieldClass} defaultValue={720}>
            {CADENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="dateSamples">
            Dates to sample
          </label>
          <select
            id="dateSamples"
            name="dateSamples"
            className={fieldClass}
            value={dateSamples}
            onChange={(e) => setDateSamples(Number(e.target.value))}
          >
            <option value={1}>1 — fastest</option>
            <option value={3}>3</option>
            <option value={5}>5 — balanced</option>
            <option value={10}>10 — thorough</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        How many departure dates to price across the window. More dates tracks a
        truer cheapest fare, but costs more provider credits per check (free on
        the demo provider).
      </p>

      {/* Serialize the flexible window (client state) into the form submission. */}
      <input type="hidden" name="departFrom" value={range.from ?? ""} />
      <input type="hidden" name="departTo" value={range.to ?? range.from ?? ""} />
      {tripType === "round-trip" && (
        <>
          <input type="hidden" name="minNights" value={minNights} />
          <input type="hidden" name="maxNights" value={maxNights} />
        </>
      )}

      {!state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Creating…" : "Create watch"}
      </button>
    </form>
  );
}
