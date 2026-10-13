import { connection } from "next/server";
import { Suspense } from "react";

import { MeetForm, type MeetDefaults } from "@/components/meet-form";
import { SaveSearchForm } from "@/components/save-search-form";
import { startOfTodayUTC } from "@/lib/domain/date-utils";
import { formatMoney } from "@/lib/flights/types";
import { optimizeMeet } from "@/lib/meet/optimize";
import { encodeParticipant, parseMeetParams, type ParsedMeet } from "@/lib/meet/params";
import type { MeetResult } from "@/lib/meet/types";
import { formatDate, formatDuration, formatStops } from "@/lib/utils/format";
import type { RawParams } from "@/lib/utils/params";

export const metadata = { title: "Meet — Radar" };

type PageSearchParams = Promise<RawParams>;

function meetHref(parsed: ParsedMeet): string {
  const qs = new URLSearchParams({
    tripType: parsed.tripType,
    cabin: parsed.cabin,
    adults: String(parsed.adults),
    togetherNights: String(parsed.togetherNights),
    limit: String(parsed.limit),
    departFrom: parsed.window.departFrom,
    departTo: parsed.window.departTo,
  });
  for (const participant of parsed.participants) {
    qs.append("p", encodeParticipant(participant));
  }
  return `/meet?${qs.toString()}`;
}

export default function MeetPage({ searchParams }: { searchParams: PageSearchParams }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Meet in the middle</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Add everyone&apos;s departure airport and a shared date window. Radar
        finds the cheapest destination you can all reach on the same dates.
      </p>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />}>
          <ControlsFromParams searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-8 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

async function ControlsFromParams({ searchParams }: { searchParams: PageSearchParams }) {
  await connection();
  const params = await searchParams;
  const parsed = parseMeetParams(params);

  const defaults: MeetDefaults = {
    participants: parsed.participants,
    window: { from: parsed.window.departFrom, to: parsed.window.departTo },
    togetherNights: parsed.togetherNights,
    tripType: parsed.tripType,
    cabin: parsed.cabin,
    adults: parsed.adults,
    limit: parsed.limit,
    minNights: parsed.window.minNights ?? 3,
    maxNights: parsed.window.maxNights ?? 7,
  };

  return <MeetForm defaults={defaults} todayIso={startOfTodayUTC()} />;
}

async function Results({ searchParams }: { searchParams: PageSearchParams }) {
  await connection();
  const params = await searchParams;
  const parsed = parseMeetParams(params);

  const results = await optimizeMeet({
    participants: parsed.participants,
    window: parsed.window,
    togetherNights: parsed.togetherNights,
    tripType: parsed.tripType,
    cabin: parsed.cabin,
    adults: parsed.adults,
    currency: parsed.currency,
    limit: parsed.limit,
  });

  if (results.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No common destination found for these travellers in that window. Try a
        wider date range, more nights, or different origins.
      </div>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Best meeting points
        </h2>
        <div className="flex items-center gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {results.length} destinations · cheapest total first
          </p>
          <SaveSearchForm
            kind="meet"
            href={meetHref(parsed)}
            label={`Meet: ${parsed.participants.map((p) => p.origin).join(" + ")}`}
          />
        </div>
      </div>
      <div className="space-y-4">
        {results.map((result, index) => (
          <MeetResultCard key={result.destination} result={result} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function MeetResultCard({ result, rank }: { result: MeetResult; rank: number }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="mr-2 text-zinc-400">{rank}.</span>
            {result.city}{" "}
            <span className="font-normal text-zinc-400">({result.destination})</span>
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {result.country}
            {result.togetherNights > 0 ? (
              <>
                {" · together "}
                {formatDate(result.togetherFrom)} → {formatDate(result.togetherTo)}
                {` (${result.togetherNights} nights)`}
              </>
            ) : (
              <> · travelling {formatDate(result.togetherFrom)}</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMoney(result.total)}
          </p>
          <p className="text-xs text-zinc-400">total · {result.legs.length} travellers</p>
        </div>
      </header>

      <table className="mt-3 w-full text-sm">
        <tbody>
          {result.legs.map((leg) => (
            <tr
              key={`${leg.origin}-${leg.label}`}
              className="border-t border-zinc-100 dark:border-zinc-900"
            >
              <td className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">
                {leg.label}
              </td>
              <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                {leg.origin} → {result.destination}
              </td>
              <td className="hidden py-2 pr-3 text-zinc-500 sm:table-cell dark:text-zinc-400">
                {formatDate(leg.departDate)}
                {leg.returnDate ? ` → ${formatDate(leg.returnDate)}` : ""}
              </td>
              <td className="hidden py-2 pr-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                {formatStops(leg.stops)} · {formatDuration(leg.durationMinutes)}
              </td>
              <td className="hidden py-2 pr-3 text-zinc-400 md:table-cell">
                {leg.carrierCode}
              </td>
              <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">
                {formatMoney(leg.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
