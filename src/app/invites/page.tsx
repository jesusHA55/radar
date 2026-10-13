import { connection } from "next/server";
import { Suspense } from "react";

import { InviteForm } from "@/components/invite-form";
import { listInvites } from "@/lib/invites/queries";
import { formatDate } from "@/lib/utils/format";
import { deleteInviteAction, sendInviteLinkAction } from "./actions";

export const metadata = { title: "Invites — Radar" };

export default function InvitesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Radar is invite-only. Add an email address to let someone sign in
        passwordlessly. Once they sign in, their account — not the invite — keeps
        them in.
      </p>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <InviteForm />
      </section>

      <Suspense
        fallback={
          <div className="mt-8 h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
        }
      >
        <InvitesTable />
      </Suspense>
    </main>
  );
}

async function InvitesTable() {
  await connection();
  const invites = await listInvites();

  if (invites.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No invites yet. Add one above.
      </p>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Invite list
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {invites.length} total
        </p>
      </div>

      <ul className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-white px-4 py-3 last:border-b-0 dark:border-zinc-900 dark:bg-zinc-950"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {invite.email}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    invite.joined
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {invite.joined ? "Joined" : "Pending"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                Added {formatDate(invite.createdAt.toISOString().slice(0, 10))}
                {invite.invitedByEmail ? ` by ${invite.invitedByEmail}` : ""}
                {invite.joined && invite.acceptedAt
                  ? ` · joined ${formatDate(invite.acceptedAt.toISOString().slice(0, 10))}`
                  : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <form action={sendInviteLinkAction}>
                <input type="hidden" name="email" value={invite.email} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  Send link
                </button>
              </form>
              <form action={deleteInviteAction}>
                <input type="hidden" name="id" value={invite.id} />
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Removing an invite forgets a <em>pending</em> invitation. Someone who has
        already signed in keeps their account.
      </p>
    </section>
  );
}
