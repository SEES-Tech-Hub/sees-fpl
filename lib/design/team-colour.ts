/** A year team's colour as a CSS value (for gradients, glows and inline styles). */
export const teamColour = (year: number | undefined | null) => (year ? `var(--team-y${year})` : "var(--muted)");
