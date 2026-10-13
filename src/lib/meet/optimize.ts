import { getAirport } from "@/lib/domain/airports";
import { addDays } from "@/lib/domain/date-utils";
import type { DateWindow } from "@/lib/domain/date-window";
import type { DestinationDeal } from "@/lib/flights/types";
import { getEverywhere, getOffers } from "@/lib/gateway/flights";
import type { MeetLeg, MeetParticipant, MeetRequest, MeetResult } from "./types";

/**
 * The Meet optimizer.
 *
 * "N people from N origins — where should we all go?"
 *
 *   1. Fan `everywhere` out over each origin (cached) to get the destinations
 *      each person could reach, with a sample price and dates.
 *   2. Intersect those destination sets to find places everyone can reach.
 *   3. Shortlist by the naive sum of each person's cheapest fare.
 *   4. For each shortlisted destination, align everyone onto a common trip:
 *      evaluate a handful of anchor departure dates (drawn from the origins'
 *      own cheapest dates) and price each participant for the same fixed
 *      `togetherNights`. The cheapest anchor wins, and — because everyone
 *      travels the same dates — the shared overlap window is exact.
 *
 * Call volume is bounded (`MAX_CANDIDATES × MAX_ANCHORS × participants`), and
 * every sub-search is cached through the gateway, so repeated planning is cheap.
 */

const MAX_CANDIDATES = 6;
const MAX_ANCHORS = 4;

function meetTtl(): number {
  const raw = Number(process.env.MEET_CACHE_TTL_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1800;
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

/** Candidate departure dates everyone could plausibly share. */
function anchorDates(
  destination: string,
  maps: Map<string, DestinationDeal>[],
  request: MeetRequest,
): string[] {
  const { window, togetherNights, tripType } = request;
  const fitsInWindow = (anchor: string): boolean => {
    if (anchor < window.departFrom) return false;
    if (tripType === "round-trip") {
      return addDays(anchor, togetherNights) <= window.departTo;
    }
    return anchor <= window.departTo;
  };

  const anchors = new Set<string>();
  if (fitsInWindow(window.departFrom)) anchors.add(window.departFrom);
  for (const map of maps) {
    const deal = map.get(destination);
    if (deal && fitsInWindow(deal.departDate)) anchors.add(deal.departDate);
  }

  return [...anchors].sort().slice(0, MAX_ANCHORS);
}

export async function optimizeMeet(request: MeetRequest): Promise<MeetResult[]> {
  if (request.participants.length < 2) return [];

  // 1. Reachable destinations per origin (cached fan-out).
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

  // 2. Intersect: only destinations everyone can reach.
  const [first, ...rest] = perOrigin;
  const common = [...first.keys()].filter((destination) =>
    rest.every((map) => map.has(destination)),
  );
  if (common.length === 0) return [];

  // 3. Shortlist by naive total cost.
  const naive = common
    .map((destination) => ({
      destination,
      total: perOrigin.reduce(
        (sum, map) => sum + (map.get(destination)?.price.amountMinor ?? 0),
        0,
      ),
    }))
    .sort((a, b) => a.total - b.total)
    .slice(0, MAX_CANDIDATES);

  // 4. Align each candidate onto a shared trip window.
  const results: MeetResult[] = [];
  for (const { destination } of naive) {
    const anchors = anchorDates(destination, perOrigin, request);

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
      if (!best || total < best.total) {
        best = { legs: priced, anchor, total };
      }
    }

    if (!best) continue;

    const airport = getAirport(destination);
    const nights = request.tripType === "round-trip" ? request.togetherNights : 0;

    results.push({
      destination,
      city: airport?.city ?? destination,
      country: airport?.country ?? "",
      total: { amountMinor: best.total, currency: request.currency },
      legs: best.legs,
      togetherFrom: best.anchor,
      togetherTo: addDays(best.anchor, nights),
      togetherNights: nights,
    });
  }

  return results
    .sort((a, b) => a.total.amountMinor - b.total.amountMinor)
    .slice(0, request.limit);
}
