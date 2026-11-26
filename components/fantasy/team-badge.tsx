// TODO(Henry): swap for Fortune's shared TeamBadge (components/shared) once
// the day-1 kit lands. Design system §11.1: team fill, dark text, the short
// name always shown so colour is never the only signal.

import { CLASS_LABEL, toneFor } from "@/lib/fantasy/team-tone";
import { cn } from "@/lib/utils";
import { YearCrest } from "@/components/brand/year-crest";

/** A player's year as its crest mark (components/brand/year-crest.tsx). */
export function TeamDot({ year, className }: { year: number; className?: string }) {
  return <YearCrest year={year} size={22} className={className} label={`Year ${year}, ${CLASS_LABEL[year] ?? ""}`} />;
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
