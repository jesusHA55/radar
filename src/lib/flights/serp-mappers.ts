/**
 * Pure mappers from SerpApi (Google Flights) responses to Radar's normalized
 * types. Kept free of network/DB concerns so they can be unit-tested against
 * captured fixtures — this is our guard against SerpApi schema drift.
 */

import { getAirport, haversineKm } from "@/lib/domain/airports";
import {
  toMoney,
  type DestinationDeal,
  type FlightSegment,
  type Itinerary,
  type SearchSpec,
} from "./types";

/* ------------------------------------------------------------------ */
/* Raw shapes (only the fields we rely on)                             */
/* ------------------------------------------------------------------ */

export type SerpEndpoint = { name?: string; id?: string; time?: string };

export type SerpFlightSegment = {
  departure_airport?: SerpEndpoint;
  arrival_airport?: SerpEndpoint;
  duration?: number;
  airline?: string;
  flight_number?: string;
  travel_class?: string;
};

export type SerpOffer = {
  flights?: SerpFlightSegment[];
  layovers?: { duration?: number; id?: string; name?: string }[];
  total_duration?: number;
  price?: number;
  type?: string;
  departure_token?: string;
  booking_token?: string;
  airline_logo?: string;
};

export type SerpExploreDestination = {
  name?: string;
  country?: string;
  destination_airport?: { code?: string };
  start_date?: string;
  end_date?: string;
  flight_price?: number;
  flight_duration?: number;
  number_of_stops?: number;
  airline?: string;
  airline_code?: string;
  link?: string;
};

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** "2026-11-15 22:05" → "2026-11-15T22:05:00" (local ISO). */
export function serpTimeToIso(time?: string): string | undefined {
  if (!time) return undefined;
  const match = time.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/);
  if (!match) return undefined;
  return `${match[1]}T${match[2]}:${match[3] ?? "00"}`;
}

/** "VY 1211" → "VY". */
export function carrierCodeFromFlightNumber(flightNumber?: string): string {
  if (!flightNumber) return "";
  const match = flightNumber.trim().match(/^([A-Z0-9]{2})\s?\d+/i);
  return match ? match[1].toUpperCase() : "";
}

export function mapSegments(flights: SerpFlightSegment[] = []): FlightSegment[] {
  return flights.map((flight) => {
    const code = carrierCodeFromFlightNumber(flight.flight_number);
    return {
      origin: flight.departure_airport?.id ?? "",
      destination: flight.arrival_airport?.id ?? "",
      departAt: serpTimeToIso(flight.departure_airport?.time) ?? "",
      arriveAt: serpTimeToIso(flight.arrival_airport?.time) ?? "",
      carrierCode: code,
      carrierName: flight.airline ?? code,
      flightNumber: flight.flight_number ?? "",
      durationMinutes: flight.duration ?? 0,
    } satisfies FlightSegment;
  });
}

export function offerStops(offer: SerpOffer): number {
  if (offer.layovers && offer.layovers.length > 0) return offer.layovers.length;
  const segments = offer.flights?.length ?? 1;
  return Math.max(0, segments - 1);
}

/** Google Flights returns both `best_flights` and `other_flights`. */
export function mergeOffers(json: {
  best_flights?: SerpOffer[];
  other_flights?: SerpOffer[];
}): SerpOffer[] {
  return [...(json.best_flights ?? []), ...(json.other_flights ?? [])];
}

/* ------------------------------------------------------------------ */
/* Itineraries                                                         */
/* ------------------------------------------------------------------ */

type MapItineraryOptions = {
  spec: SearchSpec;
  provider: string;
  returnSegments?: FlightSegment[];
  returnDate?: string;
  /** Combined round-trip price, when it comes from the return step. */
  priceOverrideMajor?: number;
  idSuffix?: string;
};

export function mapOfferToItinerary(
  offer: SerpOffer,
  options: MapItineraryOptions,
): Itinerary | null {
  const segments = mapSegments(offer.flights);
  const priceMajor = options.priceOverrideMajor ?? offer.price;
  if (segments.length === 0 || priceMajor === undefined) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const departDate = first.departAt ? first.departAt.slice(0, 10) : options.spec.window.departFrom;

  return {
    id: `${options.spec.origin}-${options.spec.destination}-${departDate}-${options.idSuffix ?? "0"}`,
    origin: first.origin || options.spec.origin,
    destination: last.destination || options.spec.destination,
    tripType: options.spec.tripType,
    departDate,
    returnDate: options.returnDate ?? options.returnSegments?.[0]?.departAt.slice(0, 10),
    price: toMoney(priceMajor, options.spec.currency),
    carrierCode: first.carrierCode,
    carrierName: first.carrierName,
    stops: offerStops(offer),
    durationMinutes:
      offer.total_duration ?? segments.reduce((sum, s) => sum + s.durationMinutes, 0),
    segments,
    returnSegments: options.returnSegments,
    provider: options.provider,
  } satisfies Itinerary;
}

/* ------------------------------------------------------------------ */
/* Explore destinations                                               */
/* ------------------------------------------------------------------ */

export function mapExploreDestinations(
  destinations: SerpExploreDestination[],
  options: { currency: string; origin: string },
): DestinationDeal[] {
  const originAirport = getAirport(options.origin);
  const deals: DestinationDeal[] = [];

  for (const destination of destinations) {
    const code = (destination.destination_airport?.code ?? "").toUpperCase();
    if (!code || destination.flight_price === undefined) continue;

    const airport = getAirport(code);
    const distanceKm =
      originAirport && airport ? Math.round(haversineKm(originAirport, airport)) : 0;

    deals.push({
      destination: code,
      city: destination.name ?? airport?.city ?? code,
      country: destination.country ?? airport?.country ?? "",
      price: toMoney(destination.flight_price, options.currency),
      departDate: destination.start_date ?? "",
      returnDate: destination.end_date,
      distanceKm,
      durationMinutes: destination.flight_duration ?? 0,
      stops: destination.number_of_stops ?? 0,
      deepLinkUrl: destination.link,
    } satisfies DestinationDeal);
  }

  return deals;
}
