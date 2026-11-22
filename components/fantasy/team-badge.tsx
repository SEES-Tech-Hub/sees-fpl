// TODO(Henry): swap for Fortune's shared TeamBadge (components/shared) once
// the day-1 kit lands. Design system §11.1: team fill, dark text, the short
// name always shown so colour is never the only signal.

import { CLASS_LABEL, toneFor } from "@/lib/fantasy/team-tone";
import { cn } from "@/lib/utils";

export function TeamDot({ year, className }: { year: number; className?: string }) {
  const tone = toneFor(year);
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full font-heading text-[0.6rem] font-semibold text-team-foreground",
        tone.fill,
        className,
      )}
      aria-label={`Year ${year}, ${CLASS_LABEL[year] ?? ""}`}
      role="img"
    >
      Y{year}
    </span>
  );
}

/** The small shirt used on the fantasy pitch (TeamBadge `kit` variant). */
export function Kit({ year, className }: { year: number | null; className?: string }) {
  const tone = toneFor(year);
  return (
    <svg viewBox="0 0 40 36" className={cn("h-9 w-10 drop-shadow-sm", className)} aria-hidden>
      <path
        d="M13 2 L5 6 L1 14 L7 17 L9 13 L9 34 L31 34 L31 13 L33 17 L39 14 L35 6 L27 2 Q20 7 13 2 Z"
        className={cn(tone.kit, "stroke-team-foreground/25")}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {year ? (
        <text
          x="20"
          y="25"
          textAnchor="middle"
          className="fill-team-foreground font-heading text-[10px] font-semibold"
        >
          Y{year}
        </text>
      ) : null}
    </svg>
  );
}
