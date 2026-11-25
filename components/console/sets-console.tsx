"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Flag, Plus, Trophy, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { teamColour } from "@/lib/design/team-colour";
import { fromRecordInput, mergeEvents, type ConsoleEvent } from "@/lib/console/match-state";
import { sideName, sideYear, tieLabel } from "@/lib/live/display";
import type { HeadToHeadEvent } from "@/lib/live/queries";
import { subscribeToFixture, type ConnectionStatus } from "@/lib/live/realtime";
import { foldSets, setIsWon, setTarget } from "@/lib/live/sets";
import type { LiveFixture, RecordEventInput, Side, TeamSummary } from "@/lib/live/types";
import { createClient } from "@/lib/supabase/client";
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

// The console for set sports: volleyball, badminton, table tennis and lawn
// tennis. +1 adds a point to the set being played; "End set" appears once the
// set is won under the event's rules (the database checks the same rules),
// and the match ends by itself when a side wins enough sets. The admin can
// end a match early (a retirement). Lawn tennis and table tennis singles name
// their players, and two from the same year can meet (each point says which
// side).

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

type Command =
  | Omit<Extract<RecordEventInput, { type: "point" }>, "fixtureId" | "clientEventId" | "occurredAt">
  | Omit<Extract<RecordEventInput, { type: "set_end" }>, "fixtureId" | "clientEventId" | "occurredAt">
  | Omit<Extract<RecordEventInput, { type: "full_time" }>, "fixtureId" | "clientEventId" | "occurredAt">;

export function SetsConsole({
  fixture,
  events: serverEvents,
  viewer,
}: {
  fixture: LiveFixture;
  events: HeadToHeadEvent[];
  viewer: ConsoleViewer;
}) {
  const home = fixture.home as TeamSummary;
  const away = fixture.away as TeamSummary;
  const sameYear = home.id === away.id;
  const rules = fixture.event;
  const router = useRouter();
  const refresh = useThrottledRefresh(router.refresh);
  const queue = useConsoleQueue(fixture.id, { onSent: refresh });
  const [realtime, setRealtime] = useState<ConnectionStatus>("connecting");
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [retiring, setRetiring] = useState(false);

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

  const queued = useMemo(
    () => queue.items.flatMap((i) => (i.kind === "event" ? [fromRecordInput(i.input, true)] : [])),
    [queue.items],
  );
  const events = useMemo(
    () => mergeEvents(serverEvents.map(fromServer), queue.confirmed, queued, queue.undone),
    [serverEvents, queue.confirmed, queued, queue.undone],
  );
  const sideOf = useCallback((e: ConsoleEvent): Side => e.side ?? (e.teamId === home.id ? "home" : "away"), [home.id]);

  const sets = useMemo(
    () => foldSets(events.filter((e) => e.type === "point" || e.type === "set_end").map((e) => ({ type: e.type, side: sideOf(e), points: e.points })), rules),
    [events, sideOf, rules],
  );
  const retired = events.find((e) => e.type === "full_time");
  const finished = sets.over || !!retired || fixture.status === "full_time" || fixture.status === "walkover";
  const winner: Side | null = retired ? (retired.side ?? (retired.teamId === home.id && !sameYear ? "home" : retired.teamId ? "away" : null)) : sets.winner;
  const target = setTarget(rules, sets.current.number);
  const setWon = setIsWon(sets.current.home, sets.current.away, target, rules.setWinBy, rules.setPointsCap);
  const setLeader: Side | null = sets.current.home > sets.current.away ? "home" : sets.current.away > sets.current.home ? "away" : null;
  const configured = rules.setPoints !== null;

  const name = (side: Side) => sideName(fixture, side);
  const teamFor = (side: Side) => (side === "home" ? home : away);

  const send = useCallback(
    (command: Command, label: string) => {
      const clientEventId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();
      const input = { ...command, fixtureId: fixture.id, clientEventId, occurredAt } as RecordEventInput;
      void queue.enqueue({ kind: "event", id: clientEventId, fixtureId: fixture.id, createdAt: occurredAt, label, input });
      setLastAction({ id: clientEventId, label, expiresAt: Date.now() + UNDO_FOR_MS });
    },
    [fixture.id, queue],
  );

  const addPoint = (side: Side) =>
    send({ type: "point", teamId: teamFor(side).id, ...(sameYear ? { side } : {}) }, `+1 ${name(side)} (set ${sets.current.number})`);

  const endSet = () => send({ type: "set_end" }, `Set ${sets.current.number} to ${setLeader ? name(setLeader) : "?"}, ${sets.current.home}–${sets.current.away}`);

  const retire = (winnerSide: Side) => {
    send(
      { type: "full_time", winnerTeamId: teamFor(winnerSide).id, ...(sameYear ? { winnerSide } : {}) },
      `Ended early: ${name(winnerSide)} wins`,
    );
    setRetiring(false);
  };

  const undoLast = useCallback(() => {
    if (!lastAction) return;
    void queue.undo(lastAction.id, lastAction.label);
    notify.message(`Undone: ${lastAction.label}`);
    setLastAction(null);
  }, [lastAction, queue]);

  const canPlay = viewer.canRecord && !finished && configured;
  const kicker = [fixture.event.name, tieLabel(fixture)].filter(Boolean).join(" · ");
  const bestOf = 2 * (rules.setsToWin ?? 1) - 1;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-32">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 pt-2 pb-3 backdrop-blur">
        <p className="text-center text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {kicker} · best of {bestOf}
        </p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <SideHeader fixture={fixture} side="home" team={home} won={finished && winner === "home"} />
          <div className="text-center" aria-live="polite" aria-atomic="true">
            <p className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Sets</p>
            <p className="font-heading text-4xl font-bold tabular-nums">
              {sets.home}–{sets.away}
            </p>
          </div>
          <SideHeader fixture={fixture} side="away" team={away} won={finished && winner === "away"} />
        </div>
        <ol className="mt-2 flex flex-wrap justify-center gap-1.5" aria-label="Set scores">
          {sets.sets.map((s) => (
            <li
              key={s.number}
              className={cn(
                "rounded-md px-2 py-0.5 font-heading text-sm font-bold tabular-nums",
                s.closed ? "bg-secondary text-brand" : "bg-live/10 text-live",
              )}
            >
              {s.home}–{s.away}
            </li>
          ))}
        </ol>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm">
          <span className={cn("font-semibold", !finished && events.length > 0 && "text-live")}>
            {finished ? (winner ? `Match over · ${name(winner)} won` : "Match over") : events.length > 0 ? `Set ${sets.current.number}` : "Not started"}
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

      {viewer.canRecord && !configured && (
        <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
          This event has no set rules yet. Ask the admin to set them in Admin → Sports.
        </p>
      )}

      {canPlay && (
        <>
          <section aria-label={`Set ${sets.current.number}`} className="grid grid-cols-2 gap-3">
            {(["home", "away"] as const).map((side) => (
              <button
                key={side}
                type="button"
                disabled={setWon && !viewer.isAdmin}
                onClick={() => addPoint(side)}
                className="flex h-36 flex-col items-center justify-center gap-1 rounded-2xl text-team-foreground shadow-card transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: teamColour(teamFor(side).year) }}
              >
                <span className="font-heading text-5xl leading-none font-bold tabular-nums">
                  {side === "home" ? sets.current.home : sets.current.away}
                </span>
                <span className="flex items-center gap-1 font-heading text-lg font-bold">
                  <Plus className="size-5" aria-hidden />
                  <span className="max-w-[8rem] truncate">{name(side)}</span>
                </span>
              </button>
            ))}
          </section>
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Set {sets.current.number} to {target ?? "?"}
            {rules.setWinBy && rules.setWinBy > 1 ? `, win by ${rules.setWinBy}` : ""}
            {rules.setPointsCap ? `, ${rules.setPointsCap} wins outright` : ""}
          </p>
          {setWon && setLeader && (
            <Button size="lg" className="h-14 gap-2 text-base" onClick={endSet}>
              <CircleCheck className="size-5" aria-hidden />
              End set {sets.current.number}: {name(setLeader)} wins it {sets.current.home}–{sets.current.away}
            </Button>
          )}
          {viewer.isAdmin && (
            <Button variant="outline" className="gap-2" onClick={() => setRetiring(true)}>
              <Flag className="size-4" aria-hidden /> End early (retirement)
            </Button>
          )}
        </>
      )}

      <Drawer open={retiring} onOpenChange={setRetiring} direction="bottom">
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>End the match early?</DrawerTitle>
            <DrawerDescription>For a retirement or injury. Pick who wins.</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            {(["home", "away"] as const).map((side) => (
              <Button key={side} size="lg" className="h-12 gap-2" onClick={() => retire(side)}>
                <Trophy className="size-5" aria-hidden /> {name(side)} wins
              </Button>
            ))}
            <Button variant="ghost" size="lg" onClick={() => setRetiring(false)}>
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

function SideHeader({ fixture, side, team, won }: { fixture: LiveFixture; side: Side; team: TeamSummary; won: boolean }) {
  const year = sideYear(fixture, side);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", side === "home" ? "items-end text-right" : "items-start text-left")}>
      <span className="h-1.5 w-10 rounded-full" style={{ background: teamColour(team.year) }} aria-hidden />
      <p className={cn("max-w-full truncate font-heading text-xl font-bold", won && "text-brand")}>
        {won && <Trophy className="mr-1 inline size-4 align-[-2px]" aria-label="Winner" />}
        {sideName(fixture, side)}
      </p>
      <p className="truncate text-xs text-muted-foreground">{year ?? team.name}</p>
    </div>
  );
}
