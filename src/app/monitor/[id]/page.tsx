import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { Sparkline } from "@/components/sparkline";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getAirport } from "@/lib/domain/airports";
import { describeDateWindow } from "@/lib/domain/date-window";
import { formatMoney } from "@/lib/flights/types";
import type { AlertKind } from "@/lib/notifications";
import { getObservations, getWatch, getWatchAlerts } from "@/lib/monitor/queries";
import { describeThreshold } from "@/lib/monitor/types";
import { formatDate } from "@/lib/utils/format";
import { checkNowAction, deleteWatchAction, toggleWatchAction } from "../actions";

export default function WatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        }
      >
        <WatchDetail params={params} />
      </Suspense>
    </main>
  );
}

const ALERT_LABEL: Record<AlertKind, string> = {
  target: "Target hit",
  drop: "Price drop",
  "all-time-low": "New low",
};

async function WatchDetail({ params }: { params: Promise<{ id: string }> }) {
  // Defer to request time: this route reads runtime data (the database).
  await connection();

  const { id } = await params;
  const watch = await getWatch(id);
  if (!watch) notFound();

  const user = await requireCurrentUser();
  if (watch.ownerId !== user.id) notFound();

  const [observations, alerts] = await Promise.all([
    getObservations(id),
    getWatchAlerts(id),
  ]);

  const latest = observations[observations.length - 1];
  const previous = observations[observations.length - 2];
  const change =
    latest && previous && previous.priceMinor > 0
      ? ((latest.priceMinor - previous.priceMinor) / previous.priceMinor) * 100
      : null;

  const origin = getAirport(watch.origin);
  const destination = getAirport(watch.destination);
  const recent = [...observations].reverse();

  return (
    <>
      <Link
        href="/monitor"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Monitor
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {watch.label ?? `${watch.origin} → ${watch.destination}`}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {origin?.city ?? watch.origin} ({watch.origin}) → {destination?.city ?? watch.destination} (
            {watch.destination})
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {latest ? formatMoney({ amountMinor: latest.priceMinor, currency: latest.currency }) : "—"}
          </p>
          {change !== null && (
            <p
              className={`text-sm ${change <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {change <= 0 ? "▼" : "▲"} {Math.abs(change).toFixed(1)}% vs previous
            </p>
          )}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <form action={checkNowAction}>
          <input type="hidden" name="id" value={watch.id} />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Check now
          </button>
        </form>
        <form action={toggleWatchAction}>
          <input type="hidden" name="id" value={watch.id} />
          <input type="hidden" name="isActive" value={watch.isActive ? "false" : "true"} />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {watch.isActive ? "Pause" : "Resume"}
          </button>
        </form>
        <form action={deleteWatchAction}>
          <input type="hidden" name="id" value={watch.id} />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg border border-red-200 px-4 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        </form>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 p-4 text-sm sm:grid-cols-4 dark:border-zinc-800">
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Dates</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {describeDateWindow(watch.dateWindow)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Trip</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {watch.tripType} · {watch.cabin} · {watch.adults}p
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Trigger</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {describeThreshold(watch.thresholdType, watch.thresholdValue, watch.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500 dark:text-zinc-400">Status</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
            {watch.isActive ? `Active · ${watch.cadenceMinutes / 60}h` : "Paused"}
          </dd>
        </div>
      </dl>

      <section className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Price history</h2>
        {observations.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No observations yet. Use “Check now”, or run{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">npm run poll</code>.
          </p>
        ) : (
          <>
            <Sparkline
              values={observations.map((o) => o.priceMinor)}
              width={640}
              height={80}
              className="mt-3 w-full text-zinc-400"
            />
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                  <th className="py-1 font-medium">Checked</th>
                  <th className="py-1 font-medium">Price</th>
                  <th className="py-1 font-medium">Travel window</th>
                </tr>
              </thead>
              <tbody>
                {recent.slice(0, 20).map((observation) => (
                  <tr key={observation.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="py-1.5 text-zinc-600 dark:text-zinc-400">
                      {observation.observedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatMoney({
                        amountMinor: observation.priceMinor,
                        currency: observation.currency,
                      })}
                    </td>
                    <td className="py-1.5 text-zinc-600 dark:text-zinc-400">
                      {observation.departDate ? formatDate(observation.departDate) : "—"}
                      {observation.returnDate ? ` → ${formatDate(observation.returnDate)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Alerts</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">No alerts sent yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {ALERT_LABEL[alert.kind as AlertKind] ?? alert.kind}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {alert.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {alert.channel}
                  </span>
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatMoney({ amountMinor: alert.priceMinor, currency: alert.currency })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
