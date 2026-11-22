"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { BenchTray, Pitch, PitchRow } from "@/components/fantasy/pitch";
import { PositionTag } from "@/components/fantasy/player-bits";
import { PlayerChip } from "@/components/fantasy/player-chip";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { formatPoints, formatSigned, POSITION_LABEL, POSITION_PLURAL } from "@/lib/fantasy/format";
import type { ManagerMatchdayPoints, PlayerPoints, Position } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

// Shows the numbers the backend sends. Nothing is calculated here.

const PITCH_ORDER: Position[] = ["FWD", "MID", "DEF", "GK"];

export function PointsView({ points, yearOf }: { points: ManagerMatchdayPoints; yearOf: Record<string, number> }) {
  const [open, setOpen] = useState<string | null>(null);
  const counted = points.players.filter((p) => p.multiplier > 0);
  const bench = points.players.filter((p) => p.multiplier === 0);
  const sheet = open ? points.players.find((p) => p.playerId === open) : undefined;

  const chip = (p: PlayerPoints) => (
    <PlayerChip
      key={p.playerId}
      player={{ displayName: p.displayName, position: p.position, teamYear: yearOf[p.playerId] ?? 0 }}
      tag={String(p.multiplier === 0 ? p.basePoints : p.totalPoints)}
      tagLabel={formatPoints(p.multiplier === 0 ? p.basePoints : p.totalPoints)}
      captain={p.isCaptain}
      vice={p.isViceCaptain}
      autoSub={p.autoSubIn}
      dimmed={p.multiplier === 0}
      onClick={() => setOpen(p.playerId)}
    />
  );

  return (
    <>
      <Pitch>
        {PITCH_ORDER.map((pos) => {
          const row = counted.filter((p) => p.position === pos);
          return (
            <PitchRow key={pos} count={row.length} label={POSITION_PLURAL[pos]}>
              {row.map(chip)}
            </PitchRow>
          );
        })}
      </Pitch>
      {bench.length > 0 && (
        <BenchTray note="Bench points don't count unless an auto-sub came on." items={bench.map((p) => ({ key: p.playerId, node: chip(p) }))} />
      )}

      <section aria-label="Every player" className="flex flex-col gap-2">
        <h2 className="font-heading text-[1.375rem] font-semibold">How each point was earned</h2>
        <ul className="rounded-xl bg-card shadow-card">
          {[...counted, ...bench].map((p) => (
            <li key={p.playerId} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => setOpen(p.playerId)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left">
                <PositionTag position={p.position} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold">
                    {p.displayName}
                    {p.isCaptain && " (C)"}
                    {p.isViceCaptain && " (V)"}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-muted-foreground">
                    {p.fixtureLabel ? `${p.fixtureLabel} · ${p.minutes}'` : "No match"}
                    {p.autoSubIn && " · auto-sub on"}
                    {p.autoSubOut && " · auto-subbed off"}
                    {p.multiplier === 0 && " · bench"}
                  </span>
                </span>
                <span className={cn("font-heading text-xl font-bold tabular-nums", p.multiplier === 0 && "text-muted-foreground")}>
                  {p.multiplier === 0 ? p.basePoints : p.totalPoints}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Drawer open={sheet !== undefined} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent>
          {sheet && <Breakdown p={sheet} provisional={points.provisional} matchday={points.matchdayNumber} />}
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** Design system §11.3 PointsBreakdown: each event with its points, the total in Oswald. */
function Breakdown({ p, provisional, matchday }: { p: PlayerPoints; provisional: boolean; matchday: number }) {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle>{p.displayName}</DrawerTitle>
        <DrawerDescription>
          {POSITION_LABEL[p.position]} · {p.fixtureLabel ? `${p.fixtureLabel} · ${p.minutes} min` : "No match this matchday"}
        </DrawerDescription>
      </DrawerHeader>
      <div className="px-4 pb-6">
        {p.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {p.fixtureLabel ? "Didn't play, so no points." : "Their team had no match this matchday."}
          </p>
        ) : (
          <table className="w-full text-[0.9375rem]">
            <caption className="sr-only">Points for {p.displayName}</caption>
            <thead className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="py-1 text-left">Event</th>
                <th scope="col" className="py-1 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((item) => (
                <tr key={item.key} className="border-t border-border">
                  <td className="py-2">
                    {item.label}
                    {item.count > 1 && <span className="text-muted-foreground"> × {item.count}</span>}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{formatSigned(item.points)}</td>
                </tr>
              ))}
              {p.multiplier > 1 && (
                <tr className="border-t border-border">
                  <td className="py-2">{p.isCaptain ? "Captain" : "Vice-captain (captain didn't play)"}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">×{p.multiplier}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {p.multiplier === 0 ? "On the bench, not counted" : "Total"}
            </p>
            {provisional && (
              <p className="text-xs text-muted-foreground">Provisional until Matchday {matchday} is finalised.</p>
            )}
          </div>
          <p className={cn("font-heading text-display font-bold tabular-nums", provisional && "text-muted-foreground")}>
            {p.multiplier === 0 ? p.basePoints : p.totalPoints}
          </p>
        </div>
      </div>
    </>
  );
}
