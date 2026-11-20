import { Suspense } from "react";
import Link from "next/link";
import { CountUp } from "@/components/fantasy/count-up";
import { CircuitPattern } from "@/components/fantasy/patterns";
import { PointsView } from "@/components/fantasy/points-view";
import { EmptyState, LoadingPitch, PageHeader } from "@/components/fantasy/states";
import { getManagerPoints, getMatchdayHistory, getMatchdayState, getPlayers } from "@/lib/fantasy/api";
import { requireManager } from "@/lib/fantasy/guards";
import { formatWAT } from "@/lib/fantasy/time";
import type { ManagerMatchdayPoints } from "@/lib/fantasy/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Points" };

export default function PointsPage({ searchParams }: PageProps<"/fantasy/points">) {
  return (
    <Suspense fallback={<LoadingPitch />}>
      <Points searchParams={searchParams} />
    </Suspense>
  );
}

const fmt = new Intl.NumberFormat("en-GB");

async function Points({ searchParams }: { searchParams: PageProps<"/fantasy/points">["searchParams"] }) {
  const params = await searchParams;
  const { user, manager } = await requireManager("/fantasy/points");
  const managerId = typeof params.manager === "string" ? params.manager : user.id;
  const mine = managerId === user.id;

  const [history, md, players] = await Promise.all([getMatchdayHistory(user, managerId), getMatchdayState(), getPlayers()]);
  if (history.length === 0) {
    const first = md.next ?? md.matchdays[0];
    return (
      <>
        <PageHeader caption="Points" title={mine ? manager.teamName : "Points"} />
        <EmptyState
          title="No points yet"
          description={
            mine
              ? `Points start once the Matchday ${first?.number ?? 1} deadline passes (${formatWAT(first?.deadlineAt)}).`
              : "This manager's points show after the deadline."
          }
          href={mine ? "/fantasy/team" : "/fantasy/rankings"}
          cta={mine ? "Check your team" : "Back to rankings"}
        />
      </>
    );
  }

  const requested = Number(params.md);
  const selected = history.find((h) => h.matchdayNumber === requested) ?? history[history.length - 1];
  const points = await getManagerPoints(user, managerId, selected.matchdayNumber);
  const has = new Set(history.map((h) => h.matchdayNumber));
  const href = (n: number) => `/fantasy/points?md=${n}${mine ? "" : `&manager=${managerId}`}`;
  const yearOf = Object.fromEntries(players.map((p) => [p.id, p.teamYear]));

  return (
    <>
      <PageHeader
        caption={mine ? "My points" : "Picks shown after the deadline"}
        title={points?.teamName ?? manager.teamName}
      />

      <nav aria-label="Matchday" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex min-w-max gap-2">
          {md.matchdays.map((m) => {
            const active = m.number === selected.matchdayNumber;
            return (
              <li key={m.id}>
                {has.has(m.number) ? (
                  <Link
                    href={href(m.number)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold",
                      active && "border-transparent bg-primary text-primary-foreground",
                    )}
                  >
                    MD{m.number}
                  </Link>
                ) : (
                  <span
                    aria-disabled
                    className="flex h-11 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground/60"
                  >
                    MD{m.number}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {!points ? (
        <EmptyState title="No team that matchday" description="This manager hadn't picked a team by that deadline." />
      ) : (
        <>
          <PointsHero points={points} />
          <PointsView points={points} yearOf={yearOf} />
        </>
      )}
    </>
  );
}

function PointsHero({ points }: { points: ManagerMatchdayPoints }) {
  const { overallRank: now, previousOverallRank: before } = points;
  const up = now !== null && before !== null && now < before;
  const down = now !== null && before !== null && now > before;
  return (
    <section
      aria-label={`Matchday ${points.matchdayNumber} points`}
      className="relative overflow-hidden rounded-xl bg-pitch px-4 py-5 text-center text-brand-foreground dark:text-foreground"
    >
      <CircuitPattern />
      <div className="relative">
        <p className="text-xs font-semibold tracking-[0.06em] text-brand-light uppercase dark:text-brand">
          Matchday {points.matchdayNumber} points
        </p>
        <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Stat label="Average" value={points.averagePoints} />
          <CountUp value={points.total} className="font-heading text-score font-bold tabular-nums" />
          <Stat label="Highest" value={points.highestPoints} />
        </div>
        {now !== null && (
          <p
            className={cn(
              "mx-auto mt-3 inline-flex items-center gap-1 rounded-full bg-brand-foreground/10 px-3 py-1 text-sm font-semibold tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:delay-700 motion-safe:fill-mode-backwards dark:bg-foreground/10",
            )}
          >
            {up && <span aria-hidden>▲</span>}
            {down && <span aria-hidden>▼</span>}
            {before !== null ? (
              <>
                <span className="sr-only">Overall rank from</span>
                {fmt.format(before)} → {fmt.format(now)}
              </>
            ) : (
              <>Overall rank {fmt.format(now)}</>
            )}
          </p>
        )}
        <p className="mt-3 text-xs text-brand-foreground/80 dark:text-foreground/80">
          {points.transferCost > 0 && <>Includes −{points.transferCost} pts for transfers. </>}
          {points.wildcardPlayed && <>Wildcard played. </>}
          {points.provisional && <>Provisional until Matchday {points.matchdayNumber} is finalised.</>}
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="pb-2">
      <p className="text-xs text-brand-foreground/80 dark:text-foreground/80">{label}</p>
      <p className="font-heading text-2xl font-semibold tabular-nums">{value ?? "–"}</p>
    </div>
  );
}
