import { CREST_CLASS, crestShape } from "./crest";
import { OG } from "./og-colours";

// The year crest for share images (next/og). next/og draws an SVG as a
// picture without the page's fonts, so the shapes come from the same paths
// as the app's crest (lib/design/crest.ts) as an image, and "Y3" and the
// class are real text laid over them. Always the "on green" version.

function svgUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The crest with its ribbon; `size` is the height in px. */
export function OgCrest({ year, size }: { year: number | null | undefined; size: number }) {
  const known = !!year && year >= 1 && year <= 5;
  const shape = crestShape(year);
  const fill = known ? OG.team[year!] : OG.neutral;
  const s = size / 124;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 124">
<g transform="translate(10 4)">
<path d="${shape}" fill="${OG.white}" opacity="0.22"/>
<path d="${shape}" fill="${fill}" transform="translate(50 56) scale(0.88) translate(-50 -56)"/>
${known ? `<path d="M30 36 H41 L46 31 H54 L59 36 H70" fill="none" stroke="${OG.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/><circle cx="27.5" cy="36" r="2.3" fill="none" stroke="${OG.ink}" stroke-width="2" opacity="0.5"/><circle cx="72.5" cy="36" r="2.3" fill="none" stroke="${OG.ink}" stroke-width="2" opacity="0.5"/>` : ""}
</g>
${known ? `<path d="M6 90 H22 V107 H6 L11.5 98.5 Z" fill="${OG.ribbonShade}"/><path d="M114 90 H98 V107 H114 L108.5 98.5 Z" fill="${OG.ribbonShade}"/><rect x="16" y="86" width="88" height="17" rx="1.5" fill="${OG.ink}"/>` : ""}
</svg>`;
  return (
    <div style={{ display: "flex", position: "relative", width: Math.round(120 * s), height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
      <img src={svgUri(svg)} width={Math.round(120 * s)} height={size} alt="" />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          top: Math.round((known ? 44 : 40) * s),
          justifyContent: "center",
          fontSize: Math.round((known ? 32 : 40) * s),
          fontWeight: 800,
          letterSpacing: -1,
          color: OG.ink,
          lineHeight: 1,
        }}
      >
        {known ? `Y${year}` : "?"}
      </div>
      {known && (
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            right: 0,
            top: Math.round(88.5 * s),
            justifyContent: "center",
            fontSize: Math.round(10.5 * s),
            fontWeight: 700,
            letterSpacing: 1.5 * s,
            color: OG.brandLight,
            lineHeight: 1,
          }}
        >
          {CREST_CLASS[year!]}
        </div>
      )}
    </div>
  );
}

/** The small mark (shape and "Y3" only), for rows in share images. */
export function OgCrestMark({ year, size }: { year: number | null | undefined; size: number }) {
  const known = !!year && year >= 1 && year <= 5;
  const shape = crestShape(year);
  const fill = known ? OG.team[year!] : OG.neutral;
  const s = size / 112;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112"><path d="${shape}" fill="${OG.white}" opacity="0.3"/><path d="${shape}" fill="${fill}" transform="translate(50 56) scale(0.84) translate(-50 -56)"/></svg>`;
  return (
    <div style={{ display: "flex", position: "relative", width: Math.round(100 * s), height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img> */}
      <img src={svgUri(svg)} width={Math.round(100 * s)} height={size} alt="" />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          right: 0,
          top: Math.round(38 * s),
          justifyContent: "center",
          fontSize: Math.round(44 * s),
          fontWeight: 800,
          letterSpacing: -1,
          color: OG.ink,
          lineHeight: 1,
        }}
      >
        {known ? `Y${year}` : "?"}
      </div>
    </div>
  );
}
