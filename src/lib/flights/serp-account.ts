/**
 * SerpApi account/usage lookup.
 *
 * SerpApi exposes remaining quota via `GET /account`, which does *not* count
 * against your searches. We cache the result briefly so rendering `/settings`
 * doesn't hit the network every time.
 */

export type SerpAccount = {
  email: string | null;
  plan: string;
  searchesPerMonth: number;
  searchesLeft: number;
  monthUsage: number;
  renewalDate: string | null;
  rateLimitPerHour: number | null;
};

const CACHE_TTL_MS = 60_000;
let cache: { at: number; value: SerpAccount | null } | null = null;

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getSerpAccount(): Promise<SerpAccount | null> {
  const key = process.env.SERPAPI_API_KEY?.trim();
  if (!key) return null;

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  try {
    const response = await fetch(
      `https://serpapi.com/account?api_key=${encodeURIComponent(key)}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const json = (await response.json()) as Record<string, unknown>;
    if (typeof json.error === "string") throw new Error(json.error);

    const value: SerpAccount = {
      email: typeof json.account_email === "string" ? json.account_email : null,
      plan: typeof json.plan_name === "string" ? json.plan_name : "—",
      searchesPerMonth: num(json.searches_per_month),
      searchesLeft: num(json.plan_searches_left),
      monthUsage: num(json.this_month_usage),
      renewalDate:
        typeof json.plan_renewal_date === "string" ? json.plan_renewal_date : null,
      rateLimitPerHour:
        json.account_rate_limit_per_hour === undefined
          ? null
          : num(json.account_rate_limit_per_hour),
    };

    cache = { at: Date.now(), value };
    return value;
  } catch {
    cache = { at: Date.now(), value: null };
    return null;
  }
}
