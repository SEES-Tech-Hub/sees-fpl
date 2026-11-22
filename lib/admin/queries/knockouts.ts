import "server-only";
import { cache } from "react";
import { getFootballStandings } from "@/lib/live/stats";
import type { StandingRow } from "@/lib/live/types";
import { adminReadClient, throwReadError } from "../server";

// Owner: admin backend. What "Fill the finals" would do, for the confirm
// screen (organisers check it before the admin taps Fill). The table is Bolu's
// football_standings (rulebook order: points, goal difference, goals scored,
// head to head) through getFootballStandings(); the fill itself is his
// fill_football_knockouts(), which reads the same view.

/** The sport fill_football_knockouts() works for. An identifier, not a rule value. */
export const FOOTBALL_SPORT_SLUG = "football";

export type KnockoutPreview =
  | {
      ready: true;
      /** The table in order (1st first). */
      standings: StandingRow[];
      final: { home: StandingRow; away: StandingRow };
      thirdPlace: { home: StandingRow; away: StandingRow } | null;
    }
  | {
      ready: false;
      reason: "not_football" | "league_not_finished" | "too_few_teams" | "standings_tied";
      /** League fixtures still to finish (for league_not_finished). */
      unfinished: number;
      standings: StandingRow[];
    };

export const getKnockoutPreview = cache(async (eventId: string): Promise<KnockoutPreview> => {
  const { supabase } = await adminReadClient();
  const { data: event, error } = await supabase.from("events").select("id, sport:sports ( slug )").eq("id", eventId).maybeSingle();
  if (error) throwReadError("the event", error);
  const slug = (event?.sport as { slug: string } | null | undefined)?.slug;
  if (slug !== FOOTBALL_SPORT_SLUG) return { ready: false, reason: "not_football", unfinished: 0, standings: [] };

  const { count, error: countError } = await supabase
    .from("fixtures")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("stage", "league")
    .not("status", "in", "(full_time,walkover,cancelled)");
  if (countError) throwReadError("league fixtures", countError);

  const standings = [...(await getFootballStandings(eventId))].sort((a, b) => a.position - b.position);
  if ((count ?? 0) > 0) return { ready: false, reason: "league_not_finished", unfinished: count ?? 0, standings };
  if (standings.length < 4) return { ready: false, reason: "too_few_teams", unfinished: 0, standings };
  // The same tie rule as fill_football_knockouts: a tie on every tie-breaker
  // across a qualifying line is for the organisers to decide.
  const tiedAcross = (a: number, b: number) => standings[b] !== undefined && standings[a].position === standings[b].position;
  if (tiedAcross(1, 2) || tiedAcross(3, 4)) return { ready: false, reason: "standings_tied", unfinished: 0, standings };

  return {
    ready: true,
    standings,
    final: { home: standings[0], away: standings[1] },
    thirdPlace: { home: standings[2], away: standings[3] },
  };
});
