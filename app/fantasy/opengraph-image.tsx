import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { OG_SIZE, OgFrame } from "@/lib/design/og-frame";

// Share image for SEES Fantasy (and every fantasy page without its own).

export const alt = "SEES Fantasy: pick your SEES XI";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const steps = ["Pick 15 players on a 100m budget", "Captain your XI", "Score every matchday"];
  return new ImageResponse(
    (
      <OgFrame kicker="SEES FANTASY · FREE" title="Pick your SEES XI">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36 }}>
              <div
                style={{
                  display: "flex",
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  background: OG.brandLight,
                  color: OG.pitch,
                  fontWeight: 800,
                }}
              >
                {String(i + 1)}
              </div>
              {s}
            </div>
          ))}
        </div>
      </OgFrame>
    ),
    size,
  );
}
