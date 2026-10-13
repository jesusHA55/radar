import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  carrierCodeFromFlightNumber,
  mapExploreDestinations,
  mapOfferToItinerary,
  mergeOffers,
  serpInsights,
  serpTimeToIso,
  type SerpExploreDestination,
  type SerpOffer,
} from "@/lib/flights/serp-mappers";
import type { SearchSpec } from "@/lib/flights/types";

/**
 * Fixture-based checks for the SerpApi mappers.
 *
 * Our guard against SerpApi schema drift: when their response shape changes,
 * refresh the fixtures in `test/fixtures/serp/` and these assertions tell us
 * what broke. Run with `npm run test:mappers`.
 */

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(`test/fixtures/serp/${name}.json`, "utf8")) as T;
}

type FlightsResponse = { best_flights?: SerpOffer[]; other_flights?: SerpOffer[] };

const oneWaySpec: SearchSpec = {
  origin: "STR",
  destination: "BCN",
  tripType: "one-way",
  window: { departFrom: "2026-11-15", departTo: "2026-11-15" },
  cabin: "economy",
  adults: 1,
  currency: "EUR",
};

/* --- primitives --------------------------------------------------- */
assert.equal(serpTimeToIso("2026-11-15 22:05"), "2026-11-15T22:05:00");
assert.equal(serpTimeToIso("not a time"), undefined);
assert.equal(carrierCodeFromFlightNumber("VY 1211"), "VY");
assert.equal(carrierCodeFromFlightNumber("BA301"), "BA");

/* --- one-way offers ----------------------------------------------- */
type FlightsFixture = FlightsResponse & { price_insights?: unknown };
const oneWay = fixture<FlightsFixture>("google-flights-oneway");
const oneWayOffers = mergeOffers(oneWay);
assert.ok(oneWayOffers.length >= 1, "expected at least one one-way offer");

const itinerary = mapOfferToItinerary(oneWayOffers[0], {
  spec: oneWaySpec,
  provider: "serpapi",
});
assert.ok(itinerary, "one-way offer should map to an itinerary");
assert.equal(itinerary.origin, "STR");
assert.equal(itinerary.destination, "BCN");
assert.ok(itinerary.price.amountMinor > 0, "price should be positive minor units");
assert.equal(itinerary.price.currency, "EUR");
assert.ok(itinerary.segments.length >= 1, "should have segments");
assert.ok(
  itinerary.segments[0].departAt.startsWith("2026-11-15T"),
  "departure should be a local ISO timestamp",
);
assert.equal(itinerary.carrierCode.length, 2, "carrier code should be 2 letters");

/* --- price insights ----------------------------------------------- */
const insights = serpInsights(oneWay as unknown as Record<string, unknown>);
assert.equal(insights.priceLevel, "typical", "price level should map");
assert.deepEqual(
  insights.typicalPriceRangeMinor,
  [3500, 11500],
  "typical range should map to minor units",
);
const priced = mapOfferToItinerary(oneWayOffers[0], {
  spec: oneWaySpec,
  provider: "serpapi",
  ...insights,
});
assert.equal(priced?.priceLevel, "typical", "insights should attach to itineraries");

/* --- explore destinations ----------------------------------------- */
const explore = fixture<{ destinations?: SerpExploreDestination[] }>("google-travel-explore");
const deals = mapExploreDestinations(explore.destinations ?? [], {
  currency: "EUR",
  origin: "STR",
});
assert.ok(deals.length >= 3, "expected several destinations");
assert.ok(
  deals.every((deal) => deal.price.amountMinor > 0),
  "every deal should have a positive price",
);
assert.ok(
  deals.every((deal) => /^[A-Z]{3}$/.test(deal.destination)),
  "every deal should have an IATA code",
);
assert.ok(
  deals.every((deal) => deal.durationMinutes >= 0 && deal.stops >= 0),
  "duration and stops should be numeric",
);

/* --- round-trip return leg ---------------------------------------- */
const returnOffers = mergeOffers(
  fixture<FlightsResponse>("google-flights-roundtrip-return"),
);
assert.ok(returnOffers.length >= 1, "expected a return-leg offer");

console.log(
  `✓ mappers ok — ${oneWayOffers.length} one-way offers, ${deals.length} destinations, ` +
    `round-trip return price ${returnOffers[0].price}`,
);
