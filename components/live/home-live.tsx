"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { Countdown } from "@/components/ui/shared/CountDown";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import type { FixtureCard } from "@/lib/live/fixture-card-types";
import type { FixtureState } from "@/lib/live/live-state-types";
import { EmptyState } from "@/components/brand/empty-state";
import { useLiveFixtures } from "@/lib/live/use-live";
import { cn, formatWAT } from "@/lib/utils";
import { FixtureRow, LiveCard, gameName } from "./fixture-card";
import { LivePulse, MatchStatus, ReconnectingPill, RollingScore, teamColour, useClock, useGoalFlash } from "./live-bits";
import { formatScore, sideName } from "@/lib/live/display";
import { YearCrest } from "@/components/brand/year-crest";
import { FixturePhoto, hasPhoto } from "./fixture-photo";
import { useMagnetic, useTilt } from "./use-pointer-motion";

// The home page's live parts: Live now, the next match, fixtures by date and
// the latest results. All of it stays live through useLiveFixtures.

const LIVE = new Set<FixtureState["status"]>(["live", "half_time"]);

/** Fade and rise in once on load (stays still for reduced motion). */
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:fill-mode-backwards";
const DONE = new Set<FixtureState["status"]>(["full_time", "walkover"]);

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function HomeLive({
  cards,
  serverNow,
  championship,
  fantasy,
}: {
  cards: FixtureCard[];
  serverNow: number;
  championship?: ReactNode;
  /** The fantasy stub on the next-match ticket (components/fantasy/ticket-stub.tsx). */
  fantasy?: ReactNode;
}) {
  const { states, status } = useLiveFixtures(cards.map((c) => c.state));
  const stateOf = (c: FixtureCard) => states.get(c.id) ?? c.state;

  const live = cards.filter((c) => LIVE.has(stateOf(c).status));
  const next = cards.find((c) => stateOf(c).status === "scheduled" && c.kickoffAt && new Date(c.kickoffAt).getTime() > serverNow);
  const results = cards
    .filter((c) => DONE.has(stateOf(c).status))
    .sort((a, b) => (b.kickoffAt ?? "").localeCompare(a.kickoffAt ?? ""))
    .slice(0, 5);

  // Fixtures by date (WAT). Start on today, or the next day with fixtures.
  const days = useMemo(() => [...new Set(cards.filter((c) => c.kickoffAt).map((c) => dayKey(c.kickoffAt!)))].sort(), [cards]);
  const today = dayKey(new Date(serverNow).toISOString());
  const [day, setDay] = useState(() => days.find((d) => d >= today) ?? days[days.length - 1] ?? today);
  const onDay = cards.filter((c) => c.kickoffAt && dayKey(c.kickoffAt) === day);
  const groups = new Map<string, FixtureCard[]>();
  for (const c of onDay) groups.set(c.sport.slug, [...(groups.get(c.sport.slug) ?? []), c]);
  const bySport = [...groups.values()].sort((a, b) => a[0].sport.sortOrder - b[0].sport.sortOrder);

  return (
    <>
      <ReconnectingPill show={status === "reconnecting"} />

      {live.length === 1 ? (
        <LiveTicket card={live[0]} state={stateOf(live[0])} fantasy={fantasy} />
      ) : live.length > 1 ? (
        <section aria-labelledby="live-now" className="flex flex-col gap-3">
          <h2 id="live-now" className="flex items-center gap-2 px-4 font-heading text-xl font-bold uppercase lg:px-0">
            <LivePulse /> Live now
          </h2>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:px-0">
            {live.map((c) => (
              <LiveCard key={c.id} card={c} state={stateOf(c)} />
            ))}
          </div>
        </section>
      ) : next ? (
        <NextUp card={next} fantasy={fantasy} />
      ) : null}

      {championship}

      {days.length > 0 && (
        <section aria-labelledby="fixtures" className="sees-reveal flex flex-col gap-3">
          <h2 id="fixtures" className="px-4 font-heading text-xl font-bold uppercase lg:px-0">
            Fixtures
          </h2>
          <nav aria-label="Pick a day" className="overflow-x-auto px-4 [scrollbar-width:none] lg:px-0">
            <ul className="flex min-w-max gap-2">
              {days.map((d) => {
                const active = d === day;
                const label = d === today ? "Today" : formatWAT(`${d}T12:00:00+01:00`, "date");
                return (
                  <li key={d}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDay(d)}
                      className={cn(
                        "h-10 rounded-full border border-border px-4 text-sm font-semibold transition-all duration-200 active:scale-95",
                        active && "border-transparent bg-primary text-primary-foreground shadow-card",
                      )}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div key={day} className="flex flex-col gap-3 px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:px-0">
            {bySport.length === 0 && <EmptyState art="calendar" title="Rest day" description="No fixtures on this day. Pick another date." compact />}
            {bySport.map((group) => (
              <div key={group[0].sport.slug} className="overflow-hidden rounded-xl bg-card shadow-card">
                <p className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  <SportIcon sport={group[0].sport.slug.replace(/-/g, "_")} size={14} />
                  {group[0].sport.name}
                  {group[0].venue && <span className="ml-auto font-medium normal-case tracking-normal">{group[0].venue}</span>}
                </p>
                <ul className="divide-y divide-border">
                  {group.map((c) => (
                    <FixtureRow
                      key={c.id}
                      card={c}
                      state={stateOf(c)}
                      label={new Set(group.map((g) => g.event.id)).size > 1 ? gameName(c) : undefined}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section aria-labelledby="results" className="sees-reveal flex flex-col gap-3 px-4 lg:px-0">
          <h2 id="results" className="font-heading text-xl font-bold uppercase">
            Latest results
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-card">
            {results.map((c) => (
              <FixtureRow key={c.id} card={c} state={stateOf(c)} label={gameName(c)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * One match live: the same ticket as Next up, with the live score and clock
 * in the middle (rolling digits, a flash in the scorer's colour on a goal)
 * and the fantasy stub torn off underneath. Several live: the swipeable
 * carousel above instead. Scores arrive through useLiveFixtures, so the
 * ticket updates the moment the official records a goal.
 */
function LiveTicket({ card, state, fantasy }: { card: FixtureCard; state: FixtureState; fantasy?: ReactNode }) {
  const tilt = useTilt<HTMLElement>();
  const magnet = useMagnetic<HTMLAnchorElement>();
  const clock = useClock({ state, periodMinutes: card.event.periodMinutes, extraPeriodMinutes: card.event.extraPeriodMinutes });
  const flash = useGoalFlash(state.homeScore, state.awayScore);
  const flashTeam = flash === "home" ? card.home : flash === "away" ? card.away : null;
  const photo = hasPhoto(card.sport.slug);
  return (
    <section
      ref={tilt}
      aria-label="Live now"
      className={cn(
        "relative mx-4 overflow-hidden rounded-2xl bg-pitch text-brand-foreground shadow-raised transition-transform duration-300 ease-out lg:mx-0",
        photo && "sees-on-photo",
      )}
    >
      <FixturePhoto sport={card.sport.slug} homeYear={card.home?.year} awayYear={card.away?.year} priority />
      {photo ? (
        <span aria-hidden className="sees-glare" />
      ) : (
        <>
          <CircuitPattern />
          <span
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              background: `linear-gradient(110deg, ${teamColour(card.home?.year)} 0 18%, transparent 40% 60%, ${teamColour(card.away?.year)} 82% 100%)`,
            }}
          />
        </>
      )}
      {flashTeam && (
        <span
          aria-hidden
          className="absolute inset-0 motion-safe:animate-in motion-safe:fade-in"
          style={{ boxShadow: `inset 0 0 0 3px ${teamColour(flashTeam.year)}, inset 0 0 64px ${teamColour(flashTeam.year)}` }}
        />
      )}
      <div className="relative flex flex-col items-center gap-4 px-5 pt-5 pb-5 text-center">
        <p className={cn("flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-brand-light uppercase", ENTER, "motion-safe:slide-in-from-top-2 motion-safe:duration-500")}>
          <LivePulse /> Live now · {gameName(card)}
          {card.matchdayNumber ? ` · Matchday ${card.matchdayNumber}` : ""}
        </p>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Side name={card.home?.name} short={card.home?.shortName} year={card.home?.year} from="left" />
          <div className={cn("flex flex-col items-center gap-2", ENTER, "motion-safe:zoom-in-75 motion-safe:duration-500 motion-safe:delay-300")}>
            <div className="flex items-baseline gap-2 font-heading text-score font-bold">
              <RollingScore value={state.homeScore} text={formatScore(state.homeScore, card.event.boards)} />
              <span className="text-2xl opacity-60">–</span>
              <RollingScore value={state.awayScore} text={formatScore(state.awayScore, card.event.boards)} />
            </div>
            <MatchStatus clock={clock} kickoffAt={card.kickoffAt} className="bg-background/90" />
          </div>
          <Side name={card.away?.name} short={card.away?.shortName} year={card.away?.year} from="right" />
        </div>
        <div className="flex h-6 items-center text-sm text-brand-foreground/85">
          {flashTeam ? (
            <span
              className="inline-block rounded-full px-3 py-0.5 font-heading text-sm font-bold tracking-wide text-team-foreground uppercase motion-safe:animate-in motion-safe:zoom-in-50"
              style={{ background: teamColour(flashTeam.year) }}
            >
              {card.sport.resultFormat === "timed" ? "Goal" : "Point"} {flash ? sideName(card, flash) : flashTeam.shortName}!
            </span>
          ) : (
            card.venue
          )}
        </div>
        <Link
          ref={magnet}
          href={`/matches/${card.id}`}
          prefetch
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-foreground text-[0.9375rem] font-bold text-brand shadow-raised transition-[translate,scale] duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-brand-light active:scale-[0.98] sm:max-w-xs",
            ENTER,
            "motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:delay-500",
          )}
        >
          Watch live <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {fantasy && (
        <>
          <div aria-hidden className="relative mx-4 border-t-2 border-dashed border-brand-foreground/25">
            <span className="absolute -top-[13px] -left-[29px] size-6 rounded-full bg-background" />
            <span className="absolute -top-[13px] -right-[29px] size-6 rounded-full bg-background" />
          </div>
          {fantasy}
        </>
      )}
    </section>
  );
}

/**
 * Nothing live: the next match as a ticket. The match on top with one clear
 * action, fantasy on a tear-off stub with its own deadline.
 */
function NextUp({ card, fantasy }: { card: FixtureCard; fantasy?: ReactNode }) {
  const tilt = useTilt<HTMLElement>();
  const magnet = useMagnetic<HTMLAnchorElement>();
  const photo = hasPhoto(card.sport.slug);
  return (
    <section
      ref={tilt}
      aria-label="Next match"
      className={cn(
        "relative mx-4 overflow-hidden rounded-2xl bg-pitch text-brand-foreground shadow-raised transition-transform duration-300 ease-out lg:mx-0",
        photo && "sees-on-photo",
      )}
    >
      <FixturePhoto sport={card.sport.slug} homeYear={card.home?.year} awayYear={card.away?.year} priority />
      {photo ? (
        <span aria-hidden className="sees-glare" />
      ) : (
        <>
          <CircuitPattern />
          <span
            aria-hidden
            className="absolute inset-0 opacity-30"
            style={{
              background: `linear-gradient(110deg, ${teamColour(card.home?.year)} 0 18%, transparent 40% 60%, ${teamColour(card.away?.year)} 82% 100%)`,
            }}
          />
        </>
      )}
      <div className="relative flex flex-col items-center gap-4 px-5 pt-5 pb-5 text-center">
        <p className={cn("flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-light uppercase", ENTER, "motion-safe:slide-in-from-top-2 motion-safe:duration-500")}>
          <SportIcon sport={card.sport.slug.replace(/-/g, "_")} size={14} />
          Next up · {gameName(card)}
          {card.matchdayNumber ? ` · Matchday ${card.matchdayNumber}` : ""}
        </p>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Side name={card.home?.name} short={card.home?.shortName} year={card.home?.year} from="left" />
          <span className={cn("font-heading text-2xl font-bold opacity-70", ENTER, "motion-safe:zoom-in-50 motion-safe:duration-500 motion-safe:delay-300")}>v</span>
          <Side name={card.away?.name} short={card.away?.shortName} year={card.away?.year} from="right" />
        </div>
        <div className={cn("flex flex-col items-center gap-1", ENTER, "motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:delay-300")}>
          <span className="text-xs font-semibold tracking-[0.08em] text-brand-foreground/70 uppercase">{card.sport.resultFormat === "timed" ? "Kickoff in" : "Starts in"}</span>
          <Countdown
            targetAt={card.kickoffAt!}
            serverOffsetMs={0}
            showDeadlineLabel={false}
            className="font-heading text-display text-brand-foreground!"
          />
          <span className="text-sm text-brand-foreground/85">
            {formatWAT(card.kickoffAt!, "datetime")}
            {card.venue ? ` · ${card.venue}` : ""}
          </span>
        </div>
        <Link
          ref={magnet}
          href={`/matches/${card.id}`}
          className={cn(
            "inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-foreground text-[0.9375rem] font-bold text-brand shadow-raised transition-[translate,scale] duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-brand-light active:scale-[0.98] sm:max-w-xs",
            ENTER,
            "motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:delay-500",
          )}
        >
          Open match centre <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {fantasy && (
        <>
          <div aria-hidden className="relative mx-4 border-t-2 border-dashed border-brand-foreground/25">
            <span className="absolute -top-[13px] -left-[29px] size-6 rounded-full bg-background" />
            <span className="absolute -top-[13px] -right-[29px] size-6 rounded-full bg-background" />
          </div>
          {fantasy}
        </>
      )}
    </section>
  );
}

function Side({ name, year, from }: { name?: string; short?: string; year?: number; from: "left" | "right" }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        ENTER,
        "motion-safe:duration-700 motion-safe:delay-150",
        from === "left" ? "motion-safe:slide-in-from-left-6" : "motion-safe:slide-in-from-right-6",
      )}
    >
      <span className="motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
        <YearCrest year={year} variant="crest" tone="dark" size={84} label="" />
      </span>
      <span className="text-sm font-semibold">{name ?? "TBD"}</span>
    </div>
  );
}
