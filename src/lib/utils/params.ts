/** Helpers for reading loose URL/form values out of `searchParams`. */

export type RawParams = Record<string, string | string[] | undefined>;

export function pickParam(
  params: RawParams,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function pickInt(
  params: RawParams,
  key: string,
  fallback: number,
  min = 1,
  max = 9,
): number {
  const raw = pickParam(params, key);
  const parsed = raw === undefined ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function pickEnum<T extends string>(
  params: RawParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = pickParam(params, key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
