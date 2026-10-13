import { getSessionUser, type SessionUser } from "./session";

/**
 * Current-user resolution.
 *
 * Every server component and action depends only on these two functions, so the
 * session implementation can change without touching feature code.
 */

export type CurrentUser = SessionUser;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getSessionUser();
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Not authenticated.");
  }
  return user;
}

export type { SessionUser } from "./session";
