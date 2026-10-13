import { saveSearchAction } from "@/lib/saved/actions";

/**
 * "Save this search" control. Rendered from server components that already know
 * the current query, so it is a plain progressive-enhancement form.
 */
export function SaveSearchForm({
  kind,
  href,
  label,
}: {
  kind: string;
  href: string;
  label: string;
}) {
  return (
    <form action={saveSearchAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="href" value={href} />
      <input type="hidden" name="label" value={label} />
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        ☆ Save
      </button>
    </form>
  );
}
