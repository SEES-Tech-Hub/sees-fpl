"use client";

import { useState } from "react";
import { ArrowLeftRight, CircleSlash, Crown, Goal, ListChecks, RectangleVertical, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import type { Controls, MatchState, PeriodButton } from "@/lib/console/match-state";
import type { SquadPlayer } from "@/lib/console/squad";
import type { SetLineupInput, TeamSummary } from "@/lib/live/types";
import { KICKOFF_OPENS_BEFORE_MS } from "@/lib/live/kickoff-window";
import { cn, formatWAT } from "@/lib/utils";
import {
  CardSheet,
  GoalSheet,
  MotmSheet,
  PenaltySheet,
  SubSheet,
  type EventCommand,
  type SheetContext,
} from "./event-sheets";
import { LineupSheet } from "./lineup-sheet";

// Owner: Samuel (console). The buttons for the phase the match is in. Big,
// stacked, and low on the screen so they work one-handed.

type OpenSheet =
  | { kind: "goal"; teamId: string }
  | { kind: "card" }
  | { kind: "sub" }
  | { kind: "penalty" }
  | { kind: "motm" }
  | { kind: "lineup"; teamId: string };

const BIG = "h-16 text-base font-semibold";

export function ConsoleControls({
  state,
  controls,
  home,
  away,
  squads,
  record,
  saveLineup,
  startersFor,
  motmName,
  teamOnly = false,
  pointValues = [1],
  kickoffAt = null,
}: {
  state: MatchState;
  controls: Controls;
  home: TeamSummary;
  away: TeamSummary;
  squads: SquadPlayer[];
  record: (command: EventCommand, label?: string) => void;
  saveLineup: (input: Omit<SetLineupInput, "fixtureId">) => void;
  startersFor: (teamId: string) => string[] | null;
  motmName: string | null;
  /** No player lists (sports other than men's football): goals by team, no cards, subs or MOTM. */
  teamOnly?: boolean;
  /** Team-only scoring: the values to offer (basketball 1, 2, 3). */
  pointValues?: number[];
  /** The scheduled start. Kick-off opens 2 hours before it (the database enforces the same). */
  kickoffAt?: string | null;
}) {
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [confirmKickoff, setConfirmKickoff] = useState(false);
  const [tooEarly, setTooEarly] = useState(false);
  const close = () => setSheet(null);
  const ctx: SheetContext = { state, home, away, squads, record: (c) => record(c), close };

  const missingLineups = [
    !state.hasLineup.home ? home.shortName : null,
    !state.hasLineup.away ? away.shortName : null,
  ].filter((n): n is string => n !== null);

  // Starting the match is the one tap that tells everyone following it, so it
  // always takes a second tap, and it waits until 2 hours before the start.
  function periodButton(button: PeriodButton, index: number) {
    const isKickoff = button.command.type === "period_start" && controls.phase === "not_started";
    return (
      <Button
        key={button.key}
        variant={index === 0 ? "default" : "outline"}
        className={cn(BIG, "w-full")}
        onClick={() => {
          if (isKickoff) {
            if (kickoffAt && Date.now() < new Date(kickoffAt).getTime() - KICKOFF_OPENS_BEFORE_MS) {
              setTooEarly(true);
              return;
            }
            if (!confirmKickoff) {
              setConfirmKickoff(true);
              return;
            }
          }
          setConfirmKickoff(false);
          record(button.command, button.label);
        }}
      >
        {isKickoff && confirmKickoff ? "Tap again to kick off" : button.label}
      </Button>
    );
  }

  return (
    <section aria-label="Match controls" className="flex flex-col gap-3">
      {teamOnly && controls.canGoal && (
        <div className="flex flex-col gap-3" aria-label="Score">
          {[home, away].map((team) => (
            <div key={team.id} className={cn("grid gap-2", pointValues.length > 1 ? "grid-cols-[4rem_repeat(3,1fr)] items-center" : "")}>
              {pointValues.length > 1 && <span className="font-heading text-lg font-semibold">{team.shortName}</span>}
              {pointValues.map((v) => (
                <Button
                  key={v}
                  className={cn(BIG, pointValues.length > 1 ? "h-16 text-xl" : "h-20")}
                  onClick={() =>
                    record({ type: "goal", teamId: team.id, points: v as 1 | 2 | 3 }, pointValues.length > 1 ? `+${v} ${team.shortName}` : `Goal ${team.shortName}`)
                  }
                >
                  {pointValues.length > 1 ? (
                    `+${v}`
                  ) : (
                    <>
                      <Goal aria-hidden className="size-5" />
                      Goal {team.shortName}
                    </>
                  )}
                </Button>
              ))}
            </div>
          ))}
        </div>
      )}

      {!teamOnly && controls.phase === "not_started" && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Lineup check</h2>
          <div className="grid grid-cols-2 gap-3">
            {[home, away].map((team) => {
              const starters = startersFor(team.id);
              return (
                <Button
                  key={team.id}
                  variant="outline"
                  className={cn(BIG, "flex-col gap-0")}
                  onClick={() => setSheet({ kind: "lineup", teamId: team.id })}
                >
                  <span className="flex items-center gap-1.5">
                    <ListChecks aria-hidden />
                    {team.shortName}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {starters ? `${starters.length} starting` : "Not set"}
                  </span>
                </Button>
              );
            })}
          </div>
          {confirmKickoff && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              No team sheet for {missingLineups.join(" or ")} yet. Tap the team above and tick who starts: fantasy
              uses it for appearance and 30-minute points and clean sheets. You can still kick off; anyone you record
              counts as having played.
            </p>
          )}
        </div>
      )}

      {!teamOnly && (controls.canGoal || controls.canCard || controls.canSub || controls.canPenaltyMiss) && (
        <div className="grid grid-cols-2 gap-3">
          {controls.canGoal &&
            [home, away].map((team) => (
              <Button key={team.id} className={cn(BIG, "h-20")} onClick={() => setSheet({ kind: "goal", teamId: team.id })}>
                <Goal aria-hidden className="size-5" />
                Goal {team.shortName}
              </Button>
            ))}
          {controls.canCard && (
            <Button variant="outline" className={BIG} onClick={() => setSheet({ kind: "card" })}>
              <RectangleVertical aria-hidden className="size-5 fill-highlight text-highlight" />
              Card
            </Button>
          )}
          {controls.canSub && (
            <Button variant="outline" className={BIG} onClick={() => setSheet({ kind: "sub" })}>
              <ArrowLeftRight aria-hidden className="size-5" />
              Sub
            </Button>
          )}
          {controls.canPenaltyMiss && (
            <Button variant="outline" className={cn(BIG, "col-span-2")} onClick={() => setSheet({ kind: "penalty" })}>
              <CircleSlash aria-hidden className="size-5" />
              Penalty missed or saved
            </Button>
          )}
        </div>
      )}

      {controls.canShootout && (
        <div className="flex flex-col gap-2" aria-label="Penalty shootout">
          <h2 className="text-sm font-medium text-muted-foreground">Penalty shootout</h2>
          {[home, away].map((team) => (
            <div key={team.id} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2">
              <span className="font-heading text-lg font-semibold">{team.shortName}</span>
              <Button
                className={BIG}
                onClick={() => record({ type: "shootout_kick", teamId: team.id, scored: true })}
              >
                Scored
              </Button>
              <Button
                variant="outline"
                className={BIG}
                onClick={() => record({ type: "shootout_kick", teamId: team.id, scored: false })}
              >
                Missed
              </Button>
            </div>
          ))}
        </div>
      )}

      {controls.periodButtons.length > 0 && (
        <div className="flex flex-col gap-2">
          {controls.periodButtons.map(periodButton)}
          {tooEarly && kickoffAt && (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              Too early. This match starts {formatWAT(kickoffAt, "datetime")}, and kick-off opens 2 hours before. If the time
              has changed, update it in Admin → Fixtures first.
            </p>
          )}
          {confirmKickoff && (
            <div role="alert" className="flex items-center gap-3 rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
              <p className="flex-1">This starts the match clock and sends a kick-off alert to everyone following it.</p>
              <Button size="sm" variant="ghost" onClick={() => setConfirmKickoff(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {controls.phase === "finished" && teamOnly && (
        <p className="rounded-lg bg-secondary p-4 text-center text-secondary-foreground">Full time. The result is in.</p>
      )}

      {controls.phase === "finished" &&
        !teamOnly &&
        (controls.canMotm ? (
          <Button className={cn(BIG, "w-full")} onClick={() => setSheet({ kind: "motm" })}>
            <Crown aria-hidden className="size-5" />
            Pick Man of the Match
          </Button>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-lg bg-secondary p-4 text-secondary-foreground">
            <Crown aria-hidden className="size-5" />
            Man of the Match: <strong>{motmName ?? "picked"}</strong>
          </p>
        ))}

      {controls.phase === "closed" && (
        <p className="rounded-lg bg-muted p-4 text-center text-muted-foreground">
          This match can&apos;t be recorded: it&apos;s {state.status.replace("_", " ")}.
        </p>
      )}

      <Drawer open={sheet !== null} onOpenChange={(open) => !open && close()}>
        {sheet?.kind === "goal" && <GoalSheet key={sheet.teamId} ctx={ctx} teamId={sheet.teamId} />}
        {sheet?.kind === "card" && <CardSheet ctx={ctx} />}
        {sheet?.kind === "sub" && <SubSheet ctx={ctx} />}
        {sheet?.kind === "penalty" && <PenaltySheet ctx={ctx} />}
        {sheet?.kind === "motm" && <MotmSheet ctx={ctx} />}
        {sheet?.kind === "lineup" && (
          <LineupSheet
            key={sheet.teamId}
            team={sheet.teamId === home.id ? home : away}
            squad={squads.filter((p) => p.teamId === sheet.teamId)}
            currentStarters={startersFor(sheet.teamId)}
            onSave={saveLineup}
            close={close}
          />
        )}
      </Drawer>
    </section>
  );
}
