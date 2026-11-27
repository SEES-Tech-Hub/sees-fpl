import type { ReactNode } from "react";
import type { ShareFormat, ShareModel, ShareSide } from "@/lib/live/match-share";
import { basketballSvg, boardSvg, connect4Svg, dieSvg, knightSvg, ludoSvg, padSvg, raysSvg, starSvg, wavesSvg } from "./og-art";
import { OG } from "./og-colours";
import { OgCrestMark } from "./og-crest";
import { seesEmblemDataUri } from "./sees-emblem";

// A match as a picture to post (1080×1350) or put on a story (1080×1920),
// drawn by next/og from lib/live/match-share.ts. One card per moment
// (poster, live, goal, result, player of the match), and the result in each
// sport's own look: the sport photo where there is one, otherwise the game
// itself drawn (a knight, a pad, dice, tiles, discs). Every card ends with
// the site's address, so a shared picture brings people back.
//
// next/og: every element with more than one child needs display:flex.

export const MATCH_SIZES = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

export type MatchCardProps = {
  m: ShareModel;
  format: ShareFormat;
  /** The sport photo, cropped to the card (data URI). */
  photo: string | null;
  /** The player's face for goal and player-of-the-match cards (data URI). */
  face: string | null;
  /** "Sat 28 Nov" and "SAT 28 NOV · 7:30 AM". */
  dateLabel: string;
  kickoffLabel: string;
  /** Fantasy points the goal earned, when the player is in the fantasy game. */
  fantasyPoints: number | null;
  /** Fan cheers for the player's side, from live reactions. */
  cheers: number | null;
};

const HEAD = "Oswald";
const BODY = "Inter";
const SITE = "games.seesunilag.com";
const yc = (year: number | null) => (year ? OG.team[year] : OG.neutral);

function Frame({ height, bg = OG.pitch, children }: { height: number; bg?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", position: "relative", width: 1080, height, overflow: "hidden", backgroundColor: bg, color: OG.white, fontFamily: BODY }}>
      {children}
    </div>
  );
}

function Fill({ children, style }: { children?: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: "flex", position: "absolute", left: 0, top: 0, right: 0, bottom: 0, ...style }}>{children}</div>;
}

function Content({ children, pad = "60px 56px 48px" }: { children: ReactNode; pad?: string }) {
  return <div style={{ display: "flex", flexDirection: "column", position: "relative", width: "100%", height: "100%", padding: pad }}>{children}</div>;
}

function Brand({ right }: { right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
        <img src={seesEmblemDataUri({ fg: OG.white, bg: null, inset: 1 })} width={52} height={52} alt="" />
        <div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 3.5, color: OG.brandLight }}>SEES GAMES 2026</div>
      </div>
      {right}
    </div>
  );
}

function Footer({ left }: { left: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `2px solid rgba(149,253,226,0.25)`, paddingTop: 26, marginTop: 30, fontSize: 26 }}>
      <div style={{ display: "flex", fontWeight: 600, maxWidth: 600 }}>{left}</div>
      <div style={{ display: "flex", fontWeight: 800, color: OG.brandLight }}>{SITE}</div>
    </div>
  );
}

function Spacer() {
  return <div style={{ display: "flex", flex: 1 }} />;
}

function Headline({ text, size }: { text: string; size: number }) {
  return (
    <div style={{ display: "flex", fontFamily: HEAD, fontSize: size, fontWeight: 700, lineHeight: 0.95, textTransform: "uppercase", maxWidth: 760 }}>{text}</div>
  );
}

const nameSize = (name: string, big: number) => (name.length > 14 ? big * 0.62 : name.length > 9 ? big * 0.8 : big);

function Photo({ src, overlay }: { src: string | null; overlay: string }) {
  if (!src) return null;
  return (
    <Fill>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
      <img src={src} width={1080} height={1920} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Fill style={{ backgroundImage: overlay }} />
    </Fill>
  );
}

function Stripe({ a, b, height = 16 }: { a: number | null; b: number | null; height?: number }) {
  return (
    <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: 0, height }}>
      <div style={{ display: "flex", flex: 1, background: yc(a) }} />
      <div style={{ display: "flex", flex: 1, background: yc(b) }} />
    </div>
  );
}

/** Crest, name and score in one row (basketball, live, art cards). */
function SideRow({ s, crest, scoreSize, dim }: { s: ShareSide; crest: number; scoreSize: number; dim?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: dim ? 0.8 : 1 }}>
      <OgCrestMark year={s.year} size={crest} />
      <div style={{ display: "flex", flex: 1, fontFamily: HEAD, fontSize: nameSize(s.name, 52), fontWeight: 600, textTransform: "uppercase" }}>{s.name}</div>
      <div style={{ display: "flex", fontFamily: HEAD, fontSize: scoreSize, fontWeight: 700, lineHeight: 1 }}>{s.score}</div>
    </div>
  );
}

function Badge({ text, bg = OG.white, color = OG.pitch, size = 30 }: { text: string; bg?: string; color?: string; size?: number }) {
  return (
    <div style={{ display: "flex", fontFamily: HEAD, fontSize: size, fontWeight: 600, letterSpacing: 2, background: bg, color, padding: "6px 20px", borderRadius: 12 }}>{text}</div>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function ClassicSide({ s, opacity }: { s: ShareSide; opacity: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: 280, opacity }}>
      <OgCrestMark year={s.year} size={196} />
      <div style={{ display: "flex", fontFamily: HEAD, fontSize: nameSize(s.name, 40), fontWeight: 600, textTransform: "uppercase" }}>{s.name}</div>
    </div>
  );
}

/** A. Football, handball and anything with no special look: photo, crests, big score, scorers. */
function ResultClassic({ m, format, photo }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const loserDim = (s: ShareSide) => (m.draw || s.won ? 1 : 0.85);
  return (
    <Frame height={h}>
      <Photo src={photo} overlay="linear-gradient(180deg, rgba(1,63,49,0.35) 0%, rgba(1,63,49,0.75) 40%, #013f31 62%)" />
      <Stripe a={m.home.year} b={m.away.year} />
      <Content>
        <Brand right={<Badge text="FULL TIME" />} />
        <Spacer />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <ClassicSide s={m.home} opacity={loserDim(m.home)} />
          <div style={{ display: "flex", fontFamily: HEAD, fontSize: 200, fontWeight: 700, lineHeight: 1, letterSpacing: -4 }}>{`${m.home.score}–${m.away.score}`}</div>
          <ClassicSide s={m.away} opacity={loserDim(m.away)} />
        </div>
        {(m.home.scorers || m.away.scorers) && (
          <div style={{ display: "flex", gap: 48, marginTop: 34, fontSize: 28, lineHeight: 1.5 }}>
            <div style={{ display: "flex", flex: 1, justifyContent: "flex-end", textAlign: "right" }}>{m.home.scorers}</div>
            <div style={{ display: "flex", flex: 1 }}>{m.away.scorers}</div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: OG.brandLight, background: "rgba(149,253,226,0.12)", borderRadius: 999, padding: "12px 28px" }}>
            {[m.what, m.stage].filter(Boolean).join(" · ")}
          </div>
        </div>
        <Footer left="Every score, live" />
      </Content>
    </Frame>
  );
}

/** B. Basketball: photo, a ball, the two scores and the quarters. */
function ResultBasketball({ m, format, photo }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  return (
    <Frame height={h} bg="#0b2a22">
      <Photo src={photo} overlay="linear-gradient(200deg, rgba(1,63,49,0.25) 0%, rgba(1,63,49,0.88) 45%, #013f31 75%)" />
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
      <img src={basketballSvg()} width={600} height={600} alt="" style={{ position: "absolute", left: 700, top: -230 }} />
      <Content>
        <Brand />
        <div style={{ display: "flex", marginTop: 44 }}>
          <Headline text={m.headline} size={108} />
        </div>
        <Spacer />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SideRow s={m.home} crest={130} scoreSize={128} dim={!m.home.won && !m.draw} />
          <SideRow s={m.away} crest={130} scoreSize={128} dim={!m.away.won && !m.draw} />
        </div>
        {m.periods.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            {m.periods.map((p) => (
              <div key={p.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, borderRadius: 16, padding: "12px 0", background: p.key ? OG.highlight : "rgba(255,255,255,0.08)", color: p.key ? OG.ink : OG.white }}>
                <div style={{ display: "flex", fontSize: 20, fontWeight: 800, letterSpacing: 2, color: p.key ? OG.ink : OG.brandLight }}>{p.label}</div>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>{`${p.home}–${p.away}`}</div>
              </div>
            ))}
          </div>
        )}
        <Footer left={`${m.what} · Full time`} />
      </Content>
    </Frame>
  );
}

/** C. Sets sports: a scoreboard of sets, the winner's set count in gold. */
function ResultSets({ m, format, photo }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const rows = [m.home, m.away];
  const col = 112;
  return (
    <Frame height={h}>
      <Photo src={photo} overlay="linear-gradient(180deg, rgba(1,63,49,0.2) 0%, #013f31 44%)" />
      <Content>
        <Brand />
        <Spacer />
        <Headline text={m.headline} size={100} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44, background: "#0b2a22", border: "2px solid rgba(149,253,226,0.2)", borderRadius: 28 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "20px 28px", fontSize: 22, fontWeight: 800, letterSpacing: 2, color: OG.brandLight }}>
            <div style={{ display: "flex", flex: 1 }}>{m.what.toUpperCase()}</div>
            {m.periods.map((p) => (
              <div key={p.label} style={{ display: "flex", width: col, justifyContent: "center" }}>{p.label.toUpperCase()}</div>
            ))}
            <div style={{ display: "flex", width: 128, justifyContent: "center" }}>SETS</div>
          </div>
          {rows.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "22px 28px", borderTop: "2px solid rgba(149,253,226,0.15)" }}>
              <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 18, opacity: s.won || m.draw ? 1 : 0.85 }}>
                <OgCrestMark year={s.year} size={74} />
                <div style={{ display: "flex", fontFamily: HEAD, fontSize: nameSize(s.name, 44), fontWeight: 600 }}>{s.name}</div>
              </div>
              {m.periods.map((p) => {
                const mine = Number(i === 0 ? p.home : p.away);
                const theirs = Number(i === 0 ? p.away : p.home);
                return (
                  <div key={p.label} style={{ display: "flex", width: col, justifyContent: "center", fontSize: 44, fontWeight: mine > theirs ? 800 : 600, opacity: mine > theirs ? 1 : 0.55 }}>
                    {String(mine)}
                  </div>
                );
              })}
              <div style={{ display: "flex", width: 128, justifyContent: "center", fontFamily: HEAD, fontSize: 60, fontWeight: 700, borderRadius: 16, background: s.won ? OG.highlight : "transparent", color: s.won ? OG.ink : OG.white }}>
                {s.score}
              </div>
            </div>
          ))}
        </div>
        <Footer left={`${m.line}`} />
      </Content>
    </Frame>
  );
}

/** D. Races: a 1–2–3 podium with crests, names and times. */
function ResultRace({ m, format, photo }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const swim = m.art === "swimming";
  const order = [2, 1, 3];
  const tall: Record<number, number> = { 1: 340, 2: 240, 3: 176 };
  const fill: Record<number, string> = { 1: OG.highlight, 2: OG.silver, 3: OG.team[2] };
  return (
    <Frame height={h}>
      <Photo src={swim ? null : photo} overlay="linear-gradient(180deg, rgba(1,63,49,0.55) 0%, rgba(1,63,49,0.92) 42%, #013f31 70%)" />
      {swim && (
        // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
        <img src={wavesSvg()} width={1080} height={560} alt="" style={{ position: "absolute", left: 0, bottom: 0 }} />
      )}
      <Content>
        <Brand />
        <div style={{ display: "flex", marginTop: 40 }}>
          <Headline text={m.headline} size={116} />
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 28, fontWeight: 600, color: OG.brandLight }}>{swim ? "Swimming" : "Athletics"}</div>
        <Spacer />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          {order.map((place) => {
            const p = m.podium.find((x) => x.place === place);
            return (
              <div key={place} style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", gap: 14 }}>
                {p && <OgCrestMark year={p.year} size={place === 1 ? 180 : 140} />}
                <div style={{ display: "flex", fontSize: place === 1 ? 32 : 28, fontWeight: 800, maxWidth: 300 }}>{p?.name ?? ""}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: tall[place], borderRadius: "20px 20px 0 0", background: fill[place], color: OG.ink }}>
                  <div style={{ display: "flex", fontFamily: HEAD, fontSize: place === 1 ? 120 : 88, fontWeight: 700, lineHeight: 1 }}>{String(place)}</div>
                  <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>{p?.time ?? ""}</div>
                </div>
              </div>
            );
          })}
        </div>
        <Footer left={swim ? "Swimming · Final" : "Athletics · Final"} />
      </Content>
    </Frame>
  );
}

/** E–G. Games with no photo: the game drawn big, the headline, the score in a pill. */
function ResultGame({ m, format }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const story = format === "story";
  const win = m.home.won ? m.home : m.away;
  const lose = m.home.won ? m.away : m.home;
  const winCol = yc(win.year);
  return (
    <Frame height={h} bg={m.art === "gaming" ? "#0b2a22" : OG.pitch}>
      {m.art === "chess" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={boardSvg()} width={1080} height={540} alt="" style={{ position: "absolute", left: 0, bottom: 0 }} />
          <Fill style={{ backgroundImage: "linear-gradient(180deg, #013f31 40%, rgba(1,63,49,0) 80%)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={knightSvg(winCol)} width={480} height={640} alt="" style={{ position: "absolute", left: 560, top: story ? 860 : 460 }} />
        </>
      )}
      {m.art === "gaming" && (
        <>
          <Fill style={{ backgroundImage: "linear-gradient(rgba(149,253,226,0.07) 2px, transparent 2px), linear-gradient(90deg, rgba(149,253,226,0.07) 2px, transparent 2px)", backgroundSize: "54px 54px" }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={padSvg()} width={800} height={480} alt="" style={{ position: "absolute", left: 140, top: story ? 520 : 300, transform: "rotate(-12deg)" }} />
        </>
      )}
      {m.art === "ludo" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={ludoSvg()} width={840} height={840} alt="" style={{ position: "absolute", left: 540, top: story ? 380 : 180, transform: "rotate(14deg)", opacity: 0.9 }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={dieSvg()} width={240} height={240} alt="" style={{ position: "absolute", left: 540, top: story ? 520 : 340, transform: "rotate(-16deg)" }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={dieSvg()} width={190} height={190} alt="" style={{ position: "absolute", left: 810, top: story ? 720 : 660, transform: "rotate(22deg)" }} />
        </>
      )}
      {m.art === "connect4" && (
        // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
        <img src={connect4Svg(winCol, yc(lose.year))} width={560} height={484} alt="" style={{ position: "absolute", left: 560, top: story ? 560 : 360, transform: "rotate(8deg)" }} />
      )}
      <Content>
        <Brand right={m.art === "gaming" ? <Badge text="GG" bg={OG.brandLight} color="#0b2a22" size={64} /> : undefined} />
        {m.art !== "gaming" && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            <Headline text={m.headline} size={150} />
            <div style={{ display: "flex", marginTop: 28, fontSize: 32, fontWeight: 600, maxWidth: 480, lineHeight: 1.35 }}>{m.line}</div>
          </div>
        )}
        <Spacer />
        {m.art === "scrabble" && (
          <div style={{ display: "flex", gap: 14, marginBottom: 36 }}>
            {["W", "I", "N", `Y${win.year ?? ""}`].map((t, i) => (
              <div key={i} style={{ display: "flex", width: 104, height: 112, borderRadius: 12, alignItems: "center", justifyContent: "center", fontFamily: HEAD, fontSize: i === 3 ? 52 : 64, fontWeight: 700, color: OG.ink, background: i === 3 ? winCol : "#f3e3c3", boxShadow: `0 8px 0 ${i === 3 ? "rgba(0,0,0,0.3)" : "#c9b48d"}` }}>
                {t}
              </div>
            ))}
          </div>
        )}
        {m.art === "gaming" ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 3, color: OG.brandLight }}>{[m.what, m.stage].filter(Boolean).join(" · ").toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
              <div style={{ display: "flex", fontFamily: HEAD, fontSize: nameSize(m.home.name, 60), fontWeight: 700, maxWidth: 330, opacity: m.home.won || m.draw ? 1 : 0.8 }}>{m.home.name.toUpperCase()}</div>
              <div style={{ display: "flex", fontFamily: HEAD, fontSize: 168, fontWeight: 700, lineHeight: 1, color: OG.brandLight }}>{`${m.home.score}–${m.away.score}`}</div>
              <div style={{ display: "flex", fontFamily: HEAD, fontSize: nameSize(m.away.name, 60), fontWeight: 700, maxWidth: 330, justifyContent: "flex-end", opacity: m.away.won || m.draw ? 1 : 0.8 }}>{m.away.name.toUpperCase()}</div>
            </div>
            <div style={{ display: "flex", height: 12, borderRadius: 6, marginTop: 20, overflow: "hidden" }}>
              <div style={{ display: "flex", flex: Math.max(1, Number(m.home.score) || 1), background: yc(m.home.year) }} />
              <div style={{ display: "flex", flex: Math.max(1, Number(m.away.score) || 1), background: yc(m.away.year) }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 24, alignSelf: "flex-start", background: "rgba(11,42,34,0.88)", border: "2px solid rgba(149,253,226,0.2)", borderRadius: 28, padding: "20px 28px" }}>
            <OgCrestMark year={m.home.year} size={86} />
            <div style={{ display: "flex", fontFamily: HEAD, fontSize: 76, fontWeight: 700 }}>{`${m.home.score}–${m.away.score}`}</div>
            <OgCrestMark year={m.away.year} size={86} />
          </div>
        )}
        <Footer left={[m.what, m.stage].filter(Boolean).join(" · ")} />
      </Content>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Moments
// ---------------------------------------------------------------------------

/** A crest on a pitch-green disc, so it stands out on its own year's colour. */
function PosterCrest({ year, size }: { year: number | null; size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size * 1.25, height: size * 1.25, borderRadius: 999, background: OG.pitch, border: `8px solid ${OG.white}` }}>
      <OgCrestMark year={year} size={size * 0.8} />
    </div>
  );
}

/** H. Before kick-off: the two years split diagonally, VS, the day and time. */
function Poster({ m, format, kickoffLabel }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const crest = format === "story" ? 300 : 230;
  return (
    <Frame height={h}>
      <Fill style={{ backgroundImage: `linear-gradient(160deg, ${yc(m.home.year)} 0%, ${yc(m.home.year)} 47%, ${OG.pitch} 47%, ${OG.pitch} 53%, ${yc(m.away.year)} 53%, ${yc(m.away.year)} 100%)` }} />
      <Content pad="56px 48px 48px">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
          <img src={seesEmblemDataUri({ fg: OG.pitch, bg: null, inset: 1 })} width={52} height={52} alt="" />
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 3, color: OG.pitch }}>{[m.what, m.stage].filter(Boolean).join(" · ").toUpperCase()}</div>
        </div>
        <Spacer />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <PosterCrest year={m.home.year} size={crest} />
          <div style={{ display: "flex", fontFamily: HEAD, fontSize: nameSize(m.home.name, 92), fontWeight: 700, color: OG.pitch, lineHeight: 1 }}>{m.home.name.toUpperCase()}</div>
        </div>
        <div style={{ display: "flex", alignSelf: "center", alignItems: "center", justifyContent: "center", width: 176, height: 176, margin: "28px 0", borderRadius: 999, background: OG.pitch, color: OG.highlight, fontFamily: HEAD, fontSize: 110, fontWeight: 700, border: `12px solid ${OG.white}` }}>
          VS
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", fontFamily: HEAD, fontSize: nameSize(m.away.name, 92), fontWeight: 700, color: OG.ink, lineHeight: 1 }}>{m.away.name.toUpperCase()}</div>
          <PosterCrest year={m.away.year} size={crest} />
        </div>
        <Spacer />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, background: OG.pitch, borderRadius: 32, padding: "32px 36px" }}>
          <div style={{ display: "flex", fontFamily: HEAD, fontSize: 68, fontWeight: 700, lineHeight: 1 }}>{kickoffLabel}</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: OG.brandLight }}>{`Who are you backing? Follow it live at ${SITE}`}</div>
        </div>
      </Content>
    </Frame>
  );
}

/** I. During play: LIVE and the minute, the score, who scored. */
function Live({ m, format, photo }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const hs = Number(m.home.score);
  const as = Number(m.away.score);
  const headline = hs === as ? (hs === 0 ? "It's on." : "All square.") : `${hs > as ? m.home.name : m.away.name} lead.`;
  const scorers = [m.home.scorers, m.away.scorers].filter(Boolean).join(" · ");
  return (
    <Frame height={h}>
      <Photo src={photo} overlay="linear-gradient(180deg, rgba(1,63,49,0.5) 0%, rgba(1,63,49,0.25) 35%, rgba(1,63,49,0.95) 62%, #013f31 80%)" />
      <Content pad="56px 48px 48px">
        <Brand
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: OG.live, color: OG.white, fontSize: 28, fontWeight: 800, letterSpacing: 2, padding: "12px 24px", borderRadius: 999 }}>
              <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: OG.white }} />
              {m.clock ? `LIVE · ${m.clock}` : "LIVE"}
            </div>
          }
        />
        <Spacer />
        <Headline text={headline} size={100} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 40, background: "rgba(11,42,34,0.9)", border: "2px solid rgba(149,253,226,0.2)", borderRadius: 32, padding: "28px 32px" }}>
          <SideRow s={m.home} crest={90} scoreSize={100} />
          <SideRow s={m.away} crest={90} scoreSize={100} />
          {scorers && <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,0.8)" }}>{scorers}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 28, background: OG.brandLight, color: OG.pitch, borderRadius: 28, padding: "26px 32px" }}>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 800 }}>Watch it live, react with everyone</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600 }}>{SITE}</div>
        </div>
      </Content>
    </Frame>
  );
}

function FaceOrCrest({ face, year, size }: { face: string | null; year: number | null; size: number }) {
  if (!face) return <OgCrestMark year={year} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
    <img src={face} width={size} height={size} alt="" style={{ borderRadius: 999, border: `${Math.round(size * 0.05)}px solid ${yc(year)}`, objectFit: "cover" }} />
  );
}

/** J. The latest goal: the scorer's face, GOAL!, the score, the fantasy points. */
function Goal({ m, format, face, fantasyPoints }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const p = m.player;
  const col = yc(p?.year ?? null);
  const faceSize = format === "story" ? 460 : 380;
  return (
    <Frame height={h}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
      <img src={raysSvg(col)} width={1080} height={1920} alt="" style={{ position: "absolute", left: 0, top: format === "story" ? 0 : -330 }} />
      <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: format === "story" ? 260 : 170, justifyContent: "center", fontFamily: HEAD, fontSize: 380, fontWeight: 700, lineHeight: 1, color: "rgba(149,253,226,0.12)", letterSpacing: -8 }}>
        GOAL
      </div>
      <Content pad="56px 48px 48px">
        <Brand right={<div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 2.5, color: OG.brandLight }}>{`${m.what.toUpperCase()}${p?.minute ? ` · ${p.minute}` : ""}`}</div>} />
        <Spacer />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", position: "relative" }}>
            <FaceOrCrest face={face} year={p?.year ?? null} size={faceSize} />
            <div style={{ display: "flex", position: "absolute", right: -20, bottom: 20, fontFamily: HEAD, fontSize: 64, fontWeight: 700, background: OG.highlight, color: OG.ink, padding: "4px 28px", borderRadius: 20, transform: "rotate(-6deg)" }}>GOAL!</div>
          </div>
          <div style={{ display: "flex", marginTop: 40, fontFamily: HEAD, fontSize: nameSize(p?.name ?? "", 104), fontWeight: 700, textTransform: "uppercase", lineHeight: 1 }}>{p?.name ?? ""}</div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 30, fontWeight: 700, color: col }}>{[p?.year ? `Year ${p.year}` : null, p?.role].filter(Boolean).join(" · ")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 36, background: "rgba(11,42,34,0.9)", borderRadius: 28, padding: "18px 34px" }}>
            <div style={{ display: "flex", fontFamily: HEAD, fontSize: 44, fontWeight: 600 }}>{m.home.year ? `Y${m.home.year}` : m.home.name}</div>
            <div style={{ display: "flex", fontFamily: HEAD, fontSize: 80, fontWeight: 700, lineHeight: 1 }}>{`${m.home.score}–${m.away.score}`}</div>
            <div style={{ display: "flex", fontFamily: HEAD, fontSize: 44, fontWeight: 600, opacity: 0.75 }}>{m.away.year ? `Y${m.away.year}` : m.away.name}</div>
          </div>
        </div>
        <Spacer />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, background: OG.brandLight, color: OG.pitch, borderRadius: 28, padding: "24px 32px" }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800 }}>{fantasyPoints ? `+${fantasyPoints} fantasy points for every manager who picked them` : "Follow every goal live"}</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>{SITE}</div>
        </div>
      </Content>
    </Frame>
  );
}

function Star() {
  // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
  return <img src={starSvg(OG.highlight)} width={80} height={80} alt="" />;
}

/** K. Player of the match: the face full width, the star, their numbers. */
function Motm({ m, format, face, cheers }: MatchCardProps) {
  const h = MATCH_SIZES[format].height;
  const p = m.player;
  const photoH = format === "story" ? 1120 : 760;
  return (
    <Frame height={h} bg="#0b2a22">
      {face ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
        <img src={face} width={1080} height={photoH} alt="" style={{ position: "absolute", left: 0, top: 0, width: 1080, height: photoH, objectFit: "cover" }} />
      ) : (
        <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1080, height: photoH, alignItems: "center", justifyContent: "center", background: yc(p?.year ?? null) }}>
          <OgCrestMark year={p?.year ?? null} size={420} />
        </div>
      )}
      <Fill style={{ backgroundImage: `linear-gradient(180deg, rgba(11,42,34,0) ${Math.round((photoH / h) * 50)}%, rgba(11,42,34,0.85) ${Math.round((photoH / h) * 88)}%, #0b2a22 ${Math.round((photoH / h) * 100)}%)` }} />
      <div style={{ display: "flex", position: "absolute", left: 0, right: 0, top: 0, height: 16, background: OG.highlight }} />
      <Content pad="56px 48px 48px">
        <Brand right={<Star />} />
        <Spacer />
        <div style={{ display: "flex", alignSelf: "flex-start", fontSize: 24, fontWeight: 800, letterSpacing: 3, background: OG.highlight, color: OG.ink, padding: "8px 20px", borderRadius: 12 }}>PLAYER OF THE MATCH</div>
        <div style={{ display: "flex", marginTop: 24, fontFamily: HEAD, fontSize: nameSize(p?.name ?? "", 152), fontWeight: 700, lineHeight: 0.9, textTransform: "uppercase" }}>{p?.name ?? ""}</div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 30, fontWeight: 700, color: yc(p?.year ?? null) }}>{[p?.year ? `Year ${p.year}` : null, p?.role].filter(Boolean).join(" · ")}</div>
        <div style={{ display: "flex", gap: 16, marginTop: 36 }}>
          {[
            [m.home.score + "–" + m.away.score, "FINAL SCORE"],
            ...(cheers ? [[String(cheers), "FAN CHEERS"]] : []),
          ].map(([v, l]) => (
            <div key={l} style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", background: "rgba(255,255,255,0.07)", borderRadius: 24, padding: "18px 0" }}>
              <div style={{ display: "flex", fontFamily: HEAD, fontSize: 60, fontWeight: 700 }}>{v}</div>
              <div style={{ display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: 2, color: OG.brandLight }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 26, color: "rgba(255,255,255,0.8)" }}>{`${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name} · ${m.what}`}</div>
        <Footer left="Tag them" />
      </Content>
    </Frame>
  );
}

export function MatchCard(props: MatchCardProps) {
  const { m } = props;
  switch (m.card) {
    case "poster":
      return <Poster {...props} />;
    case "live":
      return <Live {...props} />;
    case "goal":
      return <Goal {...props} />;
    case "motm":
      return <Motm {...props} />;
    default:
      if (m.art === "basketball") return <ResultBasketball {...props} />;
      if (m.art === "sets") return <ResultSets {...props} />;
      if (m.art === "race" || m.art === "swimming") return <ResultRace {...props} />;
      if (["chess", "gaming", "ludo", "scrabble", "connect4"].includes(m.art)) return <ResultGame {...props} />;
      return <ResultClassic {...props} />;
  }
}
