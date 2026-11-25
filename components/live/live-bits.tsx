"use client";

import { useEffect, useRef, useState } from "react";
import { getClockState, msUntilNextMinute, type ClockState } from "@/lib/live/clock";
import type { FixtureState } from "@/lib/live/live-state-types";
import { formatWAT } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Small live pieces shared by the home page and the match page.

export { teamColour } from "@/lib/design/team-colour";

type ClockInput = { state: FixtureState; periodMinutes: number | null; extraPeriodMinutes: number | null };

/**
 * The match clock, worked out in the browser from the period's start time.
 * It re-renders once a minute (not every second), which is kind to phones.
 */
export function useClock({ state, periodMinutes, extraPeriodMinutes }: ClockInput): ClockState {
  const fixture = {
    status: state.status,
    currentPeriod: state.currentPeriod,
    periodStartedAt: state.periodStartedAt,
    periodMinutes,
    extraPeriodMinutes,
  };
  const [, setTick] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const ms = msUntilNextMinute(fixture);
      if (ms === null) return;
      timer = setTimeout(() => {
        setTick((n) => n + 1);
        arm();
      }, ms + 50);
    };
    arm();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when the clock inputs change
  }, [state.status, state.currentPeriod, state.periodStartedAt, periodMinutes, extraPeriodMinutes]);
  return getClockState(fixture);
}

/** "LIVE 23'", "HT", "FT", or the kickoff time in WAT. */
export function MatchStatus({ clock, kickoffAt, className }: { clock: ClockState; kickoffAt: string | null; className?: string }) {
  if (clock.kind === "running" || clock.kind === "penalties") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-live/10 px-2.5 py-0.5 text-xs font-bold text-live tabular-nums", className)}>
        <LivePulse />
        {clock.kind === "penalties" ? "PENS" : clock.label}
      </span>
    );
  }
  if (clock.kind === "break") {
    return (
      <span className={cn("inline-flex items-center rounded-full bg-highlight px-2.5 py-0.5 text-xs font-bold text-highlight-foreground", className)}>
        {clock.label}
      </span>
    );
  }
  if (clock.kind === "finished" || clock.kind === "walkover") {
    return <span className={cn("text-xs font-bold tracking-wide text-muted-foreground", className)}>{clock.label}</span>;
  }
  if (clock.kind === "postponed" || clock.kind === "cancelled") {
    return (
      <span className={cn("rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground", className)}>
        {clock.kind === "postponed" ? "Postponed" : "Cancelled"}
      </span>
    );
  }
  return (
    <span className={cn("text-xs font-semibold text-muted-foreground tabular-nums", className)}>
      {kickoffAt ? formatWAT(kickoffAt, "time") : "TBD"}
    </span>
  );
}

export function LivePulse({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-flex size-2", className)}>
      <span className="absolute inset-0 rounded-full bg-live opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-live" />
    </span>
  );
}

/** A score digit that rolls up into place when it changes (not on first load). */
export function RollingScore({ value, text, className }: { value: number | null; text?: string; className?: string }) {
  const [first] = useState(value);
  const changed = value !== first;
  return (
    <span className={cn("inline-flex overflow-hidden tabular-nums", className)}>
      <span
        key={value ?? "none"}
        className={cn(changed && "motion-safe:animate-in motion-safe:slide-in-from-bottom-[60%] motion-safe:fade-in motion-safe:duration-500")}
      >
        {text ?? value ?? "–"}
      </span>
    </span>
  );
}

/**
 * Which team just scored, for 3 s after their score goes up (null otherwise).
 * Phones also get a short buzz, where the browser allows it.
 */
export function useGoalFlash(homeScore: number | null, awayScore: number | null): "home" | "away" | null {
  const prev = useRef({ home: homeScore, away: awayScore });
  const [flash, setFlash] = useState<"home" | "away" | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { home: homeScore, away: awayScore };
    const side = (homeScore ?? 0) > (before.home ?? 0) ? "home" : (awayScore ?? 0) > (before.away ?? 0) ? "away" : null;
    if (!side) return;
    setFlash(side);
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {
      // Not allowed without a tap first, or not supported: fine.
    }
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [homeScore, awayScore]);
  return flash;
}

/** "Reconnecting…" while polling is failing. */
export function ReconnectingPill({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="fixed inset-x-0 top-16 z-40 mx-auto w-fit rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background shadow-raised motion-safe:animate-in motion-safe:fade-in">
      Reconnecting…
    </p>
  );
}

/**
 * Confetti from the winner's side when a match you're watching ends (both
 * sides for a draw). Only on the live transition to full time, never when
 * opening a finished match. Off for reduced motion.
 */
export function useFullTimeConfetti(state: FixtureState, homeTeamId: string | null, homeYear?: number, awayYear?: number) {
  const prev = useRef(state.status);
  useEffect(() => {
    const before = prev.current;
    prev.current = state.status;
    if (state.status !== "full_time" || before === "full_time" || before === "scheduled") return;
    void (async () => {
      const { default: confetti } = await import("canvas-confetti");
      const css = getComputedStyle(document.documentElement);
      const tone = (year?: number) => (year ? css.getPropertyValue(`--team-y${year}`).trim() : "");
      const brand = [css.getPropertyValue("--brand-light").trim(), css.getPropertyValue("--highlight").trim()].filter(Boolean);
      const winnerHome = state.winnerTeamId ? state.winnerTeamId === homeTeamId : (state.homeScore ?? 0) > (state.awayScore ?? 0);
      const draw = !state.winnerTeamId && state.homeScore === state.awayScore;
      const burst = (x: number, angle: number, year?: number) =>
        confetti({
          particleCount: 120,
          spread: 70,
          startVelocity: 58,
          angle,
          origin: { x, y: 0.7 },
          colors: [tone(year), ...brand].filter(Boolean),
          disableForReducedMotion: true,
          zIndex: 200,
        });
      if (draw || winnerHome) burst(0.1, 60, homeYear);
      if (draw || !winnerHome) burst(0.9, 120, awayYear);
    })();
  }, [state.status, state.winnerTeamId, state.homeScore, state.awayScore, homeTeamId, homeYear, awayYear]);
}
