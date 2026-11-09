import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mt-10 flex flex-wrap items-end justify-between gap-5 sm:mt-14">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="font-display mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-base leading-7 text-slate-600">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
