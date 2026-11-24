import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { seesEmblemDataUri } from "@/lib/design/sees-emblem";

// The PWA and notification icons (manifest, service worker), drawn from the
// SEES emblem. Same URLs as the old files in public/icons, so the manifest,
// the service worker and installed apps keep working.

const ICONS: Record<string, { size: number; inset: number; rounded: number }> = {
  "icon-192.png": { size: 192, inset: 0.72, rounded: 0 },
  "icon-512.png": { size: 512, inset: 0.72, rounded: 0 },
  // Android crops maskable icons to a circle or squircle: keep the emblem small.
  "icon-maskable-512.png": { size: 512, inset: 0.56, rounded: 0 },
  "apple-touch-icon.png": { size: 180, inset: 0.7, rounded: 0 },
};

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const { file } = await params;
  const icon = ICONS[file];
  if (!icon) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
    <img src={seesEmblemDataUri({ fg: OG.white, bg: OG.pitch, inset: icon.inset, rounded: icon.rounded })} width={icon.size} height={icon.size} alt="" />,
    { width: icon.size, height: icon.size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
