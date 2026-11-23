// Share-card (Open Graph) images are drawn by next/og, which can't read the
// CSS variables in app/globals.css. These copy the light-theme tokens, and are
// used ONLY by opengraph-image files. If a token changes there, change it here.
export const OG = {
  pitch: "#013f31",
  brandLight: "#95fde2",
  highlight: "#ffb703",
  live: "#d92d20",
  white: "#ffffff",
  ink: "#0f0f0f",
  team: { 1: "#38bdf8", 2: "#ff7a59", 3: "#a78bfa", 4: "#9be15d", 5: "#f472b6" } as Record<number, string>,
};
