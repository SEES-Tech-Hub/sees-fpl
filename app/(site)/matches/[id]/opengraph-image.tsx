import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { getMatchPage } from "@/lib/live/match-page";
import { formatWAT } from "@/lib/utils";

// The WhatsApp / social preview for a match: both teams in their colours,
// the score (or kickoff time) and the sport.

export const alt = "SEES Games match";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatchPage(id);
  const f = data?.fixture;
  const s = data?.state;
  const home = f?.home;
  const away = f?.away;
  const started = s && s.status !== "scheduled" && s.status !== "postponed" && s.status !== "cancelled";
  const status = !s
    ? ""
    : s.status === "full_time"
      ? "FULL TIME"
      : s.status === "live" || s.status === "half_time"
        ? "LIVE NOW"
        : s.status === "postponed"
          ? "POSTPONED"
          : f?.kickoffAt
            ? formatWAT(f.kickoffAt, "datetime").toUpperCase()
            : "TIME TO BE CONFIRMED";
  const disc = (year: number | undefined, label: string | undefined) => (
    <div
      style={{
        width: 210,
        height: 210,
        borderRadius: 999,
        background: year ? OG.team[year] : OG.white,
        color: OG.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 84,
        fontWeight: 800,
        border: `8px solid rgba(255,255,255,0.35)`,
      }}
    >
      {label ?? "?"}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(110deg, ${home ? OG.team[home.year] : OG.pitch}66 0%, ${OG.pitch} 38%, ${OG.pitch} 62%, ${away ? OG.team[away.year] : OG.pitch}66 100%)`,
          backgroundColor: OG.pitch,
          color: OG.white,
          fontFamily: "sans-serif",
          gap: 28,
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 4, color: OG.brandLight, fontWeight: 700 }}>
          {`SEES GAMES 2026 · ${(f?.sport.name ?? "MATCH").toUpperCase()}`}
        </div>
        {f?.sport.resultFormat === "ranked" ? (
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800 }}>{f.event.name}</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              {disc(home?.year, home?.shortName)}
              <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{home?.name ?? "TBD"}</div>
            </div>
            <div style={{ display: "flex", fontSize: started ? 150 : 90, fontWeight: 800, opacity: started ? 1 : 0.7 }}>
              {started ? `${s.homeScore ?? 0} – ${s.awayScore ?? 0}` : "v"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              {disc(away?.year, away?.shortName)}
              <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{away?.name ?? "TBD"}</div>
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 800,
            padding: "10px 28px",
            borderRadius: 999,
            background: s?.status === "live" || s?.status === "half_time" ? OG.live : OG.highlight,
            color: s?.status === "live" || s?.status === "half_time" ? OG.white : OG.ink,
          }}
        >
          {status}
        </div>
      </div>
    ),
    size,
  );
}
