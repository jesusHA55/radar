/**
 * Provider-agnostic flight domain types.
 *
 * Every data source (the mock, Air Scraper, SerpApi, ...) normalizes its
 * response into these shapes, so the features above it never depend on a
 * specific vendor. Prices are integers in minor units (cents) to avoid
 * floating-point drift.
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
  provider: string;
  /** Optional deep link to book/verify the fare. */
  deepLinkUrl?: string;
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

export type PriceCalendarSpec = {
  origin: string;
  destination: string;
  tripType: TripType;
  window: DateWindow;
  cabin: CabinClass;
  adults: number;
  currency: string;
};

export type CalendarDay = {
  date: string;
  price: Money;
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
};

/**
 * The contract every flight data source implements.
 *
 * `everywhere` is the primitive that powers the Explore feature and, by
 * extension, the Meet feature (which fans `everywhere` out over several
 * origins and intersects the results).
 */
export interface FlightProvider {
  readonly id: string;
  readonly label: string;

  searchOffers(spec: SearchSpec): Promise<Itinerary[]>;
  priceCalendar(spec: PriceCalendarSpec): Promise<CalendarDay[]>;
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
