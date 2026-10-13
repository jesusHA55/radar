import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { invites, loginTokens, users } from "@/db/schema";
import { sendMagicLinkEmail } from "@/lib/notifications";
import type { SessionUser } from "./session";
import { generateToken, hashToken } from "./tokens";

/**
 * Invite-only, passwordless sign-in.
 *
 * A magic link is emailed only to people who already have an account or hold an
 * invite. Tokens are single-use, short-lived, and stored hashed.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function rateLimitPerHour(): number {
  const raw = Number(process.env.MAGIC_LINK_MAX_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

export type MagicLinkResult = {
  ok: boolean;
  reason?: "not-invited" | "invalid-email" | "rate-limited";
  /** Present only in dev when email is not configured, for convenience. */
  devUrl?: string;
};

export async function requestMagicLink(
  emailRaw: string,
  origin: string,
  next?: string,
): Promise<MagicLinkResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, reason: "invalid-email" };
  }

  // Throttle: cap link requests per email to blunt abuse on a public URL.
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginTokens)
    .where(
      and(
        eq(loginTokens.email, email),
        gt(loginTokens.createdAt, new Date(Date.now() - RATE_LIMIT_WINDOW_MS)),
      ),
    );
  if ((recent?.count ?? 0) >= rateLimitPerHour()) {
    return { ok: false, reason: "rate-limited" };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!existingUser) {
    const [invite] = await db
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.email, email))
      .limit(1);

    if (!invite) return { ok: false, reason: "not-invited" };

    await db.insert(users).values({ email }).onConflictDoNothing();
    await db
      .update(invites)
      .set({ acceptedAt: sql`now()` })
      .where(eq(invites.id, invite.id));
  }

  const token = generateToken();
  await db.insert(loginTokens).values({
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const url = new URL("/auth/verify", origin);
  url.searchParams.set("token", token);
  if (next) url.searchParams.set("next", next);

  const delivery = await sendMagicLinkEmail({ to: email, url: url.toString() });

  return { ok: true, devUrl: delivery.channel === "dev-log" ? url.toString() : undefined };
}

export async function consumeMagicLink(token: string): Promise<SessionUser | null> {
  if (!token) return null;

  const [row] = await db
    .select({ id: loginTokens.id, email: loginTokens.email })
    .from(loginTokens)
    .where(
      and(eq(loginTokens.tokenHash, hashToken(token)), gt(loginTokens.expiresAt, new Date())),
    )
    .limit(1);

  if (!row) return null;

  // Single use: consume immediately.
  await db.delete(loginTokens).where(eq(loginTokens.id, row.id));

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, row.email))
    .limit(1);

  return user ?? null;
}
