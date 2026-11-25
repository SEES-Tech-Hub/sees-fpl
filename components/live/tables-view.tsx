"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { SlidingTabs } from "@/components/fantasy/motion-bits";
import { MotionProvider } from "@/components/fantasy/motion-provider";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { teamColour } from "@/lib/design/team-colour";
import type { EventStandingRow, MedalTableRow, PlayerTotalsRow, ResultFormat, StandingRow, SuspensionRow, TeamSummary, TopScorerRow } from "@/lib/live/types";
import { useRefreshOnLiveChange } from "@/lib/live/use-live";
import { cn, formatWAT } from "@/lib/utils";
import { EmptyState } from "@/components/brand/empty-state";
import type { EmptyArt } from "@/components/brand/empty-art";
import { LivePulse, ReconnectingPill } from "./live-bits";
import { EventTable } from "./sports-views";

type Tab = "football" | "sports" | "championship" | "stats";

export type TablesData = {
  standings: StandingRow[];
  medals: MedalTableRow[];
  scorers: TopScorerRow[];
  assisters: TopScorerRow[];
  cleanSheets: PlayerTotalsRow[];
  discipline: PlayerTotalsRow[];
  suspensions: SuspensionRow[];
  form: Record<string, ("W" | "D" | "L")[]>;
  /** Group tables for every other sport, by sport then event. */
  sportTables: {
    sport: { slug: string; name: string; resultFormat: ResultFormat };
    tables: { event: { id: string; slug: string; name: string }; rows: EventStandingRow[] }[];
  }[];
};

export function TablesView({ data }: { data: TablesData }) {
  const status = useRefreshOnLiveChange();
  const [tab, setTab] = useLocalStorageState<Tab>("sees-live:tables-tab", "football");
  return (
    <MotionProvider>
      <ReconnectingPill show={status === "reconnecting"} />
      <div className="flex flex-col gap-4 px-4 lg:px-0">
        <div>
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">SEES Games 2026</p>
          <h1 className="font-heading text-display font-bold text-brand uppercase">Tables</h1>
        </div>
        <SlidingTabs
          label="Table"
          value={tab}
          onValueChange={setTab}
          className="w-full max-w-sm"
          items={[
            { value: "football", label: "Football" },
            { value: "sports", label: "Sports" },
            { value: "championship", label: "Medals" },
            { value: "stats", label: "Stats" },
          ]}
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            {tab === "football" && <FootballTable rows={data.standings} form={data.form} />}
            {tab === "sports" && <SportTables sports={data.sportTables} />}
            {tab === "championship" && <MedalTable rows={data.medals} />}
            {tab === "stats" && <Stats data={data} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionProvider>
  );
}

/** Every other sport's group tables, each with a link to its sport page. */
function SportTables({ sports }: { sports: TablesData["sportTables"] }) {
  if (sports.length === 0) return <Empty art="trophy" title="No tables yet" text="Group tables appear here once those sports have fixtures." />;
  return (
    <>
      {sports.map(({ sport, tables }) => (
        <section key={sport.slug} className="flex flex-col gap-2">
          <Link href={`/sports/${sport.slug}`} className="group flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-brand">
              <SportIcon sport={sport.slug.replace(/-/g, "_")} size={18} />
            </span>
            <h2 className="flex-1 font-heading text-xl font-bold uppercase">{sport.name}</h2>
            <span className="flex items-center text-xs font-semibold text-brand">
              Fixtures <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          {tables.map((t) => (
            <EventTable
              key={t.event.id}
              title={tables.length > 1 ? t.event.name : undefined}
              rows={t.rows}
              sets={sport.resultFormat === "sets"}
              boards={sport.slug === "board-games"}
            />
          ))}
        </section>
      ))}
    </>
  );
}

function TeamCell({ team, live }: { team: TeamSummary; live?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold text-team-foreground"
        style={{ background: teamColour(team.year) }}
      >
        {team.shortName}
      </span>
      <span className="truncate font-semibold">{team.name}</span>
      {live && <LivePulse />}
    </span>
  );
}

const FORM_STYLE = { W: "bg-success text-primary-foreground", D: "bg-muted-foreground text-background", L: "bg-live text-primary-foreground" } as const;

function FootballTable({ rows, form }: { rows: StandingRow[]; form: TablesData["form"] }) {
  if (rows.length === 0) return <Empty art="trophy" title="No table yet" text="It fills in after the first match on 28 Nov, and moves live while matches are on." />;
  // Before any match everyone is joint first: show plain order, no zones.
  const started = rows.some((r) => r.played > 0);
  return (
    <section className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl bg-card shadow-card">
        <table className="w-full min-w-[22rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-8 py-2 pl-3 text-left font-semibold">#</th>
              <th className="py-2 text-left font-semibold">Team</th>
              {["P", "W", "D", "L", "GD"].map((h) => (
                <th key={h} className="w-8 py-2 text-center font-semibold">
                  {h}
                </th>
              ))}
              <th className="w-10 py-2 pr-1 text-center font-semibold">Pts</th>
              <th className="hidden py-2 pr-3 text-left font-semibold sm:table-cell">Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <motion.tr
                layout
                key={r.team.id}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                className={cn("border-b border-border last:border-b-0", r.live && "bg-live/5")}
                style={{
                  boxShadow: `inset 3px 0 0 ${!started ? "transparent" : r.position <= 2 ? "var(--success)" : r.position <= 4 ? "var(--highlight)" : "transparent"}`,
                }}
              >
                <td className="py-2.5 pl-3 font-heading font-bold tabular-nums">
                  {started ? `${r.position}${r.positionShared ? "=" : ""}` : "–"}
                </td>
                <td className="max-w-0 py-2.5">
                  <TeamCell team={r.team} live={r.live} />
                </td>
                {[r.played, r.won, r.drawn, r.lost].map((v, i) => (
                  <td key={i} className="text-center tabular-nums">
                    {v}
                  </td>
                ))}
                <td className="text-center tabular-nums">{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                <td className="pr-1 text-center font-heading text-base font-bold tabular-nums">{r.points}</td>
                <td className="hidden pr-3 sm:table-cell">
                  <span className="flex gap-1">
                    {(form[r.team.id] ?? []).map((f, i) => (
                      <span key={i} className={cn("flex size-5 items-center justify-center rounded text-[0.625rem] font-bold", FORM_STYLE[f])}>
                        {f}
                      </span>
                    ))}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 rounded bg-success" /> Final
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-1 rounded bg-highlight" /> Third-place match
        </span>
        <span>Ties: goal difference, goals scored, then head-to-head.</span>
      </p>
    </section>
  );
}

function MedalTable({ rows }: { rows: MedalTableRow[] }) {
  if (rows.length === 0) return <Empty art="trophy" title="No medals yet" text="The race for the championship starts with the first results." />;
  const byPoints = rows[0].rankBy === "points";
  return (
    <section className="overflow-x-auto rounded-xl bg-card shadow-card">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-8 py-2 pl-3 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Year</th>
            <th className="w-10 py-2 text-center" aria-label="Gold">
              <Medal tone="gold" />
            </th>
            <th className="w-10 py-2 text-center" aria-label="Silver">
              <Medal tone="silver" />
            </th>
            <th className="w-10 py-2 text-center" aria-label="Bronze">
              <Medal tone="bronze" />
            </th>
            <th className="w-12 py-2 pr-3 text-center font-semibold">{byPoints ? "Pts" : "Total"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <motion.tr layout key={r.team.id} className="border-b border-border last:border-b-0">
              <td className="py-2.5 pl-3 font-heading font-bold">
                <span className="flex items-center gap-1">
                  {r.position}
                  {r.position === 1 && r.total > 0 && <Crown className="size-3.5 text-highlight" aria-label="Leader" />}
                </span>
              </td>
              <td className="max-w-0 py-2.5">
                <TeamCell team={r.team} />
              </td>
              <td className="text-center tabular-nums">{r.gold}</td>
              <td className="text-center tabular-nums">{r.silver}</td>
              <td className="text-center tabular-nums">{r.bronze}</td>
              <td className="pr-3 text-center font-heading text-base font-bold tabular-nums">{byPoints ? r.points : r.total}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Medal({ tone }: { tone: "gold" | "silver" | "bronze" }) {
  const fill = { gold: "var(--highlight)", silver: "var(--muted-foreground)", bronze: "var(--team-y2)" }[tone];
  return (
    <span aria-hidden className="mx-auto block size-4 rounded-full ring-2 ring-background" style={{ background: fill, boxShadow: `0 0 0 1px ${fill}` }} />
  );
}

function Stats({ data }: { data: TablesData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Leaders title="Top scorers" rows={data.scorers.map((r) => ({ id: r.playerId, name: r.name, team: r.team, value: r.goals }))} unit="goals" />
      <Leaders title="Top assists" rows={data.assisters.map((r) => ({ id: r.playerId, name: r.name, team: r.team, value: r.assists }))} unit="assists" />
      <Leaders
        title="Clean sheets"
        rows={data.cleanSheets.map((r) => ({ id: r.playerId, name: r.name, team: r.team, value: r.cleanSheets }))}
        unit="clean sheets"
      />
      <Leaders
        title="Cards"
        rows={data.discipline.map((r) => ({ id: r.playerId, name: r.name, team: r.team, value: r.yellowCards, extra: r.redCards }))}
        unit="yellow"
        cards
      />
      <section className="rounded-xl bg-card shadow-card sm:col-span-2">
        <h2 className="border-b border-border px-3 py-2.5 font-heading text-lg font-bold">Suspensions</h2>
        {data.suspensions.length === 0 ? (
          <EmptyState art="whistle" title="Nobody suspended" description="A red card means a one-match ban. Clean so far." compact bare />
        ) : (
          <ul className="divide-y divide-border">
            {data.suspensions.map((s) => (
              <li key={`${s.playerId}-${s.redCardFixtureId}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="h-4 w-3 rounded-[2px] bg-live" aria-label="Red card" />
                <span className="flex-1 font-semibold">
                  {s.name} <span className="font-normal text-muted-foreground">· {s.teamShortName}</span>
                </span>
                <span className={cn("text-xs", s.banServed ? "text-muted-foreground" : "font-semibold text-live")}>
                  {s.banServed
                    ? "Ban served"
                    : s.bannedFixtureKickoffAt
                      ? `Misses ${formatWAT(s.bannedFixtureKickoffAt, "date")}`
                      : "Misses the next match"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Leaders({
  title,
  rows,
  unit,
  cards,
}: {
  title: string;
  rows: { id: string; name: string; team: TeamSummary; value: number; extra?: number }[];
  unit: string;
  cards?: boolean;
}) {
  return (
    <section className="rounded-xl bg-card shadow-card">
      <h2 className="border-b border-border px-3 py-2.5 font-heading text-lg font-bold">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState art="ball" title="Nothing yet" description="Shows after the first match." compact bare />
      ) : (
        <ol className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-4 font-heading font-bold text-muted-foreground tabular-nums">{i + 1}</span>
              <span
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full font-heading text-[0.625rem] font-bold text-team-foreground"
                style={{ background: teamColour(r.team.year) }}
              >
                {r.team.shortName}
              </span>
              <span className="flex-1 truncate font-semibold">{r.name}</span>
              {cards ? (
                <span className="flex items-center gap-2 tabular-nums" aria-label={`${r.value} yellow, ${r.extra ?? 0} red`}>
                  <span className="flex items-center gap-1">
                    <span className="h-3.5 w-2.5 rounded-[2px] bg-highlight" /> {r.value}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3.5 w-2.5 rounded-[2px] bg-live" /> {r.extra ?? 0}
                  </span>
                </span>
              ) : (
                <span className="font-heading text-lg font-bold tabular-nums" aria-label={`${r.value} ${unit}`}>
                  {r.value}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function Empty({ text, title = "Nothing here yet", art = "net", compact }: { text: string; title?: string; art?: EmptyArt; compact?: boolean }) {
  return <EmptyState art={art} title={title} description={text} compact={compact} />;
}
