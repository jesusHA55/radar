/**
 * Provider-agnostic flight domain types.
 *
 * Every data source (the mock, SerpApi, ...) normalizes its response into these
 * shapes, so the features above never depend on a specific vendor. Prices are
 * integers in minor units (cents) to avoid floating-point drift.
 */

import type { DateWindow } from "@/lib/domain/date-window";
import type { CabinClass, TripType } from "@/lib/domain/trip";

export type Money = {
  /** Integer amount in minor units, e.g. 12345 === 123.45 EUR. */
  amountMinor: number;
  /** ISO 4217 currency code, uppercase, e.g. "EUR". */
  currency: string;
};

export type FlightSegment = {
  origin: string;
  destination: string;
  /** ISO 8601 local departure timestamp. */
  departAt: string;
  /** ISO 8601 local arrival timestamp. */
  arriveAt: string;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  durationMinutes: number;
};

/** Google's own "is this a good price" signal, when the provider offers it. */
export type PriceLevel = "low" | "typical" | "high";

export type Itinerary = {
  id: string;
  origin: string;
  destination: string;
  tripType: TripType;
  departDate: string;
  returnDate?: string;
  price: Money;
  /** Cheapest carrier across all segments. */
  carrierCode: string;
  carrierName: string;
  /** Number of stops on the outbound leg. */
  stops: number;
  /** Total travel time of the outbound leg, in minutes. */
  durationMinutes: number;
  segments: FlightSegment[];
  /** Return segments, for round-trips. */
  returnSegments?: FlightSegment[];
  provider: string;
  /** Optional deep link to verify/book the fare. */
  deepLinkUrl?: string;
  priceLevel?: PriceLevel;
};

export type SearchSpec = {
  origin: string;
  destination: string;
  tripType: TripType;
  window: DateWindow;
  cabin: CabinClass;
  adults: number;
  currency: string;
};

export type EverywhereSpec = {
  origin: string;
  tripType: TripType;
  window: DateWindow;
  cabin: CabinClass;
  adults: number;
  currency: string;
  /** Optional cap on the number of destinations returned. */
  limit?: number;
};

export type DestinationDeal = {
  destination: string;
  city: string;
  country: string;
  price: Money;
  departDate: string;
  returnDate?: string;
  /** Great-circle distance in kilometres. */
  distanceKm: number;
  durationMinutes: number;
  stops: number;
  /** When the provider reports a deal, how far below average it is. */
  discountPercent?: number;
  averagePriceMinor?: number;
  deepLinkUrl?: string;
};

/**
 * How many upstream requests (credits) each operation consumes. The mock is
 * free; SerpApi charges 1 credit per request — and a round-trip search needs a
 * second follow-up request, so it costs 2.
 */
export type ProviderCredits = {
  search: (spec: SearchSpec) => number;
  everywhere: (spec: EverywhereSpec) => number;
};

/**
 * The contract every flight data source implements.
 *
 * `everywhere` powers the Explore feature and, by extension, the Meet optimizer
 * (which fans `everywhere` out over several origins and intersects the results).
 */
export interface FlightProvider {
  readonly id: string;
  readonly label: string;
  readonly credits: ProviderCredits;

  searchOffers(spec: SearchSpec): Promise<Itinerary[]>;
  everywhere(spec: EverywhereSpec): Promise<DestinationDeal[]>;
}

/** Convert a float amount in major units to integer minor units. */
export function toMoney(amountMajor: number, currency: string): Money {
  return { amountMinor: Math.round(amountMajor * 100), currency };
}

export function formatMoney(money: Money, locale = "en-IE"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    maximumFractionDigits: money.amountMinor % 100 === 0 ? 0 : 2,
  }).format(money.amountMinor / 100);
}
