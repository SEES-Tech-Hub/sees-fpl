import { describe, expect, it } from "vitest";
import {
  REACTION_LIMITS,
  ReactionTally,
  addTap,
  bubbleSchedule,
  capBubbles,
  cheerMeter,
  emptyTotals,
  formatCount,
  incomingBubbles,
  mergeTallies,
  parseTotals,
  reactionsOpen,
  reactionsStarted,
  shownTotals,
  sumOf,
  toPayload,
  type ReactionTotals,
} from "./reactions";

const totals = (t: Partial<ReactionTotals>): ReactionTotals => ({ ...emptyTotals(), ...t });
const MIN = 60_000;
const NOW = Date.parse("2026-11-28T10:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatCount", () => {
  it("shows small counts in full and shortens large ones", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(980)).toBe("980");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1000)).toBe("1k");
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(1299)).toBe("1.2k");
    expect(formatCount(9999)).toBe("9.9k");
    expect(formatCount(15_000)).toBe("15k");
    expect(formatCount(15_999)).toBe("15k");
    expect(formatCount(999_999)).toBe("999k");
    expect(formatCount(1_250_000)).toBe("1.2m");
  });

  it("never shows a negative or a fraction", () => {
    expect(formatCount(-5)).toBe("0");
    expect(formatCount(12.7)).toBe("12");
  });
});

describe("the window", () => {
  it("is open while live and at half time", () => {
    expect(reactionsOpen({ status: "live", endedAt: null, now: NOW })).toBe(true);
    expect(reactionsOpen({ status: "half_time", endedAt: null, now: NOW })).toBe(true);
  });

  it("is closed before kick-off and for matches that never happened", () => {
    for (const status of ["scheduled", "postponed", "cancelled", "walkover"] as const) {
      expect(reactionsOpen({ status, endedAt: ago(MIN), now: NOW })).toBe(false);
    }
  });

  it("stays open for 15 minutes after full time, and not a moment longer", () => {
    expect(reactionsOpen({ status: "full_time", endedAt: ago(14 * MIN), now: NOW })).toBe(true);
    expect(reactionsOpen({ status: "full_time", endedAt: ago(15 * MIN - 1), now: NOW })).toBe(true);
    expect(reactionsOpen({ status: "full_time", endedAt: ago(15 * MIN), now: NOW })).toBe(false);
    expect(reactionsOpen({ status: "full_time", endedAt: ago(16 * MIN), now: NOW })).toBe(false);
  });

  it("is closed at full time when it can't tell when the match ended", () => {
    expect(reactionsOpen({ status: "full_time", endedAt: null, now: NOW })).toBe(false);
    expect(reactionsOpen({ status: "full_time", endedAt: "not a date", now: NOW })).toBe(false);
  });

  it("shows the button from kick-off on, frozen after the window", () => {
    expect(reactionsStarted("scheduled")).toBe(false);
    expect(reactionsStarted("live")).toBe(true);
    expect(reactionsStarted("half_time")).toBe(true);
    expect(reactionsStarted("full_time")).toBe(true);
    expect(reactionsStarted("walkover")).toBe(false);
  });
});

describe("a phone's tally", () => {
  it("takes up to 20 of one kind", () => {
    let t = emptyTotals();
    for (let i = 0; i < 20; i++) t = addTap(t, "fire")!;
    expect(t.fire).toBe(20);
    expect(addTap(t, "fire")).toBeNull();
    expect(addTap(t, "clap")!.clap).toBe(1);
  });

  it("takes up to 30 in all", () => {
    let t = totals({ fire: 20, clap: 9 });
    t = addTap(t, "laugh")!;
    expect(sumOf(t)).toBe(30);
    expect(addTap(t, "shock")).toBeNull();
  });

  it("puts a failed send back in front of newer taps, within one send's limits", () => {
    const merged = mergeTallies(totals({ fire: 15, cheer_home: 5 }), totals({ fire: 10, clap: 8 }));
    expect(merged.fire).toBe(20);
    expect(sumOf(merged)).toBe(30);
    expect(merged.cheer_home).toBe(5);
  });

  it("sends only the kinds with taps", () => {
    expect(toPayload(totals({ fire: 3, cheer_home: 6 }))).toEqual({ fire: 3, cheer_home: 6 });
    expect(toPayload(emptyTotals())).toEqual({});
  });
});

describe("parseTotals", () => {
  it("reads a full set of counts and refuses anything else", () => {
    expect(parseTotals(totals({ fire: 2 }))).toEqual(totals({ fire: 2 }));
    expect(parseTotals(null)).toBeNull();
    expect(parseTotals({ fire: 1 })).toBeNull();
    expect(parseTotals({ ...totals({}), fire: -1 })).toBeNull();
    expect(parseTotals({ ...totals({}), fire: "3" })).toBeNull();
  });
});

describe("incomingBubbles", () => {
  it("floats nothing on the first poll, so a match's history doesn't burst on opening", () => {
    const r = incomingBubbles(null, totals({ fire: 500 }), emptyTotals());
    expect(r.bubbles).toEqual({});
    expect(r.baseline.fire).toBe(500);
  });

  it("floats the rise in each total", () => {
    const r = incomingBubbles(totals({ fire: 10, clap: 2 }), totals({ fire: 13, clap: 3 }), emptyTotals());
    expect(r.bubbles).toEqual({ fire: 3, clap: 1 });
  });

  it("doesn't float this phone's own taps twice", () => {
    const r = incomingBubbles(totals({ fire: 10 }), totals({ fire: 15 }), totals({ fire: 4 }));
    expect(r.bubbles).toEqual({ fire: 1 });
    expect(r.ownUnseen.fire).toBe(0);
  });

  it("keeps own taps that haven't arrived yet for the next poll", () => {
    const first = incomingBubbles(totals({ fire: 10 }), totals({ fire: 12 }), totals({ fire: 5 }));
    expect(first.bubbles).toEqual({});
    expect(first.ownUnseen.fire).toBe(3);
    const second = incomingBubbles(first.baseline, totals({ fire: 16 }), first.ownUnseen);
    expect(second.bubbles).toEqual({ fire: 1 });
    expect(second.ownUnseen.fire).toBe(0);
  });

  it("never floats more than 30, keeping the mix", () => {
    const r = incomingBubbles(emptyTotals(), totals({ fire: 300, clap: 100, laugh: 1 }), emptyTotals());
    expect(Object.values(r.bubbles).reduce((n, c) => n + (c ?? 0), 0)).toBe(REACTION_LIMITS.incomingPerPoll);
    expect(r.bubbles.fire).toBeGreaterThan(r.bubbles.clap!);
    expect(r.bubbles.clap).toBeGreaterThan(0);
  });

  it("floats nothing when a total steps back, and keeps the highest as the baseline", () => {
    const r = incomingBubbles(totals({ fire: 20 }), totals({ fire: 18 }), emptyTotals());
    expect(r.bubbles).toEqual({});
    expect(r.baseline.fire).toBe(20);
    const again = incomingBubbles(r.baseline, totals({ fire: 21 }), emptyTotals());
    expect(again.bubbles).toEqual({ fire: 1 });
  });

  it("doesn't float cheers (they move the meter instead)", () => {
    const r = incomingBubbles(emptyTotals(), totals({ cheer_home: 9, cheer_away: 4, shock: 1 }), emptyTotals());
    expect(r.bubbles).toEqual({ shock: 1 });
  });
});

describe("capBubbles and bubbleSchedule", () => {
  it("leaves small counts alone", () => {
    expect(capBubbles({ fire: 2, clap: 1 }, 30)).toEqual({ fire: 2, clap: 1 });
  });

  it("spreads incoming reactions over the window, in time order", () => {
    let seed = 0;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const plan = bubbleSchedule({ fire: 3, laugh: 2 }, 6000, random);
    expect(plan).toHaveLength(5);
    expect(plan.every((p) => p.delayMs >= 0 && p.delayMs < 6000)).toBe(true);
    expect(plan.map((p) => p.delayMs)).toEqual([...plan.map((p) => p.delayMs)].sort((a, b) => a - b));
  });
});

describe("cheerMeter", () => {
  it("is empty before anyone cheers", () => {
    expect(cheerMeter({ cheer_home: 0, cheer_away: 0 })).toEqual({ homeShare: null, louder: null });
  });

  it("splits by share and names a side only when it leads by 10% or more", () => {
    expect(cheerMeter({ cheer_home: 55, cheer_away: 45 })).toEqual({ homeShare: 0.55, louder: "home" });
    expect(cheerMeter({ cheer_home: 54, cheer_away: 46 }).louder).toBeNull();
    expect(cheerMeter({ cheer_home: 40, cheer_away: 60 })).toEqual({ homeShare: 0.4, louder: "away" });
    expect(cheerMeter({ cheer_home: 1, cheer_away: 0 })).toEqual({ homeShare: 1, louder: "home" });
  });
});

describe("ReactionTally", () => {
  const T0 = 1_000_000;

  it("takes this phone's taps in one send, at most every 4 seconds", () => {
    const tally = new ReactionTally();
    tally.setOpen(true);
    tally.tap("fire");
    tally.tap("fire");
    tally.tap("cheer_home");
    expect(tally.take(T0)).toEqual(totals({ fire: 2, cheer_home: 1 }));
    tally.sent();
    tally.tap("clap");
    expect(tally.take(T0 + 3999)).toBeNull();
    expect(tally.take(T0 + 4000)).toEqual(totals({ clap: 1 }));
  });

  it("sends nothing while a send is on its way, or when closed", () => {
    const tally = new ReactionTally();
    tally.setOpen(true);
    tally.tap("fire");
    expect(tally.take(T0)).not.toBeNull();
    tally.tap("fire");
    expect(tally.take(T0 + 9000)).toBeNull();
    tally.sent();
    tally.setOpen(false);
    expect(tally.getSnapshot().pending).toEqual(emptyTotals());
    tally.tap("fire");
    expect(tally.take(T0 + 20_000)).toBeNull();
  });

  it("shows its own taps at once and doesn't float them again when they reach the totals", () => {
    const tally = new ReactionTally();
    tally.setOpen(true);
    tally.poll(totals({ fire: 10 }));
    tally.tap("fire");
    tally.tap("fire");
    expect(shownTotals(tally.getSnapshot()).fire).toBe(12);
    tally.take(T0);
    tally.sent();
    expect(shownTotals(tally.getSnapshot()).fire).toBe(12);
    // The next poll has our 2 and 3 from someone else: float only theirs.
    expect(tally.poll(totals({ fire: 15 }))).toEqual({ fire: 3 });
    expect(shownTotals(tally.getSnapshot()).fire).toBe(15);
  });

  it("keeps a tally that couldn't be sent for the next send, and drops a refused one", () => {
    const tally = new ReactionTally();
    tally.setOpen(true);
    tally.poll(emptyTotals());
    tally.tap("laugh");
    const batch = tally.take(T0)!;
    tally.tap("laugh");
    tally.unsent(batch, true);
    expect(tally.getSnapshot().pending.laugh).toBe(2);
    expect(tally.getSnapshot().ownUnseen.laugh).toBe(0);

    const again = tally.take(T0 + 5000)!;
    tally.unsent(again, false);
    expect(tally.getSnapshot().pending.laugh).toBe(0);
    expect(shownTotals(tally.getSnapshot()).laugh).toBe(0);
  });

  it("tells its subscribers about every change", () => {
    const tally = new ReactionTally();
    let calls = 0;
    const stop = tally.subscribe(() => calls++);
    tally.setOpen(true);
    tally.tap("fire");
    tally.poll(emptyTotals());
    stop();
    tally.tap("fire");
    expect(calls).toBe(2);
  });
});
