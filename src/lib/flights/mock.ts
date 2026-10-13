import { AIRPORTS, getAirport, haversineKm } from "@/lib/domain/airports";
import { addDays, eachDate, type DateWindow } from "@/lib/domain/date-window";
import type { CabinClass } from "@/lib/domain/trip";
import { hashRange, hashString, seededRandom } from "@/lib/utils/hash";
import {
  toMoney,
  type DestinationDeal,
  type EverywhereSpec,
  type FlightProvider,
  type FlightSegment,
  type Itinerary,
  type SearchSpec,
} from "./types";

/**
 * A deterministic, offline flight provider.
 *
 * It exists so the entire product — monitoring, Explore, Meet — is buildable,
 * demoable and testable at zero API cost. Prices are derived from a hash of
 * (route, date, cabin, pax), so the same search always yields the same result.
 * Swapping in a real provider is a config change, not a refactor.
 */

const CABIN_FACTOR: Record<CabinClass, number> = {
  economy: 1,
  premium: 1.7,
  business: 3.1,
  first: 5.2,
};

/** Sunday..Saturday — midweek departures are cheapest, Fri/Sun priciest. */
const DAY_OF_WEEK_FACTOR = [1.06, 0.9, 0.87, 0.89, 0.98, 1.18, 1.1];

/** Jan..Dec seasonal demand multiplier. */
const MONTH_FACTOR = [
  0.94, 0.91, 0.97, 1.02, 1.05, 1.13, 1.22, 1.19, 1.04, 0.97, 0.92, 1.06,
];

/** Demo FX rates against EUR (base). Replace with a live feed when it matters. */
const FX: Record<string, number> = { EUR: 1, USD: 1.09, GBP: 0.85, CHF: 0.94 };

const CARRIERS = [
  { code: "EW", name: "Eurowings" },
  { code: "LH", name: "Lufthansa" },
  { code: "FR", name: "Ryanair" },
  { code: "U2", name: "easyJet" },
  { code: "VY", name: "Vueling" },
  { code: "IB", name: "Iberia" },
  { code: "AF", name: "Air France" },
  { code: "KL", name: "KLM" },
  { code: "TP", name: "TAP Air Portugal" },
  { code: "LX", name: "SWISS" },
  { code: "OS", name: "Austrian Airlines" },
  { code: "SK", name: "SAS" },
];

function carrierFor(seed: string) {
  return CARRIERS[hashString(seed) % CARRIERS.length];
}

function routeKm(origin: string, destination: string): number | null {
  const a = getAirport(origin);
  const b = getAirport(destination);
  if (!a || !b) return null;
  return haversineKm(a, b);
}

function cabinFactor(cabin: CabinClass): number {
  return CABIN_FACTOR[cabin] ?? 1;
}

/**
 * The core price primitive: a believable, stable one-way fare in minor units.
 */
function quoteOneWayMinor(
  distanceKm: number,
  origin: string,
  destination: string,
  departISO: string,
  cabin: CabinClass,
  adults: number,
  currency: string,
): number {
  const baseEur = Math.max(25, 16 + distanceKm * 0.052);
  const jitter = hashRange(
    `${origin}:${destination}:${departISO}:${cabin}`,
    0.82,
    1.3,
  );
  const date = new Date(`${departISO}T00:00:00.000Z`);
  const dayFactor = DAY_OF_WEEK_FACTOR[date.getUTCDay()];
  const monthFactor = MONTH_FACTOR[date.getUTCMonth()];
  const eur =
    baseEur * jitter * dayFactor * monthFactor * cabinFactor(cabin) * adults;
  const rate = FX[currency] ?? 1;
  return Math.round(eur * rate * 100);
}

function quoteRoundTripMinor(
  distanceKm: number,
  origin: string,
  destination: string,
  departISO: string,
  returnISO: string,
  cabin: CabinClass,
  adults: number,
  currency: string,
): number {
  const out = quoteOneWayMinor(
    distanceKm,
    origin,
    destination,
    departISO,
    cabin,
    adults,
    currency,
  );
  const back = quoteOneWayMinor(
    distanceKm,
    destination,
    origin,
    returnISO,
    cabin,
    adults,
    currency,
  );
  // Round-trips are typically a touch cheaper than two separate one-ways.
  return Math.round((out + back) * 0.93);
}

type Cheapest = {
  priceMinor: number;
  departDate: string;
  returnDate?: string;
  distanceKm: number;
};

function cheapestFare(
  origin: string,
  destination: string,
  tripType: "one-way" | "round-trip",
  window: DateWindow,
  cabin: CabinClass,
  adults: number,
  currency: string,
): Cheapest | null {
  const distanceKm = routeKm(origin, destination);
  if (distanceKm === null) return null;

  const departDates = eachDate(window.departFrom, window.departTo);
  let best: Cheapest | null = null;

  if (tripType === "one-way") {
    for (const departDate of departDates) {
      const priceMinor = quoteOneWayMinor(
        distanceKm,
        origin,
        destination,
        departDate,
        cabin,
        adults,
        currency,
      );
      if (!best || priceMinor < best.priceMinor) {
        best = { priceMinor, departDate, distanceKm };
      }
    }
    return best;
  }

  const minNights = window.minNights ?? 3;
  const maxNights = Math.min(window.maxNights ?? 7, 21);
  const latestReturn = window.returnTo;

  for (const departDate of departDates) {
    for (let nights = minNights; nights <= maxNights; nights++) {
      const returnDate = addDays(departDate, nights);
      if (window.returnFrom && returnDate < window.returnFrom) continue;
      if (latestReturn && returnDate > latestReturn) continue;

      const priceMinor = quoteRoundTripMinor(
        distanceKm,
        origin,
        destination,
        departDate,
        returnDate,
        cabin,
        adults,
        currency,
      );
      if (!best || priceMinor < best.priceMinor) {
        best = { priceMinor, departDate, returnDate, distanceKm };
      }
    }
  }
  return best;
}

function estimateDurationMinutes(distanceKm: number, stops: number): number {
  const cruise = 780; // km/h
  const ground = stops * 75;
  return Math.round((distanceKm / cruise) * 60 + 35 + ground);
}

/** Short hops are usually non-stop; longer routes pick up connections. */
function typicalStops(distanceKm: number): number {
  if (distanceKm < 1500) return 0;
  if (distanceKm < 5000) return 1;
  return 2;
}

function buildSegments(
  origin: string,
  destination: string,
  departISO: string,
  stops: number,
  durationMinutes: number,
  carrier: { code: string; name: string },
  seed: string,
): FlightSegment[] {
  const rand = seededRandom(hashString(seed));
  const startHour = 6 + Math.floor(rand() * 14);
  const departAt = new Date(`${departISO}T00:00:00.000Z`);
  departAt.setUTCHours(startHour, 0, 0, 0);

  if (stops === 0) {
    const arriveAt = new Date(departAt.getTime() + durationMinutes * 60_000);
    return [
      {
        origin,
        destination,
        departAt: departAt.toISOString(),
        arriveAt: arriveAt.toISOString(),
        carrierCode: carrier.code,
        carrierName: carrier.name,
        flightNumber: `${carrier.code}${100 + Math.floor(rand() * 8000)}`,
        durationMinutes,
      },
    ];
  }

  const hub = AIRPORTS[Math.floor(rand() * AIRPORTS.length)].iata;
  const legOne = Math.round(durationMinutes * 0.55);
  const layover = 60 + Math.floor(rand() * 90);
  const legTwo = durationMinutes - legOne - layover;

  const firstArrive = new Date(departAt.getTime() + legOne * 60_000);
  const secondDepart = new Date(firstArrive.getTime() + layover * 60_000);
  const secondArrive = new Date(secondDepart.getTime() + legTwo * 60_000);

  return [
    {
      origin,
      destination: hub,
      departAt: departAt.toISOString(),
      arriveAt: firstArrive.toISOString(),
      carrierCode: carrier.code,
      carrierName: carrier.name,
      flightNumber: `${carrier.code}${100 + Math.floor(rand() * 8000)}`,
      durationMinutes: legOne,
    },
    {
      origin: hub,
      destination,
      departAt: secondDepart.toISOString(),
      arriveAt: secondArrive.toISOString(),
      carrierCode: carrier.code,
      carrierName: carrier.name,
      flightNumber: `${carrier.code}${100 + Math.floor(rand() * 8000)}`,
      durationMinutes: legTwo,
    },
  ];
}

export class MockFlightProvider implements FlightProvider {
  readonly id = "mock";
  readonly label = "Mock provider (offline demo data)";
  /** Offline demo data is free. */
  readonly credits = { search: () => 0, everywhere: () => 0 };

  async searchOffers(spec: SearchSpec): Promise<Itinerary[]> {
    const { origin, destination, tripType, window, cabin, adults, currency } =
      spec;
    const cheapest = cheapestFare(
      origin,
      destination,
      tripType,
      window,
      cabin,
      adults,
      currency,
    );
    if (!cheapest) return [];

    const variants: { uplift: number; stops: number; label: string }[] = [
      { uplift: 0, stops: (hashString(`${origin}${destination}`) % 2) as number, label: "best-value" },
      { uplift: 0.12, stops: 0, label: "fastest" },
      { uplift: 0.26, stops: 1, label: "flexible" },
    ];

    return variants.map((variant, index) => {
      const priceMinor = Math.round(cheapest.priceMinor * (1 + variant.uplift));
      const carrier = carrierFor(
        `${origin}:${destination}:${cheapest.departDate}:${index}`,
      );
      const durationMinutes = estimateDurationMinutes(
        cheapest.distanceKm,
        variant.stops,
      );
      const seed = `${origin}:${destination}:${cheapest.departDate}:${index}:seg`;
      return {
        id: `${origin}-${destination}-${cheapest.departDate}-${index}`,
        origin,
        destination,
        tripType,
        departDate: cheapest.departDate,
        returnDate: cheapest.returnDate,
        price: toMoney(priceMinor / 100, currency),
        carrierCode: carrier.code,
        carrierName: carrier.name,
        stops: variant.stops,
        durationMinutes,
        segments: buildSegments(
          origin,
          destination,
          cheapest.departDate,
          variant.stops,
          durationMinutes,
          carrier,
          seed,
        ),
        provider: this.id,
      } satisfies Itinerary;
    });
  }

  async everywhere(spec: EverywhereSpec): Promise<DestinationDeal[]> {
    const { origin, tripType, window, cabin, adults, currency, limit = 12 } =
      spec;
    if (!getAirport(origin)) return [];

    const deals: DestinationDeal[] = [];
    for (const airport of AIRPORTS) {
      if (airport.iata === origin) continue;
      const cheapest = cheapestFare(
        origin,
        airport.iata,
        tripType,
        window,
        cabin,
        adults,
        currency,
      );
      if (!cheapest) continue;
      const stops = typicalStops(cheapest.distanceKm);
      deals.push({
        destination: airport.iata,
        city: airport.city,
        country: airport.country,
        price: toMoney(cheapest.priceMinor / 100, currency),
        departDate: cheapest.departDate,
        returnDate: cheapest.returnDate,
        distanceKm: Math.round(cheapest.distanceKm),
        durationMinutes: estimateDurationMinutes(cheapest.distanceKm, stops),
        stops,
      } satisfies DestinationDeal);
    }

    return deals
      .sort((a, b) => a.price.amountMinor - b.price.amountMinor)
      .slice(0, limit);
  }
}
