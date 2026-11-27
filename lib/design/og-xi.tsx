import { OG } from "./og-colours";
import { OgCrestMark } from "./og-crest";
import { seesEmblemDataUri } from "./sees-emblem";

// A manager's starting XI as a picture to post (next/og): a post
// (1080×1350) or a story (1080×1920). Faces in their year's ring, the captain
// marked, the formation as a sticker. next/og needs display:flex on every
// element with more than one child.

export const XI_SIZES = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;
export type XiFormat = keyof typeof XI_SIZES;

export type OgXiPlayer = {
  name: string;
  year: number;
  /** A data URI, or null for the year crest. */
  photo: string | null;
  captain: boolean;
  vice: boolean;
};

type Props = {
  format: XiFormat;
  teamName: string;
  matchdayNumber: number;
  formation: string;
  /** Rows from the top: forwards, midfielders, defenders, goalkeeper. */
  rows: OgXiPlayer[][];
  /** The call to action at the bottom, e.g. "Pick yours before Sat 07:00". */
  cta: string;
};

const LINE = "rgba(149,253,226,0.22)";

function Face({ p, size }: { p: OgXiPlayer; size: number }) {
  const ring = OG.team[p.year] ?? OG.neutral;
  const badge = Math.round(size * 0.3);
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size }}>
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: 999,
          border: `${Math.round(size * 0.045)}px solid ${ring}`,
          background: OG.ribbonShade,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
          <img src={p.photo} width={size} height={size} alt="" style={{ objectFit: "cover" }} />
        ) : (
          <OgCrestMark year={p.year} size={Math.round(size * 0.6)} />
        )}
      </div>
      {(p.captain || p.vice) && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -4,
            left: -4,
            width: badge,
            height: badge,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            background: p.captain ? OG.highlight : OG.white,
            color: OG.ink,
            fontSize: badge * 0.58,
            fontWeight: 800,
            border: `4px solid ${OG.pitch}`,
          }}
        >
          {p.captain ? "C" : "V"}
        </div>
      )}
    </div>
  );
}

export function XiImage({ format, teamName, matchdayNumber, formation, rows, cta }: Props) {
  const story = format === "story";
  const face = story ? 150 : 132;
  const nameSize = story ? 30 : 27;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: story ? "96px 56px 72px" : "56px 52px 44px",
        backgroundColor: OG.pitch,
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent ${story ? 120 : 92}px, rgba(149,253,226,0.05) ${story ? 120 : 92}px, rgba(149,253,226,0.05) ${story ? 240 : 184}px)`,
        color: OG.white,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
            <img src={seesEmblemDataUri({ fg: OG.white, bg: null, inset: 1 })} width={44} height={44} alt="" />
            <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3, color: OG.brandLight }}>
              {`MY SEES XI · MATCHDAY ${matchdayNumber}`}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: story ? 92 : 80, fontWeight: 800, lineHeight: 1, letterSpacing: -1, textTransform: "uppercase" }}>
            {teamName}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 8,
            padding: "6px 22px",
            borderRadius: 16,
            background: OG.highlight,
            color: OG.ink,
            fontSize: story ? 52 : 46,
            fontWeight: 800,
            transform: "rotate(4deg)",
          }}
        >
          {formation}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around",
          position: "relative",
          flex: 1,
          margin: story ? "56px 0 48px" : "36px 0 30px",
          border: `3px solid ${LINE}`,
          borderRadius: 20,
          padding: "20px 0",
        }}
      >
        <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: "50%", height: 0, borderTop: `3px solid ${LINE}` }} />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 200,
            height: 200,
            marginLeft: -100,
            marginTop: -100,
            borderRadius: 999,
            border: `3px solid ${LINE}`,
          }}
        />
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-start" }}>
            {row.map((p) => (
              <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: 190 }}>
                <Face p={p} size={face} />
                <div
                  style={{
                    display: "flex",
                    fontSize: nameSize,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    maxWidth: 190,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700 }}>{cta}</div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: OG.brandLight }}>games.seesunilag.com/fantasy</div>
        </div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 3, color: "rgba(255,255,255,0.8)" }}>SEES GAMES HUB</div>
      </div>
    </div>
  );
}
