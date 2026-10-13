import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Sparkline } from "@/components/sparkline";
import { WatchForm } from "@/components/watch-form";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { startOfTodayUTC } from "@/lib/domain/date-utils";
import { defaultDateWindow } from "@/lib/domain/date-window";
import { formatMoney } from "@/lib/flights/types";
import {
  listWatchesWithHistory,
  type PriceObservation,
  type Watch,
} from "@/lib/monitor/queries";
import { describeThreshold } from "@/lib/monitor/types";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Monitor — Radar" };

export default function MonitorPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Monitor</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Watch a route across a flexible date window. Radar keeps the price
        history and emails you when your threshold is crossed.
      </p>

      <Suspense fallback={<MonitorSkeleton />}>
        <MonitorContent />
      </Suspense>
    </main>
  );
}

function MonitorSkeleton() {
  return (
    <div className="mt-8 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

async function MonitorContent() {
  // Defer to request time: this route reads runtime data (the database).
  await connection();

  let user;
  let items;
  try {
    user = await requireCurrentUser();
    items = await listWatchesWithHistory(user.id);
  } catch {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm dark:border-zinc-700">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Database not set up</p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">npm run db:setup</code>{" "}
          to create the local database, then reload.
        </p>
      </div>
    );
  }

  const window = defaultDateWindow();

  return (
    <>
      <details className="group mt-8 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">▶</span>
          New watch
        </summary>
        <div className="border-t border-zinc-200 p-5 dark:border-zinc-800">
          <WatchForm
            todayIso={startOfTodayUTC()}
            defaultWindow={{ from: window.departFrom, to: window.departTo }}
          />
        </div>
      </details>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Your watches
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{items.length} active set</p>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No watches yet. Create one above to start tracking prices.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map(({ watch, observations }) => (
              <WatchCard key={watch.id} watch={watch} observations={observations} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function changePct(observations: PriceObservation[]): number | null {
  if (observations.length < 2) return null;
  const last = observations[observations.length - 1].priceMinor;
  const previous = observations[observations.length - 2].priceMinor;
  if (previous === 0) return null;
  return ((last - previous) / previous) * 100;
}

function WatchCard({
  watch,
  observations,
}: {
  watch: Watch;
  observations: PriceObservation[];
}) {
  const latest = observations[observations.length - 1];
  const change = changePct(observations);

  return (
    <Link
      href={`/monitor/${watch.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-500"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {watch.label ?? `${watch.origin} → ${watch.destination}`}
          </h3>
          {!watch.isActive && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              paused
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {watch.origin} → {watch.destination} · {describeThreshold(watch.thresholdType, watch.thresholdValue, watch.currency)}
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {watch.lastCheckedAt
            ? `Checked ${formatDate(watch.lastCheckedAt.toISOString().slice(0, 10))}`
            : "Not checked yet"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <Sparkline values={observations.map((o) => o.priceMinor)} className="text-zinc-400" />
        <div className="text-right">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {latest ? formatMoney({ amountMinor: latest.priceMinor, currency: latest.currency }) : "—"}
          </p>
          {change !== null && (
            <p
              className={`text-xs ${change <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {change <= 0 ? "▼" : "▲"} {Math.abs(change).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
