import { lt, sql } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";

import { setProviderAction } from "@/app/settings/actions";
import { TestEmailButton } from "@/components/test-email-button";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/db/client";
import {
  alerts,
  priceCache,
  priceObservations,
  savedSearches,
  sessions,
  users,
  watches,
} from "@/db/schema";
import { resolveFlightProviderId } from "@/lib/flights";
import { creditBudget, monthUsage, usageByProvider } from "@/lib/gateway/meter";
import { tunnelUrl } from "@/lib/host/tunnel";
import { activeTransport, emailFrom } from "@/lib/notifications";

export const metadata = { title: "Settings — Radar" };

const PROVIDERS = [
  {
    id: "mock",
    label: "Mock — offline demo data",
    detail: "Deterministic, no network, costs 0 credits.",
  },
  {
    id: "serpapi",
    label: "SerpApi — Google Flights",
    detail: "Live data. 1 credit per request, 2 per round-trip search.",
  },
] as const;

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your account, the active flight-data provider, and how much of the quota
        you have used.
      </p>
      <Suspense
        fallback={
          <div className="mt-8 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        }
      >
        <SettingsContent />
      </Suspense>
    </main>
  );
}

async function SettingsContent() {
  await connection();
  const user = await requireCurrentUser();

  const [providerId, usage, budget, byProvider] = await Promise.all([
    resolveFlightProviderId(),
    monthUsage(),
    Promise.resolve(creditBudget()),
    usageByProvider(),
  ]);

  const counts = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(watches),
    db.select({ n: sql<number>`count(*)::int` }).from(priceObservations),
    db.select({ n: sql<number>`count(*)::int` }).from(alerts),
    db.select({ n: sql<number>`count(*)::int` }).from(savedSearches),
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(sessions),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(priceCache)
      .where(sql`${priceCache.expiresAt} > now()`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(priceCache)
      .where(lt(priceCache.expiresAt, new Date())),
  ]).then((rows) => rows.map((r) => r[0]?.n ?? 0));

  const [watchCount, observationCount, alertCount, savedCount, userCount, sessionCount, cacheActive, cacheExpired] =
    counts;

  const pct = budget > 0 ? Math.min(100, (usage.credits / budget) * 100) : 0;
  const serpConfigured = Boolean(process.env.SERPAPI_API_KEY?.trim());

  const transport = activeTransport();
  const transportLabel =
    transport === "gmail"
      ? "Gmail (SMTP)"
      : transport === "resend"
        ? "Resend"
        : "Console (development)";
  const publicUrl = tunnelUrl();

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Account</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as{" "}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.email}</span>
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Email &amp; hosting
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Email transport</dt>
            <dd className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{transportLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">From address</dt>
            <dd className="mt-1 break-all font-medium text-zinc-900 dark:text-zinc-100">
              {emailFrom()}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Public URL (tunnel)</dt>
            <dd className="mt-1 break-all font-medium text-zinc-900 dark:text-zinc-100">
              {publicUrl ?? "not available (running locally)"}
            </dd>
          </div>
        </dl>

        {transport === "console" && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No email configured. Magic links are logged to the console and shown
            for manual sharing. Set <code>SMTP_USER</code> + <code>SMTP_PASS</code>{" "}
            (Gmail) or <code>RESEND_API_KEY</code> to send real email.
          </p>
        )}

        <div className="mt-4">
          <TestEmailButton email={user.email} />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Flight data provider
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Switch between deterministic demo data and live SerpApi (Google Flights)
          results. Applies immediately — no restart.
        </p>
        <form action={setProviderAction} className="mt-4 space-y-3">
          {PROVIDERS.map((provider) => (
            <label
              key={provider.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 has-[:checked]:border-zinc-900 dark:border-zinc-800 dark:has-[:checked]:border-zinc-400"
            >
              <input
                type="radio"
                name="provider"
                value={provider.id}
                defaultChecked={providerId === provider.id}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {provider.label}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {provider.detail}
                </span>
              </span>
            </label>
          ))}

          {!serpConfigured && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <code>SERPAPI_API_KEY</code> is not set — selecting SerpApi will fail
              until you add it to <code>.env.local</code>.
            </p>
          )}

          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Save provider
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Provider credits this month
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {usage.credits.toLocaleString()} / {budget.toLocaleString()} credits
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {Math.max(0, budget - usage.credits).toLocaleString()} credits remaining ·
          ${(usage.costMicros / 1_000_000).toFixed(2)} estimated cost
        </p>

        {byProvider.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 text-right font-medium">Requests</th>
                <th className="py-1 text-right font-medium">Credits</th>
                <th className="py-1 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.map((row) => (
                <tr key={row.provider} className="border-t border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{row.provider}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {row.calls.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {row.credits.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                    ${(row.costMicros / 1_000_000).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Watches" value={watchCount} />
        <Stat label="Price observations" value={observationCount} />
        <Stat label="Alerts sent" value={alertCount} />
        <Stat label="Saved searches" value={savedCount} />
        <Stat label="Cache entries (active)" value={cacheActive} />
        <Stat label="Cache entries (expired)" value={cacheExpired} />
        <Stat label="Users" value={userCount} />
        <Stat label="Active sessions" value={sessionCount} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
