"use client";

import { motion } from "motion/react";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { teamColour } from "@/lib/design/team-colour";
import type { FixtureState } from "@/lib/live/live-state-types";
import type { MatchPageData } from "@/lib/live/match-page";
import type { RaceResultRow } from "@/lib/live/types";
import { cn, formatWAT } from "@/lib/utils";
import { EmptyState } from "@/components/brand/empty-state";
import { Medal } from "./medal-table";
import { YearCrest } from "@/components/brand/year-crest";
import { FixturePhoto, hasPhoto } from "./fixture-photo";

// Ranked events (athletics, swimming): a podium that rises gold, silver,
// bronze, then the full finishing order with times or marks.

const OUTCOME: Record<string, string> = { dnf: "DNF", dns: "DNS", dq: "DQ" };
const PODIUM_DELAY = [0.25, 0, 0.45];

export function formatResult(r: RaceResultRow): string {
  if (r.outcome && r.outcome !== "finished") return OUTCOME[r.outcome] ?? r.outcome;
  if (r.timeMs !== null) {
    const total = r.timeMs / 1000;
    const min = Math.floor(total / 60);
    const sec = total - min * 60;
    return min > 0 ? `${min}:${sec.toFixed(2).padStart(5, "0")}` : `${sec.toFixed(2)}s`;
  }
  if (r.markMm !== null) return `${(r.markMm / 1000).toFixed(2)} m`;
  return "–";
}

const stageText = (stage: string) => stage.replace(/[_-]+/g, " ");

export function RaceView({ data, state }: { data: MatchPageData; state: FixtureState }) {
  const { fixture, race } = data;
  const photo = hasPhoto(fixture.sport.slug);
  const published = race.some((r) => r.position !== null || r.outcome);
  const podium = [2, 1, 3]
    .map((p) => race.find((r) => r.position === p))
    .filter((r): r is RaceResultRow => Boolean(r));
  const ordered = [...race].sort((a, b) => (a.position ?? 99) - (b.position ?? 99) || (a.lane ?? 99) - (b.lane ?? 99));

  return (
    <>
      <section className={cn("relative overflow-hidden bg-pitch px-4 pt-5 pb-6 text-brand-foreground lg:rounded-2xl", photo && "sees-on-photo")}>
        <FixturePhoto sport={fixture.sport.slug} priority />
        {!photo && <CircuitPattern />}
        <div className="relative flex flex-col items-center gap-2 text-center">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-light uppercase">
            <SportIcon sport={fixture.sport.slug.replace(/-/g, "_")} size={14} /> {fixture.sport.name}
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase">{fixture.event.name}</h1>
          <p className="text-sm text-brand-foreground/80">
            {fixture.stage && fixture.stage !== "final" ? `${stageText(fixture.stage)} · ` : ""}
            {state.status === "full_time" ? "Final results" : fixture.kickoffAt ? formatWAT(fixture.kickoffAt, "datetime") : "Time to be confirmed"}
            {fixture.venue ? ` · ${fixture.venue}` : ""}
          </p>
          {published && podium.length > 0 && (
            <div className="mt-4 grid w-full max-w-md grid-cols-3 items-end gap-2">
              {podium.map((r, i) => {
                const height = r.position === 1 ? "h-28" : r.position === 2 ? "h-20" : "h-14";
                return (
                  <div key={r.entryId} className="flex flex-col items-center gap-1.5">
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.15 }}
                      className="line-clamp-2 text-sm font-semibold"
                    >
                      {r.athleteName ?? r.team.name}
                    </motion.span>
                    <span className="text-xs text-brand-foreground/80">{formatResult(r)}</span>
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: "spring", stiffness: 160, damping: 18, delay: PODIUM_DELAY[i] }}
                      className={cn("flex w-full origin-bottom flex-col items-center justify-start gap-1 rounded-t-lg pt-2", height)}
                      style={{ background: teamColour(r.team.year) }}
                    >
                      {r.medal && <Medal tone={r.medal} />}
                      <span className="font-heading text-2xl font-bold text-team-foreground">{r.position}</span>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mx-4 overflow-hidden rounded-xl bg-card shadow-card lg:mx-0">
        <h2 className="border-b border-border px-3 py-2.5 font-heading text-lg font-bold">{published ? "Results" : "Entrants"}</h2>
        {ordered.length === 0 ? (
          <EmptyState art="stands" title="No entrants yet" description="They show here once the officials set the lanes." compact bare />
        ) : (
          <ol className="divide-y divide-border">
            {ordered.map((r, i) => (
              <motion.li
                key={r.entryId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03 }}
                className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-6 font-heading font-bold tabular-nums">{published ? (r.position ?? "–") : r.lane ? `L${r.lane}` : "–"}</span>
                <YearCrest year={r.team.year} size={26} />
                <span className="flex-1 truncate font-semibold">{r.athleteName ?? r.team.name}</span>
                {r.medal && <Medal tone={r.medal} />}
                <span className="w-20 text-right font-heading font-semibold tabular-nums">{published ? formatResult(r) : ""}</span>
              </motion.li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
