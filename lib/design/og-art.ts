import { OG } from "./og-colours";

// Drawings for the match share pictures (lib/design/og-match.tsx), as SVG
// data URIs: next/og draws them as images. Each takes the colour it should
// wear (usually the winning year's).

export const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const INK = OG.ink;

/** A chess knight standing on its base. */
export const knightSvg = (fill: string) =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">
  <path d="M30 150 H95 V138 H30 Z" fill="${fill}"/>
  <path d="M36 136 C38 112 44 100 54 92 C40 90 26 86 22 74 C20 66 26 60 34 60 C42 58 50 56 56 48 C50 46 48 40 52 34 L58 22 L64 30 C80 32 94 48 96 72 C98 98 90 116 88 136 Z" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="64" cy="48" r="3.5" fill="${INK}"/>
  <path d="M70 40 C82 50 86 70 82 96" stroke="${INK}" stroke-width="2.5" fill="none" opacity="0.5"/>
</svg>`);

/** A board fading away: alternate squares in mint on the deep green. */
export const boardSvg = () => {
  const cells: string[] = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) if ((r + c) % 2 === 0) cells.push(`<rect x="${c * 90}" y="${r * 90}" width="90" height="90" fill="${OG.brandLight}" opacity="0.16"/>`);
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 540"><rect width="1080" height="540" fill="#0b2a22"/>${cells.join("")}</svg>`);
};

/** A game controller with the five year colours on its buttons. */
export const padSvg = () =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
  <path d="M52 14 H148 C176 14 196 44 196 82 C196 104 184 116 170 116 C156 116 148 104 138 92 H62 C52 104 44 116 30 116 C16 116 4 104 4 82 C4 44 24 14 52 14 Z" fill="#17251f" stroke="${OG.brandLight}" stroke-width="3"/>
  <rect x="38" y="44" width="12" height="36" rx="3" fill="#edf8f2"/>
  <rect x="26" y="56" width="36" height="12" rx="3" fill="#edf8f2"/>
  <circle cx="150" cy="44" r="8" fill="${OG.team[1]}"/>
  <circle cx="166" cy="60" r="8" fill="${OG.team[2]}"/>
  <circle cx="134" cy="60" r="8" fill="${OG.team[4]}"/>
  <circle cx="150" cy="76" r="8" fill="${OG.team[5]}"/>
  <circle cx="78" cy="88" r="11" fill="#0b2a22" stroke="${OG.brandLight}" stroke-width="2"/>
  <circle cx="122" cy="88" r="11" fill="#0b2a22" stroke="${OG.brandLight}" stroke-width="2"/>
  <rect x="88" y="40" width="10" height="5" rx="2.5" fill="${OG.brandLight}"/>
  <rect x="102" y="40" width="10" height="5" rx="2.5" fill="${OG.brandLight}"/>
</svg>`);

/** A die showing six. */
export const dieSvg = () =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
  <rect x="2" y="2" width="56" height="56" rx="10" fill="#ffffff"/>
  ${[16, 30, 44].map((y) => `<circle cx="16" cy="${y}" r="5" fill="${INK}"/><circle cx="44" cy="${y}" r="5" fill="${INK}"/>`).join("")}
</svg>`);

/** A Ludo board: four homes in four year colours around a pitch-green centre. */
export const ludoSvg = () =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">
  <rect x="0" y="0" width="205" height="205" rx="18" fill="${OG.team[1]}"/>
  <rect x="215" y="0" width="205" height="205" rx="18" fill="${OG.team[2]}"/>
  <rect x="0" y="215" width="205" height="205" rx="18" fill="${OG.team[4]}"/>
  <rect x="215" y="215" width="205" height="205" rx="18" fill="${OG.team[5]}"/>
  <circle cx="210" cy="210" r="56" fill="${OG.pitch}"/>
</svg>`);

/** Connect Four: a frame of holes, some filled with the two sides' colours. */
export const connect4Svg = (a: string, b: string) => {
  const discs: string[] = [];
  const pattern = ["......a", ".....ab", "....aab", "...abab", "..baaab", ".bbabab"];
  pattern.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const fill = ch === "a" ? a : ch === "b" ? b : "#0b2a22";
      discs.push(`<circle cx="${40 + c * 60}" cy="${40 + r * 60}" r="24" fill="${fill}"/>`);
    }),
  );
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 380"><rect width="440" height="380" rx="22" fill="#2b6cb0"/>${discs.join("")}</svg>`);
};

/** A basketball. */
export const basketballSvg = () =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="46" fill="#ff7a1a" stroke="#1a0f05" stroke-width="2.5"/>
  <path d="M4 50 H96 M50 4 V96" stroke="#1a0f05" stroke-width="2.5" fill="none"/>
  <path d="M18 18 C34 34 34 66 18 82 M82 18 C66 34 66 66 82 82" stroke="#1a0f05" stroke-width="2.5" fill="none"/>
</svg>`);

/** Rays bursting out from a point, in the given colour (the goal card). */
export const raysSvg = (colour: string) => {
  const rays: string[] = [];
  for (let i = 0; i < 30; i++) {
    const a = (i * 12 * Math.PI) / 180;
    const b = ((i * 12 + 6) * Math.PI) / 180;
    const r = 1600;
    rays.push(`<path d="M540 760 L${540 + r * Math.cos(a)} ${760 + r * Math.sin(a)} L${540 + r * Math.cos(b)} ${760 + r * Math.sin(b)} Z" fill="${colour}" opacity="0.22"/>`);
  }
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920">${rays.join("")}</svg>`);
};

/** Pool waves (swimming). */
export const wavesSvg = () => {
  const lines: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = 40 + i * 60;
    lines.push(`<path d="M0 ${y} Q 67.5 ${y - 22} 135 ${y} T 270 ${y} T 405 ${y} T 540 ${y} T 675 ${y} T 810 ${y} T 945 ${y} T 1080 ${y}" stroke="${OG.brandLight}" stroke-width="5" fill="none" opacity="0.18"/>`);
  }
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 560">${lines.join("")}</svg>`);
};

/** A five-pointed star. */
export const starSvg = (fill: string) =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="${fill}"/></svg>`);
