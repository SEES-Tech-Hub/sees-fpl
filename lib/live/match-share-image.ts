import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { MatchCardProps } from "@/lib/design/og-match";
import { MATCH_SIZES } from "@/lib/design/og-match";
import { getFantasyRules } from "@/lib/fantasy/api";
import { playerPhotoUrl } from "@/lib/fantasy/player-photos";
import { getClockState } from "./clock";
import { getMatchPage } from "./match-page";
import { shareCards, shareModel, sharePhoto, type ShareCard, type ShareFormat } from "./match-share";
import { getReactionSnapshot } from "./reaction-state";

// Builds a match's share picture (lib/design/og-match.tsx) for
// /matches/<id>/share-image/<format>?card=…: the match from the cached
// match page, the sport photo and the player's face from this site (turned
// into JPEGs, as next/og can't draw WebP), the fantasy points a goal earned,
// and the fans' cheers from live reactions.

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 600 | 700 | 800; style: "normal" }[]> | null = null;

/** Oswald and Inter as WOFF (next/og can't read the site's WOFF2 files). */
export function matchFonts() {
  const file = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));
  fonts ??= Promise.all([
    file("oswald-latin-600-normal.woff").then((data) => ({ name: "Oswald", data, weight: 600 as const, style: "normal" as const })),
    file("oswald-latin-700-normal.woff").then((data) => ({ name: "Oswald", data, weight: 700 as const, style: "normal" as const })),
    file("inter-latin-500-normal.woff").then((data) => ({ name: "Inter", data, weight: 500 as const, style: "normal" as const })),
    file("inter-latin-600-normal.woff").then((data) => ({ name: "Inter", data, weight: 600 as const, style: "normal" as const })),
    file("inter-latin-800-normal.woff").then((data) => ({ name: "Inter", data, weight: 800 as const, style: "normal" as const })),
  ]);
  return fonts;
}

export async function shareJpeg(origin: string, path: string | null, width: number, height: number) {
  if (!path) return null;
  try {
    const res = await fetch(new URL(path, origin));
    if (!res.ok) return null;
    const out = await sharp(Buffer.from(await res.arrayBuffer())).resize(width, height, { fit: "cover", position: "attention" }).jpeg({ quality: 76 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

const caps = (s: string) => s.toUpperCase();

/** The picture's props, or null when the match doesn't exist or can't share that card now. */
export async function matchShareImage(origin: string, fixtureId: string, format: ShareFormat, wanted: string | null): Promise<MatchCardProps | null> {
  const data = await getMatchPage(fixtureId);
  if (!data) return null;
  const cards = shareCards(data);
  if (cards.length === 0) return null;
  const card: ShareCard = cards.includes(wanted as ShareCard) ? (wanted as ShareCard) : cards[0];
  const { fixture, state } = data;

  const clock =
    card === "live"
      ? getClockState({
          status: state.status,
          currentPeriod: state.currentPeriod,
          periodStartedAt: state.periodStartedAt,
          periodMinutes: fixture.event.periodMinutes,
          extraPeriodMinutes: fixture.event.extraPeriodMinutes,
        }).label
      : null;
  const m = shareModel(card, data, clock && clock !== "Live" ? clock : null);
  const { height } = MATCH_SIZES[format];

  const wantsPhoto = card === "live" || card === "result";
  const faceSize = card === "motm" ? ([1080, format === "story" ? 1120 : 760] as const) : ([600, 600] as const);
  const faceUrl = m.player?.id ? playerPhotoUrl(m.player.id) : null;

  // Fantasy points for a goal (men's football is the fantasy game).
  let fantasyPoints: number | null = null;
  if (card === "goal" && m.player?.id && fixture.event.slug === "football-men") {
    const position = data.lineups.find((l) => l.playerId === m.player!.id)?.position;
    const rules = await getFantasyRules().catch(() => null);
    const goal = rules?.scoring.find((r) => r.key === "goal");
    if (position && goal) fantasyPoints = goal.points[position];
  }

  // The player's side's cheers, for the player of the match.
  let cheers: number | null = null;
  if (card === "motm" && m.player) {
    const snap = await getReactionSnapshot(fixtureId);
    const homeYear = fixture.home?.year ?? null;
    if (snap) cheers = (m.player.year !== null && m.player.year === homeYear ? snap.totals.cheer_home : snap.totals.cheer_away) || null;
  }

  const [photo, face] = await Promise.all([
    wantsPhoto ? shareJpeg(origin, sharePhoto(fixture.event.slug), 1080, height) : Promise.resolve(null),
    card === "goal" || card === "motm" ? shareJpeg(origin, faceUrl, faceSize[0], faceSize[1]) : Promise.resolve(null),
  ]);

  const kickoff = fixture.kickoffAt ? new Date(fixture.kickoffAt) : null;
  const day = kickoff
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short" }).format(kickoff)
    : "Date to be confirmed";
  const time = kickoff
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true }).format(kickoff)
    : "";
  return {
    m,
    format,
    photo,
    face,
    dateLabel: day,
    kickoffLabel: caps([day, time].filter(Boolean).join(" · ")),
    fantasyPoints,
    cheers,
  };
}
