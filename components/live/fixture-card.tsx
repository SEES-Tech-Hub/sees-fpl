"use client";

import Link from "next/link";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import type { FixtureCard } from "@/lib/live/fixture-card-types";
import type { FixtureState } from "@/lib/live/live-state-types";
import type { TeamSummary } from "@/lib/live/types";
import { cn } from "@/lib/utils";
import { MatchStatus, RollingScore, teamColour, useClock, useGoalFlash } from "./live-bits";

const sportSlug = (slug: string) => slug.replace(/-/g, "_");

function TeamDisc({ team, size = "md" }: { team: TeamSummary | null; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-heading font-bold text-team-foreground ring-2 ring-brand-foreground/70",
        size === "lg" ? "size-12 text-base" : "size-7 text-xs",
      )}
      style={{ background: teamColour(team?.year) }}
    >
      {team?.shortName ?? "?"}
    </span>
  );
}

const stageLabel = (stage: string) => {
  const t = stage.replace(/[_-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

/** The game's name when a sport has several (Chess, Scrabble…), else the sport's. */
export const gameName = (card: Pick<FixtureCard, "sport" | "event">) =>
  card.sport.slug === "football" || card.event.name === card.sport.name ? card.sport.name : card.event.name;

/** The line above a big card: the sport or game, then the matchday or round. */
export function cardKicker(card: FixtureCard) {
  const when =
    (card.stage === "group" || card.stage === "league") && card.matchdayNumber ? `Matchday ${card.matchdayNumber}` : stageLabel(card.stage);
  return when ? `${gameName(card)} · ${when}` : gameName(card);
}

const hasScore = (s: FixtureState) => s.status !== "scheduled" && s.status !== "postponed" && s.status !== "cancelled";

/** The big card for "Live now": team colours, a rolling score and a goal flash. */
export function LiveCard({ card, state }: { card: FixtureCard; state: FixtureState }) {
  const clock = useClock({ state, periodMinutes: card.event.periodMinutes, extraPeriodMinutes: card.event.extraPeriodMinutes });
  const flash = useGoalFlash(state.homeScore, state.awayScore);
  const flashTeam = flash === "home" ? card.home : flash === "away" ? card.away : null;

  return (
    <Link
      href={`/matches/${card.id}`}
      className="group relative block w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-pitch p-4 text-brand-foreground shadow-raised outline-none focus-visible:ring-3 focus-visible:ring-ring sm:w-auto"
    >
      {/* Team colour wedges from each side */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-35"
        style={{
          background: `linear-gradient(110deg, ${teamColour(card.home?.year)} 0 22%, transparent 42% 58%, ${teamColour(card.away?.year)} 78% 100%)`,
        }}
      />
      {flashTeam && (
        <span
          aria-hidden
          className="absolute inset-0 motion-safe:animate-in motion-safe:fade-in"
          style={{ boxShadow: `inset 0 0 0 3px ${teamColour(flashTeam.year)}, inset 0 0 48px ${teamColour(flashTeam.year)}` }}
        />
      )}
      <div className="relative flex items-center justify-between text-xs font-semibold tracking-[0.06em] text-brand-foreground/80 uppercase">
        <span className="flex items-center gap-1.5">
          <SportIcon sport={sportSlug(card.sport.slug)} size={14} />
          {cardKicker(card)}
        </span>
        <MatchStatus clock={clock} kickoffAt={card.kickoffAt} className="bg-background/90" />
      </div>
      <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <TeamDisc team={card.home} size="lg" />
          <span className="text-sm font-semibold">{card.home?.name ?? "TBD"}</span>
        </div>
        <div className="flex items-baseline gap-2 font-heading text-score font-bold">
          <RollingScore value={state.homeScore} />
          <span className="text-2xl opacity-60">–</span>
          <RollingScore value={state.awayScore} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <TeamDisc team={card.away} size="lg" />
          <span className="text-sm font-semibold">{card.away?.name ?? "TBD"}</span>
        </div>
      </div>
      <div className="relative mt-3 h-5 text-center text-xs text-brand-foreground/80">
        {flashTeam ? (
          <span
            className="inline-block rounded-full px-3 py-0.5 font-heading text-sm font-bold tracking-wide text-team-foreground uppercase motion-safe:animate-in motion-safe:zoom-in-50"
            style={{ background: teamColour(flashTeam.year) }}
          >
            Goal {flashTeam.shortName}!
          </span>
        ) : (
          card.venue
        )}
      </div>
    </Link>
  );
}

/**
 * One line in a fixture list: status, both teams and the score. `label`
 * names the game above the teams when a list mixes several (Chess, Ludo…).
 */
export function FixtureRow({ card, state, label }: { card: FixtureCard; state: FixtureState; label?: string }) {
  const clock = useClock({ state, periodMinutes: card.event.periodMinutes, extraPeriodMinutes: card.event.extraPeriodMinutes });
  const flash = useGoalFlash(state.homeScore, state.awayScore);
  const showScore = hasScore(state);
  const won = (t: TeamSummary | null) => state.status === "full_time" && t && state.winnerTeamId === t.id;

  return (
    <li>
      <Link
        href={`/matches/${card.id}`}
        className={cn(
          "grid min-h-14 grid-cols-[3.75rem_1fr_auto_1fr] items-center gap-2 px-3 py-2 transition-colors duration-300 hover:bg-muted",
          flash && "bg-highlight/20",
        )}
      >
        {label && (
          <span className="col-span-4 -mb-1 truncate text-[0.6875rem] font-semibold tracking-[0.06em] text-brand uppercase">{label}</span>
        )}
        <MatchStatus clock={clock} kickoffAt={card.kickoffAt} className="justify-self-start" />
        <span className={cn("flex min-w-0 items-center justify-end gap-2 text-right text-[0.9375rem]", won(card.home) && "font-bold")}>
          <span className="truncate">{card.home?.name ?? "TBD"}</span>
          <TeamDisc team={card.home} />
        </span>
        <span className="min-w-12 text-center font-heading text-lg font-bold tabular-nums">
          {showScore ? (
            <>
              <RollingScore value={state.homeScore} /> – <RollingScore value={state.awayScore} />
            </>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">v</span>
          )}
        </span>
        <span className={cn("flex min-w-0 items-center gap-2 text-[0.9375rem]", won(card.away) && "font-bold")}>
          <TeamDisc team={card.away} />
          <span className="truncate">{card.away?.name ?? "TBD"}</span>
        </span>
      </Link>
    </li>
  );
}
