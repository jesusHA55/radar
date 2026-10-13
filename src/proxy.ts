import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, getUserBySessionToken } from "@/lib/auth/session";

/**
 * Request proxy (Next.js 16's replacement for middleware).
 *
 * A single, central gate: every route requires a valid session except the
 * sign-in flow and the secret-protected cron endpoint. The session token is
 * validated against the database here, so nothing downstream has to worry about
 * unauthenticated users.
 */

const PUBLIC_PREFIXES = ["/sign-in", "/auth", "/api/cron"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await getUserBySessionToken(token);
  if (user) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  const next = `${pathname}${search}`;
  if (next && next !== "/") url.searchParams.set("next", next);

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
