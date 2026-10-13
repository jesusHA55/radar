import { addDays, eachDate } from "@/lib/domain/date-utils";
import type { CabinClass } from "@/lib/domain/trip";
import {
  mapExploreDestinations,
  mapOfferToItinerary,
  mapSegments,
  mergeOffers,
  type SerpExploreDestination,
  type SerpOffer,
} from "./serp-mappers";
import type {
  DestinationDeal,
  EverywhereSpec,
  FlightProvider,
  Itinerary,
  ProviderCredits,
  SearchSpec,
} from "./types";

/**
 * SerpApi (Google Flights) provider.
 *
 * Endpoints used:
 *   - `google_flights`        → route search. Round-trips take a *second*
 *                               request with the outbound's `departure_token`,
 *                               so a round-trip search costs 2 credits.
 *   - `google_travel_explore` → "Explore" — cheapest destinations from an
 *                               origin (the `everywhere` primitive). 1 credit.
 *
 * Google Flights needs concrete dates, so a flexible window is sampled
 * (`SERPAPI_DATE_SAMPLES`, default 1) and the cheapest result is returned.
 */

const ENDPOINT = "https://serpapi.com/search";

const CABIN_TO_TRAVEL_CLASS: Record<CabinClass, number> = {
  economy: 1,
  premium: 2,
  business: 3,
  first: 4,
};

export class SerpApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SerpApiError";
  }
}

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function dateSamples(): number {
  return Math.min(7, envInt("SERPAPI_DATE_SAMPLES", 1));
}

function roundTripDepth(): number {
  return Math.min(3, envInt("SERPAPI_ROUNDTRIP_DEPTH", 1));
}

function localeParams(): Record<string, string> {
  return {
    currency: process.env.SERPAPI_CURRENCY ?? "EUR",
    gl: process.env.SERPAPI_GL ?? "de",
    hl: process.env.SERPAPI_HL ?? "en",
  };
}

function apiKey(): string {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) {
    throw new SerpApiError("SERPAPI_API_KEY is not set. Add it to .env.local.");
  }
  return key;
}

async function serpFetch(
  params: Record<string, string | number>,
): Promise<Record<string, unknown>> {
  const url = new URL(ENDPOINT);
  const all = { ...params, ...localeParams(), api_key: apiKey() };
  for (const [key, value] of Object.entries(all)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: unknown })
    | null;

  if (!response.ok || (json && typeof json.error === "string")) {
    throw new SerpApiError(
      json && typeof json.error === "string"
        ? json.error
        : `SerpApi request failed (HTTP ${response.status})`,
    );
  }
  if (!json) throw new SerpApiError("SerpApi returned an empty body");
  return json;
}

/** Evenly spaced sample dates across the flexible window. */
function sampleDates(fromISO: string, toISO: string, count: number): string[] {
  const dates = eachDate(fromISO, toISO);
  if (dates.length === 0) return [fromISO];
  if (count <= 1 || dates.length <= count) return [dates[0]];
  const step = (dates.length - 1) / (count - 1);
  const picked: string[] = [];
  for (let i = 0; i < count; i++) picked.push(dates[Math.round(i * step)]);
  return [...new Set(picked)];
}

function returnDateFor(spec: SearchSpec, departDate: string): string {
  const nights = Math.max(1, spec.window.minNights ?? spec.window.maxNights ?? 5);
  let returnDate = addDays(departDate, nights);
  if (spec.window.returnFrom && returnDate < spec.window.returnFrom) {
    returnDate = spec.window.returnFrom;
  }
  if (spec.window.returnTo && returnDate > spec.window.returnTo) {
    returnDate = spec.window.returnTo;
  }
  return returnDate;
}

function baseParams(spec: SearchSpec): Record<string, string | number> {
  return {
    engine: "google_flights",
    departure_id: spec.origin,
    arrival_id: spec.destination,
    travel_class: CABIN_TO_TRAVEL_CLASS[spec.cabin],
    adults: spec.adults,
  };
}

export class SerpFlightProvider implements FlightProvider {
  readonly id = "serpapi";
  readonly label = "SerpApi (Google Flights)";

  readonly credits: ProviderCredits = {
    search: (spec) => {
      const perSample = spec.tripType === "round-trip" ? 1 + roundTripDepth() : 1;
      return dateSamples() * perSample;
    },
    everywhere: () => 1,
  };

  async searchOffers(spec: SearchSpec): Promise<Itinerary[]> {
    const dates = sampleDates(spec.window.departFrom, spec.window.departTo, dateSamples());
    const results: Itinerary[] = [];

    for (const departDate of dates) {
      if (spec.tripType === "one-way") {
        const json = await serpFetch({
          ...baseParams(spec),
          type: 2,
          outbound_date: departDate,
        });
        mergeOffers(json).forEach((offer, index) => {
          const itinerary = mapOfferToItinerary(offer, {
            spec,
            provider: this.id,
            idSuffix: `${departDate}-${index}`,
          });
          if (itinerary) results.push(itinerary);
        });
      } else {
        results.push(...(await this.searchRoundTrip(spec, departDate)));
      }
    }

    return results.sort((a, b) => a.price.amountMinor - b.price.amountMinor);
  }

  /** First call gets outbound options; each follow-up resolves the return leg. */
  private async searchRoundTrip(
    spec: SearchSpec,
    departDate: string,
  ): Promise<Itinerary[]> {
    const returnDate = returnDateFor(spec, departDate);
    const outboundJson = await serpFetch({
      ...baseParams(spec),
      type: 1,
      outbound_date: departDate,
      return_date: returnDate,
    });

    const outbounds = mergeOffers(outboundJson);
    const depth = Math.max(1, Math.min(roundTripDepth(), outbounds.length || 1));
    const itineraries: Itinerary[] = [];

    for (let i = 0; i < depth && i < outbounds.length; i++) {
      const outbound = outbounds[i];
      let returnOffer: SerpOffer | undefined;

      if (outbound.departure_token) {
        const returnJson = await serpFetch({
          ...baseParams(spec),
          type: 1,
          outbound_date: departDate,
          return_date: returnDate,
          departure_token: outbound.departure_token,
        });
        returnOffer = mergeOffers(returnJson)[0];
      }

      const returnSegments = mapSegments(returnOffer?.flights);
      const itinerary = mapOfferToItinerary(outbound, {
        spec,
        provider: this.id,
        returnSegments,
        returnDate,
        priceOverrideMajor: returnOffer?.price,
        idSuffix: `${departDate}-rt-${i}`,
      });
      if (itinerary) itineraries.push(itinerary);
    }

    return itineraries;
  }

  async everywhere(spec: EverywhereSpec): Promise<DestinationDeal[]> {
    const json = await serpFetch({
      engine: "google_travel_explore",
      departure_id: spec.origin,
      type: spec.tripType === "round-trip" ? 1 : 2,
      travel_class: CABIN_TO_TRAVEL_CLASS[spec.cabin],
      adults: spec.adults,
      stops: 0,
    });

    const destinations = (
      (json.destinations as SerpExploreDestination[] | undefined) ??
      (json.flights as SerpExploreDestination[] | undefined) ??
      []
    );

    return mapExploreDestinations(destinations, {
      currency: spec.currency,
      origin: spec.origin,
    })
      .sort((a, b) => a.price.amountMinor - b.price.amountMinor)
      .slice(0, spec.limit ?? 100);
  }
}
