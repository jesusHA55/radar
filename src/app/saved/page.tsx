import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { requireCurrentUser } from "@/lib/auth/current-user";
import { deleteSavedSearchAction } from "@/lib/saved/actions";
import {
  SAVED_KIND_LABELS,
  SAVED_KINDS,
  listSavedSearches,
} from "@/lib/saved/searches";

export const metadata = { title: "Saved — Radar" };

export default function SavedPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Saved searches</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Bookmarked searches and meetings you can replay in one click.
      </p>
      <Suspense fallback={<div className="mt-8 h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await connection();
  const user = await requireCurrentUser();
  const items = await listSavedSearches(user.id);

  if (items.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        Nothing saved yet. Use the <span className="font-medium">☆ Save</span>{" "}
        button on any results page.
      </p>
    );
  }

  const groups = SAVED_KINDS.map((kind) => ({
    kind,
    items: items.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mt-8 space-y-6">
      {groups.map((group) => (
        <section key={group.kind}>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {SAVED_KIND_LABELS[group.kind]}
          </h2>
          <ul className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            {group.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-white px-4 py-2.5 last:border-b-0 dark:border-zinc-900 dark:bg-zinc-950"
              >
                <Link
                  href={item.href}
                  className="min-w-0 truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {item.label}
                </Link>
                <form action={deleteSavedSearchAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
