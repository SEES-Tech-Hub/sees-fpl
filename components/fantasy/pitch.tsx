import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Design system §11.3 Pitch: the fantasy signature. Pitch green with lines in
// pitch-line, subtle mowing stripes, rows from the top FWD, MID, DEF, GK.
//
// The grass, stripes and lines sit on their own layer, tilted back in CSS
// perspective so the far end of the pitch looks further away. The player
// chips stay upright and flat on top, so they remain sharp, readable and
// easy to tap. The layer is taller than the pitch so the tilt never shows a
// gap at the far edge.

const STRIPES =
  "repeating-linear-gradient(180deg, transparent 0 2.75rem, color-mix(in oklch, var(--brand-light) 6%, transparent) 2.75rem 5.5rem)";

export function Pitch({ caption, children, className }: { caption?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label="Pitch"
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-pitch px-2 py-3 perspective-[56rem] lg:mx-auto lg:max-w-xl",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-[12%] bottom-0 origin-bottom transform-3d rotate-x-[24deg]"
        style={{ backgroundImage: STRIPES }}
      >
        <svg className="absolute inset-0 h-full w-full" fill="none" stroke="var(--pitch-line)" strokeWidth="1.5">
          <rect x="2%" y="1.5%" width="96%" height="97%" rx="6" />
          <line x1="2%" y1="50%" x2="98%" y2="50%" />
          <circle cx="50%" cy="50%" r="36" />
          <rect x="25%" y="1.5%" width="50%" height="13%" />
          <rect x="25%" y="85.5%" width="50%" height="13%" />
        </svg>
      </div>
      {caption && (
        <p className="relative mb-1 text-center text-xs font-semibold tracking-[0.06em] text-brand-foreground/80 uppercase dark:text-foreground/80">
          {caption}
        </p>
      )}
      <div className="relative flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** One row of chips; up to 5 fit at 360 px. */
export function PitchRow({ count, children, label }: { count: number; children: ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid justify-center gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(count, 1)}, minmax(0, 4rem))` }}
    >
      {children}
    </div>
  );
}

/**
 * The bench as a dugout under the pitch: a darker strip of the pitch green
 * with numbered seats, in the order auto-subs come on.
 */
export function BenchTray({ items, note }: { items: { key: string; node: ReactNode; label?: string }[]; note?: string }) {
  return (
    <section
      aria-label="Bench"
      className="relative w-full overflow-hidden rounded-xl bg-pitch px-2 pt-2.5 pb-3 text-brand-foreground lg:mx-auto lg:max-w-xl"
    >
      <div aria-hidden className="absolute inset-0 bg-pitch brightness-[0.68]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-foreground/25 to-transparent dark:from-background/40" />
      <div className="relative flex flex-col gap-2">
        <p className="px-1 font-heading text-sm font-semibold tracking-[0.08em] text-brand-light uppercase">Bench</p>
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((item, i) => (
            <div key={item.key} className="flex min-w-0 flex-col items-center gap-1 rounded-lg bg-brand-foreground/6 px-0.5 pt-1.5 pb-1">
              <span className="rounded-full bg-brand-light px-1.5 text-[0.65rem] leading-4 font-bold text-brand tabular-nums">
                {item.label ?? i + 1}
              </span>
              <div className="w-full max-w-16">{item.node}</div>
            </div>
          ))}
        </div>
        {note && <p className="px-1 text-xs text-brand-foreground/75">{note}</p>}
      </div>
    </section>
  );
}
