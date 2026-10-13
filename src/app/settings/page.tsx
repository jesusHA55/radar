import { lt, sql } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";

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
import { callBudget, monthUsage, usageByProvider } from "@/lib/gateway/meter";

export const metadata = { title: "Settings — Radar" };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your account and how much of the flight-data quota is being used.
      </p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}

async function SettingsContent() {
  await connection();
  const user = await requireCurrentUser();

  const [usage, budget, byProvider] = await Promise.all([
    monthUsage(),
    Promise.resolve(callBudget()),
    usageByProvider(),
  ]);

  const [
    watchCount,
    observationCount,
    alertCount,
    savedCount,
    userCount,
    sessionCount,
    cacheActive,
    cacheExpired,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(watches),
    db.select({ n: sql<number>`count(*)::int` }).from(priceObservations),
    db.select({ n: sql<number>`count(*)::int` }).from(alerts),
    db.select({ n: sql<number>`count(*)::int` }).from(savedSearches),
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(sessions),
    db.select({ n: sql<number>`count(*)::int` }).from(priceCache).where(sql`${priceCache.expiresAt} > now()`),
    db.select({ n: sql<number>`count(*)::int` }).from(priceCache).where(lt(priceCache.expiresAt, new Date())),
  ]).then((rows) => rows.map((r) => r[0]?.n ?? 0));

  const pct = budget > 0 ? Math.min(100, (usage.calls / budget) * 100) : 0;

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
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Provider quota this month
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {usage.calls.toLocaleString()} / {budget.toLocaleString()} calls
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {Math.max(0, budget - usage.calls).toLocaleString()} calls remaining ·
          ${(usage.costMicros / 1_000_000).toFixed(2)} estimated cost
        </p>

        {byProvider.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                <th className="py-1 font-medium">Provider</th>
                <th className="py-1 text-right font-medium">Calls</th>
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
