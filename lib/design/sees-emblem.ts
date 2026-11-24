// The SEES emblem as an SVG string, for app icons, the favicon and anything
// else drawn outside React (next/og, manifests). Same drawing as
// components/brand/sees-mark.tsx. Colours are plain hex because icons are
// read by the OS, not the page (see lib/design/og-colours.ts).

const SIDE = [
  { d: "M50 33 V14", end: [50, 10] },
  { d: "M43 35 V26 L35 18", end: [32.5, 15.5] },
  { d: "M57 35 V26 L65 18", end: [67.5, 15.5] },
];

/**
 * @param fg      emblem colour
 * @param bg      background colour, or null for transparent
 * @param inset   how much of the canvas the emblem fills (1 = edge to edge);
 *                maskable icons need about 0.6 to stay in Android's safe zone
 * @param rounded corner radius of the background (0 to 50; 50 is a circle)
 */
export function seesEmblemSvg({
  fg,
  bg,
  inset = 0.78,
  rounded = 22,
}: {
  fg: string;
  bg: string | null;
  inset?: number;
  rounded?: number;
}): string {
  const traces = [0, 90, 180, 270]
    .map(
      (a) =>
        `<g transform="rotate(${a} 50 50)">${SIDE.map(
          (t) => `<path d="${t.d}"/><circle cx="${t.end[0]}" cy="${t.end[1]}" r="3.2"/>`,
        ).join("")}</g>`,
    )
    .join("");
  const scale = inset;
  const shift = (100 - 100 * scale) / 2;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`,
    bg ? `<rect width="100" height="100" rx="${rounded}" fill="${bg}"/>` : "",
    `<defs><mask id="m"><rect width="100" height="100" fill="white"/><circle cx="50" cy="50" r="10" stroke="black" stroke-width="3" fill="none"/></mask></defs>`,
    `<g transform="translate(${shift} ${shift}) scale(${scale})">`,
    `<g fill="none" stroke="${fg}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${traces}</g>`,
    `<circle cx="50" cy="50" r="18" fill="${fg}" mask="url(#m)"/>`,
    `<circle cx="50" cy="50" r="5.5" fill="${fg}"/>`,
    `</g></svg>`,
  ].join("");
}

export const seesEmblemDataUri = (opts: Parameters<typeof seesEmblemSvg>[0]) =>
  `data:image/svg+xml;base64,${Buffer.from(seesEmblemSvg(opts)).toString("base64")}`;
