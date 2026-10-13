import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { invites, users } from "@/db/schema";

/**
 * The invite allowlist.
 *
 * An invite grants access to people who don't have an account yet; once they
 * sign in, their `users` row is what actually keeps them in (see
 * `src/lib/auth/magic-link.ts`). Deleting an invite therefore only removes a
 * *pending* invitation — it does not revoke an account that already exists.
 */

export type Invite = typeof invites.$inferSelect;

export type InviteWithStatus = Invite & {
  /** True once the invitee has a user account. */
  joined: boolean;
  /** Email of whoever added the invite, if known. */
  invitedByEmail: string | null;
};

export type CreateInviteResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export async function listInvites(): Promise<InviteWithStatus[]> {
  const rows = await db
    .select({ invite: invites, invitedByEmail: users.email })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .orderBy(desc(invites.createdAt));

  if (rows.length === 0) return [];

  const members = await db
    .select({ email: users.email })
    .from(users)
    .where(inArray(users.email, rows.map((row) => row.invite.email)));
  const joined = new Set(members.map((member) => member.email));

  return rows.map(({ invite, invitedByEmail }) => ({
    ...invite,
    joined: joined.has(invite.email),
    invitedByEmail,
  }));
}

export async function createInvite(
  emailRaw: string,
  invitedBy: string | null,
): Promise<CreateInviteResult> {
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const [existing] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(eq(invites.email, email))
    .limit(1);
  if (existing) {
    return { ok: false, error: "That email is already on the invite list." };
  }

  await db.insert(invites).values({ email, invitedBy });
  return { ok: true, email };
}

export async function deleteInvite(id: string): Promise<void> {
  await db.delete(invites).where(eq(invites.id, id));
}
