import { formatRaceTime } from "./results-rows";
import { formatScore, sideName, sideWon } from "./display";
import type { MatchPageData } from "./match-page";
import type { TimelineEntry } from "./types";

// What a match's share pictures say (lib/design/og-match.tsx draws them, at
// /matches/<id>/share-image/<post|story>?card=…). Pure: the match page uses
// shareCards() to offer the right ones, the image route builds the rest.
//
//   poster  before kick-off: the two sides, the day and time
//   live    during play: the score, the minute, who scored
//   goal    the latest goal, with the scorer's face
//   result  after full time, in the sport's own look
//   motm    the player of the match, with their face and numbers

export type ShareCard = "poster" | "live" | "goal" | "result" | "motm";
export type ShareFormat = "post" | "story";

export const SHARE_CARD_LABEL: Record<ShareCard, string> = {
  poster: "Matchday poster",
  live: "Live score",
  goal: "Latest goal",
  result: "Result",
  motm: "Player of the match",
};

/** Each sport's result look. */
export type ShareArt = "football" | "handball" | "basketball" | "sets" | "race" | "swimming" | "chess" | "gaming" | "ludo" | "scrabble" | "connect4" | "plain";

type Data = Pick<MatchPageData, "fixture" | "state" | "timeline">;

const LIVE = new Set(["live", "half_time"]);
const OVER = new Set(["full_time", "walkover"]);

const goals = (timeline: TimelineEntry[]) => timeline.filter((e) => e.type === "goal");
const motmEvent = (timeline: TimelineEntry[]) => timeline.find((e) => e.type === "man_of_the_match" && e.playerName);

/** The pictures this match can share right now, best first. */
export function shareCards({ fixture, state, timeline, race }: Data & { race?: MatchPageData["race"] }): ShareCard[] {
  const timed = fixture.sport.resultFormat === "timed";
  const scored = timed && goals(timeline).some((g) => g.playerName);
  if (state.status === "cancelled") return [];
  // Races: the podium once results are published, else the poster.
  if (fixture.sport.resultFormat === "ranked") return (race ?? []).some((r) => r.position !== null && r.position <= 3) ? ["result"] : ["poster"];
  if (LIVE.has(state.status)) return scored ? ["live", "goal"] : ["live"];
  if (OVER.has(state.status)) return [
    "result",
    ...(motmEvent(timeline) ? (["motm"] as const) : []),
    ...(scored ? (["goal"] as const) : []),
  ];
  return ["poster"];
}

export function shareArt(slug: string): ShareArt {
  if (slug.startsWith("football")) return "football";
  if (slug === "handball") return "handball";
  if (slug === "basketball") return "basketball";
  if (slug.startsWith("athletics")) return "race";
  if (slug.startsWith("swimming")) return "swimming";
  if (slug.includes("chess") || slug.includes("draughts")) return "chess";
  if (slug.startsWith("mobile-games") || slug.startsWith("mortal-kombat")) return "gaming";
  if (slug.includes("ludo")) return "ludo";
  if (slug.includes("scrabble")) return "scrabble";
  if (slug.includes("connect-four")) return "connect4";
  if (["volleyball", "badminton", "lawn-tennis", "table-tennis"].some((s) => slug.startsWith(s))) return "sets";
  return "plain";
}

/** The sport photo behind a card (public/photos/<name>.webp), if the sport has one. */
export function sharePhoto(slug: string): string | null {
  for (const name of ["football", "basketball", "handball", "volleyball", "athletics"]) {
    if (slug.startsWith(name)) return `/photos/${name}.webp`;
  }
  return null;
}

/** The event as people say it: "Football (men)", "Chess (women)", "Table tennis · Men's singles". */
export function matchWhat(f: { sport: { name: string }; event: { name: string } }) {
  const { name: sport } = f.sport;
  const { name: event } = f.event;
  if (event === sport || event.toLowerCase().startsWith(sport.toLowerCase())) return event;
  return /^(men's|women's|mixed|singles|male|female)/i.test(event) ? `${sport} · ${event}` : event;
}

const minuteLabel = (e: Pick<TimelineEntry, "minute" | "addedMinutes">) =>
  e.minute === null ? "" : e.addedMinutes ? `${e.minute}+${e.addedMinutes}'` : `${e.minute}'`;

export type ShareSide = { name: string; year: number | null; score: string; won: boolean; scorers: string };

export type ShareModel = {
  card: ShareCard;
  art: ShareArt;
  eventName: string;
  /** The event as people say it: "Football (men)", "Table tennis · Men's singles". */
  what: string;
  /** "Group stage", "Final"… or null. */
  stage: string | null;
  home: ShareSide;
  away: ShareSide;
  draw: boolean;
  /** The big words on a result card ("CHECKMATE.", "Full time"). */
  headline: string;
  /** One sentence under it ("Year 3 beat Year 4 in the women's chess."). */
  line: string;
  /** Quarters or sets: [label, home, away, decisive]. */
  periods: { label: string; home: string; away: string; key: boolean }[];
  /** Races: the top three. */
  podium: { place: number; name: string; year: number | null; time: string }[];
  /** Live: the minute or "HT". */
  clock: string | null;
  /** The player on a goal or player-of-the-match card. */
  player: { id: string | null; name: string; year: number | null; minute: string; role: string | null } | null;
};

const STAGE: Record<string, string> = {
  league: "Group stage",
  group: "Group stage",
  quarter_final: "Quarter-final",
  semi_final: "Semi-final",
  final: "Final",
  third_place: "Third place",
  friendly: "Friendly",
};

function scorersFor(timeline: TimelineEntry[], teamId: string | null, otherTeamId: string | null) {
  // An own goal counts for the other side, and is listed there.
  const lines = new Map<string, string[]>();
  for (const g of goals(timeline)) {
    if (!g.playerName) continue;
    const forTeam = g.isOwnGoal ? (g.teamId === otherTeamId ? teamId : otherTeamId) : g.teamId;
    if (forTeam !== teamId) continue;
    const name = g.isOwnGoal ? `${g.playerName} (og)` : g.isPenalty ? `${g.playerName} (pen)` : g.playerName;
    lines.set(name, [...(lines.get(name) ?? []), minuteLabel(g)].filter(Boolean));
  }
  return [...lines].map(([name, mins]) => (mins.length ? `${name} ${mins.join(", ")}` : name)).join(" · ");
}

const QUARTERS = ["first_quarter", "second_quarter", "third_quarter", "fourth_quarter", "overtime"] as const;

function headlineFor(art: ShareArt, d: Data, draw: boolean, winner: string, margin: number) {
  if (draw) return "All square.";
  switch (art) {
    case "chess":
      return d.fixture.event.slug.includes("draughts") ? "Crowned." : "Checkmate.";
    case "gaming":
      return "GG.";
    case "ludo":
      return "Double six.";
    case "scrabble":
      return "Triple word.";
    case "connect4":
      return "Four in a row.";
    case "basketball":
      return margin <= 3 ? "Buzzer beater." : `${winner} win.`;
    case "sets":
      return margin === 1 ? `${winner} take it in three.` : `${winner} in straight sets.`;
    default:
      return "Full time";
  }
}

/** Everything a card shows. `race` comes from the match page (races only). */
export function shareModel(
  card: ShareCard,
  d: Data & Pick<MatchPageData, "setScores" | "race" | "lineups">,
  /** Live: the clock as the match page shows it ("34'", "HT"). */
  clock: string | null = null,
): ShareModel {
  const { fixture, state, timeline } = d;
  const art = shareArt(fixture.event.slug);
  const boards = fixture.event.boards;
  const side = (s: "home" | "away"): ShareSide => {
    const team = s === "home" ? fixture.home : fixture.away;
    const other = s === "home" ? fixture.away : fixture.home;
    return {
      name: sideName(fixture, s),
      year: team?.year ?? null,
      score: formatScore(s === "home" ? state.homeScore : state.awayScore, boards),
      won: sideWon(fixture, state, s),
      scorers: fixture.sport.resultFormat === "timed" ? scorersFor(timeline, team?.id ?? null, other?.id ?? null) : "",
    };
  };
  const home = side("home");
  const away = side("away");
  const draw = OVER.has(state.status) && !home.won && !away.won;
  const winner = home.won ? home : away;
  const loser = home.won ? away : home;
  const margin = Math.abs((state.homeScore ?? 0) - (state.awayScore ?? 0));

  let periods: ShareModel["periods"] = [];
  if (art === "basketball") {
    periods = QUARTERS.map((q, i) => {
      const pts = (teamId: string | undefined) =>
        timeline.filter((e) => e.type === "goal" && e.period === q && e.teamId === teamId).reduce((s, e) => s + (e.points ?? 1), 0);
      const played = timeline.some((e) => e.period === q);
      return played ? { label: q === "overtime" ? "OT" : `Q${i + 1}`, home: String(pts(fixture.home?.id)), away: String(pts(fixture.away?.id)), key: false } : null;
    }).filter((p): p is NonNullable<typeof p> => p !== null);
  }
  if (fixture.sport.resultFormat === "sets") {
    periods = d.setScores
      .filter((s) => s.complete)
      .map((s) => ({ label: `Set ${s.setNumber}`, home: String(s.homePoints), away: String(s.awayPoints), key: false }));
  }
  if (periods.length) periods[periods.length - 1].key = true;

  const podium = d.race
    .filter((r) => r.position !== null && r.position <= 3)
    .sort((a, b) => a.position! - b.position!)
    .slice(0, 3)
    .map((r) => ({
      place: r.position!,
      name: r.athleteName ?? r.team.name,
      year: r.team.year,
      time: r.timeMs !== null ? `${formatRaceTime(r.timeMs)}s` : r.markMm !== null ? `${(r.markMm / 1000).toFixed(2)} m` : "",
    }));

  let player: ShareModel["player"] = null;
  const roleOf = (id: string | null) => {
    const pos = d.lineups.find((l) => l.playerId === id)?.position;
    return pos ? { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" }[pos] : null;
  };
  const yearOf = (teamId: string | null) => (teamId === fixture.home?.id ? fixture.home?.year : teamId === fixture.away?.id ? fixture.away?.year : null) ?? null;
  if (card === "goal") {
    const g = [...goals(timeline)].reverse().find((e) => e.playerName);
    if (g) player = { id: g.playerId, name: g.playerName!, year: yearOf(g.isOwnGoal ? null : g.teamId), minute: minuteLabel(g), role: roleOf(g.playerId) };
  }
  if (card === "motm") {
    const m = motmEvent(timeline);
    if (m) player = { id: m.playerId, name: m.playerName!, year: yearOf(m.teamId), minute: "", role: roleOf(m.playerId) };
  }

  const eventName = fixture.event.name;
  return {
    card,
    art,
    eventName,
    stage: STAGE[fixture.stage] ?? null,
    home,
    away,
    draw,
    headline: art === "race" || art === "swimming" ? eventName : headlineFor(art, d, draw, winner.name, art === "sets" ? (state.homeScore ?? 0) + (state.awayScore ?? 0) - 2 : margin),
    what: matchWhat(fixture),
    line: draw ? `${home.name} and ${away.name} share the spoils.` : `${winner.name} beat ${loser.name}.`,
    periods,
    podium,
    clock,
    player,
  };
}
