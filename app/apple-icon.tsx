import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { seesEmblemDataUri } from "@/lib/design/sees-emblem";

// iPhone Home Screen icon. iOS rounds the corners itself, so the square is full.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
    <img src={seesEmblemDataUri({ fg: OG.white, bg: OG.pitch, inset: 0.7, rounded: 0 })} width={180} height={180} alt="" />,
    size,
  );
}
