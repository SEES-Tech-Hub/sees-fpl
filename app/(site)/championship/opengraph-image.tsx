import { ImageResponse } from "next/og";
import { RACE_SIZES, RaceLinkImage } from "@/lib/design/og-race";
import { progressLine } from "@/lib/live/race";
import { getChampionshipProgress, getMedalTable } from "@/lib/live/results";

// What a pasted /championship link shows: the five years on the race track.

export const alt = "SEES Games 2026: the race for the championship";
export const size = RACE_SIZES.link;
export const contentType = "image/png";

export default async function Image() {
  const [rows, progress] = await Promise.all([getMedalTable(), getChampionshipProgress()]);
  return new ImageResponse(<RaceLinkImage rows={rows} progress={progress} line={progressLine(progress, null)} />, size);
}
