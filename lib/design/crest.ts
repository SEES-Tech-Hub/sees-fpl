// The year crests (design: the "SEES Year Logos" canvas, direction A2). Each
// year has its own shape, so the years stay apart even without colour:
// Y1 circle, Y2 shield, Y3 hexagon, Y4 diamond, Y5 crowned shield.
// Paths are drawn in a 100 × 112 box centred on (50, 56). Used by the app
// (components/brand/year-crest.tsx) and the share images (lib/design/og-crest.tsx).

export const CREST_BOX = { w: 100, h: 112 } as const;

export const CREST_SHAPES: Record<number, string> = {
  1: "M50 8 A48 48 0 1 1 49.99 8 Z",
  2: "M8 8 H92 V52 C92 80 72 98 50 108 C28 98 8 80 8 52 Z",
  3: "M50 4 L94 29 V83 L50 108 L6 83 V29 Z",
  4: "M50 2 L97 52 L50 110 L3 52 Z",
  5: "M8 14 L28 14 L39 4 L50 14 L61 4 L72 14 L92 14 V52 C92 80 72 98 50 108 C28 98 8 80 8 52 Z",
};

/** A plain circle for a side that isn't known yet (TBD). */
export const CREST_UNKNOWN = "M50 8 A48 48 0 1 1 49.99 8 Z";

export const CREST_SHAPE_NAME: Record<number, string> = { 1: "circle", 2: "shield", 3: "hexagon", 4: "diamond", 5: "crowned shield" };

/** Each year's class, as on the ribbon. (Year 5 is SEES 26 on purpose.) */
export const CREST_CLASS: Record<number, string> = { 1: "SEES 31", 2: "SEES 30", 3: "SEES 29", 4: "SEES 28", 5: "SEES 26" };

export const crestShape = (year: number | null | undefined) => (year && CREST_SHAPES[year]) || CREST_UNKNOWN;
