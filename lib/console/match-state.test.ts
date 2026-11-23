import { describe, expect, it } from "vitest";
import type { RecordEventInput } from "@/lib/live/types";
import {
  availableControls,
  deriveMatchState,
  eligiblePlayers,
  fromRecordInput,
  mergeEvents,
  type ConsoleEvent,
  type LineupEntry,
  type MatchInput,
} from "./match-state";

const HOME = "11111111-1111-4111-8111-111111111111";
const AWAY = "22222222-2222-4222-8222-222222222222";
const FIXTURE = "33333333-3333-4333-8333-333333333333";

let counter = 0;
let clock = Date.parse("2026-11-28T09:00:00Z");

type EventFields = RecordEventInput extends infer T ? (T extends unknown ? Omit<T, "fixtureId" | "clientEventId"> : never) : never;

/** A tapped event, one minute after the previous one. */
function ev(fields: EventFields, pending = false): ConsoleEvent {
  counter += 1;
  clock += 60_000;
  const input = {
    ...fields,
    fixtureId: FIXTURE,
    clientEventId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    occurredAt: new Date(clock).toISOString(),
  } as RecordEventInput;
  return fromRecordInput(input, pending);
}

const kickOff = () => ev({ type: "period_start", period: "first_half" });
const halfTime = () => ev({ type: "period_end" });
const secondHalf = () => ev({ type: "period_start", period: "second_half" });
const goal = (teamId: string, scorerId?: string) => ev({ type: "goal", teamId, scorerId });

function match(events: ConsoleEvent[], extra: Partial<MatchInput> = {}) {
  return deriveMatchState({
    homeTeamId: HOME,
    awayTeamId: AWAY,
    isKnockout: false,
    serverStatus: "scheduled",
    lineups: [],
    events,
    ...extra,
  });
}

const labels = (events: ConsoleEvent[], extra: Partial<MatchInput> = {}) =>
  availableControls(match(events, extra)).periodButtons.map((b) => b.label);

describe("deriveMatchState", () => {
  it("starts as not started, 0-0", () => {
    const state = match([]);
    expect(state.status).toBe("scheduled");
    expect([state.homeScore, state.awayScore]).toEqual([0, 0]);
  });

  it("follows periods and goals", () => {
    const ko = kickOff();
    const state = match([ko, goal(HOME), goal(AWAY), goal(HOME), halfTime()]);
    expect(state.status).toBe("half_time");
    expect(state.currentPeriod).toBe("first_half");
    expect([state.homeScore, state.awayScore]).toEqual([2, 1]);
    expect(match([ko]).periodStartedAt).toBe(ko.occurredAt);
  });

  it("counts own goals for the team given in teamId", () => {
    const state = match([kickOff(), ev({ type: "goal", teamId: AWAY, ownGoal: true })]);
    expect([state.homeScore, state.awayScore]).toEqual([0, 1]);
  });

  it("keeps a shootout score once penalties start", () => {
    const state = match(
      [
        kickOff(),
        halfTime(),
        secondHalf(),
        ev({ type: "period_end" }),
        ev({ type: "period_start", period: "penalties" }),
        ev({ type: "shootout_kick", teamId: HOME, scored: true }),
        ev({ type: "shootout_kick", teamId: AWAY, scored: false }),
      ],
      { isKnockout: true },
    );
    expect([state.homeShootout, state.awayShootout]).toEqual([1, 0]);
  });

  it("tracks who is on the pitch through subs and red cards", () => {
    const lineups: LineupEntry[] = [
      { playerId: "a1", teamId: HOME, role: "starter" },
      { playerId: "a2", teamId: HOME, role: "starter" },
      { playerId: "a3", teamId: HOME, role: "bench" },
    ];
    const before = match([], { lineups });
    expect(before.players.get("a1")).toMatchObject({ onPitch: true, appeared: false });

    const state = match(
      [
        kickOff(),
        ev({ type: "substitution", teamId: HOME, playerOffId: "a1", playerOnId: "a3" }),
        ev({ type: "card", teamId: HOME, playerId: "a2", colour: "yellow" }),
        ev({ type: "card", teamId: HOME, playerId: "a2", colour: "red" }),
      ],
      { lineups },
    );
    expect(state.players.get("a1")).toMatchObject({ onPitch: false, appeared: true });
    expect(state.players.get("a3")).toMatchObject({ onPitch: true, appeared: true });
    expect(state.players.get("a2")).toMatchObject({ onPitch: false, sentOff: true, yellowCards: 1 });
  });

  it("lets the server's postponed or cancelled status win", () => {
    expect(match([], { serverStatus: "postponed" }).status).toBe("postponed");
  });
});

describe("mergeEvents", () => {
  it("puts server, confirmed and queued events in order, once each, without undone ones", () => {
    const a = kickOff();
    const b = goal(HOME);
    const c = goal(AWAY, undefined);
    const d = ev({ type: "period_end" }, true);
    const merged = mergeEvents([a], [a, b], [c, d], new Set([c.clientEventId]));
    expect(merged.map((e) => e.clientEventId)).toEqual([a.clientEventId, b.clientEventId, d.clientEventId]);
  });
});

describe("availableControls", () => {
  it("league: kick off, half time, second half, full time, then Man of the Match", () => {
    const events: ConsoleEvent[] = [];
    expect(labels(events)).toEqual(["Kick off"]);
    events.push(kickOff());
    expect(labels(events)).toEqual(["Half time"]);
    expect(availableControls(match(events))).toMatchObject({ canGoal: true, canSub: true, canShootout: false });
    events.push(halfTime());
    expect(labels(events)).toEqual(["Second half"]);
    expect(availableControls(match(events))).toMatchObject({ canGoal: false, canSub: true, canCard: true });
    events.push(secondHalf());
    expect(labels(events)).toEqual(["Full time"]);
    events.push(ev({ type: "full_time" }));
    expect(availableControls(match(events))).toMatchObject({ phase: "finished", canMotm: true });
    events.push(ev({ type: "man_of_the_match", playerId: "a1" }));
    expect(availableControls(match(events)).canMotm).toBe(false);
  });

  it("knockout, not level: full time after the second half", () => {
    expect(labels([kickOff(), goal(HOME), halfTime(), secondHalf()], { isKnockout: true })).toEqual(["Full time"]);
  });

  it("knockout, level: end of normal time, then extra time or penalties", () => {
    const events = [kickOff(), halfTime(), secondHalf()];
    expect(labels(events, { isKnockout: true })).toEqual(["End of normal time"]);
    events.push(ev({ type: "period_end" }));
    expect(labels(events, { isKnockout: true })).toEqual(["Extra time", "Penalties"]);
    events.push(ev({ type: "period_start", period: "extra_first" }));
    expect(labels(events, { isKnockout: true })).toEqual(["Half time in extra time"]);
    events.push(ev({ type: "period_end" }));
    expect(labels(events, { isKnockout: true })).toEqual(["Extra time, 2nd half"]);
    events.push(ev({ type: "period_start", period: "extra_second" }));
    expect(labels(events, { isKnockout: true })).toEqual(["End of extra time"]);
    events.push(ev({ type: "period_end" }));
    expect(labels(events, { isKnockout: true })).toEqual(["Penalties"]);
  });

  it("knockout settled in extra time: full time", () => {
    const events = [kickOff(), halfTime(), secondHalf(), ev({ type: "period_end" })];
    events.push(ev({ type: "period_start", period: "extra_first" }), halfTime());
    events.push(ev({ type: "period_start", period: "extra_second" }), goal(AWAY));
    expect(labels(events, { isKnockout: true })).toEqual(["Full time"]);
  });

  it("penalties: shootout kicks, full time only once someone leads", () => {
    const events = [kickOff(), halfTime(), secondHalf(), ev({ type: "period_end" })];
    events.push(ev({ type: "period_start", period: "penalties" }));
    expect(availableControls(match(events, { isKnockout: true }))).toMatchObject({
      phase: "penalties",
      canShootout: true,
      canGoal: false,
      canSub: false,
      periodButtons: [],
    });
    events.push(ev({ type: "shootout_kick", teamId: HOME, scored: true }));
    expect(labels(events, { isKnockout: true })).toEqual(["Full time"]);
  });

  it("offers nothing for a postponed match", () => {
    expect(availableControls(match([], { serverStatus: "postponed" })).phase).toBe("closed");
  });
});

describe("eligiblePlayers", () => {
  const squad = [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "a4" }];
  const lineups: LineupEntry[] = [
    { playerId: "a1", teamId: HOME, role: "starter" },
    { playerId: "a2", teamId: HOME, role: "starter" },
    { playerId: "a3", teamId: HOME, role: "bench" },
  ];

  it("offers the whole squad when the team has no lineup", () => {
    expect(eligiblePlayers(match([kickOff()]), HOME, squad, "on_pitch")).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("uses the lineup when there is one", () => {
    const state = match(
      [kickOff(), ev({ type: "card", teamId: HOME, playerId: "a2", colour: "red" })],
      { lineups },
    );
    expect(eligiblePlayers(state, HOME, squad, "on_pitch")).toEqual(["a1"]);
    expect(eligiblePlayers(state, HOME, squad, "unused_sub")).toEqual(["a3"]);
    expect(eligiblePlayers(state, HOME, squad, "in_lineup")).toEqual(["a1", "a3"]);
    expect(eligiblePlayers(state, HOME, squad, "appeared")).toEqual(["a1", "a2"]);
  });
});
