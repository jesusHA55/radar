/** Small display helpers shared across components. */

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** "Wed, 14 Oct" from a `YYYY-MM-DD` string. */
export function formatDate(iso: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00.000Z`));
}

/** Short stop description, e.g. "Direct" or "1 stop". */
export function formatStops(stops: number): string {
  if (stops === 0) return "Direct";
  return `${stops} stop${stops > 1 ? "s" : ""}`;
}
