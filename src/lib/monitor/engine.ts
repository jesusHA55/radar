import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { alerts, priceObservations, users, watches } from "@/db/schema";
import { getAirport } from "@/lib/domain/airports";
import { toISODate } from "@/lib/domain/date-utils";
import type { CabinClass, TripType } from "@/lib/domain/trip";
import { getFlightProvider } from "@/lib/flights";
import type { SearchSpec } from "@/lib/flights/types";
import { getOffers } from "@/lib/gateway/flights";
import { checkCallBudget, type BudgetStatus } from "@/lib/gateway/meter";
import { dispatchAlert, type AlertKind, type AlertPayload } from "@/lib/notifications";
import { hashRange } from "@/lib/utils/hash";
import type { Watch } from "./queries";

/**
 * The monitoring engine: quote a watch, persist the observation, decide whether
 * a threshold was crossed, and dispatch an alert.
 *
 * The same `quoteWatchPrice` is reused by the seeder to backfill believable
 * price history, so the sparkline is meaningful from the first run.
 */

export type Quote = {
  priceMinor: number;
  currency: string;
  departDate: string;
  returnDate?: string;
};

function searchSpec(watch: Watch): SearchSpec {
  return {
    origin: watch.origin,
    destination: watch.destination,
    tripType: watch.tripType as TripType,
    window: watch.dateWindow,
    cabin: watch.cabin as CabinClass,
    adults: watch.adults,
    currency: watch.currency,
  };
}

/**
 * Deterministic day-to-day market movement in [0.95, 1.07). Simulates the
 * constant churn of real fares so history *moves* and drop detection has
 * something to detect.
 */
export function marketMultiplier(watchId: string, asOfISO: string): number {
  return hashRange(`${watchId}:${asOfISO}`, 0.95, 1.07);
}

/** The provider's cheapest fare for a watch, before market movement. */
export async function computeQuote(watch: Watch): Promise<Quote | null> {
  // Monitoring always wants fresh data, so caching is disabled.
  const { data: offers } = await getOffers(searchSpec(watch), { ttlSeconds: 0 });
  if (offers.length === 0) return null;

  const best = offers.reduce((a, b) =>
    a.price.amountMinor <= b.price.amountMinor ? a : b,
  );
  return {
    priceMinor: best.price.amountMinor,
    currency: best.price.currency,
    departDate: best.departDate,
    returnDate: best.returnDate,
  };
}

export async function quoteWatchPrice(watch: Watch, asOf: Date = new Date()): Promise<Quote | null> {
  const base = await computeQuote(watch);
  if (!base) return null;
  const multiplier = marketMultiplier(watch.id, toISODate(asOf));
  return { ...base, priceMinor: Math.max(1, Math.round(base.priceMinor * multiplier)) };
}

/* ------------------------------------------------------------------ */
/* Threshold evaluation                                                */
/* ------------------------------------------------------------------ */

export type Evaluation = {
  triggered: boolean;
  kind: AlertKind;
  previousLowMinor?: number;
  reason: string;
};

export function evaluateThreshold(
  watch: Watch,
  priceMinor: number,
  previousPrices: number[],
): Evaluation {
  const previousLowMinor =
    previousPrices.length > 0 ? Math.min(...previousPrices) : undefined;

  if (watch.thresholdType === "target" && watch.thresholdValue != null) {
    const hit = priceMinor <= watch.thresholdValue;
    return {
      triggered: hit,
      kind: "target",
      previousLowMinor,
      reason: hit ? "at or below target" : "above target",
    };
  }

  if (watch.thresholdType === "drop-percent") {
    const percent = watch.thresholdValue ?? 10;
    if (previousLowMinor === undefined) {
      return { triggered: false, kind: "drop", reason: "no history yet" };
    }
    const cutoff = Math.round(previousLowMinor * (1 - percent / 100));
    const hit = priceMinor <= cutoff;
    return {
      triggered: hit,
      kind: "drop",
      previousLowMinor,
      reason: hit ? `≥${percent}% below previous low` : "not enough of a drop",
    };
  }

  // "any-low"
  if (previousLowMinor === undefined) {
    return { triggered: false, kind: "all-time-low", reason: "no history yet" };
  }
  const hit = priceMinor < previousLowMinor;
  return {
    triggered: hit,
    kind: "all-time-low",
    previousLowMinor,
    reason: hit ? "new lowest price" : "not a new low",
  };
}

export function alertCooldownMinutes(): number {
  const raw = Number(process.env.ALERT_COOLDOWN_MINUTES);
  return Number.isFinite(raw) && raw >= 0 ? raw : 720;
}

export function cooldownActive(watch: Watch, now: Date): boolean {
  if (!watch.lastNotifiedAt) return false;
  return now.getTime() - watch.lastNotifiedAt.getTime() < alertCooldownMinutes() * 60_000;
}

/* ------------------------------------------------------------------ */
/* Checking a single watch                                             */
/* ------------------------------------------------------------------ */

export type CheckStatus =
  | "checked"
  | "alerted"
  | "no-offer"
  | "cooldown"
  | "paused"
  | "error";

export type CheckResult = {
  watchId: string;
  status: CheckStatus;
  priceMinor?: number;
  kind?: AlertKind;
  channel?: string;
  error?: string;
};

export async function checkWatch(
  watchId: string,
  opts: { now?: Date; reason?: "schedule" | "manual" } = {},
): Promise<CheckResult> {
  const now = opts.now ?? new Date();
  const manual = opts.reason === "manual";

  const [watch] = await db.select().from(watches).where(eq(watches.id, watchId)).limit(1);
  if (!watch) return { watchId, status: "error", error: "watch not found" };
  if (!watch.isActive && !manual) return { watchId, status: "paused" };

  const provider = await getFlightProvider();
  const quote = await quoteWatchPrice(watch, now);

  if (!quote) {
    await db
      .update(watches)
      .set({ lastCheckedAt: now, updatedAt: now })
      .where(eq(watches.id, watch.id));
    return { watchId, status: "no-offer" };
  }

  const historyRows = await db
    .select({ priceMinor: priceObservations.priceMinor })
    .from(priceObservations)
    .where(eq(priceObservations.watchId, watch.id))
    .orderBy(desc(priceObservations.observedAt))
    .limit(30);
  const previousPrices = historyRows.map((row) => row.priceMinor);

  const [observation] = await db
    .insert(priceObservations)
    .values({
      watchId: watch.id,
      provider: provider.id,
      observedAt: now,
      priceMinor: quote.priceMinor,
      currency: quote.currency,
      departDate: quote.departDate,
      returnDate: quote.returnDate ?? null,
    })
    .returning();

  await db
    .update(watches)
    .set({ lastCheckedAt: now, lastPriceMinor: quote.priceMinor, updatedAt: now })
    .where(eq(watches.id, watch.id));

  const evaluation = evaluateThreshold(watch, quote.priceMinor, previousPrices);
  if (!evaluation.triggered) {
    return { watchId, status: "checked", priceMinor: quote.priceMinor };
  }

  if (!manual && cooldownActive(watch, now)) {
    return {
      watchId,
      status: "cooldown",
      priceMinor: quote.priceMinor,
      kind: evaluation.kind,
    };
  }

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, watch.ownerId))
    .limit(1);

  const origin = getAirport(watch.origin);
  const destination = getAirport(watch.destination);
  const payload: AlertPayload = {
    toEmail: owner?.email ?? "unknown",
    watchId: watch.id,
    watchLabel: watch.label ?? `${watch.origin} → ${watch.destination}`,
    origin: watch.origin,
    destination: watch.destination,
    originLabel: origin?.city ?? watch.origin,
    destinationLabel: destination?.city ?? watch.destination,
    kind: evaluation.kind,
    priceMinor: quote.priceMinor,
    previousLowMinor: evaluation.previousLowMinor,
    currency: quote.currency,
    departDate: quote.departDate,
    returnDate: quote.returnDate,
    tripType: watch.tripType,
    cabin: watch.cabin,
    adults: watch.adults,
  };

  const result = await dispatchAlert(payload);

  await db.insert(alerts).values({
    watchId: watch.id,
    observationId: observation.id,
    kind: evaluation.kind,
    priceMinor: quote.priceMinor,
    currency: quote.currency,
    channel: result.channel,
    deliveredAt: result.ok ? now : null,
  });

  if (result.ok) {
    await db
      .update(watches)
      .set({ lastNotifiedAt: now })
      .where(eq(watches.id, watch.id));
  }

  return {
    watchId,
    status: "alerted",
    priceMinor: quote.priceMinor,
    kind: evaluation.kind,
    channel: result.channel,
  };
}

/* ------------------------------------------------------------------ */
/* Running the due set (the worker)                                    */
/* ------------------------------------------------------------------ */

export type PollSummary = {
  checked: number;
  alerted: number;
  cooldown: number;
  errors: number;
  budget: BudgetStatus;
  results: CheckResult[];
};

export async function runDueWatches(
  opts: { now?: Date; limit?: number; force?: boolean } = {},
): Promise<PollSummary> {
  const now = opts.now ?? new Date();
  const budget = await checkCallBudget(now);
  const results: CheckResult[] = [];

  if (!budget.ok && !opts.force) {
    return { checked: 0, alerted: 0, cooldown: 0, errors: 0, budget, results };
  }

  const active = await db.select().from(watches).where(eq(watches.isActive, true));

  const due = active
    .filter(
      (watch) =>
        opts.force ||
        !watch.lastCheckedAt ||
        now.getTime() - watch.lastCheckedAt.getTime() >= watch.cadenceMinutes * 60_000,
    )
    .sort(
      (a, b) => (a.lastCheckedAt?.getTime() ?? 0) - (b.lastCheckedAt?.getTime() ?? 0),
    )
    .slice(0, opts.limit ?? 50);

  for (const watch of due) {
    try {
      results.push(await checkWatch(watch.id, { now, reason: "schedule" }));
    } catch (error) {
      results.push({ watchId: watch.id, status: "error", error: String(error) });
    }
  }

  return {
    checked: due.length,
    alerted: results.filter((r) => r.status === "alerted").length,
    cooldown: results.filter((r) => r.status === "cooldown").length,
    errors: results.filter((r) => r.status === "error").length,
    budget,
    results,
  };
}
