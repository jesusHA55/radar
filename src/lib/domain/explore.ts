import type { DestinationDeal } from "@/lib/flights/types";

/**
 * Pure ranking and filtering for the Explore feature.
 *
 * Kept free of framework/DB concerns so it can be unit tested directly and
 * reused by the Meet optimizer later.
 */

export const EXPLORE_SORTS = ["cheapest", "best-value", "fastest", "soonest"] as const;
export type ExploreSort = (typeof EXPLORE_SORTS)[number];

export const EXPLORE_SORT_LABELS: Record<ExploreSort, string> = {
  cheapest: "Cheapest",
  "best-value": "Best value (€ per hour)",
  fastest: "Fastest",
  soonest: "Leaving soonest",
};

export const EXPLORE_LIMITS = [10, 25, 50, 100] as const;

export type ExploreFilters = {
  /** Budget ceiling in minor units, inclusive. */
  maxPriceMinor?: number;
  /** Maximum outbound duration in minutes, inclusive. */
  maxDurationMinutes?: number;
  /** Only non-stop options. */
  directOnly: boolean;
  /** Exact country match, if set. */
  country?: string;
  /** How many results to keep after ranking. */
  limit: number;
};

export function isExploreSort(value: string): value is ExploreSort {
  return (EXPLORE_SORTS as readonly string[]).includes(value);
}

/** Price per hour in the air, in minor units. Lower is better value. */
export function pricePerHourMinor(deal: DestinationDeal): number {
  const hours = Math.max(deal.durationMinutes, 1) / 60;
  return Math.round(deal.price.amountMinor / hours);
}

export function matchesFilters(deal: DestinationDeal, filters: ExploreFilters): boolean {
  if (filters.maxPriceMinor !== undefined && deal.price.amountMinor > filters.maxPriceMinor) {
    return false;
  }
  if (
    filters.maxDurationMinutes !== undefined &&
    deal.durationMinutes > filters.maxDurationMinutes
  ) {
    return false;
  }
  if (filters.directOnly && deal.stops > 0) {
    return false;
  }
  if (filters.country && deal.country !== filters.country) {
    return false;
  }
  return true;
}

/** Returns a new array sorted according to `sort` (never mutates the input). */
export function sortDeals(deals: DestinationDeal[], sort: ExploreSort): DestinationDeal[] {
  const sorted = [...deals];
  switch (sort) {
    case "cheapest":
      sorted.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
      break;
    case "best-value":
      sorted.sort((a, b) => pricePerHourMinor(a) - pricePerHourMinor(b));
      break;
    case "fastest":
      sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
      break;
    case "soonest":
      sorted.sort((a, b) => a.departDate.localeCompare(b.departDate));
      break;
  }
  return sorted;
}

/**
 * Keep one entry per destination.
 *
 * Providers can return several fares for the same airport (different airlines
 * or dates); without this, results contain duplicate destinations — which
 * breaks React keys and makes re-ordering look wrong.
 */
export function dedupeByDestination(deals: DestinationDeal[]): DestinationDeal[] {
  const seen = new Set<string>();
  const out: DestinationDeal[] = [];
  for (const deal of deals) {
    if (seen.has(deal.destination)) continue;
    seen.add(deal.destination);
    out.push(deal);
  }
  return out;
}

export function applyExplore(
  deals: DestinationDeal[],
  sort: ExploreSort,
  filters: ExploreFilters,
): DestinationDeal[] {
  const kept = deals.filter((deal) => matchesFilters(deal, filters));
  // Sort first, then keep the single best entry per destination for the chosen
  // ranking (cheapest / fastest / best value / soonest).
  return dedupeByDestination(sortDeals(kept, sort)).slice(0, filters.limit);
}

/** Distinct countries present in a deal set, sorted for stable UI options. */
export function countriesOf(deals: DestinationDeal[]): string[] {
  return [...new Set(deals.map((deal) => deal.country))].sort();
}
