"use client";

import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";

import { parseISODate, toISODate } from "@/lib/domain/date-utils";

export type FlexibleDatesValue = { from?: string; to?: string };

type Props = {
  value: FlexibleDatesValue;
  onChange: (value: FlexibleDatesValue) => void;
  /** Earliest selectable date (ISO). Defaults to today. */
  minIso?: string;
  numberOfMonths?: number;
};

/**
 * The shared flexible-dates control. It selects a *span* of departure dates
 * (inclusive), which every feature maps onto a `DateWindow`.
 */
export function FlexibleDatesCalendar({
  value,
  onChange,
  minIso,
  numberOfMonths = 2,
}: Props) {
  const selected: DateRange | undefined = value.from
    ? { from: parseISODate(value.from), to: value.to ? parseISODate(value.to) : undefined }
    : undefined;

  const disabled = minIso ? { before: parseISODate(minIso) } : undefined;

  return (
    <div className="rdp-theme overflow-x-auto rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
      <DayPicker
        mode="range"
        numberOfMonths={numberOfMonths}
        selected={selected}
        onSelect={(range) =>
          onChange({
            from: range?.from ? toISODate(range.from) : undefined,
            to: range?.to ? toISODate(range.to) : undefined,
          })
        }
        disabled={disabled}
        showOutsideDays
        className="mx-auto"
      />
    </div>
  );
}
