import { connection } from "next/server";
import { Suspense } from "react";

import { safeRedirectPath } from "@/lib/auth/redirect";
import { pickParam, type RawParams } from "@/lib/utils/params";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in — Radar" };

type PageSearchParams = Promise<RawParams>;

export default function SignInPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Suspense
        fallback={
          <div className="h-56 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        }
      >
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: PageSearchParams }) {
  await connection();
  const params = await searchParams;
  const error = pickParam(params, "error");
  const next = safeRedirectPath(pickParam(params, "next"), "/");

  return (
    <>
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Radar
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Invite-only and passwordless. Enter your email and we&apos;ll send a
          one-time sign-in link.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {error === "expired"
            ? "That sign-in link has expired or was already used."
            : "Please try signing in again."}
        </p>
      )}

      <SignInForm next={next} />
    </>
  );
}
