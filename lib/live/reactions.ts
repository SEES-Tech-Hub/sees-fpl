// Live reactions on the match page: the list of reactions, the window rule,
// the limits, and the arithmetic behind the floating reactions and the cheer
// meter. Pure functions, safe on server and client (tested in
// reactions.test.ts).
//
// How it fits together (spec: "Live Reactions: Spec for Bolu"):
//   1. A tap floats straight away and goes into this phone's tally.
//   2. Every 5 s the tally is sent in one add_reactions() call.
//   3. The match page's existing poll (/api/live/<id>, every 6 s, cached 4 s)
//      brings back the match's totals.
//   4. incomingBubbles() turns the change in totals, minus this phone's own
//      taps, into reactions to float, spread over the next 6 s.
// The database enforces every limit; the ones here only keep the app smooth.
import type { FixtureStatus, ReactionKind, ReactionTotals } from "./types";

export type { ReactionKind, ReactionTotals } from "./types";

/** Every kind, in the order the database and the app use. */
export const REACTION_KINDS = ["fire", "shock", "clap", "laugh", "heartbreak", "cheer_home", "cheer_away"] as const satisfies readonly ReactionKind[];

/** The five reactions a fan taps (the cheers come from tapping a crest). */
export type FanReaction = Exclude<ReactionKind, "cheer_home" | "cheer_away">;

export const REACTIONS: readonly { kind: FanReaction; label: string; emoji: string }[] = [
  { kind: "fire", label: "Fire", emoji: "🔥" },
  { kind: "shock", label: "Shock", emoji: "😱" },
  { kind: "clap", label: "Clap", emoji: "👏" },
  { kind: "laugh", label: "Laugh", emoji: "😂" },
  { kind: "heartbreak", label: "Heartbreak", emoji: "💔" },
];

export const FAN_REACTIONS = REACTIONS.map((r) => r.kind);

export const emojiFor = (kind: FanReaction) => REACTIONS.find((r) => r.kind === kind)!.emoji;

export type CheerSide = "home" | "away";
export const cheerKind = (side: CheerSide): ReactionKind => (side === "home" ? "cheer_home" : "cheer_away");

/**
 * The limits. The database refuses anything past the first five
 * (add_reactions in supabase/migrations/*_live_reactions.sql); the rest are
 * the app's own, for a smooth page on cheap phones.
 */
export const REACTION_LIMITS = {
  /** Most taps of one kind in one send. */
  perKind: 20,
  /** Most taps in one send. */
  perSend: 30,
  /** Most taps one phone can add to one match. */
  perMatch: 1000,
  /** The database refuses a phone's sends closer together than this. */
  minGapMs: 4000,
  /** How long reactions stay open after full time. */
  windowMs: 15 * 60_000,
  /** The app sends its tally this often (a little over minGapMs). */
  sendEveryMs: 5000,
  /** Most reactions floating at once. */
  onScreen: 40,
  /** Most of other people's reactions floated after one poll. */
  incomingPerPoll: 30,
  /** Other people's reactions are spread over this long after each poll. */
  spreadMs: 6000,
  /** A cheer side needs this much more of the cheers to be "louder". */
  louderBy: 0.1,
} as const;

export function emptyTotals(): ReactionTotals {
  return { fire: 0, shock: 0, clap: 0, laugh: 0, heartbreak: 0, cheer_home: 0, cheer_away: 0 };
}

/** Sum of the given kinds (all of them by default). */
export function sumOf(totals: ReactionTotals, kinds: readonly ReactionKind[] = REACTION_KINDS): number {
  return kinds.reduce((n, k) => n + totals[k], 0);
}

/** a + b, kind by kind. */
export function addTotals(a: ReactionTotals, b: ReactionTotals): ReactionTotals {
  const out = emptyTotals();
  for (const k of REACTION_KINDS) out[k] = a[k] + b[k];
  return out;
}

/** a − b, kind by kind, never below 0. */
export function subtractTotals(a: ReactionTotals, b: ReactionTotals): ReactionTotals {
  const out = emptyTotals();
  for (const k of REACTION_KINDS) out[k] = Math.max(0, a[k] - b[k]);
  return out;
}

/** Reads the totals out of an API response, or null when it has none. */
export function parseTotals(value: unknown): ReactionTotals | null {
  if (!value || typeof value !== "object") return null;
  const out = emptyTotals();
  for (const k of REACTION_KINDS) {
    const n = (value as Record<string, unknown>)[k];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
    out[k] = Math.floor(n);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

/** True once the match has kicked off: the reaction button shows from then on. */
export function reactionsStarted(status: FixtureStatus): boolean {
  return status === "live" || status === "half_time" || status === "full_time";
}

/**
 * Open from kick-off until 15 minutes after full time. `endedAt` is when the
 * match's latest active event was recorded (for races, which have no events,
 * when the results were published). Mirrors live_reactions_open() in the
 * database, which has the final say.
 */
export function reactionsOpen({ status, endedAt, now }: { status: FixtureStatus; endedAt: string | null; now: number }): boolean {
  if (status === "live" || status === "half_time") return true;
  if (status !== "full_time" || !endedAt) return false;
  const ended = Date.parse(endedAt);
  return Number.isFinite(ended) && now - ended < REACTION_LIMITS.windowMs;
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

/** 980, 1.2k, 15k, 1.2m: short enough for a badge. */
export function formatCount(n: number): string {
  const v = Math.max(0, Math.floor(n));
  if (v < 1000) return String(v);
  const short = (x: number, unit: string) => {
    const rounded = x < 10 ? Math.floor(x * 10) / 10 : Math.floor(x);
    return `${rounded}${unit}`;
  };
  if (v < 1_000_000) return short(v / 1000, "k");
  return short(v / 1_000_000, "m");
}

/**
 * Adds one tap of `kind` to this phone's unsent tally, if one send can still
 * carry it (20 of a kind, 30 in all). Returns the new tally, or null when the
 * tap can float but not be counted.
 */
export function addTap(tally: ReactionTotals, kind: ReactionKind): ReactionTotals | null {
  if (tally[kind] >= REACTION_LIMITS.perKind || sumOf(tally) >= REACTION_LIMITS.perSend) return null;
  return { ...tally, [kind]: tally[kind] + 1 };
}

/**
 * Puts a tally that couldn't be sent back in front of the taps made since,
 * keeping within what one send can carry. The older taps go first.
 */
export function mergeTallies(older: ReactionTotals, newer: ReactionTotals): ReactionTotals {
  let out = older;
  for (const k of REACTION_KINDS) {
    for (let i = 0; i < newer[k]; i++) {
      const next = addTap(out, k);
      if (!next) break;
      out = next;
    }
  }
  return out;
}

/** Just the kinds with taps, for add_reactions: {"fire": 3, "cheer_home": 6}. */
export function toPayload(tally: ReactionTotals): Partial<ReactionTotals> {
  const out: Partial<ReactionTotals> = {};
  for (const k of REACTION_KINDS) if (tally[k] > 0) out[k] = tally[k];
  return out;
}

// ---------------------------------------------------------------------------
// Floating other people's reactions
// ---------------------------------------------------------------------------

export type IncomingResult = {
  /** How many of each reaction to float now (at most 30 in all). */
  bubbles: Partial<Record<FanReaction, number>>;
  /** The totals to compare the next poll with: the highest seen of each kind. */
  baseline: ReactionTotals;
  /** This phone's sent taps that haven't shown up in the totals yet. */
  ownUnseen: ReactionTotals;
};

/**
 * After a poll: what to float. The rise in each total since `previous`, less
 * this phone's own taps that have just arrived in it (they floated when they
 * were tapped), is everyone else's. The first poll (previous = null) only
 * sets the baseline, so opening a match never floats its whole history.
 * Totals can step back for a moment (a slower server's cached copy), so the
 * baseline keeps the highest seen and a drop floats nothing.
 */
export function incomingBubbles(previous: ReactionTotals | null, next: ReactionTotals, ownUnseen: ReactionTotals): IncomingResult {
  if (!previous) return { bubbles: {}, baseline: next, ownUnseen };

  const baseline = emptyTotals();
  const ownLeft = emptyTotals();
  const others: Partial<Record<FanReaction, number>> = {};
  for (const k of REACTION_KINDS) {
    const rise = Math.max(0, next[k] - previous[k]);
    const own = Math.min(rise, ownUnseen[k]);
    ownLeft[k] = ownUnseen[k] - own;
    baseline[k] = Math.max(previous[k], next[k]);
    const theirs = rise - own;
    if (theirs > 0 && (FAN_REACTIONS as readonly ReactionKind[]).includes(k)) others[k as FanReaction] = theirs;
  }
  return { bubbles: capBubbles(others, REACTION_LIMITS.incomingPerPoll), baseline, ownUnseen: ownLeft };
}

/** Scales counts down to at most `max` in all, keeping the mix (largest remainders). */
export function capBubbles(counts: Partial<Record<FanReaction, number>>, max: number): Partial<Record<FanReaction, number>> {
  const entries = FAN_REACTIONS.map((k) => [k, counts[k] ?? 0] as const).filter(([, n]) => n > 0);
  const total = entries.reduce((n, [, c]) => n + c, 0);
  if (total <= max) return Object.fromEntries(entries);
  const shares = entries.map(([k, n]) => {
    const exact = (n / total) * max;
    return { k, whole: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = max - shares.reduce((n, s) => n + s.whole, 0);
  for (const s of [...shares].sort((a, b) => b.rest - a.rest)) {
    if (left <= 0) break;
    s.whole += 1;
    left -= 1;
  }
  return Object.fromEntries(shares.filter((s) => s.whole > 0).map((s) => [s.k, s.whole]));
}

/**
 * When to float each incoming reaction: spread over `spreadMs`, shuffled so
 * kinds mix, so a burst after a goal feels like a crowd rather than a block.
 */
export function bubbleSchedule(
  counts: Partial<Record<FanReaction, number>>,
  spreadMs: number = REACTION_LIMITS.spreadMs,
  random: () => number = Math.random,
): { kind: FanReaction; delayMs: number }[] {
  const out: { kind: FanReaction; delayMs: number }[] = [];
  for (const k of FAN_REACTIONS) for (let i = 0; i < (counts[k] ?? 0); i++) out.push({ kind: k, delayMs: Math.floor(random() * spreadMs) });
  return out.sort((a, b) => a.delayMs - b.delayMs);
}

// ---------------------------------------------------------------------------
// The cheer meter
// ---------------------------------------------------------------------------

/**
 * The home side's share of the cheers (null before anyone cheers), and which
 * side is louder: one with at least 10% more of the cheers than the other.
 */
export function cheerMeter(totals: Pick<ReactionTotals, "cheer_home" | "cheer_away">): {
  homeShare: number | null;
  louder: CheerSide | null;
} {
  const home = totals.cheer_home;
  const away = totals.cheer_away;
  const all = home + away;
  if (all === 0) return { homeShare: null, louder: null };
  const lead = (home - away) / all;
  return {
    homeShare: home / all,
    louder: lead >= REACTION_LIMITS.louderBy ? "home" : -lead >= REACTION_LIMITS.louderBy ? "away" : null,
  };
}

// ---------------------------------------------------------------------------
// One phone's taps on one match page
// ---------------------------------------------------------------------------

export type TallySnapshot = {
  /** Taps not sent yet (at most what one send carries). */
  pending: ReactionTotals;
  /** Taps sent but not yet seen in the totals. */
  ownUnseen: ReactionTotals;
  /** The highest totals seen from the server, or null before the first poll. */
  baseline: ReactionTotals | null;
};

/**
 * This phone's taps on one match page, from tap to send to showing up in the
 * totals. A small store the page subscribes to (useSyncExternalStore), so the
 * send loop and the buttons share one copy without re-render races.
 */
export class ReactionTally {
  private snap: TallySnapshot = { pending: emptyTotals(), ownUnseen: emptyTotals(), baseline: null };
  private listeners = new Set<() => void>();
  /** A send is on its way (only one at a time). */
  sending = false;
  /** When the last send started (ms), for the 4-second gap. */
  lastSentAt = 0;
  /** Whether reactions are open, as the page last heard (setOpen). */
  private open = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snap;

  private set(next: Partial<TallySnapshot>) {
    this.snap = { ...this.snap, ...next };
    for (const l of this.listeners) l();
  }

  /** Counts a tap if one send can still carry it. False when it can only float. */
  tap(kind: ReactionKind): boolean {
    const next = addTap(this.snap.pending, kind);
    if (!next) return false;
    this.set({ pending: next });
    return true;
  }

  /** New totals from a poll. Returns everyone else's new reactions, to float. */
  poll(totals: ReactionTotals): Partial<Record<FanReaction, number>> {
    const r = incomingBubbles(this.snap.baseline, totals, this.snap.ownUnseen);
    this.set({ baseline: r.baseline, ownUnseen: r.ownUnseen });
    return r.bubbles;
  }

  /**
   * Takes the unsent taps for a send, or null when there's nothing to send, a
   * send is already going, reactions are closed or the last send was under
   * 4 seconds ago.
   */
  take(now: number): ReactionTotals | null {
    const batch = this.snap.pending;
    if (sumOf(batch) === 0 || this.sending || !this.open) return null;
    if (now - this.lastSentAt < REACTION_LIMITS.minGapMs) return null;
    this.sending = true;
    this.lastSentAt = now;
    this.set({ pending: emptyTotals(), ownUnseen: addTotals(this.snap.ownUnseen, batch) });
    return batch;
  }

  /** The send landed. */
  sent() {
    this.sending = false;
  }

  /**
   * The send didn't land. Its taps won't show up in the totals, so stop
   * waiting for them; with `keep` (no signal, or a moment too soon) they go
   * back in front of the next send, otherwise they're dropped.
   */
  unsent(batch: ReactionTotals, keep: boolean) {
    this.sending = false;
    this.set({
      ownUnseen: subtractTotals(this.snap.ownUnseen, batch),
      pending: keep && this.open ? mergeTallies(batch, this.snap.pending) : this.snap.pending,
    });
  }

  /** Whether reactions are open. Closing drops anything unsent. */
  setOpen(open: boolean) {
    this.open = open;
    if (!open && sumOf(this.snap.pending) > 0) this.set({ pending: emptyTotals() });
  }
}

/** What the page shows: the server's totals with this phone's own taps added at once. */
export function shownTotals(snap: TallySnapshot): ReactionTotals {
  return addTotals(addTotals(snap.baseline ?? emptyTotals(), snap.ownUnseen), snap.pending);
}
