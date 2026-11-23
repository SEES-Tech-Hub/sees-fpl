"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notify } from "./notify";
import { CloudOff, Loader2, ShieldAlert, Undo2, Wifi } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  availableControls,
  deriveMatchState,
  fromRecordInput,
  fromTimelineEntry,
  mergeEvents,
  type ConsoleEvent,
  type LineupEntry,
} from "@/lib/console/match-state";
import type { SquadPlayer } from "@/lib/console/squad";
import { releaseFixture, takeFixture } from "@/lib/live/actions";
import { getClockState, msUntilNextMinute, type ClockFixture } from "@/lib/live/clock";
import { subscribeToFixture, type ConnectionStatus } from "@/lib/live/realtime";
import type { LineupPlayer, LiveFixture, RecordEventInput, SetLineupInput, TeamSummary, TimelineEntry } from "@/lib/live/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ConsoleControls } from "./controls";
import { describeEvent, type Names } from "./describe";
import type { EventCommand } from "./event-sheets";
import { useConsoleQueue } from "./use-console-queue";

// Owner: Samuel (console app). Bolu owns the API underneath (lib/live).
//
// One screen for the whole match. The state shown (score, period, who's on
// the pitch) is worked out on the phone from the server's events plus the
// ones waiting to send, so the console keeps working with no signal. See
// lib/console/match-state.ts and lib/console/queue.ts.

export type ConsoleViewer = {
  signedIn: boolean;
  /** This account is the fixture's console holder. */
  isHolder: boolean;
  /** Holder or admin: show the controls. */
  canRecord: boolean;
  isAdmin: boolean;
  /** An official, and nobody holds the match. */
  canTake: boolean;
  heldBySomeoneElse: boolean;
};

const UNDO_FOR_MS = 10_000;

type LastAction = { id: string; label: string; expiresAt: number };

export function ConsoleApp({
  fixture,
  timeline,
  lineups,
  squads,
  viewer,
}: {
  fixture: LiveFixture;
  timeline: TimelineEntry[];
  lineups: LineupPlayer[];
  squads: SquadPlayer[];
  viewer: ConsoleViewer;
}) {
  const home = fixture.home as TeamSummary;
  const away = fixture.away as TeamSummary;
  const router = useRouter();
  const refresh = useThrottledRefresh(router.refresh);
  const queue = useConsoleQueue(fixture.id, { onSent: refresh });
  const [realtime, setRealtime] = useState<ConnectionStatus>("connecting");
  const [lastAction, setLastAction] = useState<LastAction | null>(null);

  // Live updates from the server: other consoles, the admin, our own sends.
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

  // Lost the match: reload who holds it, so the holder bar tells the truth.
  const lostControl = queue.lostControl !== null;
  useEffect(() => {
    if (lostControl) refresh();
  }, [lostControl, refresh]);

  // ---------------------------------------------------------------------------
  // The match as this phone sees it
  // ---------------------------------------------------------------------------

  const names = useMemo<Names>(() => {
    const players = new Map(squads.map((p) => [p.id, p.name]));
    for (const e of timeline) {
      if (e.playerId && e.playerName) players.set(e.playerId, e.playerName);
      if (e.otherPlayerId && e.otherPlayerName) players.set(e.otherPlayerId, e.otherPlayerName);
    }
    return {
      player: (id) => (id ? (players.get(id) ?? null) : null),
      team: (id) => (id === home.id ? home.shortName : id === away.id ? away.shortName : ""),
    };
  }, [squads, timeline, home, away]);

  const queuedEvents = useMemo(
    () => queue.items.flatMap((i) => (i.kind === "event" ? [fromRecordInput(i.input, true)] : [])),
    [queue.items],
  );

  const lineupEntries = useMemo<LineupEntry[]>(() => {
    // Per team, newest first: waiting to send, sent this session, then the server's.
    const byTeam = new Map<string, LineupEntry[]>();
    const fromInput = (input: SetLineupInput): LineupEntry[] => [
      ...input.starters.map((playerId) => ({ playerId, teamId: input.teamId, role: "starter" as const })),
      ...input.bench.map((playerId) => ({ playerId, teamId: input.teamId, role: "bench" as const })),
    ];
    for (const p of lineups) {
      byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), { playerId: p.playerId, teamId: p.teamId, role: p.role }]);
    }
    for (const input of queue.confirmedLineups) byTeam.set(input.teamId, fromInput(input));
    for (const item of queue.items) if (item.kind === "lineup") byTeam.set(item.input.teamId, fromInput(item.input));
    return [...byTeam.values()].flat();
  }, [lineups, queue.confirmedLineups, queue.items]);

  const events = useMemo(
    () => mergeEvents(timeline.map(fromTimelineEntry), queue.confirmed, queuedEvents, queue.undone),
    [timeline, queue.confirmed, queuedEvents, queue.undone],
  );

  const state = useMemo(
    () =>
      deriveMatchState({
        homeTeamId: home.id,
        awayTeamId: away.id,
        isKnockout: fixture.stage !== "league",
        serverStatus: fixture.status,
        lineups: lineupEntries,
        events,
      }),
    [home.id, away.id, fixture.stage, fixture.status, lineupEntries, events],
  );
  const controls = availableControls(state);

  const clockFixture = useMemo<ClockFixture>(
    () => ({
      status: state.status,
      currentPeriod: state.currentPeriod,
      periodStartedAt: state.periodStartedAt,
      periodMinutes: fixture.event.periodMinutes,
      extraPeriodMinutes: fixture.event.extraPeriodMinutes,
    }),
    [state.status, state.currentPeriod, state.periodStartedAt, fixture.event.periodMinutes, fixture.event.extraPeriodMinutes],
  );
  const clockLabel = useClockLabel(clockFixture);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const record = useCallback(
    (command: EventCommand, label?: string) => {
      const clientEventId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();
      const input = { ...command, fixtureId: fixture.id, clientEventId, occurredAt } as RecordEventInput;
      const text = label ?? describeEvent(fromRecordInput(input, true), names);
      const clock = getClockState(clockFixture);
      const minute = clock.kind === "running" ? `${clock.label} ` : "";
      const full = `${minute}${text}`;
      void queue.enqueue({ kind: "event", id: clientEventId, fixtureId: fixture.id, createdAt: occurredAt, label: full, input });
      setLastAction({ id: clientEventId, label: full, expiresAt: Date.now() + UNDO_FOR_MS });
    },
    [fixture.id, names, clockFixture, queue],
  );

  const saveLineup = useCallback(
    (input: Omit<SetLineupInput, "fixtureId">) => {
      const team = input.teamId === home.id ? home.shortName : away.shortName;
      void queue.enqueue({
        kind: "lineup",
        id: crypto.randomUUID(),
        fixtureId: fixture.id,
        createdAt: new Date().toISOString(),
        label: `Lineup ${team}`,
        input: { ...input, fixtureId: fixture.id },
      });
      // No toast: the lineup button now says "7 starting", and a toast would cover the score.
    },
    [fixture.id, home, away, queue],
  );

  const startersFor = useCallback(
    (teamId: string) => {
      const starters = lineupEntries.filter((p) => p.teamId === teamId && p.role === "starter").map((p) => p.playerId);
      return starters.length > 0 ? starters : null;
    },
    [lineupEntries],
  );

  const undoLast = useCallback(() => {
    if (!lastAction) return;
    void queue.undo(lastAction.id, lastAction.label);
    notify.message(`Undone: ${lastAction.label}`);
    setLastAction(null);
  }, [lastAction, queue]);

  // ---------------------------------------------------------------------------

  const hasLiveScore = state.status !== "scheduled" && state.status !== "postponed" && state.status !== "cancelled";

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-32">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 pt-2 pb-3 backdrop-blur">
        <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {fixture.event.name}
          {fixture.stage !== "league" && ` · ${fixture.stage.replace("_", " ")}`}
        </p>
        <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamName team={home} align="right" />
          <div className="text-center" aria-live="polite" aria-atomic="true">
            <p className="font-heading text-4xl font-semibold tabular-nums">
              {hasLiveScore ? `${state.homeScore}–${state.awayScore}` : "v"}
            </p>
            {state.homeShootout !== null && (
              <p className="text-sm text-muted-foreground tabular-nums">
                Pens {state.homeShootout}–{state.awayShootout}
              </p>
            )}
          </div>
          <TeamName team={away} align="left" />
        </div>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm">
          <span
            className={cn("font-semibold tabular-nums", state.status === "live" && "text-live")}
            suppressHydrationWarning
          >
            {clockLabel}
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

      {viewer.canRecord && (
        <ConsoleControls
          state={state}
          controls={controls}
          home={home}
          away={away}
          squads={squads}
          record={record}
          saveLineup={saveLineup}
          startersFor={startersFor}
          motmName={names.player(state.motmPlayerId)}
        />
      )}

      <Timeline events={events} timeline={timeline} queueItems={queue.items} names={names} />

      <Lineups home={home} away={away} entries={lineupEntries} state={state} names={names} />

      {viewer.canRecord && lastAction && (
        <UndoBar key={lastAction.id} action={lastAction} onUndo={undoLast} onExpire={() => setLastAction(null)} />
      )}
    </div>
  );
}

function TeamName({ team, align }: { team: TeamSummary; align: "left" | "right" }) {
  return (
    <div className={cn("min-w-0", align === "right" ? "text-right" : "text-left")}>
      <p className="font-heading text-2xl font-semibold">{team.shortName}</p>
      <p className="truncate text-xs text-muted-foreground">{team.name}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sending status and the lost-control banner
// -----------------------------------------------------------------------------

function SendStatus({ queue }: { queue: ReturnType<typeof useConsoleQueue> }) {
  const waiting = queue.items.length;

  if (queue.lostControl) {
    return (
      <Alert variant="destructive" role="alert">
        <ShieldAlert aria-hidden />
        <AlertTitle>You&apos;re no longer recording this match</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>{queue.lostControl.error.message}</p>
          {waiting > 0 && (
            <>
              <p>
                {waiting} {waiting === 1 ? "action was" : "actions were"} not sent:
              </p>
              <ul className="list-disc pl-5">
                {queue.items.map((i) => (
                  <li key={i.id}>{i.label}</li>
                ))}
              </ul>
              <p>Tell the admin or the new holder, or take the match again and send them.</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={queue.resume}>
              Try again
            </Button>
            {waiting > 0 && (
              <Button variant="destructive" onClick={() => void queue.discardAll()}>
                Discard {waiting === 1 ? "it" : `all ${waiting}`}
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (!queue.persistent) {
    return (
      <p role="status" className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">
        This browser can&apos;t store actions on the phone (private mode?). Actions waiting to send will be lost if
        the page closes.
      </p>
    );
  }

  if (waiting === 0) {
    return (
      <p role="status" className="sr-only">
        All actions sent
      </p>
    );
  }

  const sending = queue.sendState === "sending";
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-highlight bg-highlight/15 p-3 text-sm"
    >
      {sending ? <Loader2 aria-hidden className="size-5 shrink-0 animate-spin" /> : <CloudOff aria-hidden className="size-5 shrink-0" />}
      <div className="flex-1">
        <p className="font-semibold">
          {waiting} {waiting === 1 ? "action" : "actions"} waiting to send
        </p>
        <p className="text-muted-foreground">
          {sending
            ? "Sending…"
            : queue.sendState === "offline"
              ? "No connection. They'll send in order when you're back online. Keep this page open."
              : (queue.lastError?.message ?? "Couldn't reach the server. Trying again…")}
        </p>
      </div>
      {!sending && (
        <Button size="sm" variant="outline" onClick={() => void queue.retryNow()}>
          Retry
        </Button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Take this match / Hand over
// -----------------------------------------------------------------------------

function HolderBar({
  viewer,
  fixtureId,
  waiting,
  onTaken,
}: {
  viewer: ConsoleViewer;
  fixtureId: string;
  waiting: number;
  onTaken: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run(action: typeof takeFixture, success: string, after?: () => void) {
    setBusy(true);
    try {
      const result = await action(fixtureId);
      if (!result.ok) {
        notify.error(result.error.message);
        return;
      }
      notify.success(success);
      after?.();
      router.refresh();
    } catch {
      notify.error("No connection. Try again when you're back online.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (viewer.isHolder) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
        <p className="flex-1">
          {confirming
            ? waiting > 0
              ? "Wait until every action has sent, then hand over."
              : "Hand over? Another official can then take this match."
            : "You're recording this match."}
        </p>
        {confirming ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || waiting > 0}
              onClick={() => void run(releaseFixture, "Handed over. Another official can take the match now.")}
            >
              Hand over
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
            Hand over
          </Button>
        )}
      </div>
    );
  }

  if (viewer.canTake) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <p className="text-sm text-muted-foreground">Nobody is recording this match.</p>
        <Button
          className="h-14 text-base"
          disabled={busy}
          onClick={() => void run(takeFixture, "You're recording this match.", onTaken)}
        >
          Take this match
        </Button>
      </div>
    );
  }

  if (viewer.canRecord) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        You&apos;re recording as the admin{viewer.heldBySomeoneElse ? " (another official holds this match)" : ""}.
      </p>
    );
  }

  return (
    <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      Read only.{" "}
      {viewer.heldBySomeoneElse
        ? "Another official is recording this match."
        : "Only officials can record matches."}
      {!viewer.signedIn && (
        <>
          {" "}
          <Link href={`/login?next=/console/${fixtureId}`} className="font-medium text-primary underline">
            Sign in
          </Link>
        </>
      )}
    </p>
  );
}

// -----------------------------------------------------------------------------
// Undo
// -----------------------------------------------------------------------------

function UndoBar({ action, onUndo, onExpire }: { action: LastAction; onUndo: () => void; onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.ceil((action.expiresAt - Date.now()) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = Math.ceil((action.expiresAt - Date.now()) / 1000);
      if (left <= 0) onExpire();
      else setSecondsLeft(left);
    }, 250);
    return () => window.clearInterval(timer);
  }, [action.expiresAt, onExpire]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        className="flex w-full max-w-lg items-center gap-3 rounded-xl bg-foreground p-3 text-background shadow-lg"
      >
        <p className="min-w-0 flex-1 truncate text-sm">{action.label}</p>
        <Button variant="secondary" className="h-12 shrink-0 px-5 text-base" onClick={onUndo}>
          <Undo2 aria-hidden />
          Undo ({secondsLeft})
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Timeline and lineups
// -----------------------------------------------------------------------------

function Timeline({
  events,
  timeline,
  queueItems,
  names,
}: {
  events: ConsoleEvent[];
  timeline: TimelineEntry[];
  queueItems: ReturnType<typeof useConsoleQueue>["items"];
  names: Names;
}) {
  const server = new Map(timeline.map((e) => [e.clientEventId, e]));
  const queuedLabels = new Map(queueItems.map((i) => [i.id, i.label]));
  const rows = [...events].reverse();

  return (
    <section aria-label="Timeline" className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold">Timeline</h2>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>}
      <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {rows.map((event) => {
          const entry = server.get(event.clientEventId);
          const minute = entry?.minute != null ? (entry.addedMinutes ? `${entry.minute}+${entry.addedMinutes}'` : `${entry.minute}'`) : "";
          const text = entry
            ? describeEvent(fromTimelineEntry(entry), {
                ...names,
                player: (id) =>
                  names.player(id) ??
                  (id === entry.playerId ? entry.playerName : id === entry.otherPlayerId ? entry.otherPlayerName : null),
              })
            : (queuedLabels.get(event.clientEventId) ?? describeEvent(event, names));
          return (
            <li key={event.clientEventId} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">{minute}</span>
              <span className="flex-1">{text}</span>
              {event.pending && (
                <Badge variant="outline" className="shrink-0">
                  Waiting
                </Badge>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Lineups({
  home,
  away,
  entries,
  state,
  names,
}: {
  home: TeamSummary;
  away: TeamSummary;
  entries: LineupEntry[];
  state: ReturnType<typeof deriveMatchState>;
  names: Names;
}) {
  if (entries.length === 0) return null;
  return (
    <section aria-label="Lineups" className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-semibold">Lineups</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[home, away].map((team) => (
          <div key={team.id} className="flex flex-col gap-1">
            <p className="font-semibold">{team.shortName}</p>
            {entries
              .filter((e) => e.teamId === team.id)
              .map((e) => {
                const p = state.players.get(e.playerId);
                return (
                  <p
                    key={e.playerId}
                    className={cn(
                      "flex items-center gap-1",
                      !p?.onPitch && "text-muted-foreground",
                      p?.sentOff && "line-through",
                    )}
                  >
                    <span className="truncate">{names.player(e.playerId) ?? "Player"}</span>
                    {p && p.yellowCards > 0 && !p.sentOff && (
                      <span aria-label="yellow card" className="inline-block h-3 w-2 shrink-0 rounded-xs bg-highlight" />
                    )}
                    {p?.sentOff && <span aria-label="sent off" className="inline-block h-3 w-2 shrink-0 rounded-xs bg-live" />}
                  </p>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

/** The clock label, re-rendered when the minute changes (not every second). */
function useClockLabel(clock: ClockFixture): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Catch up straight away when the period changes, then once a minute.
    const stale = Math.abs(Date.now() - now) > 1000;
    const wait = stale ? 0 : msUntilNextMinute(clock, new Date(now));
    if (wait === null) return;
    const timer = window.setTimeout(() => setNow(Date.now()), wait + 50);
    return () => window.clearTimeout(timer);
  }, [clock, now]);

  return getClockState(clock, new Date(now)).label;
}

/** router.refresh(), at most once a second however many updates arrive. */
function useThrottledRefresh(refresh: () => void) {
  const timer = useRef<number | null>(null);
  return useCallback(() => {
    if (timer.current !== null) return;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      refresh();
    }, 1000);
  }, [refresh]);
}
