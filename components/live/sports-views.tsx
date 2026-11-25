"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { SlidingTabs } from "@/components/fantasy/motion-bits";
import { MotionProvider } from "@/components/fantasy/motion-provider";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { teamColour } from "@/lib/design/team-colour";
import type { FixtureCard } from "@/lib/live/fixture-card-types";
import type { SportSummary } from "@/lib/live/public-pages";
import type { EventStandingRow, RaceResultRow, ResultFormat, StandingRow } from "@/lib/live/types";
import { useLiveFixtures } from "@/lib/live/use-live";
import { cn, formatWAT } from "@/lib/utils";
import { formatScore } from "@/lib/live/display";
import { FixtureRow, gameName } from "./fixture-card";
import { LivePulse, ReconnectingPill } from "./live-bits";
import { Empty, Medal } from "./tables-view";

const FORMAT_LABEL: Record<ResultFormat, string> = {
  timed: "Timed match",
  sets: "Sets",
  head_to_head: "Head-to-head",
  ranked: "Races and results",
};
const icon = (slug: string) => slug.replace(/-/g, "_");
const LIVE = new Set(["live", "half_time"]);

// ---------------------------------------------------------------------------
// /sports: every sport as a tile
// ---------------------------------------------------------------------------

export function SportsGrid({ sports, cards }: { sports: SportSummary[]; cards: FixtureCard[] }) {
  const { states, status } = useLiveFixtures(cards.map((c) => c.state));
  return (
    <>
      <ReconnectingPill show={status === "reconnecting"} />
      <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:px-0">
        {sports.map((s, i) => {
          const mine = cards.filter((c) => c.sport.slug === s.slug);
          const live = mine.filter((c) => LIVE.has((states.get(c.id) ?? c.state).status)).length;
          const next = mine.find((c) => (states.get(c.id) ?? c.state).status === "scheduled" && c.kickoffAt);
          return (
            <li
              key={s.id}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <Link
                href={`/sports/${s.slug}`}
                className="group relative flex h-full min-h-32 flex-col justify-between overflow-hidden rounded-2xl bg-card p-4 shadow-card transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <span className="flex items-start justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-brand transition-transform duration-300 group-hover:rotate-[-8deg]">
                    <SportIcon sport={icon(s.slug)} size={24} />
                  </span>
                  {live > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-live/10 px-2 py-0.5 text-xs font-bold text-live">
                      <LivePulse /> {live} live
                    </span>
                  )}
                </span>
                <span>
                  <span className="block font-heading text-lg leading-tight font-bold">{s.name}</span>
                  {s.events.length > 1 && (
                    <span className="mt-0.5 block truncate text-xs font-medium text-brand">{s.events.map((e) => e.name.replace(/ \((men|women)\)$/i, "")).filter((n, i, a) => a.indexOf(n) === i).join(" · ")}</span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {next?.kickoffAt ? `Next: ${formatWAT(next.kickoffAt, "date")}` : mine.length ? `${mine.length} fixtures` : FORMAT_LABEL[s.resultFormat]}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// /sports/<slug>
// ---------------------------------------------------------------------------

type Tab = "fixtures" | "table" | "results";

export function SportView({
  sport,
  cards,
  tables,
  races,
}: {
  sport: SportSummary;
  cards: FixtureCard[];
  tables: { event: SportSummary["events"][number]; rows: (StandingRow | EventStandingRow)[] }[];
  races: { fixtureId: string; results: RaceResultRow[] }[];
}) {
  const { states, status } = useLiveFixtures(cards.map((c) => c.state));
  const ranked = sport.resultFormat === "ranked";
  const [tab, setTab] = useLocalStorageState<Tab>(`sees-live:sport-tab:${sport.slug}`, "fixtures");
  const current: Tab = ranked && tab === "table" ? "results" : !ranked && tab === "results" ? "table" : tab;

  // Sports with several games (Board Games: Chess, Scrabble…) get a game filter.
  const multi = sport.events.length > 1;
  const [gameChoice, setGame] = useLocalStorageState<string>(`sees-live:sport-game:${sport.slug}`, "all");
  const game = multi && sport.events.some((e) => e.id === gameChoice) ? gameChoice : "all";
  const shownCards = game === "all" ? cards : cards.filter((c) => c.event.id === game);
  const shownTables = game === "all" ? tables : tables.filter((t) => t.event.id === game);
  const labelOf = multi && game === "all" ? (c: FixtureCard) => gameName(c) : undefined;

  return (
    <MotionProvider>
      <ReconnectingPill show={status === "reconnecting"} />
      <div className="flex flex-col gap-4 px-4 lg:px-0">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-pitch text-brand-light">
            <SportIcon sport={icon(sport.slug)} size={30} />
          </span>
          <div>
            <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{FORMAT_LABEL[sport.resultFormat]}</p>
            <h1 className="font-heading text-display leading-none font-bold text-brand uppercase">{sport.name}</h1>
          </div>
        </div>
        <SlidingTabs
          label={sport.name}
          value={current}
          onValueChange={setTab}
          className="w-full max-w-xs"
          items={[
            { value: "fixtures", label: "Fixtures" },
            ranked ? { value: "results", label: "Results" } : { value: "table", label: "Table" },
          ]}
        />
        {multi && <GameFilter games={sport.events} value={game} onChange={setGame} />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${current}:${game}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {current === "fixtures" && <FixturesByDate cards={shownCards} labelOf={labelOf} stateOf={(c) => states.get(c.id) ?? c.state} />}
            {current === "table" && (
              <>
                {shownTables.map((t) => (
                  <EventTable
                    key={t.event.id}
                    title={multi ? t.event.name : undefined}
                    rows={t.rows}
                    sets={sport.resultFormat === "sets"}
                    boards={sport.slug === "board-games"}
                  />
                ))}
                <Knockouts cards={shownCards} labelOf={labelOf} stateOf={(c) => states.get(c.id) ?? c.state} />
              </>
            )}
            {current === "results" && <Races cards={shownCards} races={races} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionProvider>
  );
}

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Chips for each game in a sport, with the highlight sliding between them. */
function GameFilter({ games, value, onChange }: { games: SportSummary["events"]; value: string; onChange: (id: string) => void }) {
  const items = [{ id: "all", name: "All games" }, ...games];
  return (
    <div role="radiogroup" aria-label="Game" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
      {items.map((g) => {
        const on = g.id === value;
        return (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(g.id)}
            className={cn(
              "relative h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
              on ? "text-brand-light" : "bg-card text-muted-foreground shadow-card hover:text-foreground",
            )}
          >
            {on && <motion.span layoutId="game-filter" className="absolute inset-0 rounded-full bg-pitch" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative">{g.name}</span>
          </button>
        );
      })}
    </div>
  );
}

function FixturesByDate({
  cards,
  stateOf,
  labelOf,
}: {
  cards: FixtureCard[];
  stateOf: (c: FixtureCard) => FixtureCard["state"];
  labelOf?: (c: FixtureCard) => string;
}) {
  if (cards.length === 0) return <Empty art="calendar" title="No fixtures yet" text="The organisers add them before the event. Check back soon." />;
  const days = new Map<string, FixtureCard[]>();
  for (const c of cards) {
    const k = c.kickoffAt ? dayKey(c.kickoffAt) : "tbd";
    days.set(k, [...(days.get(k) ?? []), c]);
  }
  return (
    <>
      {[...days].map(([k, list]) => (
        <section key={k} className="overflow-hidden rounded-xl bg-card shadow-card">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {k === "tbd" ? "Date to be confirmed" : formatWAT(`${k}T12:00:00+01:00`, "date")}
          </p>
          <ul className="divide-y divide-border">
            {list.map((c) => (
              <FixtureRow key={c.id} card={c} state={stateOf(c)} label={labelOf?.(c)} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function EventTable({
  title,
  rows,
  sets,
  boards = false,
}: {
  title?: string;
  rows: (StandingRow | EventStandingRow)[];
  sets: boolean;
  /** Board games: ranked by board points (stored doubled), shown as halves. */
  boards?: boolean;
}) {
  if (rows.length === 0) return <Empty art="trophy" title="No table yet" text="It fills in with the first results." />;
  const started = rows.some((r) => r.played > 0);
  const forOf = (r: StandingRow | EventStandingRow) => ("goalsFor" in r ? r.goalsFor : sets ? r.setsFor : r.scoreFor);
  const againstOf = (r: StandingRow | EventStandingRow) => ("goalsAgainst" in r ? r.goalsAgainst : sets ? r.setsAgainst : r.scoreAgainst);
  return (
    <section className="overflow-x-auto rounded-xl bg-card shadow-card">
      {title && <h2 className="border-b border-border px-3 py-2.5 font-heading text-lg font-bold">{title}</h2>}
      <table className="w-full min-w-[21rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-8 py-2 pl-3 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Team</th>
            {["P", "W", "L", sets ? "Sets" : boards ? "Boards" : "+/−"].map((h) => (
              <th key={h} className="w-10 py-2 text-center font-semibold">
                {h}
              </th>
            ))}
            <th className="w-10 py-2 pr-3 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <motion.tr layout key={r.team.id} className={cn("border-b border-border last:border-b-0", r.live && "bg-live/5")}>
              <td className="py-2.5 pl-3 font-heading font-bold">{started ? `${r.position}${r.positionShared ? "=" : ""}` : "–"}</td>
              <td className="max-w-0 py-2.5">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold text-team-foreground"
                    style={{ background: teamColour(r.team.year) }}
                  >
                    {r.team.shortName}
                  </span>
                  <span className="truncate font-semibold">{r.team.name}</span>
                  {r.live && <LivePulse />}
                </span>
              </td>
              <td className="text-center tabular-nums">{r.played}</td>
              <td className="text-center tabular-nums">{r.won}</td>
              <td className="text-center tabular-nums">{r.lost}</td>
              <td className={cn("text-center tabular-nums", boards && "font-heading text-base font-bold")}>
                {sets ? `${forOf(r)}–${againstOf(r)}` : boards ? formatScore(forOf(r), 1) : forOf(r) - againstOf(r)}
              </td>
              <td className="pr-3 text-center font-heading text-base font-bold tabular-nums">{r.points}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const STAGE_ORDER = ["quarter_final", "semi_final", "third_place", "final"];
const stageName = (s: string) => {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

/** Knockout rounds, in order: the bracket as a list per round. */
function Knockouts({
  cards,
  stateOf,
  labelOf,
}: {
  cards: FixtureCard[];
  stateOf: (c: FixtureCard) => FixtureCard["state"];
  labelOf?: (c: FixtureCard) => string;
}) {
  const ko = cards.filter((c) => c.stage !== "league" && c.stage !== "group");
  if (ko.length === 0) return null;
  const rounds = new Map<string, FixtureCard[]>();
  for (const c of ko) rounds.set(c.stage, [...(rounds.get(c.stage) ?? []), c]);
  const ordered = [...rounds].sort((a, b) => STAGE_ORDER.indexOf(a[0]) - STAGE_ORDER.indexOf(b[0]));
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-xl font-bold uppercase">Knockouts</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {ordered.map(([stage, list]) => (
          <div key={stage} className="overflow-hidden rounded-xl bg-card shadow-card">
            <p className="border-b border-border px-3 py-2 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{stageName(stage)}</p>
            <ul className="divide-y divide-border">
              {list.map((c) => (
                <FixtureRow key={c.id} card={c} state={stateOf(c)} label={labelOf?.(c)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Ranked sports: each race with its podium. */
function Races({ cards, races }: { cards: FixtureCard[]; races: { fixtureId: string; results: RaceResultRow[] }[] }) {
  if (cards.length === 0) return <Empty art="stands" title="No races yet" text="The organisers add them before the event. The stands are waiting." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => {
        const results = races.find((r) => r.fixtureId === c.id)?.results ?? [];
        const podium = results.filter((r) => r.medal).sort((a, b) => (a.position ?? 9) - (b.position ?? 9));
        return (
          <Link key={c.id} href={`/matches/${c.id}`} className="group rounded-xl bg-card p-3 shadow-card transition-transform hover:-translate-y-0.5">
            <p className="flex items-center justify-between text-sm font-semibold">
              <span>
                {c.event.name}
                {c.stage && c.stage !== "final" ? ` · ${stageName(c.stage)}` : ""}
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </p>
            {podium.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{c.kickoffAt ? formatWAT(c.kickoffAt, "datetime") : "Time to be confirmed"}</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1">
                {podium.map((r) => (
                  <li key={r.entryId} className="flex items-center gap-2 text-sm">
                    <span className="w-4">{r.medal && <Medal tone={r.medal} />}</span>
                    <span className="flex-1 truncate">{r.athleteName ?? r.team.name}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{r.team.shortName}</span>
                  </li>
                ))}
              </ol>
            )}
          </Link>
        );
      })}
    </div>
  );
}
