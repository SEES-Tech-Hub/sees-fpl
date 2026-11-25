import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Radio } from "lucide-react";
import { SeesMark } from "@/components/brand/sees-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { SportIcon } from "@/components/ui/shared/SportIcon";
import { requireRole } from "@/lib/auth";
import { teamColour } from "@/lib/design/team-colour";
import { formatScore, sideName, tieLabel } from "@/lib/live/display";
import { getFixtureCards, type FixtureCard } from "@/lib/live/fixture-cards";
import { createClient } from "@/lib/supabase/server";
import { formatWAT } from "@/lib/utils";

// The officials' start page: the matches they hold, then every match today
// and in the next two days, each linking to its console. Officials and the
// admin only (requireRole sends anyone else away).

export const metadata: Metadata = { title: "Match console", robots: { index: false } };

export default function ConsoleHome() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-5">
      <header className="flex items-center gap-3">
        <SeesMark className="size-9 text-brand" />
        <div>
          <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">SEES Games</p>
          <h1 className="font-heading text-2xl leading-none font-bold text-brand">Match console</h1>
        </div>
      </header>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Matches />
      </Suspense>
    </main>
  );
}

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Today and two days ahead, as WAT dates. (Request time: requireRole has already read the cookies.) */
function dayWindow() {
  const now = Date.now();
  return { today: dayKey(new Date(now).toISOString()), horizon: dayKey(new Date(now + 2 * 86_400_000).toISOString()) };
}

async function Matches() {
  const me = await requireRole("official");
  const supabase = await createClient();
  const [cards, held] = await Promise.all([
    getFixtureCards(),
    supabase.from("fixtures").select("id").eq("console_holder", me.user.id),
  ]);
  const mine = new Set((held.data ?? []).map((f) => f.id));

  const { today, horizon } = dayWindow();
  const open = (c: FixtureCard) => c.state.status !== "full_time" && c.state.status !== "walkover" && c.state.status !== "cancelled";
  const yours = cards.filter((c) => mine.has(c.id) && open(c));
  const soon = cards.filter((c) => c.kickoffAt && dayKey(c.kickoffAt) >= today && dayKey(c.kickoffAt) <= horizon && !mine.has(c.id));
  const days = new Map<string, FixtureCard[]>();
  for (const c of soon) days.set(dayKey(c.kickoffAt!), [...(days.get(dayKey(c.kickoffAt!)) ?? []), c]);

  return (
    <>
      <section aria-labelledby="yours" className="flex flex-col gap-2">
        <h2 id="yours" className="flex items-center gap-2 font-heading text-lg font-bold uppercase">
          <Radio className="size-5 text-live" aria-hidden /> Your matches
        </h2>
        {yours.length === 0 ? (
          <p className="rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">
            None yet. Open a match below and tap <strong>Take this match</strong>, or ask the admin to assign you.
          </p>
        ) : (
          <MatchList cards={yours} />
        )}
      </section>
      {[...days].map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {day === today ? "Today" : formatWAT(`${day}T12:00:00+01:00`, "date")}
          </h2>
          <MatchList cards={list} />
        </section>
      ))}
      {days.size === 0 && yours.length === 0 && <p className="text-sm text-muted-foreground">No matches in the next few days.</p>}
    </>
  );
}

function MatchList({ cards }: { cards: FixtureCard[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-card">
      {cards.map((c) => {
        const live = c.state.status === "live" || c.state.status === "half_time";
        const what = c.sport.slug === "football" || c.event.name === c.sport.name ? c.sport.name : `${c.sport.name}: ${c.event.name}`;
        return (
          <li key={c.id}>
            <Link href={`/console/${c.id}`} className="flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-muted">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-brand">
                <SportIcon sport={c.sport.slug.replace(/-/g, "_")} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-muted-foreground">
                  {[what, tieLabel(c)].filter(Boolean).join(" · ")}
                </span>
                <span className="flex items-center gap-1.5 truncate text-[0.9375rem] font-semibold">
                  {c.home && <span className="size-2.5 shrink-0 rounded-full" style={{ background: teamColour(c.home.year) }} aria-hidden />}
                  {c.home || c.homeEntrant ? sideName(c, "home") : c.sport.resultFormat === "ranked" ? "Race" : "TBD"}
                  {c.sport.resultFormat !== "ranked" && (
                    <>
                      <span className="text-muted-foreground">v</span>
                      {c.away && <span className="size-2.5 shrink-0 rounded-full" style={{ background: teamColour(c.away.year) }} aria-hidden />}
                      {sideName(c, "away")}
                    </>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-right text-xs">
                {live ? (
                  <span className="font-bold text-live">
                    {formatScore(c.state.homeScore, c.event.boards)}–{formatScore(c.state.awayScore, c.event.boards)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{c.kickoffAt ? formatWAT(c.kickoffAt, "time") : "TBC"}</span>
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
