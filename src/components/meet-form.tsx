"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AIRPORTS } from "@/lib/domain/airports";
import { startOfTodayUTC } from "@/lib/domain/date-utils";
import {
  CABIN_CLASSES,
  CABIN_LABELS,
  TRIP_TYPES,
  TRIP_TYPE_LABELS,
  type CabinClass,
  type TripType,
} from "@/lib/domain/trip";
import { MEET_LIMITS, type MeetParticipant } from "@/lib/meet/types";
import { FlexibleDatesCalendar, type FlexibleDatesValue } from "./flexible-dates-calendar";

export type MeetDefaults = {
  participants: MeetParticipant[];
  window: FlexibleDatesValue;
  togetherNights: number;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  limit: number;
  minNights: number;
  maxNights: number;
};

const SORTED_AIRPORTS = [...AIRPORTS].sort((a, b) => a.city.localeCompare(b.city));

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";
const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

export function MeetForm({ defaults, todayIso }: { defaults: MeetDefaults; todayIso: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [participants, setParticipants] = useState<MeetParticipant[]>(defaults.participants);
  const [range, setRange] = useState<FlexibleDatesValue>(defaults.window);
  const [togetherNights, setTogetherNights] = useState(defaults.togetherNights);
  const [tripType, setTripType] = useState<TripType>(defaults.tripType);
  const [cabin, setCabin] = useState<CabinClass>(defaults.cabin);
  const [adults, setAdults] = useState(defaults.adults);
  const [limit, setLimit] = useState(defaults.limit);

  function update(index: number, patch: Partial<MeetParticipant>) {
    setParticipants((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function add() {
    setParticipants((rows) => [...rows, { label: `Traveller ${rows.length + 1}`, origin: "BER" }]);
  }

  function remove(index: number) {
    setParticipants((rows) => (rows.length <= 2 ? rows : rows.filter((_, i) => i !== index)));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const qs = new URLSearchParams({
      tripType,
      cabin,
      adults: String(adults),
      togetherNights: String(togetherNights),
      limit: String(limit),
    });
    for (const p of participants) {
      qs.append("p", `${p.origin.toUpperCase()}|${p.label}`);
    }
    if (range.from) qs.set("departFrom", range.from);
    if (range.to) qs.set("departTo", range.to);
    startTransition(() => router.push(`/meet?${qs.toString()}`));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className={labelClass}>Travellers (2 or more)</p>
          <button
            type="button"
            onClick={add}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Add traveller
          </button>
        </div>
        <div className="space-y-2">
          {participants.map((participant, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label={`Name for traveller ${index + 1}`}
                className={`${fieldClass} sm:max-w-[200px]`}
                value={participant.label}
                onChange={(e) => update(index, { label: e.target.value })}
                placeholder="Name"
              />
              <select
                aria-label={`Origin for traveller ${index + 1}`}
                className={fieldClass}
                value={participant.origin}
                onChange={(e) => update(index, { origin: e.target.value })}
              >
                {SORTED_AIRPORTS.map((a) => (
                  <option key={a.iata} value={a.iata}>
                    {a.city} ({a.iata})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={participants.length <= 2}
                className="rounded-lg border border-zinc-300 px-3 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className={labelClass}>Shareable flexible dates</p>
        <FlexibleDatesCalendar value={range} onChange={setRange} minIso={todayIso} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="togetherNights">
            Nights together
          </label>
          <input
            id="togetherNights"
            type="number"
            min={0}
            max={30}
            className={fieldClass}
            value={togetherNights}
            onChange={(e) => setTogetherNights(Number(e.target.value))}
          />
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor="adults">
              Each
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
              {MEET_LIMITS.map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Finding a meeting point…" : "Find where to meet"}
      </button>
    </form>
  );
}
