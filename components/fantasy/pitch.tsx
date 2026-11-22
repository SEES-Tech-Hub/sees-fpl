import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Design system §11.3 Pitch: the fantasy signature. Pitch green with lines in
// pitch-line, subtle mowing stripes, rows from the top FWD, MID, DEF, GK.

export function Pitch({ caption, children, className }: { caption?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label="Pitch"
      className={cn("relative w-full overflow-hidden rounded-xl bg-pitch px-2 py-3 lg:mx-auto lg:max-w-xl", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(180deg, transparent 0 2.75rem, color-mix(in oklch, var(--brand-light) 6%, transparent) 2.75rem 5.5rem)",
      }}
    >
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" fill="none" stroke="var(--pitch-line)" strokeWidth="1.5">
        <rect x="2%" y="1.5%" width="96%" height="97%" rx="6" />
        <line x1="2%" y1="50%" x2="98%" y2="50%" />
        <circle cx="50%" cy="50%" r="36" />
        <rect x="25%" y="1.5%" width="50%" height="13%" />
        <rect x="25%" y="85.5%" width="50%" height="13%" />
      </svg>
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

/** The bench tray under the pitch, with order numbers 1 to 4. */
export function BenchTray({ items, note }: { items: { key: string; node: ReactNode; label?: string }[]; note?: string }) {
  return (
    <section aria-label="Bench" className="w-full rounded-xl bg-muted px-2 pt-2 pb-3 lg:mx-auto lg:max-w-xl">
      <p className="px-1 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Bench</p>
      {note && <p className="px-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {items.map((item, i) => (
          <div key={item.key} className="flex min-w-0 flex-col items-center gap-1">
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {i + 1}
              {item.label ? ` · ${item.label}` : ""}
            </span>
            <div className="w-full max-w-16">{item.node}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
