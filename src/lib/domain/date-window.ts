/**
 * The shared "flexible dates" abstraction.
 *
 * Every Radar feature — Monitor, Explore and Meet — bottoms out on the same
 * query shape: a span of acceptable departure dates, an optional span of
 * acceptable return dates, and optional trip-length constraints. Modelling it
 * once keeps the UI, the URL and the provider layer in agreement.
 */

import { z } from "zod";
import { addDays, parseISODate, toISODate } from "./date-utils";

export { addDays, eachDate, nightsBetween, parseISODate, toISODate } from "./date-utils";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD)");

export const dateWindowSchema = z.object({
  /** Earliest acceptable departure date, inclusive. */
  departFrom: isoDate,
  /** Latest acceptable departure date, inclusive. */
  departTo: isoDate,
  /** Earliest acceptable return date, inclusive (round-trips only). */
  returnFrom: isoDate.optional(),
  /** Latest acceptable return date, inclusive (round-trips only). */
  returnTo: isoDate.optional(),
  /** Minimum nights away, inclusive. */
  minNights: z.coerce.number().int().min(0).max(60).optional(),
  /** Maximum nights away, inclusive. */
  maxNights: z.coerce.number().int().min(0).max(365).optional(),
});

export type DateWindow = z.infer<typeof dateWindowSchema>;

const MS_PER_DAY = 86_400_000;

/** A sensible default window: the next 30 days starting a week out. */
export function defaultDateWindow(now: Date = new Date()): DateWindow {
  const start = toISODate(new Date(now.getTime() + 7 * MS_PER_DAY));
  const end = addDays(start, 29);
  return {
    departFrom: start,
    departTo: end,
    minNights: 3,
    maxNights: 7,
  };
}

export function isValidDateWindow(value: unknown): value is DateWindow {
  return dateWindowSchema.safeParse(value).success;
}

/** Parse a DateWindow out of loose URL/form values, falling back to defaults. */
export function dateWindowFromParams(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): DateWindow {
  const pick = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const candidate = {
    departFrom: pick("departFrom"),
    departTo: pick("departTo"),
    returnFrom: pick("returnFrom"),
    returnTo: pick("returnTo"),
    minNights: pick("minNights"),
    maxNights: pick("maxNights"),
  };

  const parsed = dateWindowSchema.safeParse(candidate);
  if (parsed.success) {
    // Guard against inverted ranges.
    if (parsed.data.departFrom > parsed.data.departTo) {
      return { ...parsed.data, departTo: parsed.data.departFrom };
    }
    return parsed.data;
  }
  return defaultDateWindow(now);
}

/** Serialize a DateWindow into flat, URL-friendly string values. */
export function dateWindowToParams(window: DateWindow): Record<string, string> {
  const out: Record<string, string> = {
    departFrom: window.departFrom,
    departTo: window.departTo,
  };
  if (window.returnFrom) out.returnFrom = window.returnFrom;
  if (window.returnTo) out.returnTo = window.returnTo;
  if (window.minNights !== undefined) out.minNights = String(window.minNights);
  if (window.maxNights !== undefined) out.maxNights = String(window.maxNights);
  return out;
}

export function describeDateWindow(window: DateWindow): string {
  if (window.departFrom === window.departTo) {
    return window.departFrom;
  }
  return `${window.departFrom} → ${window.departTo}`;
}
