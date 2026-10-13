import { gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { usageEvents } from "@/db/schema";

/**
 * Provider usage metering.
 *
 * Every upstream call records a row. This is what makes "quota-aware" polling
 * and future pay-as-you-go billing real: the worker consults the monthly total
 * before it does anything.
 */

export const DEFAULT_MONTHLY_CALL_BUDGET = 10_000;

/** First instant of the current UTC month. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function callBudget(): number {
  const raw = Number(process.env.MONTHLY_CALL_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_CALL_BUDGET;
}

export async function recordUsage(input: {
  provider: string;
  endpoint: string;
  /** Estimated cost in micro-USD. */
  costMicros?: number;
  ok?: boolean;
}): Promise<void> {
  await db.insert(usageEvents).values({
    provider: input.provider,
    endpoint: input.endpoint,
    estimatedCostMicros: input.costMicros ?? 0,
    ok: input.ok ?? true,
  });
}

export type MonthUsage = { calls: number; costMicros: number };

export async function monthUsage(now: Date = new Date()): Promise<MonthUsage> {
  const rows = await db
    .select({
      calls: sql<number>`count(*)::int`,
      costMicros: sql<number>`coalesce(sum(${usageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.occurredAt, monthStart(now)));

  return { calls: rows[0]?.calls ?? 0, costMicros: rows[0]?.costMicros ?? 0 };
}

export type BudgetStatus = {
  ok: boolean;
  calls: number;
  budget: number;
  remaining: number;
};

export async function checkCallBudget(now: Date = new Date()): Promise<BudgetStatus> {
  const { calls } = await monthUsage(now);
  const budget = callBudget();
  return { ok: calls < budget, calls, budget, remaining: Math.max(0, budget - calls) };
}

export type ProviderUsage = {
  provider: string;
  calls: number;
  costMicros: number;
};

/** This month's call count and cost, grouped by provider. */
export async function usageByProvider(now: Date = new Date()): Promise<ProviderUsage[]> {
  return db
    .select({
      provider: usageEvents.provider,
      calls: sql<number>`count(*)::int`,
      costMicros: sql<number>`coalesce(sum(${usageEvents.estimatedCostMicros}), 0)::int`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.occurredAt, monthStart(now)))
    .groupBy(usageEvents.provider);
}
