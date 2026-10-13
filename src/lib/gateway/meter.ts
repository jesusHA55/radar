import { gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { usageEvents } from "@/db/schema";

/**
 * Provider usage metering, in **credits**.
 *
 * One credit = one upstream HTTP request. The mock provider costs 0 (it is
 * offline and free); SerpApi charges 1 credit per request, and a round-trip
 * search needs a follow-up request, so it costs 2. The budget therefore gates
 * on credits, not on logical calls.
 */

export const DEFAULT_MONTHLY_CREDIT_BUDGET = 250;

/** First instant of the current UTC month. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function creditBudget(): number {
  const raw = Number(process.env.MONTHLY_CALL_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_CREDIT_BUDGET;
}

export async function recordUsage(input: {
  provider: string;
  endpoint: string;
  credits?: number;
  /** Estimated cost in micro-USD. */
  costMicros?: number;
  ok?: boolean;
}): Promise<void> {
  await db.insert(usageEvents).values({
    provider: input.provider,
    endpoint: input.endpoint,
    credits: input.credits ?? 0,
    estimatedCostMicros: input.costMicros ?? 0,
    ok: input.ok ?? true,
  });
}

export type MonthUsage = { calls: number; credits: number; costMicros: number };

export async function monthUsage(now: Date = new Date()): Promise<MonthUsage> {
  const rows = await db
    .select({
      calls: sql<number>`count(*)::int`,
      credits: sql<number>`coalesce(sum(${usageEvents.credits}), 0)::int`,
      costMicros: sql<number>`coalesce(sum(${usageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.occurredAt, monthStart(now)));

  return {
    calls: rows[0]?.calls ?? 0,
    credits: rows[0]?.credits ?? 0,
    costMicros: rows[0]?.costMicros ?? 0,
  };
}

export type BudgetStatus = {
  ok: boolean;
  credits: number;
  budget: number;
  remaining: number;
};

export async function checkCallBudget(now: Date = new Date()): Promise<BudgetStatus> {
  const { credits } = await monthUsage(now);
  const budget = creditBudget();
  return { ok: credits < budget, credits, budget, remaining: Math.max(0, budget - credits) };
}

export type ProviderUsage = {
  provider: string;
  calls: number;
  credits: number;
  costMicros: number;
};

/** This month's call count, credits and cost, grouped by provider. */
export async function usageByProvider(now: Date = new Date()): Promise<ProviderUsage[]> {
  return db
    .select({
      provider: usageEvents.provider,
      calls: sql<number>`count(*)::int`,
      credits: sql<number>`coalesce(sum(${usageEvents.credits}), 0)::int`,
      costMicros: sql<number>`coalesce(sum(${usageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.occurredAt, monthStart(now)))
    .groupBy(usageEvents.provider);
}
