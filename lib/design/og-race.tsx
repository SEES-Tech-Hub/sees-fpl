import type { ReactNode } from "react";
import { lanePercent, medalShort, raceHeadline, raceStarted, type ChampionshipProgress } from "@/lib/live/race";
import type { MedalTableRow } from "@/lib/live/types";
import { OG } from "./og-colours";
import { OgCrest, OgCrestMark } from "./og-crest";
import { seesEmblemDataUri } from "./sees-emblem";

// The race for the championship as pictures (next/og): the link preview
// (1200×630), a post to download (1080×1350, the podium) and a story
// (1080×1920, the five crests racing up their lanes). next/og needs
// display:flex on every element with more than one child.

export const RACE_SIZES = {
  link: { width: 1200, height: 630 },
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;
export type RaceFormat = keyof typeof RACE_SIZES;

type Props = { rows: MedalTableRow[]; progress: ChampionshipProgress; line: string };

const trail = (year: number | null | undefined) => `${year ? OG.team[year] : OG.neutral}59`;
const medal = { gold: OG.highlight, silver: OG.silver, bronze: OG.team[2] };

function Shell({ padding, children }: { padding: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding,
        backgroundColor: OG.pitch,
        color: OG.white,
        fontFamily: "sans-serif",
      }}
    >
      {children}
    </div>
  );
}

function Kicker({ size, text }: { size: number; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.6 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
      <img src={seesEmblemDataUri({ fg: OG.white, bg: null, inset: 1 })} width={size * 2} height={size * 2} alt="" />
      <div style={{ display: "flex", fontSize: size, fontWeight: 700, letterSpacing: size * 0.14, color: OG.brandLight }}>{text}</div>
    </div>
  );
}

function Medals({ r, size }: { r: MedalTableRow; size: number }) {
  return (
    <div style={{ display: "flex", gap: size * 0.7, fontSize: size, fontWeight: 700 }}>
      {(["gold", "silver", "bronze"] as const).map((m) => (
        <div key={m} style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
          <div style={{ display: "flex", width: size * 0.6, height: size * 0.6, borderRadius: 999, background: medal[m] }} />
          {String(r[m])}
        </div>
      ))}
    </div>
  );
}

/** 1200×630: what a pasted /championship link shows. */
export function RaceLinkImage({ rows, progress, line }: Props) {
  return (
    <Shell padding="52px 64px 44px">
      <Kicker size={24} text="SEES GAMES 2026" />
      <div style={{ display: "flex", marginTop: 16, fontSize: 60, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>RACE FOR THE CHAMPIONSHIP</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 26, flex: 1 }}>
        {rows.map((r) => (
          <div key={r.team.id} style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", position: "relative", flex: 1, height: 50, borderRadius: 14, background: "rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", position: "absolute", left: 0, top: 0, bottom: 0, width: `${lanePercent(r, rows, progress)}%`, borderRadius: 14, background: trail(r.team.year) }} />
              <div style={{ display: "flex", position: "absolute", left: `${lanePercent(r, rows, progress)}%`, top: 1, marginLeft: -22 }}>
                <OgCrestMark year={r.team.year} size={48} />
              </div>
            </div>
            <div style={{ display: "flex", width: 210, justifyContent: "flex-end" }}>
              <Medals r={r} size={26} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", marginTop: 18, fontSize: 24, opacity: 0.85 }}>
        <div style={{ display: "flex" }}>{line}</div>
        <div style={{ display: "flex", marginLeft: "auto", color: OG.brandLight }}>games.seesunilag.com</div>
      </div>
    </Shell>
  );
}

/** 1080×1350: the podium and the chasers, to post. */
export function RacePostImage({ rows, progress, line }: Props) {
  const started = raceStarted(rows);
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const heights = [250, 340, 180];
  const crests = [230, 280, 210];
  return (
    <Shell padding="72px 72px 64px">
      <Kicker size={30} text="SEES GAMES 2026 · THE CHAMPIONSHIP" />
      <div style={{ display: "flex", marginTop: 30, fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
        {raceHeadline(rows, progress).replace(/\.$/, "")}
      </div>
      {started ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end", gap: 36 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            {podium.map((r, k) => (
              <div key={r.team.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 16 }}>
                <OgCrest year={r.team.year} size={crests[k]} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: "100%",
                    height: heights[k],
                    paddingTop: 22,
                    gap: 10,
                    background: "rgba(255,255,255,0.08)",
                    borderTop: `10px solid ${r.team.year ? OG.team[r.team.year] : OG.neutral}`,
                    borderRadius: "14px 14px 0 0",
                  }}
                >
                  <div style={{ display: "flex", fontSize: 88, fontWeight: 800, lineHeight: 1 }}>{String(r.position)}</div>
                  <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>{medalShort(r)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {rows.slice(3).map((r) => (
              <div key={r.team.id} style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 24px", borderRadius: 18, background: "rgba(255,255,255,0.07)", fontSize: 36 }}>
                <div style={{ display: "flex", fontWeight: 800, width: 40 }}>{String(r.position)}</div>
                <OgCrestMark year={r.team.year} size={60} />
                <div style={{ display: "flex", fontWeight: 700 }}>{r.team.name}</div>
                <div style={{ display: "flex", marginLeft: "auto", opacity: 0.85 }}>{medalShort(r)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          {rows.map((r) => (
            <OgCrest key={r.team.id} year={r.team.year} size={180} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", marginTop: 40, fontSize: 30, opacity: 0.85 }}>
        <div style={{ display: "flex" }}>{line}</div>
        <div style={{ display: "flex", marginLeft: "auto", color: OG.brandLight }}>games.seesunilag.com</div>
      </div>
    </Shell>
  );
}

/** 1080×1920: the five years racing up their lanes, for a WhatsApp or Instagram story. */
export function RaceStoryImage({ rows, progress, line }: Props) {
  const lanes = [...rows].sort((a, b) => (a.team.year ?? 9) - (b.team.year ?? 9));
  return (
    <Shell padding="110px 80px 90px">
      <Kicker size={32} text="SEES GAMES 2026" />
      <div style={{ display: "flex", marginTop: 34, fontSize: 112, fontWeight: 800, letterSpacing: -3, lineHeight: 0.95 }}>RACE FOR THE CHAMPIONSHIP</div>
      <div style={{ display: "flex", marginTop: 26, fontSize: 46, fontWeight: 600, color: OG.brandLight }}>{raceHeadline(rows, progress)}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 56, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", opacity: 0.75 }}>
          {[0, 1].map((row) => (
            <div key={row} style={{ display: "flex" }}>
              {Array.from({ length: 46 }, (_, i) => (
                <div key={i} style={{ display: "flex", width: 20, height: 14, background: (i + row) % 2 === 0 ? OG.white : OG.pitch }} />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flex: 1, gap: 18, marginTop: 10 }}>
          {lanes.map((r) => {
            const pct = lanePercent(r, rows, progress);
            return (
              <div key={r.team.id} style={{ display: "flex", position: "relative", flex: 1, borderRadius: 18, background: "rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: `${pct}%`, borderRadius: 18, background: trail(r.team.year) }} />
                <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: `${pct}%`, marginBottom: -62, justifyContent: "center" }}>
                  <OgCrestMark year={r.team.year} size={124} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 20 }}>
          {lanes.map((r) => (
            <div key={r.team.id} style={{ display: "flex", flex: 1, justifyContent: "center", fontSize: 30, fontWeight: 700 }}>
              {medalShort(r)}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 50, fontSize: 34 }}>
        <div style={{ display: "flex", opacity: 0.85 }}>{line}</div>
        <div style={{ display: "flex", color: OG.brandLight, fontWeight: 700 }}>games.seesunilag.com</div>
      </div>
    </Shell>
  );
}

export function RaceImage({ format, ...props }: Props & { format: RaceFormat }) {
  if (format === "post") return <RacePostImage {...props} />;
  if (format === "story") return <RaceStoryImage {...props} />;
  return <RaceLinkImage {...props} />;
}
