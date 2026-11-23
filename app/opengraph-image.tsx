import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";

// The site-wide share preview (home, tables, sports, fantasy).

export const alt = "SEES Games Hub: live scores and SEES Fantasy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          backgroundColor: OG.pitch,
          color: OG.white,
          fontFamily: "sans-serif",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          {[1, 2, 3, 4, 5].map((y) => (
            <div key={y} style={{ width: 54, height: 54, borderRadius: 999, background: OG.team[y], display: "flex" }} />
          ))}
        </div>
        <div style={{ display: "flex", fontSize: 110, fontWeight: 800, letterSpacing: -2 }}>SEES GAMES 2026</div>
        <div style={{ display: "flex", fontSize: 40, color: OG.brandLight, fontWeight: 700 }}>Live scores · Tables · SEES Fantasy</div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.8 }}>12 sports · 5 years · 28 Nov to 9 Dec</div>
      </div>
    ),
    size,
  );
}
