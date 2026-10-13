"use client";

import { startOfTodayUTC } from "@/lib/domain/date-utils";

/**
 * The flexible-dates control.
 *
 * Deliberately simple and responsive: two native date fields (which allow manual
 * typing *and* a picker), plus quick presets. Native inputs are keyboard- and
 * mobile-friendly, unlike a heavy inline month grid.
 */

export type FlexibleDatesValue = { from?: string; to?: string };

type Props = {
  value: FlexibleDatesValue;
  onChange: (value: FlexibleDatesValue) => void;
  /** Earliest selectable date (ISO). Defaults to today. */
  minIso?: string;
};

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";

const labelClass = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

function Preset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {children}
    </button>
  );
}

export function FlexibleDatesInput({ value, onChange, minIso }: Props) {
  const today = minIso ?? startOfTodayUTC();
  const from = value.from ?? "";
  const to = value.to ?? "";

  function setFrom(next: string) {
    if (!next) return onChange({ from: undefined, to: value.to });
    const nextTo = value.to && value.to < next ? next : value.to;
    onChange({ from: next, to: nextTo });
  }

  function setTo(next: string) {
    if (!next) return onChange({ from: value.from, to: undefined });
    const nextFrom = value.from && next < value.from ? next : value.from;
    onChange({ from: nextFrom, to: next });
  }

  function applyPreset(days: number) {
    const start = addDays(today, 1);
    onChange({ from: start, to: addDays(start, days - 1) });
  }

  const summary = from
    ? to && to !== from
      ? `Departing any day between ${from} and ${to} · ${daysBetween(from, to) + 1} days`
      : `Departing on ${from}`
    : "Pick a departure window (or a single day).";

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="depart-from">
            Earliest departure
          </label>
          <input
            id="depart-from"
            type="date"
            className={inputClass}
            min={today}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="depart-to">
            Latest departure
          </label>
          <input
            id="depart-to"
            type="date"
            className={inputClass}
            min={from || today}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Preset onClick={() => applyPreset(7)}>Next 7 days</Preset>
        <Preset onClick={() => applyPreset(30)}>Next 30 days</Preset>
        <Preset onClick={() => applyPreset(90)}>Next 3 months</Preset>
        <Preset onClick={() => onChange({})}>Clear</Preset>
      </div>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{summary}</p>
    </div>
  );
}
