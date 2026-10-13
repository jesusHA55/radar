import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { signOutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/monitor", label: "Monitor" },
  { href: "/explore", label: "Explore" },
  { href: "/meet", label: "Meet" },
  { href: "/saved", label: "Saved" },
  { href: "/settings", label: "Settings" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            ◉
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Radar
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Suspense fallback={<div className="ml-2 h-6 w-16 rounded bg-zinc-100 dark:bg-zinc-900" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function UserMenu() {
  // Defer to request time: the session is request-specific data.
  await connection();
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="ml-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="ml-1 flex items-center gap-2">
      <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400" title={user.email}>
        {user.email}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-md px-2 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
