import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque token helpers.
 *
 * Tokens are generated with 256 bits of entropy and only ever stored as a
 * SHA-256 hash, so a database leak does not expose usable sessions or
 * magic-link links.
 */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
