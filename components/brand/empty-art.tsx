import { cn } from "@/lib/utils";

// Small sports illustrations for empty states, drawn in SEES colours (lines
// take the text colour; fills use the brand-light and highlight tokens), so
// they suit light and dark themes and weigh almost nothing. Each one floats
// gently; reduced motion keeps them still.

export type EmptyArt =
  | "net" // empty goal: nothing here yet
  | "ball" // deflated ball: no results, no matches
  | "stands" // empty stands: no fans, no managers, no members
  | "whistle" // sleeping whistle: waiting for kick-off
  | "trophy" // dusty trophy: no medals or winners yet
  | "board" // tactics board: lineups not set
  | "calendar" // calendar with a ball: no fixtures on this day
  | "lost"; // ball over the fence: 404

const S = { stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;

const ART: Record<EmptyArt, React.ReactNode> = {
  net: (
    <>
      <path d="M22 96 V30 H138 V96" {...S} />
      <path d="M22 30 L36 44 H124 L138 30 M36 44 V96 M124 44 V96" {...S} strokeWidth={2} opacity={0.6} />
      {[52, 68, 84, 100].map((x) => (
        <path key={x} d={`M${x} 44 V96`} {...S} strokeWidth={1.5} opacity={0.35} />
      ))}
      {[58, 72, 86].map((y) => (
        <path key={y} d={`M36 ${y} H124`} {...S} strokeWidth={1.5} opacity={0.35} />
      ))}
      <path d="M8 100 H152" {...S} strokeWidth={2} opacity={0.5} />
      <circle cx="146" cy="90" r="8" className="fill-brand-light" {...{ stroke: "currentColor", strokeWidth: 2.5 }} />
      <path d="M143 87 l3 -2 l3 2 l-1 3.5 h-4 z" fill="currentColor" />
    </>
  ),
  ball: (
    <>
      <ellipse cx="80" cy="84" rx="44" ry="20" className="fill-brand-light" stroke="currentColor" strokeWidth={3} />
      <path d="M72 76 l8 -4 l8 4 l-3 8 h-10 z" fill="currentColor" />
      <path d="M50 82 l8 2 M110 82 l-8 2 M80 98 v-6" {...S} strokeWidth={2.5} />
      <path d="M58 40 q6 -8 12 0 M90 34 q6 -8 12 0" {...S} strokeWidth={2.5} opacity={0.6} />
      <path d="M34 106 H126" {...S} strokeWidth={2} opacity={0.4} />
    </>
  ),
  stands: (
    <>
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <path d={`M${20 + r * 10} ${92 - r * 22} H${140 - r * 10}`} {...S} />
          {Array.from({ length: 7 - r }, (_, i) => (
            <rect
              key={i}
              x={26 + r * 10 + i * (16 + (r === 0 ? 0 : 0))}
              y={80 - r * 22}
              width="10"
              height="8"
              rx="2"
              className="fill-brand-light"
              stroke="currentColor"
              strokeWidth={2}
            />
          ))}
        </g>
      ))}
      <path d="M128 40 V14" {...S} />
      <path d="M128 14 L148 20 L128 26 Z" className="fill-highlight" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" />
    </>
  ),
  whistle: (
    <>
      <path d="M30 70 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0" className="fill-brand-light" stroke="currentColor" strokeWidth={3} />
      <path d="M66 52 H128 V70 H74" className="fill-brand-light" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
      <circle cx="52" cy="70" r="7" fill="currentColor" />
      <path d="M128 52 h8" {...S} />
      <path d="M100 30 h10 l-10 12 h10 M118 18 h7 l-7 8 h7" {...S} strokeWidth={2.5} opacity={0.6} />
    </>
  ),
  trophy: (
    <>
      <path d="M56 24 H104 V52 a24 24 0 0 1 -48 0 Z" className="fill-highlight" stroke="currentColor" strokeWidth={3} strokeLinejoin="round" />
      <path d="M56 32 H44 a10 10 0 0 0 12 18 M104 32 H116 a10 10 0 0 1 -12 18" {...S} />
      <path d="M80 76 V88 M64 100 H96 V88 H64 Z" {...S} />
      <path d="M24 18 l10 10 M24 28 l6 -4 l4 6" {...S} strokeWidth={1.5} opacity={0.5} />
      <path d="M124 92 q4 -4 8 0 q4 4 8 0" {...S} strokeWidth={2} opacity={0.5} />
      <circle cx="40" cy="96" r="2" fill="currentColor" opacity={0.4} />
      <circle cx="122" cy="20" r="2" fill="currentColor" opacity={0.4} />
    </>
  ),
  board: (
    <>
      <rect x="28" y="18" width="104" height="84" rx="8" className="fill-brand-light" stroke="currentColor" strokeWidth={3} />
      <path d="M80 18 V102 M28 60 H132" {...S} strokeWidth={2} opacity={0.5} />
      <circle cx="80" cy="60" r="10" {...S} strokeWidth={2} opacity={0.5} />
      <path d="M46 36 l8 8 m0 -8 l-8 8 M104 76 l8 8 m0 -8 l-8 8" {...S} />
      <circle cx="56" cy="82" r="5" {...S} />
      <circle cx="108" cy="40" r="5" {...S} />
      <path d="M60 78 q20 -30 42 -36" {...S} strokeWidth={2} strokeDasharray="4 5" />
    </>
  ),
  calendar: (
    <>
      <rect x="30" y="24" width="100" height="80" rx="8" stroke="currentColor" strokeWidth={3} fill="none" />
      <path d="M30 44 H130" {...S} />
      <path d="M54 16 V30 M106 16 V30" {...S} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}${c}`} x={42 + c * 20} y={54 + r * 15} width="10" height="7" rx="2" fill="currentColor" opacity={0.18} />
        )),
      )}
      <circle cx="122" cy="96" r="13" className="fill-brand-light" stroke="currentColor" strokeWidth={2.5} />
      <path d="M117 92 l5 -3 l5 3 l-2 5 h-6 z" fill="currentColor" />
    </>
  ),
  lost: (
    <>
      <path d="M10 96 H150" {...S} strokeWidth={2} opacity={0.5} />
      {[24, 44, 64, 84, 104, 124].map((x) => (
        <path key={x} d={`M${x} 96 V56`} {...S} strokeWidth={2.5} />
      ))}
      <path d="M18 64 H130 M18 82 H130" {...S} strokeWidth={2} />
      <circle cx="132" cy="30" r="13" className="fill-brand-light" stroke="currentColor" strokeWidth={2.5} />
      <path d="M127 26 l5 -3 l5 3 l-2 5 h-6 z" fill="currentColor" />
      <path d="M70 40 q30 -36 50 -14" {...S} strokeWidth={2} strokeDasharray="4 6" opacity={0.6} />
    </>
  ),
};

export function EmptyIllustration({ art, className }: { art: EmptyArt; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 160 120"
      className={cn("h-28 w-auto text-brand motion-safe:animate-[sees-float_4s_ease-in-out_infinite] dark:text-brand-light", className)}
    >
      {ART[art]}
    </svg>
  );
}
