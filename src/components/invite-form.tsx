"use client";

import { useActionState } from "react";

import { createInviteAction, type InviteActionState } from "@/app/invites/actions";

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400";

export function InviteForm() {
  const [state, formAction, isPending] = useActionState<InviteActionState, FormData>(
    createInviteAction,
    { ok: true, message: "" },
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="name@example.com"
          aria-label="Invitee email address"
          className={fieldClass}
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Adding…" : "Add invite"}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" name="send" defaultChecked className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700" />
        Also email them a sign-in link now
      </label>

      {state.message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {state.message}
          {state.devUrl && (
            <>
              {" "}
              <a href={state.devUrl} className="font-medium underline">
                Open sign-in link
              </a>{" "}
              <span className="opacity-70">(dev)</span>
            </>
          )}
        </p>
      )}
    </form>
  );
}
