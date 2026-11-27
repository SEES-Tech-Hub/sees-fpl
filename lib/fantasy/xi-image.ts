import "server-only";
import sharp from "sharp";
import type { OgXiPlayer } from "@/lib/design/og-xi";
import { getCurrentUser } from "@/lib/auth";
import { getFantasyRules, getMatchdayState, getMyManager, getMyTeam, getPlayers } from "./api";
import { formatWAT } from "./time";
import type { Player, Position } from "./types";

// What the "Share my XI" picture shows for the signed-in manager: their team
// name, the starting XI from their saved lineup (with the faces read from
// this site's public/players and turned into PNGs), the formation, and a
// line inviting others to play.

const ROWS: Position[] = ["FWD", "MID", "DEF", "GK"];

async function photoDataUri(origin: string, url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(new URL(url, origin));
    if (!res.ok) return null;
    // next/og can't draw WebP, so each face goes in as a small PNG.
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize(200, 200).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Rows of the XI, forwards first, with each face as a data URI. */
export async function xiRows(
  origin: string,
  starters: Player[],
  captainId: string | null,
  viceId: string | null,
): Promise<OgXiPlayer[][]> {
  const faces = await Promise.all(starters.map((p) => photoDataUri(origin, p.photoUrl)));
  const face = new Map(starters.map((p, i) => [p.id, faces[i]]));
  return ROWS.map((pos) =>
    starters
      .filter((p) => p.position === pos)
      .map((p) => ({
        name: p.displayName,
        year: p.teamYear,
        photo: face.get(p.id) ?? null,
        captain: p.id === captainId,
        vice: p.id === viceId,
      })),
  );
}

export const formationOf = (starters: Pick<Player, "position">[]) =>
  (["DEF", "MID", "FWD"] as const).map((pos) => starters.filter((p) => p.position === pos).length).join("-");

/** The signed-in manager's XI picture data, or null if they have no team. */
export async function myXiImage(origin: string) {
  const current = await getCurrentUser();
  if (!current) return null;
  const user = { id: current.profile.id, name: current.profile.display_name ?? "Manager", yearGroup: current.profile.year_group };
  const [manager, team, players, rules, md] = await Promise.all([
    getMyManager(user),
    getMyTeam(user),
    getPlayers(),
    getFantasyRules(),
    getMatchdayState(),
  ]);
  if (!manager || !team) return null;
  const byId = new Map(players.map((p) => [p.id, p]));
  const ordered = [...team.picks].sort((a, b) => a.slot - b.slot);
  const starters = ordered
    .slice(0, rules.startingSize)
    .map((p) => byId.get(p.playerId))
    .filter((p): p is Player => Boolean(p));
  const captain = team.picks.find((p) => p.isCaptain)?.playerId ?? null;
  const vice = team.picks.find((p) => p.isViceCaptain)?.playerId ?? null;
  const deadline = md.next?.deadlineAt ?? null;
  return {
    teamName: manager.teamName,
    matchdayNumber: team.matchdayNumber,
    formation: formationOf(starters),
    rows: await xiRows(origin, starters, captain, vice),
    cta: deadline ? `Pick yours before ${formatWAT(deadline, "date")}, ${formatWAT(deadline, "time")}` : "Pick your SEES XI",
  };
}
