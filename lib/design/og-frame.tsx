import type { ReactNode } from "react";
import { OG } from "./og-colours";
import { seesEmblemDataUri } from "./sees-emblem";

// The shared frame for share images (next/og): brand green, the SEES emblem,
// a kicker line, the big title, and whatever the page adds underneath.
// next/og needs display:flex on every element with more than one child.

export const OG_SIZE = { width: 1200, height: 630 };

export function OgFrame({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        backgroundColor: OG.pitch,
        color: OG.white,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
        <img src={seesEmblemDataUri({ fg: OG.white, bg: null, inset: 1 })} width={64} height={64} alt="" />
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: 4, color: OG.brandLight }}>{kicker}</div>
      </div>
      <div style={{ display: "flex", marginTop: 24, fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>{title}</div>
      <div style={{ display: "flex", flex: 1, marginTop: 24 }}>{children}</div>
      <div style={{ display: "flex", gap: 12 }}>
        {[1, 2, 3, 4, 5].map((y) => (
          <div key={y} style={{ width: 40, height: 10, borderRadius: 999, background: OG.team[y], display: "flex" }} />
        ))}
        <div style={{ display: "flex", marginLeft: "auto", fontSize: 26, opacity: 0.8 }}>games.seesunilag.com</div>
      </div>
    </div>
  );
}
