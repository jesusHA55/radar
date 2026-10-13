import { formatMoney, type Itinerary } from "@/lib/flights/types";
import { formatDate, formatDuration, formatStops } from "@/lib/utils/format";

export function OfferCard({ itinerary }: { itinerary: Itinerary }) {
  const outbound = itinerary.segments[0];

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {itinerary.carrierCode}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {itinerary.carrierName}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatDate(itinerary.departDate)}
              {itinerary.returnDate ? ` → ${formatDate(itinerary.returnDate)}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{formatStops(itinerary.stops)}</span>
          <span>{formatDuration(itinerary.durationMinutes)}</span>
          <span>
            {itinerary.origin} → {itinerary.destination}
          </span>
          {outbound && (
            <span>
              Departs {outbound.departAt.slice(11, 16)} · arrives {outbound.arriveAt.slice(11, 16)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end sm:gap-1">
        <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {formatMoney(itinerary.price)}
        </p>
        <p className="text-xs text-zinc-400">{itinerary.provider}</p>
      </div>
    </article>
  );
}
