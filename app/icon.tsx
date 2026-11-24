import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { seesEmblemDataUri } from "@/lib/design/sees-emblem";

// The browser-tab favicon: the SEES emblem in white on the brand green.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
    <img src={seesEmblemDataUri({ fg: OG.white, bg: OG.pitch, inset: 0.86, rounded: 18 })} width={64} height={64} alt="" />,
    size,
  );
}
