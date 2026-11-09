import Image from "next/image";

export function BrandMark({ caption }: { caption?: string; inverted?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 sm:gap-3">
      <Image src="/msu-library-logo.png" alt="MSU Library" width={1200} height={669} className="h-9 w-auto shrink-0 sm:h-12" />
      <span className="min-w-0 leading-tight">
        <span className="font-display block text-[13px] font-bold tracking-[0.01em] text-[#1f2937] sm:text-base">BOOKING AI CORNER</span>
        {caption ? <span className="mt-0.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{caption}</span> : null}
      </span>
    </span>
  );
}
