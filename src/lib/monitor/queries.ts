import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { alerts, priceObservations, watches } from "@/db/schema";
import type { DateWindow } from "@/lib/domain/date-window";
import type { CabinClass, TripType } from "@/lib/domain/trip";
import type { ThresholdType } from "./types";

export type Watch = typeof watches.$inferSelect;
export type PriceObservation = typeof priceObservations.$inferSelect;
export type WatchAlert = typeof alerts.$inferSelect;

export type NewWatchInput = {
  ownerId: string;
  label: string | null;
  origin: string;
  destination: string;
  tripType: TripType;
  cabin: CabinClass;
  adults: number;
  currency: string;
  dateWindow: DateWindow;
  thresholdType: ThresholdType;
  thresholdValue: number | null;
  cadenceMinutes: number;
  dateSamples: number;
};

export type WatchWithHistory = {
  watch: Watch;
  /** Observations in ascending time order (most recent last). */
  observations: PriceObservation[];
};

export async function listWatchesWithHistory(
  ownerId: string,
  perWatch = 40,
): Promise<WatchWithHistory[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.ownerId, ownerId))
    .orderBy(desc(watches.createdAt));

  if (rows.length === 0) return [];

  const observations = await db
    .select()
    .from(priceObservations)
    .where(
      inArray(
        priceObservations.watchId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(priceObservations.observedAt));

  const byWatch = new Map<string, PriceObservation[]>();
  for (const observation of observations) {
    const list = byWatch.get(observation.watchId);
    if (list) list.push(observation);
    else byWatch.set(observation.watchId, [observation]);
  }

  return rows.map((watch) => ({
    watch,
    observations: (byWatch.get(watch.id) ?? []).slice(-perWatch),
  }));
}

export async function getWatch(watchId: string): Promise<Watch | null> {
  const [row] = await db.select().from(watches).where(eq(watches.id, watchId)).limit(1);
  return row ?? null;
}

export async function getObservations(
  watchId: string,
  limit = 90,
): Promise<PriceObservation[]> {
  const rows = await db
    .select()
    .from(priceObservations)
    .where(eq(priceObservations.watchId, watchId))
    .orderBy(desc(priceObservations.observedAt))
    .limit(limit);
  return rows.reverse();
}

export async function getWatchAlerts(watchId: string, limit = 20): Promise<WatchAlert[]> {
  return db
    .select()
    .from(alerts)
    .where(eq(alerts.watchId, watchId))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}

export async function createWatch(input: NewWatchInput): Promise<Watch> {
  const [row] = await db.insert(watches).values(input).returning();
  return row;
}

export async function setWatchActive(watchId: string, isActive: boolean): Promise<void> {
  await db
    .update(watches)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(watches.id, watchId));
}

export async function deleteWatch(watchId: string): Promise<void> {
  await db.delete(watches).where(eq(watches.id, watchId));
}

export async function listActiveWatches(): Promise<Watch[]> {
  return db.select().from(watches).where(eq(watches.isActive, true));
}
