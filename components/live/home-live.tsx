"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Shirt } from "lucide-react";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { Countdown } from "@/components/ui/shared/CountDown";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import type { FixtureCard } from "@/lib/live/fixture-card-types";
import type { FixtureState } from "@/lib/live/live-state-types";
import { EmptyState } from "@/components/brand/empty-state";
import { useLiveFixtures } from "@/lib/live/use-live";
import { cn, formatWAT } from "@/lib/utils";
import { FixtureRow, LiveCard, gameName } from "./fixture-card";
import { LivePulse, ReconnectingPill, teamColour } from "./live-bits";
import { YearCrest } from "@/components/brand/year-crest";
import { Pitch3D } from "./pitch-3d";

// The home page's live parts: Live now, the next match, fixtures by date and
// the latest results. All of it stays live through useLiveFixtures.

const LIVE = new Set<FixtureState["status"]>(["live", "half_time"]);
const DONE = new Set<FixtureState["status"]>(["full_time", "walkover"]);

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export function HomeLive({ cards, serverNow, championship }: { cards: FixtureCard[]; serverNow: number; championship?: ReactNode }) {
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

      {live.length > 0 ? (
        <section aria-labelledby="live-now" className="flex flex-col gap-3">
          <h2 id="live-now" className="flex items-center gap-2 px-4 font-heading text-lg font-bold uppercase lg:px-0">
            <LivePulse /> Live now
          </h2>
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible lg:px-0">
            {live.map((c) => (
              <LiveCard key={c.id} card={c} state={stateOf(c)} />
            ))}
          </div>
        </section>
      ) : next ? (
        <NextUp card={next} />
      ) : null}

      {championship}

      {days.length > 0 && (
        <section aria-labelledby="fixtures" className="flex flex-col gap-4">
          <h2 id="fixtures" className="heading-bar px-4 font-heading text-lg font-bold uppercase lg:px-0">
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
                        "h-10 rounded-full border border-border bg-card px-4 text-sm font-semibold transition-all duration-200 hover:border-ring active:scale-95",
                        active && "border-transparent bg-brand-gradient text-brand-foreground shadow-card",
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
              <div key={group[0].sport.slug} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
                <p className="flex items-center gap-2 border-b border-border bg-soft-gradient px-4 py-2.5 text-xs font-semibold tracking-[0.06em] text-secondary-foreground uppercase">
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
        <section aria-labelledby="results" className="flex flex-col gap-4 px-4 lg:px-0">
          <h2 id="results" className="heading-bar font-heading text-lg font-bold uppercase">
            Latest results
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
            {results.map((c) => (
              <FixtureRow key={c.id} card={c} state={stateOf(c)} label={gameName(c)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Nothing live: a big countdown to the next match. */
function NextUp({ card }: { card: FixtureCard }) {
  return (
    <section
      aria-label="Next match"
      className="relative mx-4 overflow-hidden rounded-3xl bg-pitch-gradient px-5 pt-6 pb-7 text-on-pitch shadow-raised lg:mx-0"
    >
      <CircuitPattern />
      <span
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          background: `linear-gradient(110deg, ${teamColour(card.home?.year)} 0 14%, transparent 36% 64%, ${teamColour(card.away?.year)} 86% 100%)`,
        }}
      />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-on-pitch-accent uppercase">
          <SportIcon sport={card.sport.slug.replace(/-/g, "_")} size={14} />
          Next up · {gameName(card)}
          {card.matchdayNumber ? ` · Matchday ${card.matchdayNumber}` : ""}
        </p>
        {card.sport.slug.startsWith("football") && <Pitch3D homeYear={card.home?.year} awayYear={card.away?.year} />}
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-on-pitch/10 bg-on-pitch/5 px-3 py-4 backdrop-blur-sm">
          <Side name={card.home?.name} short={card.home?.shortName} year={card.home?.year} />
          <span className="font-heading text-xl font-bold opacity-70">v</span>
          <Side name={card.away?.name} short={card.away?.shortName} year={card.away?.year} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold tracking-[0.08em] text-on-pitch/70 uppercase">{card.sport.resultFormat === "timed" ? "Kickoff in" : "Starts in"}</span>
          <Countdown
            targetAt={card.kickoffAt!}
            serverOffsetMs={0}
            showDeadlineLabel={false}
            className="font-heading text-display text-on-pitch!"
          />
          <span className="text-sm text-on-pitch/80">
            {formatWAT(card.kickoffAt!, "datetime")}
            {card.venue ? ` · ${card.venue}` : ""}
          </span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/matches/${card.id}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-on-pitch px-6 text-sm font-semibold text-on-pitch-ink transition-transform active:scale-95"
          >
            Match centre <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/fantasy"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-on-pitch-accent px-6 text-sm font-semibold text-on-pitch-ink transition-transform active:scale-95"
          >
            <Shirt className="size-4" /> Play SEES Fantasy
          </Link>
        </div>
      </div>
    </section>
  );
}

function Side({ name, year }: { name?: string; short?: string; year?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
        <YearCrest year={year} variant="crest" tone="dark" size={84} label="" />
      </span>
      <span className="text-sm font-semibold">{name ?? "TBD"}</span>
    </div>
  );
}
