import { useId } from "react";
import { cn } from "@/lib/utils";

// The SEES (Society of Electrical & Electronics and Computer Engineering
// Students) emblem: a chip with circuit traces on all four sides, redrawn as
// SVG from public/brand/sees-logo.png (the full logo with its lettering).
//
// Everything takes the text colour. The traces (`tracesClassName`) and the
// chip's centre (`ballClassName`) are separate so loaders can animate them.

// One side's three traces, pointing up from the chip; rotated for the others.
const SIDE = [
  { d: "M50 33 V14", end: [50, 10] },
  { d: "M43 35 V26 L35 18", end: [32.5, 15.5] },
  { d: "M57 35 V26 L65 18", end: [67.5, 15.5] },
] as const;

export function SeesMark({
  className,
  tracesClassName,
  ballClassName,
}: {
  className?: string;
  /** Kept for older callers; the chip's ring is part of the body now. */
  shapeClassName?: string;
  tracesClassName?: string;
  ballClassName?: string;
}) {
  const mask = useId();
  return (
    <svg aria-hidden viewBox="0 0 100 100" className={cn("size-12", className)} fill="none">
      <defs>
        <mask id={mask}>
          <rect width="100" height="100" fill="white" />
          <circle cx="50" cy="50" r="10" stroke="black" strokeWidth="3" />
        </mask>
      </defs>
      <g className={tracesClassName} stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        {[0, 90, 180, 270].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 50 50)`}>
            {SIDE.map((t) => (
              <g key={t.d}>
                <path d={t.d} pathLength={1} className="sees-trace" />
                <circle cx={t.end[0]} cy={t.end[1]} r="3.2" />
              </g>
            ))}
          </g>
        ))}
      </g>
      <circle cx="50" cy="50" r="18" fill="currentColor" mask={`url(#${mask})`} />
      <circle
        cx="50"
        cy="50"
        r="5.5"
        className={cn("fill-current", ballClassName)}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
