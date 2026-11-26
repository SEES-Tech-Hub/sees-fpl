import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { RACE_SIZES, RaceImage, type RaceFormat } from "@/lib/design/og-race";
import { progressLine } from "@/lib/live/race";
import { getChampionshipProgress, getMedalTable } from "@/lib/live/results";

// The race for the championship as a picture to download or share:
// /championship/race-image/post (1080×1350) or /story (1080×1920). Made fresh
// on every request, so it always shows the latest standings.

export async function GET(_request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (format !== "post" && format !== "story") return new Response("Not found", { status: 404 });
  await connection();
  const [rows, progress] = await Promise.all([getMedalTable(), getChampionshipProgress()]);
  return new ImageResponse(<RaceImage format={format as RaceFormat} rows={rows} progress={progress} line={progressLine(progress, Date.now())} />, {
    ...RACE_SIZES[format as RaceFormat],
    headers: { "Cache-Control": "no-store" },
  });
}
