/**
 * Pure date helpers shared by both server and client code.
 *
 * Kept separate from `date-window.ts` so client components can use them without
 * pulling zod (and the schema) into the browser bundle. All dates are handled
 * in UTC to avoid timezone drift when serialising to `YYYY-MM-DD`.
 */

const MS_PER_DAY = 86_400_000;

/** Parse a `YYYY-MM-DD` string into a UTC Date at midnight. */
export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Format a Date as `YYYY-MM-DD` (UTC). */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * MS_PER_DAY));
}

/** Inclusive number of nights between two ISO dates. */
export function nightsBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / MS_PER_DAY,
  );
}

/** Every ISO date in [from, to], inclusive. Bounded to guard against typos. */
export function eachDate(fromISO: string, toISO: string, max = 400): string[] {
  const out: string[] = [];
  let cursor = fromISO;
  while (cursor <= toISO && out.length < max) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** Start of today, UTC midnight. */
export function startOfTodayUTC(now: Date = new Date()): string {
  return toISODate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}
