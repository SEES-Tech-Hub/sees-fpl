"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { ChevronUp } from "lucide-react";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { teamColour } from "@/lib/design/team-colour";
import { toLiveError } from "@/lib/live/errors";
import {
  REACTION_LIMITS,
  REACTIONS,
  ReactionTally,
  bubbleSchedule,
  cheerKind,
  cheerMeter,
  emojiFor,
  formatCount,
  reactionsStarted,
  shownTotals,
  sumOf,
  toPayload,
  type CheerSide,
  type FanReaction,
  type ReactionTotals,
} from "@/lib/live/reactions";
import type { FixtureStatus } from "@/lib/live/types";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { reactionId } from "@/lib/device-id";

// Live reactions on the match page: the floating reaction button and its
// tray, the reactions that float up, and the cheer meter in the score header.
// The rules and arithmetic are in lib/live/reactions.ts; the database
// enforces every limit (add_reactions). In short:
//   - a tap floats at once and joins this phone's tally;
//   - every 5 s the tally goes to the database in one call (and right away
//     when the page is hidden or the signal comes back);
//   - each poll of /api/live/<id> brings the match's totals, and the rise,
//     less this phone's own taps, floats up over the next 6 s.
// No error toasts: a refused tally is dropped quietly, and one that couldn't
// be sent (no signal) waits for the next send.

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

// Reactions are anonymous: they go through a client with no session, so the
// request carries no user token, and the only id is reactionId(), a random id
// kept on the phone that is never linked to an account (lib/device-id.ts).
// keepalive lets the last send finish when the page is closed or hidden.
let anonClient: SupabaseClient<Database> | null = null;
function reactionsClient() {
  anonClient ??= createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "sees-reactions" },
    global: { fetch: (input, init) => fetch(input, { ...init, keepalive: true }) },
  });
  return anonClient;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(reducedMotionQuery);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Not every browser allows it.
  }
};

// ---------------------------------------------------------------------------
// The hook: everything the button, the bubbles and the cheer meter share
// ---------------------------------------------------------------------------

export type Bubble = { id: number; kind: FanReaction; own: boolean; x: number; sway: number; ms: number };

export type Reactions = {
  /** Show the reaction button (from kick-off on, and only if the totals can be read). */
  shown: boolean;
  /** Taps count (kick-off to 15 minutes after full time). */
  open: boolean;
  /** The totals have arrived at least once. */
  ready: boolean;
  /** The match's totals, with this phone's own taps added at once. */
  totals: ReactionTotals;
  /** The reaction on the button: the one used last, fire to start. */
  current: FanReaction;
  react: (kind: FanReaction) => void;
  /** Cheering is possible in this match (two sides). */
  twoSided: boolean;
  /** The side this phone cheers for, once it has cheered. */
  side: CheerSide | null;
  cheer: (side: CheerSide) => void;
  /** The latest cheer, for the "+1" on the crest. */
  lastCheer: { side: CheerSide; id: number } | null;
  bubbles: Bubble[];
  bubbleDone: (id: number) => void;
  reducedMotion: boolean;
};

let bubbleIds = 0;

export function useReactions({
  fixtureId,
  status,
  poll,
  twoSided,
}: {
  fixtureId: string;
  status: FixtureStatus;
  /** From useLiveFixture: the latest totals and whether reactions are open (null before the first poll). */
  poll: { totals: ReactionTotals | null; open: boolean } | null;
  twoSided: boolean;
}): Reactions {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useLocalStorageState<FanReaction>("sees-live:reaction", "fire", {
    validate: (v) => (REACTIONS.some((r) => r.kind === v) ? v : null),
  });
  const [side, setSide] = useLocalStorageState<CheerSide | null>(`sees-live:cheer:${fixtureId}`, null, {
    validate: (v) => (v === "home" || v === "away" ? v : null),
    maxAgeMs: 14 * 24 * 60 * 60_000,
  });

  // Before the first poll, go by the status the page was rendered with.
  const open = poll ? poll.open : status === "live" || status === "half_time";
  const shown = reactionsStarted(status) && (poll ? poll.totals !== null : status === "live" || status === "half_time");

  // This phone's taps, from tap to send to the totals (ReactionTally in
  // lib/live/reactions.ts), shared by the buttons and the send loop.
  const [tally] = useState(() => new ReactionTally());
  const snap = useSyncExternalStore(tally.subscribe, tally.getSnapshot, tally.getSnapshot);
  useEffect(() => tally.setOpen(open), [tally, open]);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [lastCheer, setLastCheer] = useState<Reactions["lastCheer"]>(null);
  const [timers] = useState(() => new Set<ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      timers.forEach(clearTimeout);
      timers.clear();
    },
    [timers],
  );

  const float = useCallback(
    (kind: FanReaction, own: boolean) => {
      if (reducedMotion) return;
      const bubble: Bubble = {
        id: ++bubbleIds,
        kind,
        own,
        x: Math.round(Math.random() * 28 - 20),
        sway: Math.round(Math.random() * 36 - 18),
        ms: 3400 + Math.round(Math.random() * 900),
      };
      setBubbles((list) => {
        if (list.length < REACTION_LIMITS.onScreen) return [...list, bubble];
        // Full: your own tap still shows, in place of the oldest.
        return own ? [...list.slice(1), bubble] : list;
      });
    },
    [reducedMotion],
  );
  const bubbleDone = useCallback((id: number) => setBubbles((list) => list.filter((b) => b.id !== id)), []);

  // A poll arrived: float everyone else's new reactions over the next 6 s.
  useEffect(() => {
    if (!poll?.totals) return;
    const incoming = tally.poll(poll.totals);
    for (const { kind, delayMs } of bubbleSchedule(incoming)) {
      const t = setTimeout(() => {
        timers.delete(t);
        float(kind, false);
      }, delayMs);
      timers.add(t);
    }
  }, [poll, tally, timers, float]);

  const send = useCallback(async () => {
    const batch = tally.take(Date.now());
    if (!batch) return;
    try {
      const { error } = await reactionsClient().rpc("add_reactions", {
        p_fixture_id: fixtureId,
        p_session: reactionId(),
        p_counts: toPayload(batch),
      });
      if (!error) return tally.sent();
      const e = toLiveError(error);
      // No signal, or sent a moment too soon: keep the taps for the next
      // send. Anything else (closed, over a limit) is dropped quietly.
      tally.unsent(batch, e.retryable || e.code === "reactions_too_fast");
    } catch {
      tally.unsent(batch, true);
    }
  }, [tally, fixtureId]);

  // Send every 5 s, when the page is hidden or closed, and when the signal comes back.
  useEffect(() => {
    if (!shown) return;
    const every = setInterval(() => void send(), REACTION_LIMITS.sendEveryMs);
    const onHide = () => {
      if (document.visibilityState === "hidden") void send();
    };
    const now = () => void send();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", now);
    window.addEventListener("online", now);
    return () => {
      clearInterval(every);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", now);
      window.removeEventListener("online", now);
    };
  }, [shown, send]);

  const react = (kind: FanReaction) => {
    if (!open) return;
    buzz();
    float(kind, true);
    if (kind !== current) setCurrent(kind);
    // Past what one send can carry, the tap still floats but isn't counted.
    tally.tap(kind);
  };

  const cheer = (which: CheerSide) => {
    if (!open || !twoSided) return;
    if (side && side !== which) return;
    if (!side) setSide(which);
    buzz();
    setLastCheer({ side: which, id: ++bubbleIds });
    tally.tap(cheerKind(which));
  };

  return {
    shown,
    open,
    ready: snap.baseline !== null,
    totals: shownTotals(snap),
    current,
    react,
    twoSided,
    side,
    cheer,
    lastCheer,
    bubbles,
    bubbleDone,
    reducedMotion,
  };
}

// ---------------------------------------------------------------------------
// Motion (transform and opacity only, so it stays smooth on cheap phones).
// Nothing here runs for reduced motion: the hook floats nothing then.
// ---------------------------------------------------------------------------

const MOTION_CSS = `
/* Like YouTube live: each reaction pops out of the button, drifts up at an
   even pace while it sways from side to side, and fades only near the top. */
@keyframes sees-react-rise {
  0%   { transform: translate3d(0, 0, 0); opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: translate3d(0, -42vh, 0); opacity: 0; }
}
@keyframes sees-react-sway {
  from { transform: translate3d(calc(var(--sway) * -1), 0, 0) rotate(-6deg); }
  to   { transform: translate3d(var(--sway), 0, 0) rotate(6deg); }
}
@keyframes sees-react-pop {
  0%   { transform: scale(0.2); }
  55%  { transform: scale(1.3); }
  80%  { transform: scale(0.92); }
  100% { transform: scale(1); }
}
@keyframes sees-cheer-plus {
  0%   { transform: translate3d(-50%, 0, 0) scale(0.6); opacity: 0; }
  20%  { transform: translate3d(-50%, -0.75rem, 0) scale(1.1); opacity: 1; }
  100% { transform: translate3d(-50%, -2.75rem, 0) scale(1); opacity: 0; }
}
@keyframes sees-cheer-pulse {
  0%, 100% { transform: scale(1); }
  35%      { transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
  .sees-cheer-pulse, .sees-cheer-plus { animation: none !important; }
}
`;

function MotionStyles() {
  return (
    <style href="sees-live-reactions" precedence="default">
      {MOTION_CSS}
    </style>
  );
}

// ---------------------------------------------------------------------------
// The floating button, its tray and the reactions that float up
// ---------------------------------------------------------------------------

// Above the phone's bottom dock (components/shell/BottomTabBar.tsx: 4 rem
// tall, its bottom edge at max(0.75 rem, the safe area)), and bottom-right
// on a laptop, where there's no dock.
const ABOVE_DOCK = "bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] lg:bottom-6";

/** The reaction button, its tray and the floating reactions. Renders nothing before kick-off. */
export function ReactionDock({ rx }: { rx: Reactions }) {
  const [trayOpen, setTrayOpen] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heldOpen = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  // Close the tray on a tap outside it or Escape.
  useEffect(() => {
    if (!trayOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setTrayOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTrayOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [trayOpen]);
  useEffect(() => () => clearTimeout(hold.current), []);

  if (!rx.shown) return null;

  const reactionTotal = sumOf(rx.totals, REACTIONS.map((r) => r.kind));
  const label = REACTIONS.find((r) => r.kind === rx.current)!.label;

  // Press and hold opens the tray; a quick tap sends (or, once reactions
  // have closed, shows the final counts).
  const startHold = () => {
    heldOpen.current = false;
    clearTimeout(hold.current);
    hold.current = setTimeout(() => {
      heldOpen.current = true;
      setTrayOpen(true);
    }, 450);
  };
  const endHold = () => clearTimeout(hold.current);
  const tap = () => {
    if (heldOpen.current) {
      heldOpen.current = false;
      return;
    }
    if (rx.open) rx.react(rx.current);
    else setTrayOpen((o) => !o);
  };

  return (
    <>
      <MotionStyles />
      <BubbleLayer rx={rx} />
      <div ref={root} className={cn("fixed right-4 z-40 lg:right-6", ABOVE_DOCK)}>
        {trayOpen && (
          <div
            role="group"
            aria-label={rx.open ? "Choose a reaction" : "Final reaction counts"}
            className="absolute right-0 bottom-full mb-2 flex gap-0.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-raised motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
          >
            {REACTIONS.map((r) => (
              <button
                key={r.kind}
                type="button"
                disabled={!rx.open}
                aria-pressed={r.kind === rx.current}
                aria-label={`${r.label}: ${rx.totals[r.kind]}`}
                onClick={() => {
                  rx.react(r.kind);
                  setTrayOpen(false);
                }}
                className={cn(
                  "flex w-12 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:active:scale-90",
                  r.kind === rx.current && rx.open && "bg-secondary",
                )}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {r.emoji}
                </span>
                <span className="text-[0.6875rem] font-semibold text-muted-foreground tabular-nums">{rx.ready ? formatCount(rx.totals[r.kind]) : "–"}</span>
              </button>
            ))}
          </div>
        )}

        <div className={cn("relative flex items-center rounded-full border border-border bg-card shadow-raised", !rx.open && "opacity-80")}>
          <button
            type="button"
            onClick={tap}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={rx.open ? `React: ${label}` : "Reactions have closed. See the final counts."}
            className="flex h-12 w-11 touch-manipulation items-center justify-center rounded-full pl-1 text-[1.375rem] leading-none outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:scale-90 motion-safe:transition-transform"
          >
            <span aria-hidden className={cn(!rx.open && "grayscale")}>
              {emojiFor(rx.current)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTrayOpen((o) => !o)}
            aria-label={rx.open ? "Choose a reaction" : "See the final counts"}
            aria-expanded={trayOpen}
            className="-ml-1.5 flex h-12 w-6 items-center justify-center rounded-r-full pr-1 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronUp aria-hidden className={cn("size-4 motion-safe:transition-transform", trayOpen && "rotate-180")} />
          </button>
          {rx.ready && reactionTotal > 0 && (
            <span className="pointer-events-none absolute -top-2 -left-2 min-w-6 rounded-full bg-primary px-1.5 py-0.5 text-center text-[0.6875rem] font-bold text-primary-foreground tabular-nums shadow-card">
              {formatCount(reactionTotal)}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

/** Reactions drifting up the right edge from the button, about 4 s each, at most 40 at once. */
function BubbleLayer({ rx }: { rx: Reactions }) {
  if (rx.reducedMotion || rx.bubbles.length === 0) return null;
  return (
    <div aria-hidden className={cn("pointer-events-none fixed right-4 z-40 h-0 w-14 lg:right-6", ABOVE_DOCK)}>
      {rx.bubbles.map((b) => (
        <span
          key={b.id}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) rx.bubbleDone(b.id);
          }}
          className={cn("absolute bottom-0 left-1/2 -ml-4 text-[2rem] leading-none will-change-transform", !b.own && "text-[1.625rem]")}
          style={{ marginLeft: `${b.x - 16}px`, animation: `sees-react-rise ${b.ms}ms linear forwards` }}
        >
          <span
            className="block will-change-transform"
            style={
              {
                "--sway": `${Math.max(8, Math.abs(b.sway))}px`,
                animation: `sees-react-sway ${700 + (b.id % 5) * 110}ms ease-in-out ${-(b.id % 7) * 90}ms infinite alternate`,
              } as CSSProperties
            }
          >
            <span className="block" style={{ animation: "sees-react-pop 380ms cubic-bezier(0.3, 1.4, 0.5, 1) both" }}>
              {emojiFor(b.kind)}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The cheer meter (inside the score header)
// ---------------------------------------------------------------------------

/**
 * A team's crest as a cheer button while reactions are open. The first crest
 * a phone taps is its side; the other stops taking cheers.
 */
export function CheerCrest({
  rx,
  side,
  name,
  children,
}: {
  rx: Reactions | null;
  side: CheerSide;
  name: string;
  children: ReactNode;
}) {
  if (!rx || !rx.shown || !rx.twoSided || !rx.open) return <>{children}</>;
  const other = rx.side !== null && rx.side !== side;
  const popped = rx.lastCheer?.side === side ? rx.lastCheer : null;
  return (
    <button
      type="button"
      onClick={() => rx.cheer(side)}
      disabled={other}
      aria-label={other ? `${name}: you're cheering for the other side` : `Cheer for ${name}`}
      className="relative touch-manipulation rounded-2xl outline-none select-none focus-visible:ring-2 focus-visible:ring-brand-light enabled:cursor-pointer enabled:active:scale-95 disabled:opacity-60 motion-safe:transition-transform"
    >
      <span key={popped?.id ?? 0} className="sees-cheer-pulse block" style={popped ? { animation: "sees-cheer-pulse 380ms ease-out" } : undefined}>
        {children}
      </span>
      {popped && !rx.reducedMotion && (
        <span
          key={`plus-${popped.id}`}
          aria-hidden
          className="sees-cheer-plus pointer-events-none absolute top-0 left-1/2 rounded-full bg-brand-foreground px-2 py-0.5 font-heading text-sm font-bold text-brand"
          style={{ animation: "sees-cheer-plus 900ms ease-out forwards", opacity: 0 }}
        >
          +1
        </span>
      )}
    </button>
  );
}

/**
 * A 6 px bar under the score, in the two years' colours by share of cheers,
 * and "Year 5 are louder" when one side leads by 10% or more.
 */
export function CheerBar({
  rx,
  homeYear,
  awayYear,
  homeName,
  awayName,
}: {
  rx: Reactions | null;
  homeYear: number | null | undefined;
  awayYear: number | null | undefined;
  /** How to name each side in "… are louder" ("Year 5", or "Ade's fans"). */
  homeName: string;
  awayName: string;
}) {
  if (!rx || !rx.shown || !rx.twoSided) return null;
  const { homeShare, louder } = cheerMeter(rx.totals);
  const home = rx.totals.cheer_home;
  const away = rx.totals.cheer_away;
  const spoken =
    homeShare === null
      ? "Cheer meter: no cheers yet. Tap a crest to cheer."
      : `Cheer meter: ${homeName} ${Math.round(homeShare * 100)}%, ${awayName} ${100 - Math.round(homeShare * 100)}%`;
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-1.5">
      <div role="img" aria-label={spoken} className="relative h-1.5 w-full overflow-hidden rounded-full bg-brand-foreground/15">
        {homeShare !== null && (
          <>
            <span className="absolute inset-0" style={{ background: teamColour(awayYear) }} />
            <span
              className="absolute inset-0 origin-left motion-safe:transition-transform motion-safe:duration-700"
              style={{ background: teamColour(homeYear), transform: `scaleX(${homeShare})` }}
            />
          </>
        )}
      </div>
      <p className="h-4 text-xs font-semibold text-brand-foreground/85" aria-live="polite">
        {louder === "home" ? `${homeName} are louder` : louder === "away" ? `${awayName} are louder` : ""}
        <span className="sr-only">
          {home + away > 0 ? `${formatCount(home)} cheers for ${homeName}, ${formatCount(away)} for ${awayName}.` : ""}
        </span>
      </p>
    </div>
  );
}
