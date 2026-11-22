import type { MetadataRoute } from "next";

// PWA manifest. Owner: Samuel (PWA, push).
// The colours are the one place hex values appear outside app/globals.css:
// manifests are read by the OS, not the page, so they can't use CSS tokens.
// Keep them in step with --brand in app/globals.css.
// PNG icons are generated from public/icons/icon.svg (logo on the brand green);
// the maskable one keeps the logo inside Android's central safe zone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SEES Games Hub",
    short_name: "SEES Games",
    description: "Live scores and fantasy football for SEES Games 2026.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#013f31",
    theme_color: "#013f31",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
