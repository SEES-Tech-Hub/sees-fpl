import { ImageResponse } from "next/og";
import { OG } from "@/lib/design/og-colours";
import { OG_SIZE, OgFrame } from "@/lib/design/og-frame";
import { getSportPage } from "@/lib/live/public-pages";
import { formatWAT } from "@/lib/utils";

// Share image for a sport page: the sport and its next fixture (or how many are done).

export const alt = "A sport at SEES Games 2026";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const data = await getSportPage(sport);
  const next = data?.cards.find((c) => c.state.status === "scheduled" && c.kickoffAt);
  const done = data?.cards.filter((c) => c.state.status === "full_time" || c.state.status === "walkover").length ?? 0;
  const line = next
    ? `Next: ${next.home?.name ?? "TBD"} v ${next.away?.name ?? "TBD"} · ${formatWAT(next.kickoffAt!, "datetime")}`
    : data?.cards.length
      ? `${done} of ${data.cards.length} matches played`
      : "Fixtures coming soon";
  return new ImageResponse(
    (
      <OgFrame kicker="SEES GAMES 2026" title={data?.sport.name ?? "Sports"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 40, color: OG.brandLight, fontWeight: 700 }}>Fixtures · Live scores · Results</div>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.9 }}>{line}</div>
        </div>
      </OgFrame>
    ),
    size,
  );
}
