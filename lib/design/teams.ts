export const teamTone = {
 1: { fill: "bg-team-y1", ink: "text-team-y1-ink", ring: "ring-team-y1" },
 2: { fill: "bg-team-y2", ink: "text-team-y2-ink", ring: "ring-team-y2" },
 3: { fill: "bg-team-y3", ink: "text-team-y3-ink", ring: "ring-team-y3" },
 4: { fill: "bg-team-y4", ink: "text-team-y4-ink", ring: "ring-team-y4" },
 5: { fill: "bg-team-y5", ink: "text-team-y5-ink", ring: "ring-team-y5" },
} as const;

export type TeamId = keyof typeof teamTone;