// Small shared UI pieces for the payment demo, styled like the rest of the app.

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white p-2.5 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const primaryButtonClass =
  "rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200";

export const secondaryButtonClass =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition hover:border-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{children}</p>;
}

const TONE = {
  green: "border-green-600/30 bg-green-50 text-green-900 dark:bg-green-950/30 dark:text-green-200",
  yellow: "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
  red: "border-red-600/30 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200",
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
};

export function Panel({
  tone,
  children,
}: {
  tone: keyof typeof TONE;
  children: React.ReactNode;
}) {
  return <div className={`mt-4 rounded-lg border p-4 ${TONE[tone]}`}>{children}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <Panel tone="red">
      <p className="text-sm font-medium">{message}</p>
    </Panel>
  );
}
