import { FeatureCard } from "@/components/feature-card";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
      <section className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Flight price radar
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Catch the fare, not the FOMO.
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
          Radar watches the routes you care about, surfaces the cheapest places
          you could fly from any airport, and finds the fair meeting point for a
          group — all bounded by a flexible span of dates.
        </p>
      </section>

      <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          href="/monitor"
          eyebrow="Feature 1"
          title="Monitor a connection"
          description="Watch a specific route, say STR → BCN. Radar polls the fare, keeps a price history, and emails you when it drops below your target."
          status="Live"
        />
        <FeatureCard
          href="/explore"
          eyebrow="Feature 2"
          title="Explore cheap destinations"
          description="Give a source airport and a date window. Radar ranks the cheapest places you could fly to under that budget."
          status="Live"
        />
        <FeatureCard
          href="/meet"
          eyebrow="Feature 3"
          title="Meet in the middle"
          description="N people, N origins, one destination. Radar finds the cheapest common city that all of you can reach."
          status="Live"
        />
      </section>

      <section className="mt-12 rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
        <p>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Running on demo data.
          </span>{" "}
          The app uses a deterministic mock provider, so every feature is fully
          explorable offline at zero cost. A real provider (Air Scraper /
          SerpApi) plugs in behind the same interface when you are ready.
        </p>
      </section>
    </main>
  );
}
