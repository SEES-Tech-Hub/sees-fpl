import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { BackToHub } from "@/components/brand/back-to-hub";
import { notFound } from "next/navigation";
import { ConsoleApp, type ConsoleViewer } from "@/components/console/console-app";
import { HeadToHeadConsole } from "@/components/console/head-to-head-console";
import { RaceConsole } from "@/components/console/race-console";
import { SetsConsole } from "@/components/console/sets-console";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { eventHasHeats, getFirstLeg, getFixtureLineups, getHeadToHeadEvents, getLiveFixture, getMatchTimeline, getTeams } from "@/lib/live/queries";
import { getRaceResults } from "@/lib/live/results";
import { getSquads } from "./squads";

// Owner: Samuel (console app). Bolu owns the API it calls (lib/live).
//
// Anyone can open a console and see it read-only (the PRD: "Everyone else
// gets a read-only view"). The controls appear only for the fixture's console
// holder, the admin included: an admin takes the match (or takes it over)
// before recording, so a look around the console can't start a match. After
// a match is over the admin keeps the controls for corrections. None of this
// is the real check: the database refuses events from anyone else (see
// docs/live-scores.md).

export const metadata: Metadata = {
  title: "Match console",
  robots: { index: false },
};

export default function ConsolePage({ params }: PageProps<"/console/[fixtureId]">) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      {/* Out of this match: back to the officials' match list, or to the Games Hub. */}
      <nav aria-label="Console" className="flex items-center justify-between px-2">
        <Link href="/console" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden />
          All matches
        </Link>
        <BackToHub className="px-2" />
      </nav>
      <Suspense fallback={<ConsoleSkeleton />}>
        <ConsoleLoader params={params} />
      </Suspense>
    </main>
  );
}

async function ConsoleLoader({ params }: { params: PageProps<"/console/[fixtureId]">["params"] }) {
  const { fixtureId } = await params;
  const [fixture, current] = await Promise.all([getLiveFixture(fixtureId), getCurrentUser()]);
  if (!fixture) notFound();

  const format = fixture.sport.resultFormat;
  const role = current?.profile.role;
  const isHolder = !!current && fixture.consoleHolderId === current.user.id;
  const isAdmin = role === "admin";
  const over = fixture.status === "full_time" || fixture.status === "walkover" || fixture.status === "cancelled";
  const viewer: ConsoleViewer = {
    signedIn: !!current,
    userId: current?.user.id ?? null,
    isHolder,
    canRecord: isHolder || (isAdmin && over),
    isAdmin,
    canTake: hasRole(role, "official") && fixture.consoleHolderId === null && !over,
    heldBySomeoneElse: fixture.consoleHolderId !== null && !isHolder,
  };

  // Races have no home or away: entrants and results.
  if (format === "ranked") {
    const [entries, teams, hasHeats] = await Promise.all([getRaceResults(fixtureId), getTeams(), eventHasHeats(fixture.event.id)]);
    return <RaceConsole fixture={fixture} entries={entries} teams={teams} hasHeats={hasHeats} viewer={viewer} />;
  }

  if (!fixture.home || !fixture.away) {
    return (
      <div className="flex flex-col gap-2 px-4 py-12 text-center">
        <h1 className="font-heading text-2xl font-semibold text-brand">
          {[fixture.event.name, fixture.tie ? (fixture.leg ? `${fixture.tie} · Leg ${fixture.leg}` : fixture.tie) : null].filter(Boolean).join(" · ")}
        </h1>
        <p className="text-muted-foreground">
          The sides for this match aren&apos;t known yet. The admin adds them in Admin → Fixtures once they&apos;re decided.
        </p>
      </div>
    );
  }

  if (format === "head_to_head") {
    const [events, firstLeg] = await Promise.all([getHeadToHeadEvents(fixtureId), getFirstLeg(fixture)]);
    return <HeadToHeadConsole fixture={fixture} events={events} firstLeg={firstLeg} viewer={viewer} />;
  }
  if (format === "sets") {
    return <SetsConsole fixture={fixture} events={await getHeadToHeadEvents(fixtureId)} viewer={viewer} />;
  }

  const [timeline, lineups, squads] = await Promise.all([
    getMatchTimeline(fixtureId),
    getFixtureLineups(fixtureId),
    // The player list is the men's football (fantasy) squad. Other timed sports
    // (basketball, handball, women's football) score by team only.
    fixture.event.slug === "football-men" ? getSquads([fixture.home.id, fixture.away.id]) : Promise.resolve([]),
  ]);

  return <ConsoleApp fixture={fixture} timeline={timeline} lineups={lineups} squads={squads} viewer={viewer} />;
}

function ConsoleSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy="true" aria-label="Loading the console">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}
