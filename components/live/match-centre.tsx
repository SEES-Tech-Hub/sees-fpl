"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Star, X } from "lucide-react";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { SlidingTabs } from "@/components/fantasy/motion-bits";
import { MotionProvider } from "@/components/fantasy/motion-provider";
import { Countdown } from "@/components/ui/shared/CountDown";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { teamColour } from "@/lib/design/team-colour";
import type { FixtureState } from "@/lib/live/live-state-types";
import type { MatchPageData } from "@/lib/live/match-page";
import type { LineupPlayer, TeamSummary, TimelineEntry } from "@/lib/live/types";
import { useLiveFixture } from "@/lib/live/use-live";
import { cn, formatWAT } from "@/lib/utils";
import { MatchStatus, ReconnectingPill, RollingScore, useClock, useGoalFlash } from "./live-bits";
import { NotifyBell } from "./notify-bell";
import { RaceView } from "./race-view";

type Tab = "timeline" | "lineups";

/** "league" → "League", "third_place" → "Third place". */
const stageLabel = (stage: string) => {
  const s = stage.replace(/[_-]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
};

const minuteLabel = (e: TimelineEntry) =>
  e.minute === null ? "" : `${e.minute}${e.addedMinutes ? `+${e.addedMinutes}` : ""}'`;

export function MatchCentre({ data }: { data: MatchPageData }) {
  const { fixture, timeline, lineups, setScores } = data;
  const { state, status } = useLiveFixture(fixture.id, data.state, data.version);
  const [savedTab, setTab] = useLocalStorageState<Tab>("sees-live:match-tab", "timeline");
  // Only timed sports (football, handball, basketball) have lineups.
  const timed = fixture.sport.resultFormat === "timed";
  const tab: Tab = timed ? savedTab : "timeline";

  if (fixture.sport.resultFormat === "ranked") {
    return (
      <MotionProvider>
        <ReconnectingPill show={status === "reconnecting"} />
        <RaceView data={data} state={state} />
      </MotionProvider>
    );
  }

  return (
    <MotionProvider>
      <ReconnectingPill show={status === "reconnecting"} />
      <MatchHeader data={data} state={state} />

      {fixture.sport.resultFormat === "sets" && setScores.length > 0 && <SetBoard data={data} />}

      <div className="flex flex-col gap-4 px-4 lg:px-0">
        {timed && (
          <SlidingTabs
            label="Match"
            value={tab}
            onValueChange={setTab}
            className="w-full max-w-xs"
            items={[
              { value: "timeline", label: "Timeline" },
              { value: "lineups", label: "Lineups" },
            ]}
          />
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2 }}
          >
            {tab === "timeline" ? (
              <Timeline entries={timeline} home={fixture.home} away={fixture.away} state={state} kickoffAt={fixture.kickoffAt} />
            ) : (
              <Lineups players={lineups} home={fixture.home} away={fixture.away} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionProvider>
  );
}

// ---------------------------------------------------------------------------
// Score header
// ---------------------------------------------------------------------------

function MatchHeader({ data, state }: { data: MatchPageData; state: FixtureState }) {
  const { fixture, timeline } = data;
  const clock = useClock({
    state,
    periodMinutes: fixture.event.periodMinutes,
    extraPeriodMinutes: fixture.event.extraPeriodMinutes,
  });
  const flash = useGoalFlash(state.homeScore, state.awayScore);
  const notStarted = state.status === "scheduled";
  const goals = timeline.filter((e) => e.type === "goal");
  const scorers = (team: TeamSummary | null) => {
    if (!team) return [];
    const byName = new Map<string, string[]>();
    for (const g of goals) {
      // An own goal counts for the other side.
      const forTeam = g.isOwnGoal ? g.teamId !== team.id : g.teamId === team.id;
      if (!forTeam) continue;
      const name = `${g.playerName ?? "Goal"}${g.isOwnGoal ? " (OG)" : ""}`;
      byName.set(name, [...(byName.get(name) ?? []), `${minuteLabel(g)}${g.isPenalty ? " pen" : ""}`]);
    }
    return [...byName].map(([name, mins]) => `${name} ${mins.join(", ")}`);
  };
  const flashTeam = flash === "home" ? fixture.home : flash === "away" ? fixture.away : null;

  return (
    <section
      aria-label="Score"
      className="relative overflow-hidden bg-pitch px-4 pt-4 pb-6 text-brand-foreground lg:rounded-2xl"
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          background: `linear-gradient(115deg, ${teamColour(fixture.home?.year)} 0 30%, transparent 46% 54%, ${teamColour(fixture.away?.year)} 70% 100%)`,
        }}
      />
      <CircuitPattern />
      {flashTeam && (
        <motion.span
          aria-hidden
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.6, 1, 0] }}
          transition={{ duration: 2.6 }}
          style={{ boxShadow: `inset 0 0 80px ${teamColour(flashTeam.year)}` }}
        />
      )}

      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between gap-2">
          <span className="size-10" aria-hidden />
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-light uppercase">
            <SportIcon sport={fixture.sport.slug.replace(/-/g, "_")} size={14} />
            {fixture.sport.name} · {stageLabel(fixture.stage)}
          </p>
          {state.status === "full_time" || state.status === "walkover" || state.status === "cancelled" ? (
            <span className="size-10" aria-hidden />
          ) : (
            <NotifyBell fixtureId={fixture.id} home={fixture.home} away={fixture.away} />
          )}
        </div>

        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-start gap-2">
          <HeaderTeam team={fixture.home} lines={scorers(fixture.home)} align="end" />
          <div className="flex flex-col items-center gap-2 pt-2">
            {notStarted ? (
              <span className="font-heading text-3xl font-bold opacity-80">v</span>
            ) : (
              <div className="flex items-baseline gap-2 font-heading text-score font-bold">
                <RollingScore value={state.homeScore} />
                <span className="text-3xl opacity-50">–</span>
                <RollingScore value={state.awayScore} />
              </div>
            )}
            {(state.homeShootout !== null || state.awayShootout !== null) && (
              <span className="text-xs font-semibold text-brand-foreground/80">
                Pens {state.homeShootout ?? 0}–{state.awayShootout ?? 0}
              </span>
            )}
            {!notStarted && <MatchStatus clock={clock} kickoffAt={fixture.kickoffAt} className="bg-background/90" />}
          </div>
          <HeaderTeam team={fixture.away} lines={scorers(fixture.away)} align="start" />
        </div>

        <AnimatePresence>
          {flashTeam && (
            <motion.p
              key="goal"
              initial={{ scale: 0.4, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 420, damping: 16 }}
              className="rounded-full px-4 py-1 font-heading text-xl font-bold tracking-wide text-team-foreground uppercase shadow-raised"
              style={{ background: teamColour(flashTeam.year) }}
            >
              Goal {flashTeam.shortName}!
            </motion.p>
          )}
        </AnimatePresence>

        {notStarted && fixture.kickoffAt && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-semibold tracking-[0.08em] text-brand-foreground/70 uppercase">Kickoff in</span>
            <Countdown targetAt={fixture.kickoffAt} showDeadlineLabel={false} className="font-heading text-3xl text-brand-foreground!" />
          </div>
        )}
        <p className="text-xs text-brand-foreground/80">
          {fixture.kickoffAt ? formatWAT(fixture.kickoffAt, "datetime") : "Kickoff time to be confirmed"}
          {fixture.venue ? ` · ${fixture.venue}` : ""}
        </p>
      </div>
    </section>
  );
}

function HeaderTeam({ team, lines, align }: { team: TeamSummary | null; lines: string[]; align: "start" | "end" }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span
        className="inline-flex size-16 items-center justify-center rounded-full font-heading text-xl font-bold text-team-foreground ring-4 ring-brand-foreground/25 sm:size-20 sm:text-2xl"
        style={{ background: teamColour(team?.year) }}
      >
        {team?.shortName ?? "?"}
      </span>
      <span className="text-sm font-semibold sm:text-base">{team?.name ?? "TBD"}</span>
      <ul className={cn("flex flex-col gap-0.5 text-xs text-brand-foreground/85", align === "end" ? "sm:items-end" : "sm:items-start")}>
        <AnimatePresence initial={false}>
          {lines.map((l) => (
            <motion.li key={l} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {l}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/** Sets sports: set-by-set scores like a tennis scoreboard. */
function SetBoard({ data }: { data: MatchPageData }) {
  const { fixture, setScores } = data;
  const row = (team: TeamSummary | null, side: "home" | "away") => (
    <tr className="border-b border-border last:border-b-0">
      <th scope="row" className="py-2 pr-3 text-left text-sm font-semibold">
        {team?.name ?? "TBD"}
      </th>
      {setScores.map((s) => {
        const pts = side === "home" ? s.homePoints : s.awayPoints;
        const won = s.complete && s.winnerTeamId === team?.id;
        return (
          <td key={s.setNumber} className={cn("w-10 text-center font-heading text-lg tabular-nums", won && "font-bold", !s.complete && "text-live")}>
            {pts}
          </td>
        );
      })}
    </tr>
  );
  return (
    <div className="mx-4 overflow-x-auto rounded-xl bg-card p-3 shadow-card lg:mx-0">
      <table className="w-full">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="text-left font-semibold">Set</th>
            {setScores.map((s) => (
              <th key={s.setNumber} className="w-10 text-center font-semibold">
                {s.setNumber}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row(fixture.home, "home")}
          {row(fixture.away, "away")}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const PERIOD_START: Record<string, string> = {
  first_half: "Kick-off",
  second_half: "Second half",
  extra_first: "Extra time",
  extra_second: "Extra time, second half",
  penalties: "Penalty shootout",
  first_quarter: "Tip-off",
  second_quarter: "Second quarter",
  third_quarter: "Third quarter",
  fourth_quarter: "Fourth quarter",
  overtime: "Overtime",
};
const PERIOD_END: Record<string, string> = {
  first_half: "Half-time",
  second_half: "End of normal time",
  extra_first: "Extra time, half-time",
  extra_second: "End of extra time",
  second_quarter: "Half-time",
};

function Timeline({
  entries,
  home,
  away,
  state,
  kickoffAt,
}: {
  entries: TimelineEntry[];
  home: TeamSummary | null;
  away: TeamSummary | null;
  state: FixtureState;
  kickoffAt: string | null;
}) {
  const kicks = entries.filter((e) => e.type === "shootout_kick");
  const shown = entries.filter((e) => e.type !== "shootout_kick" && e.type !== "point" && e.type !== "set_end").reverse();

  if (shown.length === 0 && kicks.length === 0) {
    return (
      <p className="rounded-xl bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-card">
        {state.status === "scheduled"
          ? `Kick-off ${kickoffAt ? `at ${formatWAT(kickoffAt, "time")}` : "time to be confirmed"}. Goals, cards and subs appear here as they happen.`
          : "Nothing recorded yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {kicks.length > 0 && <Shootout kicks={kicks} home={home} away={away} />}
      <ol className="relative flex flex-col gap-1 rounded-xl bg-card px-2 py-3 shadow-card">
        <span aria-hidden className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-border" />
        <AnimatePresence initial={false}>
          {shown.map((e) => (
            <motion.li
              key={e.id}
              layout="position"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <TimelineRow entry={e} homeId={home?.id ?? null} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function TimelineRow({ entry: e, homeId }: { entry: TimelineEntry; homeId: string | null }) {
  // Period markers and full time run across the middle.
  if (e.type === "period_start" || e.type === "period_end" || e.type === "full_time" || e.type === "walkover") {
    const label =
      e.type === "full_time"
        ? "Full-time"
        : e.type === "walkover"
          ? "Walkover"
          : e.type === "period_start"
            ? PERIOD_START[e.period ?? ""] ?? "Period starts"
            : PERIOD_END[e.period ?? ""] ?? "Period ends";
    return (
      <div className="relative flex justify-center py-1.5">
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</span>
      </div>
    );
  }

  // Own goals sit on the side of the team that benefits.
  const onHomeSide = e.type === "goal" && e.isOwnGoal ? e.teamId !== homeId : e.teamId === homeId;
  const content = <EventContent entry={e} alignEnd={onHomeSide} />;
  return (
    <div className="grid grid-cols-[1fr_3rem_1fr] items-center gap-1 py-1">
      <div className="flex justify-end">{onHomeSide ? content : null}</div>
      <span className="relative z-10 mx-auto rounded-full bg-background px-1.5 py-0.5 text-xs font-bold tabular-nums ring-1 ring-border">
        {minuteLabel(e) || "·"}
      </span>
      <div className="flex justify-start">{onHomeSide ? null : content}</div>
    </div>
  );
}

function EventContent({ entry: e, alignEnd }: { entry: TimelineEntry; alignEnd: boolean }) {
  const row = cn("flex items-center gap-2", alignEnd && "flex-row-reverse text-right");
  if (e.type === "goal") {
    return (
      <div className={cn(row, "rounded-lg bg-secondary px-2.5 py-1.5")}>
        <BallIcon />
        <div className="leading-tight">
          <p className="font-semibold">
            {e.playerName ?? "Goal"}
            {e.isPenalty ? " (pen)" : ""}
            {e.isOwnGoal ? " (OG)" : ""}
          </p>
          {e.otherPlayerName && !e.isOwnGoal && <p className="text-xs text-muted-foreground">Assist: {e.otherPlayerName}</p>}
        </div>
      </div>
    );
  }
  if (e.type === "card") {
    return (
      <div className={row}>
        <span aria-label={`${e.card} card`} className={cn("h-4 w-3 rounded-[2px] shadow-sm", e.card === "red" ? "bg-live" : "bg-highlight")} />
        <span className="text-sm font-medium">{e.playerName ?? "Card"}</span>
      </div>
    );
  }
  if (e.type === "substitution") {
    return (
      <div className={cn(row, "items-start")}>
        <div className="flex flex-col gap-0.5 text-sm">
          <span className={cn("flex items-center gap-1", alignEnd && "flex-row-reverse")}>
            <ArrowUp className="size-3.5 text-success" aria-label="On" /> {e.otherPlayerName ?? "Sub"}
          </span>
          <span className={cn("flex items-center gap-1 text-muted-foreground", alignEnd && "flex-row-reverse")}>
            <ArrowDown className="size-3.5 text-live" aria-label="Off" /> {e.playerName ?? ""}
          </span>
        </div>
      </div>
    );
  }
  if (e.type === "penalty_miss") {
    return (
      <div className={row}>
        <X className="size-4 text-live" aria-hidden />
        <span className="text-sm">
          {e.playerName ?? "Penalty"} <span className="text-muted-foreground">missed a penalty</span>
        </span>
      </div>
    );
  }
  if (e.type === "man_of_the_match") {
    return (
      <div className={cn(row, "rounded-lg bg-highlight/20 px-2.5 py-1.5")}>
        <Star className="size-4 fill-highlight text-highlight" aria-hidden />
        <span className="text-sm">
          <span className="font-semibold">{e.playerName}</span> <span className="text-muted-foreground">player of the match</span>
        </span>
      </div>
    );
  }
  return <span className="text-sm text-muted-foreground">{e.playerName ?? e.type}</span>;
}

function BallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-label="Goal">
      <circle cx="12" cy="12" r="10" className="fill-background stroke-foreground" strokeWidth="1.5" />
      <path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z" className="fill-foreground" />
      <path d="M12 7V3.5M15.5 9.5l3.3-1.2M14.2 13.5l2.2 3M9.8 13.5l-2.2 3M8.5 9.5L5.2 8.3" className="stroke-foreground" strokeWidth="1.2" />
    </svg>
  );
}

/** The shootout as two rows of dots that fill in kick by kick. */
function Shootout({ kicks, home, away }: { kicks: TimelineEntry[]; home: TeamSummary | null; away: TeamSummary | null }) {
  const row = (team: TeamSummary | null) => {
    const mine = kicks.filter((k) => k.teamId === team?.id);
    return (
      <div className="flex items-center gap-3">
        <span className="w-16 text-sm font-semibold">{team?.shortName ?? "?"}</span>
        <ol className="flex gap-1.5">
          {mine.map((k) => (
            <motion.li
              key={k.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              title={k.playerName ?? undefined}
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                k.scored ? "bg-success text-primary-foreground" : "bg-live text-primary-foreground",
              )}
            >
              {k.scored ? "✓" : "✕"}
            </motion.li>
          ))}
        </ol>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-card">
      <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Penalty shootout</p>
      {row(home)}
      {row(away)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

function Lineups({ players, home, away }: { players: LineupPlayer[]; home: TeamSummary | null; away: TeamSummary | null }) {
  if (players.length === 0) {
    return (
      <p className="rounded-xl bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-card">
        Lineups show here once the officials set them, usually just before kickoff.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[home, away].map((team) =>
        team ? <TeamSheet key={team.id} team={team} players={players.filter((p) => p.teamId === team.id)} /> : null,
      )}
    </div>
  );
}

const ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;

function TeamSheet({ team, players }: { team: TeamSummary; players: LineupPlayer[] }) {
  const sorted = [...players].sort((a, b) => ORDER[a.position] - ORDER[b.position] || (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99));
  const starters = sorted.filter((p) => p.role === "starter");
  const bench = sorted.filter((p) => p.role === "bench");
  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card">
      <h3 className="flex items-center gap-2 px-3 py-2.5 font-heading text-lg font-bold" style={{ boxShadow: `inset 4px 0 0 ${teamColour(team.year)}` }}>
        {team.name}
      </h3>
      <ul className="divide-y divide-border border-t border-border">
        {starters.map((p) => (
          <PlayerLine key={p.playerId} player={p} />
        ))}
      </ul>
      {bench.length > 0 && (
        <>
          <p className="bg-muted px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">Bench</p>
          <ul className="divide-y divide-border">
            {bench.map((p) => (
              <PlayerLine key={p.playerId} player={p} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PlayerLine({ player: p }: { player: LineupPlayer }) {
  const subbedOff = p.role === "starter" && p.appeared && !p.onPitch && !p.sentOff;
  const cameOn = p.role === "bench" && p.appeared;
  return (
    <li className={cn("flex min-h-11 items-center gap-3 px-3 py-1.5", p.role === "bench" && !p.appeared && "text-muted-foreground")}>
      <span className="w-6 text-center font-heading text-sm font-bold tabular-nums">{p.shirtNumber ?? "–"}</span>
      <span className="flex-1 truncate text-[0.9375rem]">{p.name}</span>
      <span className="flex items-center gap-1">
        {p.yellowCards > 0 && <span aria-label="Booked" className="h-3.5 w-2.5 rounded-[2px] bg-highlight" />}
        {p.sentOff && <span aria-label="Sent off" className="h-3.5 w-2.5 rounded-[2px] bg-live" />}
        {subbedOff && <ArrowDown className="size-3.5 text-live" aria-label="Subbed off" />}
        {cameOn && <ArrowUp className="size-3.5 text-success" aria-label="Came on" />}
        <span className="w-8 text-right text-xs font-semibold text-muted-foreground">{p.position}</span>
      </span>
    </li>
  );
}
