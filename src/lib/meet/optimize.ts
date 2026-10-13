import { getAirport } from "@/lib/domain/airports";
import { addDays, nightsBetween } from "@/lib/domain/date-utils";
import type { DateWindow } from "@/lib/domain/date-window";
import { getFlightProvider } from "@/lib/flights";
import type { DestinationDeal } from "@/lib/flights/types";
import { getEverywhere, getOffers } from "@/lib/gateway/flights";
import { checkCallBudget } from "@/lib/gateway/meter";
import type { MeetLeg, MeetParticipant, MeetRequest, MeetResult } from "./types";

/**
 * The Meet optimizer — credit-bounded.
 *
 * "N people from N origins — where should we all go?"
 *
 *   1. Fan `everywhere` out over each origin (N credits, cached).
 *   2. Intersect those destination sets.
 *   3. Shortlist by the naive sum of each person's cheapest fare.
 *   4. For the shortlist, align everyone onto a shared trip: evaluate a small
 *      number of anchor dates (derived from the origins' own cheapest dates) and
 *      price each traveller for the same `togetherNights`.
 *
 * Cost is bounded to `N + candidates × anchors × N × (round-trip ? 2 : 1)`
 * credits. If the remaining monthly budget can't cover the aligned re-pricing,
 * Meet degrades to a **sample** result built from the cached `everywhere` data,
 * costing nothing extra.
 */

const MAX_CANDIDATES = 3;

function meetTtl(): number {
  const raw = Number(process.env.MEET_CACHE_TTL_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1800;
}

function maxAnchors(): number {
  const raw = Number(process.env.MEET_ANCHORS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(3, raw) : 1;
}

function pairWindow(anchor: string, request: MeetRequest): DateWindow {
  if (request.tripType === "round-trip") {
    return {
      departFrom: anchor,
      departTo: anchor,
      minNights: request.togetherNights,
      maxNights: request.togetherNights,
    };
  }
  return { departFrom: anchor, departTo: anchor };
}

async function priceLeg(
  participant: MeetParticipant,
  destination: string,
  anchor: string,
  request: MeetRequest,
): Promise<MeetLeg | null> {
  const { data: offers } = await getOffers(
    {
      origin: participant.origin,
      destination,
      tripType: request.tripType,
      window: pairWindow(anchor, request),
      cabin: request.cabin,
      adults: request.adults,
      currency: request.currency,
    },
    { ttlSeconds: meetTtl() },
  );

  if (offers.length === 0) return null;
  const cheapest = offers.reduce((a, b) =>
    a.price.amountMinor <= b.price.amountMinor ? a : b,
  );

  return {
    label: participant.label,
    origin: participant.origin,
    price: cheapest.price,
    departDate: cheapest.departDate,
    returnDate: cheapest.returnDate,
    carrierCode: cheapest.carrierCode,
    carrierName: cheapest.carrierName,
    stops: cheapest.stops,
    durationMinutes: cheapest.durationMinutes,
  };
}

function anchorDates(
  destination: string,
  maps: Map<string, DestinationDeal>[],
  request: MeetRequest,
): string[] {
  const { window, togetherNights, tripType } = request;
  const fits = (anchor: string): boolean => {
    if (anchor < window.departFrom) return false;
    return tripType === "round-trip"
      ? addDays(anchor, togetherNights) <= window.departTo
      : anchor <= window.departTo;
  };

  const set = new Set<string>();
  for (const map of maps) {
    const deal = map.get(destination);
    if (deal?.departDate && fits(deal.departDate)) set.add(deal.departDate);
  }
  if (set.size === 0 && fits(window.departFrom)) set.add(window.departFrom);

  const sorted = [...set].sort();
  const target = maxAnchors();
  if (sorted.length <= target) return sorted;
  if (target === 1) return [sorted[Math.floor(sorted.length / 2)]];

  const step = (sorted.length - 1) / (target - 1);
  return [...new Set(Array.from({ length: target }, (_, i) => sorted[Math.round(i * step)]))];
}

function assemble(
  destination: string,
  legs: MeetLeg[],
  togetherFrom: string,
  request: MeetRequest,
  approximate: boolean,
): MeetResult {
  const airport = getAirport(destination);
  const nights = request.tripType === "round-trip" ? request.togetherNights : 0;
  return {
    destination,
    city: airport?.city ?? destination,
    country: airport?.country ?? "",
    total: {
      amountMinor: legs.reduce((sum, leg) => sum + leg.price.amountMinor, 0),
      currency: request.currency,
    },
    legs,
    togetherFrom,
    togetherTo: addDays(togetherFrom, nights),
    togetherNights: nights,
    approximate,
  };
}

/** Sample result — from cached `everywhere` data, no extra credits. */
function sampleResult(
  destination: string,
  maps: Map<string, DestinationDeal>[],
  request: MeetRequest,
): MeetResult | null {
  const legs: MeetLeg[] = [];
  for (let i = 0; i < request.participants.length; i++) {
    const deal = maps[i].get(destination);
    if (!deal) return null;
    legs.push({
      label: request.participants[i].label,
      origin: request.participants[i].origin,
      price: deal.price,
      departDate: deal.departDate,
      returnDate: deal.returnDate,
      carrierCode: "—",
      carrierName: "Sample dates",
      stops: deal.stops,
      durationMinutes: deal.durationMinutes,
    });
  }

  const departures = legs.map((leg) => leg.departDate).filter(Boolean).sort();
  const returns = legs
    .map((leg) => leg.returnDate)
    .filter((value): value is string => Boolean(value))
    .sort();

  const from = departures.at(-1) ?? request.window.departFrom;
  const to = returns[0] ?? from;
  const nights =
    request.tripType === "round-trip"
      ? Math.max(0, nightsBetween(from, to))
      : 0;

  return assemble(destination, legs, from, request, true);
}

/** Precise result — aligned re-pricing of each traveller. */
async function preciseResult(
  destination: string,
  maps: Map<string, DestinationDeal>[],
  request: MeetRequest,
): Promise<MeetResult | null> {
  const anchors = anchorDates(destination, maps, request);
  let best: { legs: MeetLeg[]; anchor: string; total: number } | null = null;

  for (const anchor of anchors) {
    const legs = await Promise.all(
      request.participants.map((participant) =>
        priceLeg(participant, destination, anchor, request),
      ),
    );
    if (legs.some((leg) => leg === null)) continue;

    const priced = legs as MeetLeg[];
    const total = priced.reduce((sum, leg) => sum + leg.price.amountMinor, 0);
    if (!best || total < best.total) best = { legs: priced, anchor, total };
  }

  if (!best) return null;
  return assemble(destination, best.legs, best.anchor, request, false);
}

export async function optimizeMeet(
  request: MeetRequest,
  options: { maxCredits?: number } = {},
): Promise<MeetResult[]> {
  if (request.participants.length < 2) return [];

  const count = request.participants.length;
  const perLeg = request.tripType === "round-trip" ? 2 : 1;

  // 1. Reachable destinations per origin (N credits, cached).
  const perOrigin = await Promise.all(
    request.participants.map(async (participant) => {
      const { data } = await getEverywhere(
        {
          origin: participant.origin,
          tripType: request.tripType,
          window: request.window,
          cabin: request.cabin,
          adults: request.adults,
          currency: request.currency,
          limit: 100,
        },
        { ttlSeconds: meetTtl() },
      );
      return new Map(data.map((deal) => [deal.destination, deal]));
    }),
  );

  // 2. Intersect.
  const [first, ...rest] = perOrigin;
  const common = [...first.keys()].filter((destination) =>
    rest.every((map) => map.has(destination)),
  );
  if (common.length === 0) return [];

  // 3. Shortlist by naive total.
  const shortlist = common
    .map((destination) => ({
      destination,
      total: perOrigin.reduce(
        (sum, map) => sum + (map.get(destination)?.price.amountMinor ?? Number.MAX_SAFE_INTEGER),
        0,
      ),
    }))
    .sort((a, b) => a.total - b.total)
    .slice(0, MAX_CANDIDATES);

  // Can we afford the aligned re-pricing?
  const provider = await getFlightProvider();
  const perDestinationCost = maxAnchors() * count * perLeg;
  let affordable = true;
  if (provider.id !== "mock") {
    const remaining = options.maxCredits ?? (await checkCallBudget()).remaining;
    affordable = remaining >= shortlist.length * perDestinationCost;
  }

  const results: MeetResult[] = [];
  for (const { destination } of shortlist) {
    const result = affordable
      ? await preciseResult(destination, perOrigin, request)
      : sampleResult(destination, perOrigin, request);
    if (result) results.push(result);
  }

  return results
    .sort((a, b) => a.total.amountMinor - b.total.amountMinor)
    .slice(0, request.limit);
}
