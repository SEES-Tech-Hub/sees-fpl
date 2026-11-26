import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { OG_SIZE, OgFrame } from "@/lib/design/og-frame";
import { getTablesPage } from "@/lib/live/public-pages";
import { OgCrestMark } from "@/lib/design/og-crest";

// Share image for /tables: the top of the football table, live.

export const alt = "SEES Games 2026 football table";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const { standings } = await getTablesPage();
  const started = standings.some((r) => r.played > 0);
  return new ImageResponse(
    (
      <OgFrame kicker="SEES GAMES 2026 · FOOTBALL" title="The table">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
          {standings.slice(0, 5).map((r, i) => (
            <div key={r.team.id} style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 28, height: 44 }}>
              <div style={{ display: "flex", width: 40, fontWeight: 800 }}>{started ? r.position : i + 1}</div>
              <OgCrestMark year={r.team.year} size={40} />
              <div style={{ display: "flex", flex: 1, fontWeight: 700 }}>{r.team.name}</div>
              <div style={{ display: "flex", width: 140, opacity: 0.75 }}>{`P ${r.played}`}</div>
              <div style={{ display: "flex", width: 120, fontWeight: 800, color: OG.brandLight }}>{`${r.points} pts`}</div>
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    size,
  );
}
