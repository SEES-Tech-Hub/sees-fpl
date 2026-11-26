import Link from "next/link";
import type { ReactNode } from "react";
import { Crown } from "lucide-react";
import { YearCrest } from "@/components/brand/year-crest";
import { teamColour } from "@/lib/design/team-colour";
import { lanePercent, progressLine, raceHeadline, raceStarted, type ChampionshipProgress } from "@/lib/live/race";
import type { MedalTableRow } from "@/lib/live/types";
import { cn } from "@/lib/utils";

// "Race for the championship" as a race track: each year's crest runs down
// its own lane. How far it has run is its medal points (gold 3, silver 2,
// bronze 1 by default, the admin's setting); the lanes are in the real
// ranking order. A bar under the title shows how much of the festival is
// decided, so an early lead doesn't read like a done deal. Before any medal
// it's a start line; once every event is decided the leader crosses it.

export const MEDAL_FILL = { gold: "var(--highlight)", silver: "var(--muted-foreground)", bronze: "var(--team-y2)" } as const;

export function ChampionshipStrip({
  rows,
  progress,
  now,
  share,
  link = true,
  className,
}: {
  rows: MedalTableRow[];
  progress: ChampionshipProgress;
  now: number;
  /** The share button (components/live/race-share.tsx). */
  share?: ReactNode;
  /** Show the "Medal table" link (off on the championship page itself). */
  link?: boolean;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const started = raceStarted(rows);
  const byPoints = rows[0].rankBy === "points";
  const sub = raceHeadline(rows, progress);

  return (
    <section aria-labelledby="championship" className={cn("mx-4 flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card lg:mx-0", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="championship" className="font-heading text-lg leading-tight font-bold uppercase sm:text-xl">
            Race for the championship
          </h2>
          <p className="text-sm text-muted-foreground">{sub}</p>
        </div>
        {share}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span
            className="block h-full rounded-full bg-primary motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-700"
            style={{ width: `${progress.total ? (progress.decided / progress.total) * 100 : 0}%` }}
          />
        </span>
        <p className="text-xs font-semibold text-secondary-foreground">{progressLine(progress, now)}</p>
      </div>

      <ol className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const pct = lanePercent(r, rows, progress);
          const leader = started && r.position === 1;
          const spoken = started
            ? `${r.team.name}: ${r.gold} gold, ${r.silver} silver, ${r.bronze} bronze${byPoints ? `, ${r.points} points` : ""}`
            : `${r.team.name}: no medals yet`;
          return (
            <li key={r.team.id} className="grid grid-cols-[0.875rem_minmax(0,1fr)_4.75rem] items-center gap-2.5" aria-label={spoken}>
              <span className="font-heading text-sm font-bold text-muted-foreground" aria-hidden>
                {started ? r.position : ""}
              </span>
              <span className="relative h-11 rounded-xl bg-muted" aria-hidden>
                <span className="absolute inset-0 overflow-hidden rounded-xl">
                  <span
                    className="block h-full rounded-xl motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-700 motion-safe:fill-mode-backwards"
                    style={{
                      width: `${pct}%`,
                      background: started ? `color-mix(in oklab, ${teamColour(r.team.year)} 32%, transparent)` : "transparent",
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                </span>
                <span className="absolute top-1.5 right-3 bottom-1.5 w-1.5 rounded-[2px] bg-[repeating-conic-gradient(var(--foreground)_0_25%,var(--card)_0_50%)] bg-[length:6px_6px] opacity-50" />
                <span
                  className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-500 motion-safe:fill-mode-backwards"
                  style={{ left: `${pct}%`, animationDelay: `${300 + i * 80}ms` }}
                >
                  {leader && <Crown className="-mb-0.5 size-3.5 fill-highlight text-highlight" />}
                  <YearCrest year={r.team.year} size={30} label="" />
                </span>
              </span>
              <span className="flex justify-end gap-2 text-xs font-semibold tabular-nums" aria-hidden>
                {(["gold", "silver", "bronze"] as const).map((m) => (
                  <span key={m} className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: MEDAL_FILL[m] }} />
                    {started ? r[m] : "–"}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {byPoints ? "Ranked on points: gold, silver and bronze each count." : "Ranked gold first, then silver, then bronze."}
        </p>
        {link && (
          <Link href="/championship" className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline">
            Medal table
          </Link>
        )}
      </div>
    </section>
  );
}
