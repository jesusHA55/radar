import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { consumeMagicLink } from "@/lib/auth/magic-link";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { SESSION_COOKIE, createSession, sessionCookieOptions } from "@/lib/auth/session";

/**
 * Magic-link verification. Consumes the single-use token, opens a session, and
 * redirects to the originally requested path.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = safeRedirectPath(url.searchParams.get("next"), "/");

  const user = await consumeMagicLink(token);
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in?error=expired", request.url));
  }

  const session = await createSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));

  return NextResponse.redirect(new URL(next, request.url));
}
