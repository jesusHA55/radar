"use client";

import { useActionState } from "react";

import { sendTestEmailAction, type TestEmailState } from "@/app/settings/actions";

export function TestEmailButton({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState<TestEmailState, FormData>(
    sendTestEmailAction,
    { ok: true, message: "" },
  );

  return (
    <div>
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isPending ? "Sending…" : `Send test email to ${email}`}
        </button>
      </form>
      {state.message && (
        <p
          className={`mt-2 text-xs ${
            state.ok
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
