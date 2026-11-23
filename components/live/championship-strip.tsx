import Link from "next/link";
import { Crown } from "lucide-react";
import type { MedalTableRow } from "@/lib/live/types";
import { teamColour } from "@/lib/design/team-colour";

// "Race for the championship": the five years as bars, longest for the
// leader, with a crown. Before any medals, all five sit level.

export function ChampionshipStrip({ rows }: { rows: MedalTableRow[] }) {
  if (rows.length === 0) return null;
  const byPoints = rows[0].rankBy === "points";
  const score = (r: MedalTableRow) => (byPoints ? r.points : r.gold * 10000 + r.silver * 100 + r.bronze);
  const label = (r: MedalTableRow) => (byPoints ? `${r.points} pts` : `${r.gold}·${r.silver}·${r.bronze}`);
  const top = Math.max(...rows.map(score));
  const started = top > 0;

  return (
    <section aria-labelledby="championship" className="mx-4 rounded-2xl bg-card p-4 shadow-card lg:mx-0">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="championship" className="font-heading text-lg leading-tight font-bold uppercase sm:text-xl">
          Race for the championship
        </h2>
        <Link href="/tables" className="shrink-0 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline">
          Medal table
        </Link>
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {started ? (byPoints ? "Overall points across every event." : "Gold · silver · bronze across every event.") : "All five years start level. First medals from 28 Nov."}
      </p>
      <ol className="mt-4 flex flex-col gap-2.5">
        {rows.map((r, i) => {
          const pct = started ? Math.max(6, (score(r) / top) * 100) : 20;
          const leader = started && r.position === 1;
          return (
            <li key={r.team.id} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-2">
              <span className="flex items-center gap-1 font-heading text-sm font-bold">
                {r.team.shortName}
                {leader && <Crown className="size-3.5 text-highlight" aria-label="Leader" />}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full origin-left rounded-full motion-safe:animate-in motion-safe:slide-in-from-left-full motion-safe:duration-700 motion-safe:fill-mode-backwards"
                  style={{ width: `${pct}%`, background: teamColour(r.team.year), animationDelay: `${i * 80}ms` }}
                />
              </span>
              <span className="w-16 text-right text-xs font-semibold text-muted-foreground tabular-nums">{started ? label(r) : "–"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
