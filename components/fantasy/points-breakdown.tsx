import { ChevronDown } from "lucide-react";
import { PitchCard, PitchRow } from "@/components/fantasy/pitch-card";
import { PositionTag } from "@/components/fantasy/player-bits";
import { formatSigned } from "@/lib/fantasy/format";
import { POSITIONS, type ManagerMatchdayPoints, type PlayerPoints } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

// Shows the numbers Mary's engine sends. Nothing is calculated here.
export function PointsBreakdown({ points }: { points: ManagerMatchdayPoints }) {
  const counted = points.players.filter((p) => p.multiplier > 0);
  const bench = points.players.filter((p) => p.multiplier === 0);
  const badge = (p: PlayerPoints) => (p.isCaptain ? "C" : p.isViceCaptain ? "V" : null);

  return (
    <>
      <section aria-label="Points on the pitch" className="flex flex-col gap-2 rounded-xl bg-brand p-3">
        {POSITIONS.map((pos) => {
          const row = counted.filter((p) => p.position === pos);
          return (
            <PitchRow key={pos} count={row.length}>
              {row.map((p) => (
                <PitchCard key={p.playerId} player={p} badge={badge(p)} sub={<PointsSub p={p} />} />
              ))}
            </PitchRow>
          );
        })}
      </section>
      {bench.length > 0 && (
        <section aria-label="Bench" className="rounded-xl border border-border bg-muted p-3">
          <p className="mb-2 text-xs text-muted-foreground">Bench (not counted)</p>
          <div className="grid grid-cols-4 gap-1.5">
            {bench.map((p) => (
              <PitchCard key={p.playerId} player={p} badge={badge(p)} dimmed sub={<PointsSub p={p} />} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="How each point was earned" className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">How each point was earned</h2>
        <ul className="rounded-xl border border-border bg-card">
          {[...counted, ...bench].map((p) => (
            <li key={p.playerId} className="border-b border-border last:border-b-0">
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                  <PositionTag position={p.position} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {p.displayName}
                      {p.isCaptain && " (C)"}
                      {p.isViceCaptain && " (V)"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.fixtureLabel ? `${p.fixtureLabel} · ${p.minutes} min` : "No match"}
                      {p.autoSubIn && " · auto-sub in"}
                      {p.autoSubOut && " · auto-subbed off"}
                      {p.multiplier === 0 && " · bench"}
                    </p>
                  </div>
                  <span className={cn("font-heading text-lg font-semibold tabular-nums", p.multiplier === 0 && "text-muted-foreground")}>
                    {p.totalPoints}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-3 pb-3">
                  {p.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {p.fixtureLabel ? "Didn't play, so no points." : "Their team had no match this matchday."}
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <caption className="sr-only">Points for {p.displayName}</caption>
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th scope="col" className="py-1 text-left font-normal">Event</th>
                          <th scope="col" className="py-1 text-right font-normal">×</th>
                          <th scope="col" className="py-1 text-right font-normal">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items.map((item) => (
                          <tr key={item.key} className="border-t border-border">
                            <td className="py-1.5">{item.label}</td>
                            <td className="py-1.5 text-right tabular-nums">{item.count}</td>
                            <td className="py-1.5 text-right tabular-nums">{formatSigned(item.points)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-medium">
                          <td className="py-1.5" colSpan={2}>
                            {p.multiplier > 1
                              ? `${p.basePoints} × ${p.multiplier} (${p.isCaptain ? "captain" : "vice standing in"})`
                              : p.multiplier === 0
                                ? `${p.basePoints} (on the bench, not counted)`
                                : "Total"}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{p.totalPoints}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function PointsSub({ p }: { p: PlayerPoints }) {
  return <span className="font-semibold text-foreground">{p.multiplier === 0 ? p.basePoints : p.totalPoints} pts</span>;
}
