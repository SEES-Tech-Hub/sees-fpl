import type { MetadataRoute } from "next";

// PWA manifest. Owner: Samuel (PWA, push). PNG icons (192, 512, maskable)
// still need exporting from the SEES logo; the SVG covers modern browsers.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SEES Games Hub",
    short_name: "SEES Games",
    description: "Live scores and fantasy football for SEES Games 2026.",
    start_url: "/",
    display: "standalone",
    background_color: "#013f31",
    theme_color: "#013f31",
    icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
