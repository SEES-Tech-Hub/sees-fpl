import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getFixtureCards } from "./fixture-cards";
import { createPublicClient } from "./public-client";
import { getEventStandings, getMedalTable, getRaceResults } from "./results";
import { getFootballStandings, getPlayerTotals, getSuspensions, getTopAssisters, getTopScorers } from "./stats";
import { liveTags } from "./tags";
import type { ResultFormat } from "./types";

// Cached reads for the public tables and sport pages. Short lifetimes and
// the live tags, so console writes show at once on this server and within
// 10 s everywhere; open pages refresh when /api/live reports a change.

const LIFE = { stale: 10, revalidate: 10, expire: 120 } as const;

export type SportSummary = {
  id: string;
  slug: string;
  name: string;
  resultFormat: ResultFormat;
  sortOrder: number;
  events: { id: string; slug: string; name: string }[];
};

export async function getSports(): Promise<SportSummary[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });
  cacheTag(liveTags.fixtureList);
  const { data, error } = await createPublicClient()
    .from("sports")
    .select("id, slug, name, result_format, sort_order, events:events!events_sport_id_fkey ( id, slug, name )")
    .order("sort_order");
  if (error) throw new Error(`Couldn't load sports: ${error.message}`);
  return data.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    resultFormat: s.result_format,
    sortOrder: s.sort_order,
    events: (s.events ?? []).map((e) => ({ id: e.id, slug: e.slug, name: e.name })),
  }));
}

/** The football table, the championship and the football stats. */
export async function getTablesPage() {
  "use cache";
  cacheLife(LIFE);
  cacheTag(liveTags.standings, liveTags.fixtureList);
  const [standings, medals, scorers, assisters, totals, suspensions, cards] = await Promise.all([
    getFootballStandings(),
    getMedalTable(),
    getTopScorers(10),
    getTopAssisters(10),
    getPlayerTotals(),
    getSuspensions(),
    getFixtureCards(),
  ]);

  // Form guide: each team's last five finished football results, oldest first.
  const finished = cards
    .filter((c) => c.sport.slug === "football" && (c.state.status === "full_time" || c.state.status === "walkover"))
    .sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));
  const form: Record<string, ("W" | "D" | "L")[]> = {};
  for (const c of finished) {
    for (const side of ["home", "away"] as const) {
      const team = c[side];
      if (!team) continue;
      const mine = side === "home" ? c.state.homeScore : c.state.awayScore;
      const theirs = side === "home" ? c.state.awayScore : c.state.homeScore;
      const r: "W" | "D" | "L" = c.state.winnerTeamId ? (c.state.winnerTeamId === team.id ? "W" : "L") : mine === theirs ? "D" : (mine ?? 0) > (theirs ?? 0) ? "W" : "L";
      form[team.id] = [...(form[team.id] ?? []), r].slice(-5);
    }
  }

  const cleanSheets = [...totals].filter((p) => p.cleanSheets > 0).sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 10);
  const discipline = [...totals]
    .filter((p) => p.yellowCards + p.redCards > 0)
    .sort((a, b) => b.redCards - a.redCards || b.yellowCards - a.yellowCards)
    .slice(0, 10);

  return { standings, medals, scorers, assisters, cleanSheets, discipline, suspensions, form };
}

/** One sport: its events, fixtures, and each event's table and race results. */
export async function getSportPage(slug: string) {
  "use cache";
  cacheLife(LIFE);
  cacheTag(liveTags.standings, liveTags.fixtureList);
  const sports = await getSports();
  const sport = sports.find((s) => s.slug === slug);
  if (!sport) return null;

  const cards = (await getFixtureCards()).filter((c) => c.sport.slug === slug);
  const tables =
    sport.resultFormat === "ranked"
      ? []
      : await Promise.all(
          sport.events.map(async (e) => ({
            event: e,
            rows: sport.slug === "football" ? await getFootballStandings(e.id) : await getEventStandings(e.id),
          })),
        );
  const races =
    sport.resultFormat === "ranked"
      ? await Promise.all(cards.map(async (c) => ({ fixtureId: c.id, results: await getRaceResults(c.id) })))
      : [];

  return { sport, cards, tables, races };
}
