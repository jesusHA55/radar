import Link from "next/link";

type Props = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
};

export function FeatureCard({ href, eyebrow, title, description, status }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-900 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-500"
    >
      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {eyebrow}
          </p>
          {status && (
            <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {status}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <span className="mt-6 text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
        Open →
      </span>
    </Link>
  );
}
