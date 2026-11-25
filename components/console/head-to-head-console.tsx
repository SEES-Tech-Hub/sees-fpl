"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Minus, Plus, Trophy, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { fromRecordInput, mergeEvents, type ConsoleEvent } from "@/lib/console/match-state";
import { aggregateScore, formatScore, sideName, sideYear, tieLabel } from "@/lib/live/display";
import type { HeadToHeadEvent } from "@/lib/live/queries";
import { subscribeToFixture, type ConnectionStatus } from "@/lib/live/realtime";
import type { LiveFixture, RecordEventInput, Side, TeamSummary } from "@/lib/live/types";
import { createClient } from "@/lib/supabase/client";
import { teamColour } from "@/lib/design/team-colour";
import { cn } from "@/lib/utils";
import {
  HolderBar,
  SendStatus,
  UNDO_FOR_MS,
  UndoBar,
  useThrottledRefresh,
  type ConsoleViewer,
  type LastAction,
} from "./console-app";
import { notify } from "./notify";
import { useConsoleQueue } from "./use-console-queue";

// The console for head-to-head games: board games, Mortal Kombat, CODM, EA FC
// and eFootball. Board games record each board (a win, or a draw); the other
// games add points one tap at a time. "End match" asks for the winner when a
// knockout is level (for a second leg, when the aggregate is level).
//
// Like the football console, the score shown is worked out on the phone from
// the server's events plus the ones waiting to send, so it keeps working with
// no signal (use-console-queue).

type FirstLeg = { homeScore: number | null; awayScore: number | null; homeTeamId: string | null; homeEntrant: string | null } | null;

const fromServer = (e: HeadToHeadEvent): ConsoleEvent => ({
  clientEventId: e.clientEventId,
  type: e.type,
  period: null,
  teamId: e.teamId,
  playerId: null,
  otherPlayerId: null,
  card: null,
  isPenalty: false,
  isOwnGoal: false,
  scored: null,
  points: e.points,
  side: e.side,
  board: e.board,
  occurredAt: e.occurredAt,
  pending: false,
});

type Command = Omit<Extract<RecordEventInput, { type: "point" }>, "fixtureId" | "clientEventId" | "occurredAt">
  | Omit<Extract<RecordEventInput, { type: "full_time" }>, "fixtureId" | "clientEventId" | "occurredAt">;

export function HeadToHeadConsole({
  fixture,
  events: serverEvents,
  firstLeg,
  viewer,
}: {
  fixture: LiveFixture;
  events: HeadToHeadEvent[];
  firstLeg: FirstLeg;
  viewer: ConsoleViewer;
}) {
  const home = fixture.home as TeamSummary;
  const away = fixture.away as TeamSummary;
  const sameYear = home.id === away.id;
  const boards = fixture.event.boards;
  const knockout = fixture.stage !== "league" && fixture.stage !== "group";
  const router = useRouter();
  const refresh = useThrottledRefresh(router.refresh);
  const queue = useConsoleQueue(fixture.id, { onSent: refresh });
  const [realtime, setRealtime] = useState<ConnectionStatus>("connecting");
  const [lastAction, setLastAction] = useState<(LastAction & { ids: string[] }) | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(
    () =>
      subscribeToFixture(createClient(), fixture.id, {
        onFixture: refresh,
        onEvent: refresh,
        onLineup: refresh,
        onStatus: setRealtime,
      }),
    [fixture.id, refresh],
  );
  const lostControl = queue.lostControl !== null;
  useEffect(() => {
    if (lostControl) refresh();
  }, [lostControl, refresh]);

  // ---------------------------------------------------------------------------
  // The match as this phone sees it
  // ---------------------------------------------------------------------------
  const queued = useMemo(
    () => queue.items.flatMap((i) => (i.kind === "event" ? [fromRecordInput(i.input, true)] : [])),
    [queue.items],
  );
  const events = useMemo(
    () => mergeEvents(serverEvents.map(fromServer), queue.confirmed, queued, queue.undone),
    [serverEvents, queue.confirmed, queued, queue.undone],
  );

  const sideOf = useCallback(
    (e: ConsoleEvent): Side => e.side ?? (e.teamId === home.id ? "home" : "away"),
    [home.id],
  );

  const match = useMemo(() => {
    let homeScore = 0;
    let awayScore = 0;
    let started = false;
    let finished = false;
    let winner: Side | null = null;
    const boardResults = new Map<number, { home: number; away: number; ids: string[] }>();
    for (const e of events) {
      if (e.type === "point") {
        started = true;
        const pts = e.points ?? 1;
        if (sideOf(e) === "home") homeScore += pts;
        else awayScore += pts;
        if (e.board) {
          const b = boardResults.get(e.board) ?? { home: 0, away: 0, ids: [] };
          if (sideOf(e) === "home") b.home += pts;
          else b.away += pts;
          b.ids.push(e.clientEventId);
          boardResults.set(e.board, b);
        }
      } else if (e.type === "full_time") {
        finished = true;
        winner = e.side ?? (e.teamId ? (e.teamId === home.id && !sameYear ? "home" : e.teamId === away.id && !sameYear ? "away" : null) : null);
      } else if (e.type === "walkover") {
        finished = true;
      }
    }
    if (finished && !winner) winner = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : null;
    return { homeScore, awayScore, started, finished: finished || fixture.status === "full_time" || fixture.status === "walkover", winner, boardResults };
  }, [events, sideOf, home.id, away.id, sameYear, fixture.status]);

  const aggregate = aggregateScore(
    { homeScore: match.homeScore, awayScore: match.awayScore, home, homeEntrant: fixture.homeEntrant },
    firstLeg,
  );
  const decidingScore = aggregate ?? { home: match.homeScore, away: match.awayScore };
  const needsWinner = knockout && fixture.leg !== 1 && decidingScore.home === decidingScore.away;
  const allBoardsIn = !boards || match.boardResults.size >= boards;

  const name = (side: Side) => sideName(fixture, side);
  const teamFor = (side: Side) => (side === "home" ? home : away);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const send = useCallback(
    (commands: Command[], label: string) => {
      const ids: string[] = [];
      for (const command of commands) {
        const clientEventId = crypto.randomUUID();
        const occurredAt = new Date().toISOString();
        const input = { ...command, fixtureId: fixture.id, clientEventId, occurredAt } as RecordEventInput;
        void queue.enqueue({ kind: "event", id: clientEventId, fixtureId: fixture.id, createdAt: occurredAt, label, input });
        ids.push(clientEventId);
      }
      setLastAction({ id: ids[ids.length - 1], ids, label, expiresAt: Date.now() + UNDO_FOR_MS });
    },
    [fixture.id, queue],
  );

  const point = (side: Side, points = 1, board?: number): Command => ({
    type: "point",
    teamId: teamFor(side).id,
    points,
    ...(sameYear ? { side } : {}),
    ...(board ? { board } : {}),
  });

  const recordBoard = (board: number, result: Side | "draw") => {
    if (result === "draw") send([point("home", 1, board), point("away", 1, board)], `Board ${board}: draw`);
    else send([point(result, 2, board)], `Board ${board}: ${name(result)} wins`);
  };

  const endMatch = (winnerSide: Side | null) => {
    const label = winnerSide ? `Full time: ${name(winnerSide)} wins` : "Full time";
    send(
      [
        {
          type: "full_time",
          ...(winnerSide ? { winnerTeamId: teamFor(winnerSide).id, ...(sameYear ? { winnerSide } : {}) } : {}),
        },
      ],
      label,
    );
    setEnding(false);
  };

  const undoLast = useCallback(() => {
    if (!lastAction) return;
    // Newest first: the server only lets the holder undo their latest event.
    for (const id of [...lastAction.ids].reverse()) void queue.undo(id, lastAction.label);
    notify.message(`Undone: ${lastAction.label}`);
    setLastAction(null);
  }, [lastAction, queue]);

  const canPlay = viewer.canRecord && !match.finished;
  const kicker = [fixture.event.name, tieLabel(fixture)].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-32">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 pt-2 pb-3 backdrop-blur">
        <p className="text-center text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{kicker}</p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <SideName fixture={fixture} side="home" team={home} won={match.finished && match.winner === "home"} />
          <div className="text-center" aria-live="polite" aria-atomic="true">
            <p className="font-heading text-4xl font-bold tabular-nums">
              {match.started || match.finished
                ? `${formatScore(match.homeScore, boards)}–${formatScore(match.awayScore, boards)}`
                : "v"}
            </p>
            {aggregate && (
              <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                Aggregate {aggregate.home}–{aggregate.away}
              </p>
            )}
          </div>
          <SideName fixture={fixture} side="away" team={away} won={match.finished && match.winner === "away"} />
        </div>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm">
          <span className={cn("font-semibold", match.started && !match.finished && "text-live")}>
            {match.finished ? (match.winner ? `Full time · ${name(match.winner)} won` : "Full time · draw") : match.started ? "In play" : "Not started"}
          </span>
          {realtime !== "live" && (
            <Badge variant="outline" className="gap-1">
              <Wifi aria-hidden className="size-3" />
              {realtime === "connecting" ? "Connecting" : "Reconnecting"}
            </Badge>
          )}
        </p>
      </header>

      {(viewer.canRecord || queue.items.length > 0) && <SendStatus queue={queue} />}
      <HolderBar viewer={viewer} fixtureId={fixture.id} waiting={queue.items.length} onTaken={queue.resume} />

      {boards ? (
        <section aria-label="Boards" className="flex flex-col gap-2">
          {Array.from({ length: boards }, (_, i) => i + 1).map((b) => {
            const r = match.boardResults.get(b);
            const done = !!r && r.home + r.away >= 2;
            const result = !r ? null : r.home === r.away ? "Draw" : `${name(r.home > r.away ? "home" : "away")} won`;
            return (
              <div key={b} className="rounded-xl bg-card p-3 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="font-heading text-lg font-bold">Board {b}</p>
                  {result && (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", done ? "bg-secondary text-brand" : "bg-highlight/30")}>
                      {result}
                    </span>
                  )}
                </div>
                {canPlay && !done && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Button className="h-14 flex-col gap-0 text-sm" onClick={() => recordBoard(b, "home")}>
                      <span className="max-w-full truncate">{name("home")}</span>
                      <span className="text-xs opacity-80">wins</span>
                    </Button>
                    <Button variant="outline" className="h-14 text-sm" onClick={() => recordBoard(b, "draw")}>
                      Draw
                    </Button>
                    <Button className="h-14 flex-col gap-0 text-sm" onClick={() => recordBoard(b, "away")}>
                      <span className="max-w-full truncate">{name("away")}</span>
                      <span className="text-xs opacity-80">wins</span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        canPlay && (
          <section aria-label="Score" className="grid grid-cols-2 gap-3">
            {(["home", "away"] as const).map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => send([point(side)], `+1 ${name(side)}`)}
                className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl text-team-foreground shadow-card transition-transform active:scale-95"
                style={{ background: teamColour(teamFor(side).year) }}
              >
                <Plus className="size-8" aria-hidden />
                <span className="max-w-full truncate px-2 font-heading text-xl font-bold">{name(side)}</span>
              </button>
            ))}
          </section>
        )
      )}

      {canPlay && (
        <Button
          size="lg"
          variant="outline"
          className="h-12 gap-2 text-base"
          disabled={!allBoardsIn}
          onClick={() => setEnding(true)}
        >
          <Flag className="size-5" aria-hidden />
          {allBoardsIn ? "End match" : `Enter all ${boards} boards first`}
        </Button>
      )}

      <EventLog events={events} name={name} sideOf={sideOf} boards={boards} />

      <Drawer open={ending} onOpenChange={setEnding} direction="bottom">
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{needsWinner ? "Who won?" : "End the match?"}</DrawerTitle>
            <DrawerDescription>
              {needsWinner
                ? fixture.leg === 2
                  ? `Level on aggregate (${decidingScore.home}–${decidingScore.away}). Pick who won after extra time or penalties.`
                  : `It's level at ${formatScore(match.homeScore, boards)}–${formatScore(match.awayScore, boards)}. A knockout needs a winner.`
                : `Final score ${formatScore(match.homeScore, boards)}–${formatScore(match.awayScore, boards)}.`}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            {needsWinner ? (
              (["home", "away"] as const).map((side) => (
                <Button key={side} size="lg" className="h-12 gap-2" onClick={() => endMatch(side)}>
                  <Trophy className="size-5" aria-hidden /> {name(side)} won
                </Button>
              ))
            ) : (
              <Button size="lg" className="h-12" onClick={() => endMatch(null)}>
                End match
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={() => setEnding(false)}>
              Keep playing
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {viewer.canRecord && lastAction && (
        <UndoBar key={lastAction.id} action={lastAction} onUndo={undoLast} onExpire={() => setLastAction(null)} />
      )}
    </div>
  );
}

function SideName({ fixture, side, team, won }: { fixture: LiveFixture; side: Side; team: TeamSummary; won: boolean }) {
  const year = sideYear(fixture, side);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", side === "home" ? "items-end text-right" : "items-start text-left")}>
      <span className="h-1.5 w-10 rounded-full" style={{ background: teamColour(team.year) }} aria-hidden />
      <p className={cn("max-w-full truncate font-heading text-xl font-bold", won && "text-brand")}>
        {won && <Trophy className="mr-1 inline size-4 align-[-2px]" aria-label="Winner" />}
        {sideName(fixture, side)}
      </p>
      {year && <p className="truncate text-xs text-muted-foreground">{year}</p>}
    </div>
  );
}

function EventLog({
  events,
  name,
  sideOf,
  boards,
}: {
  events: ConsoleEvent[];
  name: (side: Side) => string;
  sideOf: (e: ConsoleEvent) => Side;
  boards: number | null;
}) {
  const lines = events
    .filter((e) => e.type === "point" || e.type === "full_time")
    .map((e) => {
      if (e.type === "full_time") return { id: e.clientEventId, text: "Full time", pending: e.pending };
      if (boards && e.board) {
        const text = e.points === 2 ? `Board ${e.board}: ${name(sideOf(e))} wins` : `Board ${e.board}: ½ to ${name(sideOf(e))}`;
        return { id: e.clientEventId, text, pending: e.pending };
      }
      return { id: e.clientEventId, text: `+${e.points ?? 1} ${name(sideOf(e))}`, pending: e.pending };
    })
    .reverse();
  if (lines.length === 0) return null;
  return (
    <section aria-label="What's been recorded" className="rounded-xl bg-card shadow-card">
      <h2 className="border-b border-border px-3 py-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        Recorded
      </h2>
      <ul className="divide-y divide-border">
        {lines.map((l) => (
          <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <Minus className="size-3 text-muted-foreground" aria-hidden />
            <span className="flex-1">{l.text}</span>
            {l.pending && <span className="text-xs text-muted-foreground">Sending…</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
