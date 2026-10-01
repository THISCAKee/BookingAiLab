export function BrandMark({ caption, inverted = false }: { caption?: string; inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`grid h-9 w-9 grid-cols-2 gap-0.5 rounded-xl p-2 ${inverted ? "bg-white" : "bg-[#171717]"}`} aria-hidden="true">
        <span className={`rounded-sm ${inverted ? "bg-[#171717]" : "bg-white"}`} />
        <span className="rounded-sm bg-[#facc15]" />
        <span className="rounded-sm bg-[#eab308]" />
        <span className={`rounded-sm ${inverted ? "bg-[#171717]" : "bg-white"}`} />
      </span>
      <span className="leading-tight">
        <span className="font-display block text-sm font-bold tracking-[0.14em] sm:text-base">
          BOOKING<span className="text-amber-500">AI</span>LAB
        </span>
        {caption ? <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{caption}</span> : null}
      </span>
    </span>
  );
}
