// TODO(Henry): swap for Fortune's `teamTone` in lib/teams.ts once the day-1
// kit lands (design system §4). Class names are written out in full so
// Tailwind can see them.

export const teamTone = {
  1: { fill: "bg-team-y1", ink: "text-team-y1-ink", ring: "ring-team-y1", kit: "fill-team-y1" },
  2: { fill: "bg-team-y2", ink: "text-team-y2-ink", ring: "ring-team-y2", kit: "fill-team-y2" },
  3: { fill: "bg-team-y3", ink: "text-team-y3-ink", ring: "ring-team-y3", kit: "fill-team-y3" },
  4: { fill: "bg-team-y4", ink: "text-team-y4-ink", ring: "ring-team-y4", kit: "fill-team-y4" },
  5: { fill: "bg-team-y5", ink: "text-team-y5-ink", ring: "ring-team-y5", kit: "fill-team-y5" },
} as const;

const NEUTRAL = { fill: "bg-muted", ink: "text-muted-foreground", ring: "ring-border", kit: "fill-muted" } as const;

export function toneFor(year: number | null | undefined) {
  return year && year in teamTone ? teamTone[year as keyof typeof teamTone] : NEUTRAL;
}

export const CLASS_LABEL: Record<number, string> = { 1: "SEES 31", 2: "SEES 30", 3: "SEES 29", 4: "SEES 28", 5: "SEES 26" };
