import type { DateWindow } from "@/lib/domain/date-window";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Radar schema.
 *
 * Written for Postgres (an embedded cluster locally, a hosted Supabase/Neon
 * instance later — same DDL either way).
 */

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Invite-only access for the small private group. */
export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

/** Server-side sessions. The raw token lives only in an httpOnly cookie. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

/** Single-use, short-lived magic-link tokens (stored hashed, never raw). */
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_tokens_email_idx").on(table.email)],
);

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

export const airports = pgTable("airports", {
  iata: text("iata").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
});

/* ------------------------------------------------------------------ */
/* Feature 1 — Monitoring                                              */
/* ------------------------------------------------------------------ */

export const watches = pgTable(
  "watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    label: text("label"),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    tripType: text("trip_type").notNull().default("round-trip"),
    cabin: text("cabin").notNull().default("economy"),
    adults: integer("adults").notNull().default(1),
    currency: text("currency").notNull().default("EUR"),
    /** The flexible-dates window this watch evaluates against. */
    dateWindow: jsonb("date_window").$type<DateWindow>().notNull(),
    /** "target" | "drop-percent" | "any-low" */
    thresholdType: text("threshold_type").notNull().default("target"),
    /** Minor units for "target", percent for "drop-percent". */
    thresholdValue: integer("threshold_value"),
    cadenceMinutes: integer("cadence_minutes").notNull().default(720),
    isActive: boolean("is_active").notNull().default(true),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    lastPriceMinor: integer("last_price_minor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("watches_owner_idx").on(table.ownerId)],
);

/** Append-only price time series — powers sparklines and drop detection. */
export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchId: uuid("watch_id")
      .notNull()
      .references(() => watches.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull(),
    departDate: text("depart_date"),
    returnDate: text("return_date"),
    raw: jsonb("raw"),
  },
  (table) => [index("price_observations_watch_idx").on(table.watchId, table.observedAt)],
);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  watchId: uuid("watch_id")
    .notNull()
    .references(() => watches.id, { onDelete: "cascade" }),
  observationId: uuid("observation_id").references(() => priceObservations.id, {
    onDelete: "set null",
  }),
  /** "target" | "drop" | "all-time-low" */
  kind: text("kind").notNull(),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull(),
  channel: text("channel"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

/* ------------------------------------------------------------------ */
/* Provider gateway — cache + metering                                 */
/* ------------------------------------------------------------------ */

export const priceCache = pgTable("price_cache", {
  key: text("key").primaryKey(),
  provider: text("provider").notNull(),
  payload: jsonb("payload").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per upstream call. Drives quota limits and pay-as-you-go billing. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    endpoint: text("endpoint").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** Estimated cost in micro-USD (integer, avoids float drift). */
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    ok: boolean("ok").notNull().default(true),
  },
  (table) => [index("usage_events_provider_idx").on(table.provider, table.occurredAt)],
);

/* ------------------------------------------------------------------ */
/* Feature 3 — Meet                                                    */
/* ------------------------------------------------------------------ */

export const meetSessions = pgTable("meet_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id),
  label: text("label"),
  tripType: text("trip_type").notNull().default("round-trip"),
  cabin: text("cabin").notNull().default("economy"),
  currency: text("currency").notNull().default("EUR"),
  dateWindow: jsonb("date_window").$type<DateWindow>().notNull(),
  /** "pending" | "complete" | "error" */
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const meetParticipants = pgTable(
  "meet_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => meetSessions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    origin: text("origin").notNull(),
    adults: integer("adults").notNull().default(1),
  },
  (table) => [index("meet_participants_session_idx").on(table.sessionId)],
);

export const meetResults = pgTable(
  "meet_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => meetSessions.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    totalPriceMinor: integer("total_price_minor").notNull(),
    currency: text("currency").notNull(),
    /** Per-origin leg detail, keyed by participant id. */
    perParticipant: jsonb("per_participant").notNull(),
    rank: integer("rank").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("meet_results_session_idx").on(table.sessionId, table.rank)],
);

/* ------------------------------------------------------------------ */
/* Saved searches                                                      */
/* ------------------------------------------------------------------ */

/** A bookmarked Search / Explore / Meet query for one-tap recall. */
export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "search" | "explore" | "meet" */
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    /** Path + query string to replay the search. */
    href: text("href").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("saved_searches_owner_idx").on(table.ownerId, table.createdAt)],
);
