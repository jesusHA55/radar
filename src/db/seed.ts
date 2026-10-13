import { eq } from "drizzle-orm";

import { closeDatabase, db } from "@/db/client";
import { airports, invites, priceObservations, users, watches } from "@/db/schema";
import { AIRPORTS } from "@/lib/domain/airports";
import { defaultDateWindow, toISODate } from "@/lib/domain/date-window";
import { computeQuote, marketMultiplier } from "@/lib/monitor/engine";
import { loadLocalEnv } from "@/lib/utils/load-env";

loadLocalEnv();

/**
 * Seeds reference airports, the local user, and a couple of sample watches with
 * backfilled price history so the Monitor UI is meaningful immediately.
 *
 * Run with: npm run db:seed  (or npm run db:setup)
 */

const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL ?? "you@radar.local";
const BACKFILL_DAYS = 14;
const MS_PER_DAY = 86_400_000;

const SAMPLE_WATCHES = [
  {
    label: "Weekend in Barcelona",
    origin: "STR",
    destination: "BCN",
    tripType: "round-trip",
    cabin: "economy",
    adults: 1,
    thresholdType: "any-low",
    thresholdValue: null,
    cadenceMinutes: 720,
  },
  {
    label: "Lisbon with a friend",
    origin: "MUC",
    destination: "LIS",
    tripType: "round-trip",
    cabin: "economy",
    adults: 2,
    thresholdType: "drop-percent",
    thresholdValue: 12,
    cadenceMinutes: 1440,
  },
] as const;

async function main() {
  for (const airport of AIRPORTS) {
    await db.insert(airports).values(airport).onConflictDoNothing();
  }
  console.log(`✓ Airports: ${AIRPORTS.length}`);

  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, LOCAL_USER_EMAIL))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email: LOCAL_USER_EMAIL, name: "Local User" })
      .returning();
    console.log(`✓ Created user ${user.email}`);
  } else {
    console.log(`✓ User ${user.email} already exists`);
  }

  await db
    .insert(invites)
    .values({ email: LOCAL_USER_EMAIL, invitedBy: user.id })
    .onConflictDoNothing();
  const friendEmail = process.env.SEED_FRIEND_EMAIL;
  if (friendEmail) {
    await db
      .insert(invites)
      .values({ email: friendEmail.toLowerCase(), invitedBy: user.id })
      .onConflictDoNothing();
  }
  console.log(`✓ Invite ready for ${LOCAL_USER_EMAIL}${friendEmail ? ` and ${friendEmail}` : ""}`);

  const existing = await db.select().from(watches).where(eq(watches.ownerId, user.id));
  if (existing.length > 0) {
    console.log(`✓ ${existing.length} watch(es) already present — skipping samples.`);
    return;
  }

  const dateWindow = defaultDateWindow();
  const now = new Date();

  for (const sample of SAMPLE_WATCHES) {
    const [watch] = await db
      .insert(watches)
      .values({
        ownerId: user.id,
        label: sample.label,
        origin: sample.origin,
        destination: sample.destination,
        tripType: sample.tripType,
        cabin: sample.cabin,
        adults: sample.adults,
        currency: "EUR",
        dateWindow,
        thresholdType: sample.thresholdType,
        thresholdValue: sample.thresholdValue,
        cadenceMinutes: sample.cadenceMinutes,
      })
      .returning();

    const base = await computeQuote(watch);
    if (base) {
      for (let daysAgo = BACKFILL_DAYS; daysAgo >= 1; daysAgo--) {
        const observedAt = new Date(now.getTime() - daysAgo * MS_PER_DAY);
        const priceMinor = Math.max(
          1,
          Math.round(base.priceMinor * marketMultiplier(watch.id, toISODate(observedAt))),
        );
        await db.insert(priceObservations).values({
          watchId: watch.id,
          provider: "mock",
          observedAt,
          priceMinor,
          currency: base.currency,
          departDate: base.departDate,
          returnDate: base.returnDate ?? null,
        });
      }
      await db
        .update(watches)
        .set({ lastCheckedAt: new Date(now.getTime() - MS_PER_DAY), lastPriceMinor: base.priceMinor })
        .where(eq(watches.id, watch.id));
    }

    console.log(
      `✓ Watch ${sample.origin} → ${sample.destination} (+${BACKFILL_DAYS}d history)`,
    );
  }

  console.log("✓ Seed complete");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
