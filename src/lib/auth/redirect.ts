/**
 * Guards against open-redirect abuse: only same-origin, absolute *paths* are
 * allowed as post-login destinations.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
